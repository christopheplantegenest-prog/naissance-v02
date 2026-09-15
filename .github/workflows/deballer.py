#!/usr/bin/env python3
"""ROBOT DE LIVRAISON — déballeur (version du robot : 2).

Commandes :
  inventaire   compte les colis et dit si un APK est demandé (sorties GitHub)
  traiter      traite chaque colis : contrôle, application, vérification,
               APK éventuel, commit + étiquette, ou refus complet
  site         prépare le dossier publié sur GitHub Pages

Bibliothèque standard uniquement. Aucune extraction avec « unzip » :
chaque fichier est contrôlé puis écrit un par un.
"""

import datetime
import json
import os
import posixpath
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import zipfile

RACINE = os.path.realpath(os.getcwd())
TEMP = os.environ.get("RUNNER_TEMP") or tempfile.gettempdir()
RAPPORT = os.path.join(TEMP, "rapport")
OUTILS = os.path.join(TEMP, "outils")
SITE = os.path.join(TEMP, "site")
APKS = os.path.join(TEMP, "apk")
ROBOT = os.path.dirname(os.path.realpath(__file__))

FICHIER_COLIS = "_livraison.json"
FICHIER_ETAT = "ETAT.md"
FICHIER_VERSION = "VERSION"
MARQUEUR_VERSION = "VERSION_AUTO"

# Limites contre les colis anormaux (bombe zip, etc.)
MAX_FICHIERS = 3000
MAX_OCTETS_FICHIER = 25 * 1024 * 1024
MAX_OCTETS_TOTAL = 80 * 1024 * 1024
MAX_OCTETS_DESCRIPTEUR = 64 * 1024

# Chemins qu'un colis ne peut ni écrire ni supprimer (comparaison en minuscules)
DOSSIERS_INTERDITS = (".git", ".github", "signature", "node_modules", "android")
FICHIERS_INTERDITS = (FICHIER_ETAT.lower(), FICHIER_VERSION.lower())

# Exclus du site publié
EXCLUS_SITE = {".git", ".github", "node_modules", "android", "signature", "tests"}

MOT_DE_PASSE_CLE = "naissance"  # clé personnelle, dépôt public assumé (décision du 15/09)
ALIAS_CLE = "naissance"
CHEMIN_CLE = os.path.join("signature", "naissance.jks")

RE_VERSION = re.compile(r"^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$")


class Refus(Exception):
    """Colis refusé : le message est affiché tel quel à l'utilisateur."""


# ---------------------------------------------------------------- outils

def sortie_github(cle, valeur):
    chemin = os.environ.get("GITHUB_OUTPUT")
    if chemin:
        with open(chemin, "a", encoding="utf-8") as f:
            f.write(f"{cle}={valeur}\n")
    print(f"[sortie] {cle}={valeur}")


def resume_github(texte):
    chemin = os.environ.get("GITHUB_STEP_SUMMARY")
    if chemin:
        with open(chemin, "a", encoding="utf-8") as f:
            f.write(texte + "\n")


def lancer(cmd, journal=None, cwd=None, verifier=True, env=None, delai=None):
    """Lance une commande, recopie sa sortie dans le journal, renvoie (code, sortie)."""
    try:
        res = subprocess.run(
            cmd, cwd=cwd or RACINE, env=env, text=True,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=delai,
        )
        code, sortie = res.returncode, res.stdout or ""
    except subprocess.TimeoutExpired as e:
        code, sortie = 124, (e.stdout or "") if isinstance(e.stdout, str) else ""
        sortie += f"\n[délai dépassé après {delai} s]"
    except FileNotFoundError:
        code, sortie = 127, f"[commande introuvable : {cmd[0]}]"
    if journal is not None:
        journal.write(f"\n$ {' '.join(cmd)}\n{sortie}\n[code {code}]\n")
        journal.flush()
    if verifier and code != 0:
        raise Refus(f"la commande « {' '.join(cmd[:3])} » a échoué (code {code})")
    return code, sortie


def git(*args, journal=None, verifier=True):
    return lancer(["git", *args], journal=journal, verifier=verifier)


def version_en_tuple(v):
    m = RE_VERSION.match(v or "")
    return tuple(int(x) for x in m.groups()) if m else None


def version_actuelle():
    chemin = os.path.join(RACINE, FICHIER_VERSION)
    try:
        with open(chemin, encoding="utf-8") as f:
            v = f.read().strip()
        return v if version_en_tuple(v) else "0.0.0"
    except OSError:
        return "0.0.0"


def etiquette_existe(v):
    code, _ = git("rev-parse", "-q", "--verify", f"refs/tags/v{v}", verifier=False)
    return code == 0


def lister_colis():
    return sorted(
        n for n in os.listdir(RACINE)
        if n.lower().endswith(".zip") and os.path.isfile(os.path.join(RACINE, n))
    )


def maintenant():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


# ------------------------------------------------------ contrôle des chemins

def controler_chemin(nom, origine):
    """Refuse tout chemin qui pourrait sortir du dépôt ou viser une zone interdite."""
    if not isinstance(nom, str) or not nom:
        raise Refus(f"{origine} : chemin vide")
    if "\\" in nom or "\x00" in nom or ":" in nom:
        raise Refus(f"{origine} : caractère interdit dans « {nom} »")
    if nom.startswith("/"):
        raise Refus(f"{origine} : chemin absolu interdit « {nom} »")
    morceaux = nom.split("/")
    if any(m in ("", ".", "..") for m in morceaux):
        raise Refus(f"{origine} : chemin irrégulier « {nom} »")
    if posixpath.normpath(nom) != nom:
        raise Refus(f"{origine} : chemin irrégulier « {nom} »")
    premier = morceaux[0].lower()
    if premier in DOSSIERS_INTERDITS:
        raise Refus(f"{origine} : zone protégée « {morceaux[0]}/ »")
    if len(morceaux) == 1 and (premier in FICHIERS_INTERDITS or premier.endswith(".zip")):
        raise Refus(f"{origine} : fichier protégé « {nom} »")
    cible = os.path.realpath(os.path.join(RACINE, *morceaux))
    if not cible.startswith(RACINE + os.sep):
        raise Refus(f"{origine} : « {nom} » sortirait du dépôt")
    return cible


# ---------------------------------------------------------- lecture du colis

def lire_descripteur(archive):
    try:
        info = archive.getinfo(FICHIER_COLIS)
    except KeyError:
        raise Refus(f"{FICHIER_COLIS} absent à la racine du zip")
    if info.file_size > MAX_OCTETS_DESCRIPTEUR:
        raise Refus(f"{FICHIER_COLIS} trop gros")
    try:
        d = json.loads(archive.read(info).decode("utf-8"))
    except Exception as e:
        raise Refus(f"{FICHIER_COLIS} illisible : {e}")
    if not isinstance(d, dict):
        raise Refus(f"{FICHIER_COLIS} doit être un objet JSON")

    action = d.get("action", "livraison")
    if action not in ("livraison", "retour"):
        raise Refus(f"action inconnue « {action} »")
    version = d.get("version")
    if not version_en_tuple(version):
        raise Refus(f"version absente ou mal écrite (attendu X.Y.Z) : « {version} »")
    if version_en_tuple(version) <= version_en_tuple(version_actuelle()):
        raise Refus(f"version {version} pas plus grande que la version actuelle {version_actuelle()}")
    if etiquette_existe(version):
        raise Refus(f"l'étiquette v{version} existe déjà")
    supprimer = d.get("supprimer", [])
    if not isinstance(supprimer, list) or not all(isinstance(s, str) for s in supprimer):
        raise Refus("« supprimer » doit être une liste de chemins")
    apk = d.get("apk", False)
    if not isinstance(apk, bool):
        raise Refus("« apk » doit valoir true ou false")
    description = d.get("description", "")
    if not isinstance(description, str):
        raise Refus("« description » doit être un texte")
    cible = d.get("cible")
    if action == "retour":
        if not version_en_tuple(cible):
            raise Refus("un retour arrière doit préciser « cible » (X.Y.Z)")
        if not etiquette_existe(cible):
            raise Refus(f"version cible v{cible} introuvable")
    return {
        "action": action,
        "version": version,
        "description": description.strip().replace("\n", " ")[:200],
        "supprimer": supprimer,
        "apk": apk,
        "cible": cible,
    }


def inventorier_archive(archive):
    """Contrôle toutes les entrées AVANT la moindre écriture."""
    entrees = []
    vus = set()
    total = 0
    infos = archive.infolist()
    if len(infos) > MAX_FICHIERS:
        raise Refus(f"trop de fichiers dans le zip ({len(infos)})")
    for info in infos:
        nom = info.filename
        if nom.endswith("/"):
            if nom.rstrip("/"):
                controler_chemin(nom.rstrip("/"), "dossier du zip")
            continue
        if nom == FICHIER_COLIS:
            continue
        mode = (info.external_attr >> 16) & 0o170000
        if mode == stat.S_IFLNK:
            raise Refus(f"lien symbolique interdit « {nom} »")
        if info.flag_bits & 0x1:
            raise Refus(f"fichier chiffré interdit « {nom} »")
        cible = controler_chemin(nom, "fichier du zip")
        cle = nom.lower()
        if cle in vus:
            raise Refus(f"fichier en double dans le zip « {nom} »")
        vus.add(cle)
        if info.file_size > MAX_OCTETS_FICHIER:
            raise Refus(f"fichier trop gros « {nom} »")
        total += info.file_size
        if total > MAX_OCTETS_TOTAL:
            raise Refus("contenu décompressé trop volumineux")
        entrees.append((info, nom, cible))
    return entrees


def extraire_vers(archive, entrees, dossier):
    """Extraction contrôlée dans un dossier temporaire, en comptant les octets réels."""
    total = 0
    for info, nom, _ in entrees:
        dest = os.path.join(dossier, *nom.split("/"))
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        ecrits = 0
        with archive.open(info) as src, open(dest, "wb") as dst:
            while True:
                bloc = src.read(65536)
                if not bloc:
                    break
                ecrits += len(bloc)
                total += len(bloc)
                if ecrits > MAX_OCTETS_FICHIER or total > MAX_OCTETS_TOTAL:
                    raise Refus(f"taille réelle anormale pour « {nom} »")
                dst.write(bloc)


def verifier_places(entrees):
    """Un fichier ne peut pas remplacer un dossier, ni un dossier traverser un fichier."""
    for _, nom, cible in entrees:
        if os.path.isdir(cible):
            raise Refus(f"« {nom} » existe déjà comme dossier")
        morceaux = nom.split("/")
        for i in range(1, len(morceaux)):
            parent = os.path.join(RACINE, *morceaux[:i])
            if os.path.lexists(parent) and not os.path.isdir(parent):
                raise Refus(f"« {'/'.join(morceaux[:i])} » est un fichier, pas un dossier")
            if os.path.islink(parent):
                raise Refus(f"« {'/'.join(morceaux[:i])} » est un lien, refusé")


# ----------------------------------------------------------- application

def appliquer_livraison(chemin_zip, journal):
    with zipfile.ZipFile(chemin_zip) as archive:
        mauvais = archive.testzip()
        if mauvais is not None:
            raise Refus(f"zip abîmé (fichier « {mauvais} »)")
        d = lire_descripteur(archive)
        entrees = inventorier_archive(archive)
        for s in d["supprimer"]:
            controler_chemin(s, "suppression")
        if d["action"] == "retour":
            if entrees:
                raise Refus("un colis de retour arrière ne doit contenir que _livraison.json")
            return d, []
        if not entrees and not d["supprimer"]:
            raise Refus("colis vide : aucun fichier et aucune suppression")
        verifier_places(entrees)
        tmp = tempfile.mkdtemp(prefix="colis-", dir=TEMP)
        try:
            extraire_vers(archive, entrees, tmp)
            for _, nom, cible in entrees:
                os.makedirs(os.path.dirname(cible), exist_ok=True)
                shutil.copyfile(os.path.join(tmp, *nom.split("/")), cible)
                journal.write(f"écrit : {nom}\n")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    avertissements = []
    for s in d["supprimer"]:
        cible = controler_chemin(s, "suppression")
        if os.path.isdir(cible) and not os.path.islink(cible):
            shutil.rmtree(cible)
            journal.write(f"supprimé (dossier) : {s}\n")
        elif os.path.lexists(cible):
            os.remove(cible)
            journal.write(f"supprimé : {s}\n")
        else:
            avertissements.append(f"à supprimer mais déjà absent : {s}")
    return d, avertissements


def appliquer_retour(cible, journal):
    """Remet l'arbre dans l'état de l'étiquette cible, sauf les zones du robot."""
    def protege(p):
        premier = p.split("/")[0].lower()
        return (premier in DOSSIERS_INTERDITS
                or (("/" not in p) and (premier in FICHIERS_INTERDITS or premier.endswith(".zip"))))

    _, sortie = git("ls-tree", "-r", "--name-only", "-z", f"v{cible}", journal=journal)
    dans_cible = {p for p in sortie.split("\x00") if p and not protege(p)}
    _, sortie = git("ls-files", "-z", journal=journal)
    actuels = {p for p in sortie.split("\x00") if p and not protege(p)}
    for p in sorted(actuels - dans_cible):
        git("rm", "-q", "--", p, journal=journal)
    liste = sorted(dans_cible)
    for i in range(0, len(liste), 200):
        git("checkout", f"v{cible}", "--", *liste[i:i + 200], journal=journal)


def injecter_version(v, journal):
    with open(os.path.join(RACINE, FICHIER_VERSION), "w", encoding="utf-8") as f:
        f.write(v + "\n")
    motif = re.compile(r'"[^"\n]*"')
    for dossier, sous, fichiers in os.walk(os.path.join(RACINE, "app")):
        for nom in fichiers:
            if not nom.endswith((".js", ".mjs")):
                continue
            chemin = os.path.join(dossier, nom)
            with open(chemin, encoding="utf-8") as f:
                lignes = f.read().split("\n")
            change = False
            for i, ligne in enumerate(lignes):
                if MARQUEUR_VERSION in ligne:
                    nouvelle = motif.sub(f'"{v}"', ligne, count=1)
                    if nouvelle != ligne:
                        lignes[i] = nouvelle
                        change = True
            if change:
                with open(chemin, "w", encoding="utf-8") as f:
                    f.write("\n".join(lignes))
                journal.write(f"version injectée : {os.path.relpath(chemin, RACINE)}\n")
    pkg = os.path.join(RACINE, "package.json")
    if os.path.isfile(pkg):
        try:
            with open(pkg, encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                data["version"] = v
                with open(pkg, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                    f.write("\n")
        except (OSError, ValueError):
            pass  # le vérificateur signalera un package.json invalide


def verifier_application(v, dossier_rapport, journal):
    code, sortie = lancer(
        ["node", os.path.join(ROBOT, "verifier.mjs"),
         "--version", v, "--rapport", dossier_rapport, "--outils", OUTILS],
        journal=journal, verifier=False, delai=900,
    )
    if code != 0:
        erreurs = [l for l in sortie.splitlines() if l.startswith("❌")]
        raise Refus("vérification échouée : " + (erreurs[0][2:] if erreurs else f"code {code}"))


# ------------------------------------------------------------------ APK

def version_code(v):
    a, b, c = version_en_tuple(v)
    return a * 1000000 + b * 1000 + c


def construire_apk(v, journal):
    if not os.path.isfile(os.path.join(RACINE, "capacitor.config.json")):
        raise Refus("APK demandé mais capacitor.config.json absent")
    lancer(["npm", "install", "--no-audit", "--no-fund"], journal=journal, delai=900)
    shutil.rmtree(os.path.join(RACINE, "android"), ignore_errors=True)
    lancer(["npx", "cap", "add", "android"], journal=journal, delai=900)

    gradle = os.path.join(RACINE, "android", "app", "build.gradle")
    with open(gradle, encoding="utf-8") as f:
        texte = f.read()
    texte, n1 = re.subn(r"versionCode\s+\d+", f"versionCode {version_code(v)}", texte)
    texte, n2 = re.subn(r'versionName\s+"[^"]*"', f'versionName "{v}"', texte)
    if not (n1 and n2):
        raise Refus("numéro de version introuvable dans le projet Android généré")
    with open(gradle, "w", encoding="utf-8") as f:
        f.write(texte)

    # Point d'extension : un colis peut adapter le projet Android (permissions…)
    preparateur = os.path.join(RACINE, "outils-android", "preparer.mjs")
    if os.path.isfile(preparateur):
        lancer(["node", preparateur, os.path.join(RACINE, "android")], journal=journal, delai=300)

    lancer(["npx", "cap", "sync", "android"], journal=journal, delai=900)

    cle = os.path.join(RACINE, CHEMIN_CLE)
    if not os.path.isfile(cle):
        os.makedirs(os.path.dirname(cle), exist_ok=True)
        lancer(["keytool", "-genkeypair", "-keystore", cle, "-alias", ALIAS_CLE,
                "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000",
                "-storepass", MOT_DE_PASSE_CLE, "-keypass", MOT_DE_PASSE_CLE,
                "-dname", "CN=Naissance"], journal=journal)
        journal.write("nouvelle clé de signature créée\n")

    gradlew = os.path.join(RACINE, "android", "gradlew")
    os.chmod(gradlew, 0o755)
    lancer([gradlew, "assembleRelease", "--no-daemon", "--stacktrace"],
           cwd=os.path.join(RACINE, "android"), journal=journal, delai=1800)

    brut = os.path.join(RACINE, "android", "app", "build", "outputs", "apk",
                        "release", "app-release-unsigned.apk")
    if not os.path.isfile(brut):
        raise Refus("APK non produit par la compilation")
    sdk = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
    if not sdk:
        raise Refus("SDK Android introuvable sur la machine du robot")
    outils_bt = os.path.join(sdk, "build-tools")
    versions = sorted(os.listdir(outils_bt),
                      key=lambda s: [int(x) if x.isdigit() else 0 for x in re.split(r"[.-]", s)])
    if not versions:
        raise Refus("build-tools Android introuvables")
    bt = os.path.join(outils_bt, versions[-1])
    aligne = os.path.join(TEMP, "aligne.apk")
    os.makedirs(APKS, exist_ok=True)
    final = os.path.join(APKS, f"naissance-v{v}.apk")
    lancer([os.path.join(bt, "zipalign"), "-p", "-f", "4", brut, aligne], journal=journal)
    lancer([os.path.join(bt, "apksigner"), "sign", "--ks", cle, "--ks-key-alias", ALIAS_CLE,
            "--ks-pass", f"pass:{MOT_DE_PASSE_CLE}", "--key-pass", f"pass:{MOT_DE_PASSE_CLE}",
            "--out", final, aligne], journal=journal)
    lancer([os.path.join(bt, "apksigner"), "verify", final], journal=journal)
    return final


# ----------------------------------------------------------- état + git

def ecrire_etat(ligne):
    chemin = os.path.join(RACINE, FICHIER_ETAT)
    historique = []
    try:
        with open(chemin, encoding="utf-8") as f:
            dans = False
            for l in f.read().splitlines():
                if l.startswith("## Historique"):
                    dans = True
                elif dans and l.startswith("- "):
                    historique.append(l)
    except OSError:
        pass
    historique = [f"- {ligne}"] + historique[:29]
    with open(chemin, "w", encoding="utf-8") as f:
        f.write("# État du robot de livraison\n\n")
        f.write("Fichier écrit par le robot. Ne pas le modifier.\n\n")
        f.write(f"## Dernier colis\n\n{ligne}\n\n")
        f.write(f"Version en ligne : **{version_actuelle()}**\n\n")
        f.write("## Historique\n\n" + "\n".join(historique) + "\n")


def ajouter_tout(journal):
    # Pas de pathspec « exclude » : git refuse (code 1) quand il vise un dossier
    # ignoré par .gitignore (cas de node_modules/ et android/ après un APK).
    # On ajoute tout, puis on retire de l'index ce que le robot ne doit jamais livrer.
    git("add", "-A", journal=journal)
    git("reset", "-q", "HEAD", "--", ".github", "node_modules", "android", journal=journal)


def traiter_un(nom_zip, journal, dossier_rapport):
    base = git("rev-parse", "HEAD")[1].strip()
    chemin = os.path.join(RACINE, nom_zip)
    avertissements = []
    try:
        if os.path.getsize(chemin) == 0:
            raise Refus("fichier zip vide")
        if not zipfile.is_zipfile(chemin):
            raise Refus("ce n'est pas un zip valide")
        with zipfile.ZipFile(chemin) as archive:
            d = lire_descripteur(archive)
        journal.write(f"colis : {json.dumps(d, ensure_ascii=False)}\n")

        if d["action"] == "retour":
            appliquer_livraison(chemin, journal)  # contrôle qu'il n'y a rien d'autre
            appliquer_retour(d["cible"], journal)
            if not d["description"]:
                d["description"] = f"retour à la version {d['cible']}"
        else:
            d, avertissements = appliquer_livraison(chemin, journal)

        injecter_version(d["version"], journal)
        verifier_application(d["version"], dossier_rapport, journal)
        apk = construire_apk(d["version"], journal) if d["apk"] else None

        os.remove(chemin)
        v = d["version"]
        ligne = f"✅ {maintenant()} — **v{v}** — {d['description'] or 'sans description'} ({nom_zip})"
        if avertissements:
            ligne += " — ⚠️ " + " ; ".join(avertissements)
        ecrire_etat(ligne)
        ajouter_tout(journal)
        if apk:
            git("add", "-f", "--", CHEMIN_CLE, journal=journal)
        git("commit", "-q", "-m", f"Livraison v{v} : {d['description'] or nom_zip} [skip ci]",
            journal=journal)
        git("tag", "-a", f"v{v}", "-m", d["description"] or f"version {v}", journal=journal)
        return {"ok": True, "version": v, "apk": apk, "message": ligne,
                "description": d["description"]}
    except Refus as e:
        return refuser(nom_zip, base, str(e), journal)
    except Exception as e:  # imprévu : on refuse aussi, sans rien casser
        return refuser(nom_zip, base, f"erreur imprévue du robot : {e!r}", journal)


def refuser(nom_zip, base, raison, journal):
    journal.write(f"\nREFUS : {raison}\n")
    git("reset", "-q", "--hard", base, journal=journal, verifier=False)
    git("clean", "-fdq", "-e", "node_modules", journal=journal, verifier=False)
    shutil.rmtree(os.path.join(RACINE, "android"), ignore_errors=True)
    chemin = os.path.join(RACINE, nom_zip)
    if os.path.lexists(chemin):
        os.remove(chemin)
    ligne = f"❌ {maintenant()} — colis **{nom_zip}** refusé — {raison}"
    ecrire_etat(ligne)
    git("add", "-A", "--", nom_zip, journal=journal, verifier=False)
    git("add", "--", FICHIER_ETAT, journal=journal, verifier=False)
    git("commit", "-q", "-m", f"Colis refusé : {nom_zip} [skip ci]", journal=journal, verifier=False)
    return {"ok": False, "version": None, "apk": None, "message": ligne}


def pousser(etiquettes, journal):
    branche = os.environ.get("GITHUB_REF_NAME") or git("rev-parse", "--abbrev-ref", "HEAD")[1].strip()
    for essai in range(4):
        code, _ = git("push", "--atomic", "origin", f"HEAD:refs/heads/{branche}",
                      *[f"refs/tags/{t}" for t in etiquettes], journal=journal, verifier=False)
        if code == 0:
            return True
        git("pull", "-q", "--rebase", "origin", branche, journal=journal, verifier=False)
        if os.path.isdir(os.path.join(RACINE, ".git", "rebase-merge")) or \
           os.path.isdir(os.path.join(RACINE, ".git", "rebase-apply")):
            git("rebase", "--abort", journal=journal, verifier=False)
            return False
        # après un rebase, les étiquettes doivent suivre les nouveaux commits
        for t in etiquettes:
            _, sujet = git("log", "-1", "--format=%H", f"--grep=^Livraison {t} ", journal=journal,
                           verifier=False)
            if sujet.strip():
                git("tag", "-f", "-a", t, sujet.strip(), "-m", f"version {t[1:]}",
                    journal=journal, verifier=False)
    return False


# ------------------------------------------------------------- commandes

def cmd_inventaire():
    colis = lister_colis()
    apk = "non"
    for nom in colis:
        try:
            with zipfile.ZipFile(os.path.join(RACINE, nom)) as a:
                d = json.loads(a.read(FICHIER_COLIS).decode("utf-8"))
                if isinstance(d, dict) and d.get("apk") is True:
                    apk = "oui"
        except Exception:
            pass  # le vrai contrôle se fait dans « traiter »
    sortie_github("colis", str(len(colis)))
    sortie_github("apk", apk)


def cmd_traiter():
    os.makedirs(RAPPORT, exist_ok=True)
    git("config", "user.name", "github-actions[bot]")
    git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")

    colis = lister_colis()
    resultats = []
    with open(os.path.join(RAPPORT, "journal-du-robot.txt"), "a", encoding="utf-8") as journal:
        journal.write(f"=== passage du {maintenant()} — {len(colis)} colis ===\n")
        for nom in colis:
            dossier = os.path.join(RAPPORT, re.sub(r"[^A-Za-z0-9._-]", "_", nom))
            os.makedirs(dossier, exist_ok=True)
            journal.write(f"\n=== colis {nom} ===\n")
            r = traiter_un(nom, journal, dossier)
            r["zip"] = nom
            resultats.append(r)
            print(r["message"])

        etiquettes = [f"v{r['version']}" for r in resultats if r["ok"]]
        pousse = True
        if resultats:
            pousse = pousser(etiquettes, journal)
            if not pousse:
                journal.write("\nÉCHEC DE L'ENVOI vers GitHub\n")

        publies = []
        if pousse:
            for r in resultats:
                if r["ok"] and r["apk"]:
                    code, _ = lancer(
                        ["gh", "release", "create", f"v{r['version']}", r["apk"],
                         "--title", f"Naissance v{r['version']}",
                         "--notes", r["description"] or f"Version {r['version']}"],
                        journal=journal, verifier=False)
                    if code == 0:
                        publies.append(r["version"])

    succes = any(r["ok"] for r in resultats)
    echec = (not pousse) or any(not r["ok"] for r in resultats)
    manuel = os.environ.get("GITHUB_EVENT_NAME") == "workflow_dispatch"
    sortie_github("publier", "true" if pousse and (succes or manuel) else "false")
    sortie_github("echec", "true" if echec else "false")

    lignes = ["## Robot de livraison", ""]
    if not resultats:
        lignes.append("Aucun colis à traiter." + (" Republication du site." if manuel else ""))
    for r in resultats:
        lignes.append(f"- {r['message']}")
    if not pousse:
        lignes.append("- ❌ l'envoi des résultats vers GitHub a échoué : rien n'a été modifié")
    for v in publies:
        lignes.append(f"- 📦 APK v{v} publié dans les Releases")
    resume_github("\n".join(lignes))


def cmd_site():
    shutil.rmtree(SITE, ignore_errors=True)
    os.makedirs(SITE)
    for nom in os.listdir(RACINE):
        if nom in EXCLUS_SITE or nom.lower().endswith(".zip"):
            continue
        src = os.path.join(RACINE, nom)
        if os.path.islink(src):
            continue
        if os.path.isdir(src):
            shutil.copytree(src, os.path.join(SITE, nom), symlinks=False,
                            ignore=shutil.ignore_patterns(".git", "node_modules"))
        else:
            shutil.copy2(src, os.path.join(SITE, nom))
    print(f"site prêt : {sorted(os.listdir(SITE))}")


if __name__ == "__main__":
    commandes = {"inventaire": cmd_inventaire, "traiter": cmd_traiter, "site": cmd_site}
    if len(sys.argv) != 2 or sys.argv[1] not in commandes:
        print("usage : deballer.py inventaire|traiter|site")
        sys.exit(2)
    commandes[sys.argv[1]]()
