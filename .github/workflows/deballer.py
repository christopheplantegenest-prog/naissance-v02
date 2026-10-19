#!/usr/bin/env python3
"""ROBOT DE LIVRAISON — déballeur (version du robot : 2).

Commandes :
  inventaire   compte les colis et dit si un APK est demandé (sorties GitHub)
  traiter      traite chaque colis : contrôle, application, vérification,
               APK éventuel, commit + étiquette, ou refus complet
  site         prépare le dossier publié sur GitHub Pages

Version 2 (livraison séparée, voir la section VERSION 2 en fin de fichier) :
  inventaire2  J-Inventaire : décrit le colis et l'arbre attendu (aucun code du colis)
  controler    J-Contrôle : reconstruit, vérifie, APK (sorties non fiables)
  livrer       J-Livraison : revérifie, reconstruit le commit, pousse sans rebase

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


# =====================================================================
# VERSION 2 — livraison séparée (AT-9, conception CONCEPTION_LIVRAISON_SEPAREE.md)
#
#   inventaire2  J-Inventaire : décrit le colis et calcule l'arbre attendu,
#                sans exécuter aucun code du colis (sorties de confiance)
#   controler    J-Contrôle : reconstruit le même arbre, puis exécute la
#                vérification (et l'APK) ; ses sorties ne sont PAS fiables
#   livrer       J-Livraison : revérifie tout, reconstruit lui-même le commit
#                et pousse main + étiquette en une fois, sans rebase
#
# Les commandes de la version 1 (inventaire, traiter, site) sont inchangées.
# Règle : en cas de doute, on s'arrête (Arret) sans rien écrire ; un colis
# interdit est refusé (Refus) et ce refus est inscrit par J-Livraison.
# =====================================================================

import hashlib
import io
import unicodedata

BRANCHE_LIVRAISON = "main"
DISTANT = "origin"
NOM_ROBOT = "github-actions[bot]"
COURRIEL_ROBOT = "41898282+github-actions[bot]@users.noreply.github.com"
DOSSIER_CONTROLE = os.path.join(TEMP, "controle-apk")
APK_CONTROLE = os.path.join(DOSSIER_CONTROLE, "app.apk")
APK_MAX_OCTETS = 100 * 1024 * 1024
MOTIF_MAX = 300

# Chemins privilégiés (P1) : exécutés avec un secret ou décidant d'une autorisation.
# Ils ne changent que par dépôt manuel de Christophe, comme .github.
PRIVILEGIES_MOTIFS = (re.compile(r"^outils-atelier/auto-[^/]*\.mjs$"),)
PRIVILEGIES_FIXES = (
    "app/atelier/auto.js", "app/atelier/budget.js", "app/atelier/chantier.js",
    "app/atelier/empreinte.js", "app/atelier/journal.js", "app/atelier/mission.js",
    "app/atelier/parcours.js", "app/atelier/verification.js",
)
# Dossiers où un package.json changerait le type des modules privilégiés
DOSSIERS_SANS_PACKAGE = ("app", "outils-atelier")
CHAMPS_PACKAGE_PROTEGES = ("type", "imports", "exports")
FICHIERS_CONFIG_GIT = (".gitattributes", ".gitignore", ".gitmodules", ".lfsconfig")

RE_HEX40 = re.compile(r"^[0-9a-f]{40}$")
RE_HEX64 = re.compile(r"^[0-9a-f]{64}$")
RE_IMPORT = re.compile(
    r"""(?:^|[;\s])(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]"""
    r"""|(?:^|[;\s])import\s*['"]([^'"]+)['"]""",
    re.M)
RE_DYNAMIQUE = re.compile(r"\bimport\s*\(|\brequire\s*\(|\bcreateRequire\b")


class Arret(Exception):
    """Situation ambiguë ou incohérente : on s'arrête sans rien écrire."""


# ------------------------------------------------------------ outils v2

def proteger_git():
    """Aucun hook ni moniteur de fichiers pour tous les git lancés ensuite."""
    reglages = [("core.hooksPath", "/dev/null"), ("core.fsmonitor", "false")]
    os.environ["GIT_CONFIG_COUNT"] = str(len(reglages))
    for i, (cle, valeur) in enumerate(reglages):
        os.environ[f"GIT_CONFIG_KEY_{i}"] = cle
        os.environ[f"GIT_CONFIG_VALUE_{i}"] = valeur
    os.environ["GIT_TERMINAL_PROMPT"] = "0"


def git_ok(*args):
    """git qui doit réussir ; renvoie la sortie brute."""
    try:
        res = subprocess.run(["git", *args], cwd=RACINE, stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE, timeout=600)
    except (OSError, subprocess.TimeoutExpired) as e:
        raise Arret(f"git {args[0]} impossible : {e}")
    if res.returncode != 0:
        detail = res.stderr.decode("utf-8", "replace").strip().splitlines()
        raise Arret(f"git {args[0]} a échoué : {detail[-1] if detail else res.returncode}")
    return res.stdout


def git_texte(*args):
    return git_ok(*args).decode("utf-8").strip()


def nettoyer(texte, longueur=MOTIF_MAX):
    """Texte venu d'ailleurs : une ligne, sans caractère de mise en forme."""
    if not isinstance(texte, str):
        return ""
    propre = []
    for c in texte:
        if unicodedata.category(c)[0] == "C" or c in "|<>`*_[]#\\":
            propre.append(" ")
        else:
            propre.append(c)
    return re.sub(r"\s+", " ", "".join(propre)).strip()[:longueur]


def sha256_octets(donnees):
    return hashlib.sha256(donnees).hexdigest()


def sha256_fichier(chemin):
    h = hashlib.sha256()
    with open(chemin, "rb") as f:
        for bloc in iter(lambda: f.read(65536), b""):
            h.update(bloc)
    return h.hexdigest()


def env_obligatoire(nom, motif):
    valeur = os.environ.get(nom, "")
    if not motif.match(valeur):
        raise Arret(f"entrée {nom} absente ou mal formée")
    return valeur


def etat_propre(base):
    if git_texte("rev-parse", "HEAD") != base:
        raise Arret("la copie de travail n'est pas sur la base attendue")
    sale = git_ok("status", "--porcelain", "--untracked-files=all", "-z")
    if sale:
        raise Arret("la copie de travail n'est pas propre")


def fichiers_suivis(base):
    """{chemin: mode} de tous les fichiers suivis de la base."""
    sortie = git_ok("ls-tree", "-r", "-z", "--full-tree", base)
    suivis = {}
    for ligne in sortie.split(b"\x00"):
        if not ligne:
            continue
        entete, chemin = ligne.split(b"\t", 1)
        suivis[chemin.decode("utf-8")] = entete.split(b" ")[0].decode()
    return suivis


def zips_de_la_base(suivis):
    return sorted(p for p in suivis if "/" not in p and p.lower().endswith(".zip"))


def distant_main():
    sortie = git_texte("ls-remote", DISTANT, f"refs/heads/{BRANCHE_LIVRAISON}")
    lignes = [l for l in sortie.splitlines() if l.strip()]
    if len(lignes) != 1:
        raise Arret("tête distante de main illisible")
    sha, ref = lignes[0].split("\t")
    if ref != f"refs/heads/{BRANCHE_LIVRAISON}" or not RE_HEX40.match(sha):
        raise Arret("tête distante de main illisible")
    return sha


def etiquette_distante_existe(v):
    sortie = git_texte("ls-remote", "--tags", DISTANT, f"refs/tags/v{v}")
    return bool(sortie.strip())


# ------------------------------------------------ fermeture des privilégiés

def lire_blob(base, chemin):
    return git_ok("cat-file", "blob", f"{base}:{chemin}")


def fermeture_privilegiee(base, suivis):
    """Fichiers privilégiés de la base : motifs + liste fixe + leurs imports."""
    depart = [p for p in suivis if any(m.match(p) for m in PRIVILEGIES_MOTIFS)]
    depart += [p for p in PRIVILEGIES_FIXES if p in suivis]
    vus, pile = set(), list(depart)
    while pile:
        chemin = pile.pop()
        if chemin in vus:
            continue
        vus.add(chemin)
        if suivis.get(chemin) != "100644" and suivis.get(chemin) != "100755":
            raise Arret(f"fichier privilégié inattendu (lien ou dossier) : {chemin}")
        texte = lire_blob(base, chemin).decode("utf-8")
        if RE_DYNAMIQUE.search(texte):
            raise Arret(f"chargement dynamique dans un fichier privilégié : {chemin}")
        for m in RE_IMPORT.finditer(texte):
            spec = m.group(1) or m.group(2)
            if spec.startswith("node:"):
                continue
            if not spec.startswith("./") and not spec.startswith("../"):
                raise Arret(f"import non relatif dans {chemin} : {spec}")
            cible = posixpath.normpath(posixpath.join(posixpath.dirname(chemin), spec))
            if cible.startswith("../") or cible not in suivis:
                raise Arret(f"import introuvable dans {chemin} : {spec}")
            pile.append(cible)
    return vus


def est_privilegie(chemin, fermeture):
    return chemin in fermeture or any(m.match(chemin) for m in PRIVILEGIES_MOTIFS)


# ------------------------------------------------------ contrôle des noms

def controler_nom_v2(nom, origine, suivis_minuscules):
    """Contrôles ajoutés en v2, en plus de controler_chemin (v1)."""
    if any(unicodedata.category(c)[0] == "C" for c in nom):
        raise Refus(f"{origine} : caractère de contrôle dans « {nettoyer(nom)} »")
    if unicodedata.normalize("NFC", nom) != nom:
        raise Refus(f"{origine} : nom non normalisé (NFC) « {nettoyer(nom)} »")
    morceaux = nom.split("/")
    if any(m.startswith(".") for m in morceaux):
        raise Refus(f"{origine} : fichier ou dossier caché interdit « {nom} »")
    if any(m.endswith((" ", ".")) for m in morceaux):
        raise Refus(f"{origine} : nom ambigu (espace ou point final) « {nom} »")
    existant = suivis_minuscules.get(unicodedata.normalize("NFC", nom).casefold())
    if existant is not None and existant != nom:
        raise Refus(f"{origine} : « {nom} » entre en collision avec « {existant} »")


def controler_archive_v2(octets, suivis):
    """Contrôles d'ensemble du zip avant toute écriture."""
    if not octets.startswith(b"PK\x03\x04"):
        raise Refus("zip mal formé (en-tête absent ou données avant le zip)")
    try:
        archive = zipfile.ZipFile(io.BytesIO(octets))
    except (zipfile.BadZipFile, ValueError) as e:
        raise Refus(f"zip illisible : {e}")
    with archive:
        try:
            mauvais = archive.testzip()
        except Exception as e:
            raise Refus(f"zip illisible : {e!r}")
        if mauvais is not None:
            raise Refus(f"zip abîmé (fichier « {mauvais} »)")
        noms = [i.filename for i in archive.infolist()]
        if noms.count(FICHIER_COLIS) != 1:
            raise Refus(f"{FICHIER_COLIS} doit figurer exactement une fois")
        if len(set(noms)) != len(noms):
            raise Refus("entrée en double dans le zip")
        minuscules = {}
        for chemin in suivis:
            minuscules.setdefault(unicodedata.normalize("NFC", chemin).casefold(), chemin)
        for nom in noms:
            if nom == FICHIER_COLIS:
                continue
            controler_chemin(nom.rstrip("/"), "fichier du zip")
            controler_nom_v2(nom.rstrip("/"), "fichier du zip", minuscules)
        try:
            d = json.loads(archive.read(FICHIER_COLIS).decode("utf-8"))
        except Exception as e:
            raise Refus(f"{FICHIER_COLIS} illisible : {e!r}")
        supprimer = d.get("supprimer", []) if isinstance(d, dict) else []
        if isinstance(supprimer, list):
            for s in supprimer:
                if isinstance(s, str):
                    controler_chemin(s, "suppression")
                    controler_nom_v2(s, "suppression", minuscules)
        return noms, supprimer


# --------------------------------------------------------- reconstruction

def construire(base, nom_zip, octets):
    """Applique le colis sur la base dans la copie de travail et met tout à l'index.
    Aucune exécution de code du colis : lecture du zip, copies de fichiers, git.
    Renvoie la description du colis et l'arbre obtenu (avant ETAT.md).
    Lève Refus (colis interdit) ou Arret (doute, rien à écrire)."""
    etat_propre(base)
    suivis = fichiers_suivis(base)
    fermeture = fermeture_privilegiee(base, suivis)
    noms, supprimer = controler_archive_v2(octets, suivis)
    ecrits = sorted(n for n in noms if n != FICHIER_COLIS and not n.endswith("/"))

    for s in supprimer:
        if s in ecrits:
            raise Refus(f"« {s} » est à la fois écrit et supprimé")
        if not any(p == s or p.startswith(s + "/") for p in suivis):
            raise Refus(f"« {s} » à supprimer n'existe pas dans la base")

    # liens symboliques de la base sur le trajet d'un fichier écrit ou supprimé
    for chemin in ecrits + list(supprimer):
        morceaux = chemin.split("/")
        for i in range(1, len(morceaux) + 1):
            if suivis.get("/".join(morceaux[:i])) == "120000":
                raise Refus(f"« {chemin} » passe par un lien symbolique de la base")
        reel = os.path.realpath(os.path.join(RACINE, *morceaux))
        if os.path.relpath(reel, RACINE).replace(os.sep, "/") != chemin:
            raise Refus(f"« {chemin} » ne désigne pas le chemin attendu")

    tmp = tempfile.mkdtemp(prefix="colis-v2-", dir=TEMP)
    try:
        chemin_zip = os.path.join(tmp, "colis.zip")
        with open(chemin_zip, "wb") as f:
            f.write(octets)
        with open(os.devnull, "w", encoding="utf-8") as journal:
            d, _ = appliquer_livraison(chemin_zip, journal)
            if d["action"] == "retour":
                appliquer_retour(d["cible"], journal)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    if d["apk"] and suivis.get(CHEMIN_CLE.replace(os.sep, "/")) is None:
        raise Refus("APK demandé mais la clé de signature n'est pas dans le dépôt")

    os.remove(os.path.join(RACINE, nom_zip))
    mettre_a_l_index()

    # chaque fichier du colis doit être à l'index, octet pour octet (avant l'injection)
    with zipfile.ZipFile(io.BytesIO(octets)) as archive:
        for nom in ecrits:
            ligne = git_ok("ls-files", "-s", "-z", "--", nom).split(b"\x00")[0]
            if not ligne:
                raise Refus(f"« {nom} » serait ignoré par git (.gitignore)")
            blob = ligne.split(b" ")[1].decode()
            res = subprocess.run(["git", "hash-object", "--no-filters", "--stdin"], cwd=RACINE,
                                 input=archive.read(nom), stdout=subprocess.PIPE, check=True)
            attendu = res.stdout.decode().strip()
            if blob != attendu:
                raise Refus(f"« {nom} » serait transformé par git (attributs)")

    with open(os.devnull, "w", encoding="utf-8") as journal:
        injecter_version(d["version"], journal)
    mettre_a_l_index()
    arbre = git_texte("write-tree")
    changements = lister_changements(base)
    controler_changements(base, changements, fermeture, nom_zip)
    return d, arbre, changements


def mettre_a_l_index():
    git_ok("add", "-A")
    git_ok("reset", "-q", "HEAD", "--", ".github", "node_modules", "android")


def lister_changements(base):
    sortie = git_ok("diff", "--cached", "--no-renames", "--raw", "-z", base)
    morceaux = sortie.split(b"\x00")
    changements = []
    i = 0
    while i < len(morceaux) - 1:
        entete = morceaux[i].decode()
        chemin = morceaux[i + 1].decode("utf-8")
        champs = entete.lstrip(":").split(" ")
        changements.append({"ancien_mode": champs[0], "mode": champs[1],
                            "statut": champs[4], "chemin": chemin})
        i += 2
    return changements


def controler_changements(base, changements, fermeture, nom_zip):
    """Contrôle sur la différence réelle base → arbre, quel que soit le chemin suivi."""
    for c in changements:
        p, statut = c["chemin"], c["statut"]
        premier = p.split("/")[0].lower()
        if p == nom_zip and statut == "D":
            continue
        if premier in DOSSIERS_INTERDITS:
            raise Refus(f"zone protégée modifiée « {p} »")
        if "/" not in p and p.lower() in FICHIERS_INTERDITS and p != FICHIER_VERSION:
            raise Refus(f"fichier protégé modifié « {p} »")
        if "/" not in p and p.lower().endswith(".zip"):
            raise Refus(f"zip à la racine modifié « {p} »")
        nom = p.split("/")[-1]
        if nom in FICHIERS_CONFIG_GIT or any(m.startswith(".") for m in p.split("/")):
            raise Refus(f"configuration ou fichier caché modifié « {p} »")
        if c["mode"] == "120000" or c["ancien_mode"] == "120000":
            raise Refus(f"lien symbolique « {p} »")
        if c["mode"] not in ("100644", "100755", "000000"):
            raise Refus(f"type d'entrée interdit « {p} »")
        if est_privilegie(p, fermeture):
            raise Refus(f"chemin privilégié « {p} » : dépôt manuel seulement")
        if nom == "package.json" and premier in DOSSIERS_SANS_PACKAGE:
            raise Refus(f"package.json interdit dans « {premier}/ »")
        if p == "package.json":
            controler_package_racine(base)


def controler_package_racine(base):
    def champs(texte):
        try:
            data = json.loads(texte)
        except ValueError:
            raise Refus("package.json racine illisible")
        if not isinstance(data, dict):
            raise Refus("package.json racine illisible")
        return {k: data.get(k) for k in CHAMPS_PACKAGE_PROTEGES}
    avant = champs(lire_blob(base, "package.json").decode("utf-8")) \
        if "package.json" in fichiers_suivis(base) else {k: None for k in CHAMPS_PACKAGE_PROTEGES}
    chemin = os.path.join(RACINE, "package.json")
    if not os.path.isfile(chemin):
        raise Refus("package.json racine supprimé")
    with open(chemin, encoding="utf-8") as f:
        apres = champs(f.read())
    if avant != apres:
        raise Refus("package.json racine : champs type/imports/exports modifiés")


# ----------------------------------------------------------- inventaire2

def decrire_base(base):
    suivis = fichiers_suivis(base)
    zips = zips_de_la_base(suivis)
    if not zips:
        raise Arret("aucun colis à la racine")
    if len(zips) > 1:
        raise Arret(f"plusieurs colis à la racine ({len(zips)}) : un seul à la fois")
    nom = zips[0]
    if suivis[nom] not in ("100644", "100755"):
        raise Arret("le colis n'est pas un fichier ordinaire")
    blob = git_texte("rev-parse", f"{base}:{nom}")
    octets = lire_blob(base, nom)
    if os.path.getsize(os.path.join(RACINE, nom)) != len(octets):
        raise Arret("le colis de la copie de travail diffère de la base")
    return nom, blob, octets


def sorties(valeurs):
    for cle, valeur in valeurs.items():
        texte = valeur if isinstance(valeur, str) else json.dumps(valeur, ensure_ascii=False,
                                                                  separators=(",", ":"))
        if "\n" in texte or "\r" in texte:
            raise Arret(f"sortie {cle} sur plusieurs lignes")
        sortie_github(cle, texte)


def cmd_inventaire2():
    proteger_git()
    valeurs = {"decision": "stop", "motif": "", "base_sha": "", "zip_nom": "", "zip_blob": "",
               "zip_sha256": "", "version": "", "action": "", "apk": "false",
               "description": "", "chemins": "[]", "arbre_attendu": ""}
    code = 0
    try:
        base = git_texte("rev-parse", "HEAD")
        valeurs["base_sha"] = base
        nom, blob, octets = decrire_base(base)
        valeurs.update(zip_nom=nom, zip_blob=blob, zip_sha256=sha256_octets(octets))
        try:
            d, arbre, changements = construire(base, nom, octets)
            valeurs.update(decision="controler", version=d["version"], action=d["action"],
                           apk="true" if d["apk"] else "false",
                           description=nettoyer(d["description"], 200),
                           chemins=[f'{c["statut"]} {c["chemin"]}' for c in changements],
                           arbre_attendu=arbre)
        except Refus as e:
            valeurs.update(decision="refuser", motif=nettoyer(str(e)))
    except Arret as e:
        valeurs.update(decision="stop", motif=nettoyer(str(e)))
        code = 1
    sorties(valeurs)
    with open(os.path.join(TEMP, "contrat.json"), "w", encoding="utf-8") as f:
        json.dump(valeurs, f, ensure_ascii=False, indent=1)
    resume_github("\n".join([
        "## Inventaire du colis (source de confiance)", "",
        f"- décision : **{valeurs['decision']}** {valeurs['motif']}",
        f"- colis : {nettoyer(valeurs['zip_nom'])} (sha256 {valeurs['zip_sha256']})",
        f"- version : {valeurs['version']} — APK : {valeurs['apk']}",
        f"- base : {valeurs['base_sha']} — arbre attendu : {valeurs['arbre_attendu']}",
        f"- chemins : {nettoyer(json.dumps(valeurs['chemins'], ensure_ascii=False), 3000)}",
    ]))
    sys.exit(code)


# -------------------------------------------------------------- controler

def cmd_controler():
    """J-Contrôle : sorties NON fiables (le colis s'exécute ici)."""
    proteger_git()
    valeurs = {"verdict": "refus", "motif": "", "arbre_teste": "", "apk_sha256": ""}
    try:
        base = env_obligatoire("INV_BASE_SHA", RE_HEX40)
        attendu = env_obligatoire("INV_ARBRE", RE_HEX40)
        zip_sha = env_obligatoire("INV_ZIP_SHA256", RE_HEX64)
        nom, _, octets = decrire_base(base)
        if sha256_octets(octets) != zip_sha:
            raise Arret("le colis diffère de l'inventaire")
        d, arbre, _ = construire(base, nom, octets)
        if arbre != attendu:
            raise Arret("arbre reconstruit différent de l'arbre attendu")
        valeurs["arbre_teste"] = arbre
        os.makedirs(RAPPORT, exist_ok=True)
        with open(os.path.join(RAPPORT, "journal-du-controle.txt"), "a",
                  encoding="utf-8") as journal:
            try:
                verifier_application(d["version"], RAPPORT, journal)
                if d["apk"]:
                    apk = construire_apk(d["version"], journal)
                    os.makedirs(DOSSIER_CONTROLE, exist_ok=True)
                    shutil.copyfile(apk, APK_CONTROLE)
                    valeurs["apk_sha256"] = sha256_fichier(APK_CONTROLE)
                valeurs["verdict"] = "ok"
            except Refus as e:
                valeurs["motif"] = nettoyer(str(e))
    except Refus as e:
        valeurs["motif"] = nettoyer(str(e))
    except Arret as e:
        valeurs.update(verdict="arret", motif=nettoyer(str(e)))
    sorties(valeurs)
    sys.exit(0 if valeurs["verdict"] in ("ok", "refus") else 1)


# ----------------------------------------------------------------- livrer

def lire_entrees_livraison():
    if os.environ.get("INV_DECISION", "") not in ("controler", "refuser"):
        raise Arret("décision de l'inventaire absente ou « stop » : rien n'est livré")
    e = {
        "base": env_obligatoire("INV_BASE_SHA", RE_HEX40),
        "zip_blob": env_obligatoire("INV_ZIP_BLOB", RE_HEX40),
        "zip_sha256": env_obligatoire("INV_ZIP_SHA256", RE_HEX64),
        "decision": os.environ.get("INV_DECISION", ""),
        "verdict": os.environ.get("CTL_VERDICT", ""),
        "motif_controle": nettoyer(os.environ.get("CTL_MOTIF", "")),
    }
    if e["decision"] == "controler":
        e["arbre"] = env_obligatoire("INV_ARBRE", RE_HEX40)
        e["version"] = os.environ.get("INV_VERSION", "")
        if not version_en_tuple(e["version"]):
            raise Arret("entrée INV_VERSION mal formée")
        if e["verdict"] not in ("ok", "refus"):
            raise Arret("verdict du contrôle absent ou inconnu : rien n'est livré")
        if e["verdict"] == "ok":
            e["arbre_teste"] = env_obligatoire("CTL_ARBRE", RE_HEX40)
            e["apk_sha256"] = os.environ.get("CTL_APK_SHA256", "")
    elif e["decision"] == "refuser":
        e["motif_inventaire"] = os.environ.get("INV_MOTIF", "")
    else:
        raise Arret("décision de l'inventaire absente ou « stop » : rien n'est livré")
    return e


def commit_robot(message):
    env = dict(os.environ, GIT_AUTHOR_NAME=NOM_ROBOT, GIT_AUTHOR_EMAIL=COURRIEL_ROBOT,
               GIT_COMMITTER_NAME=NOM_ROBOT, GIT_COMMITTER_EMAIL=COURRIEL_ROBOT)
    res = subprocess.run(["git", "commit", "-q", "--no-verify", "-m", message], cwd=RACINE,
                         env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode != 0:
        raise Arret("commit impossible")
    return git_texte("rev-parse", "HEAD")


def etiquette_robot(v, message, cible):
    env = dict(os.environ, GIT_COMMITTER_NAME=NOM_ROBOT, GIT_COMMITTER_EMAIL=COURRIEL_ROBOT)
    res = subprocess.run(["git", "tag", "-a", f"v{v}", "-m", message, cible], cwd=RACINE,
                         env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode != 0:
        raise Arret("étiquette impossible")


def changements_commit(base, commit):
    sortie = git_ok("diff", "--no-renames", "--name-status", "-z", base, commit)
    morceaux = [m.decode("utf-8") for m in sortie.split(b"\x00") if m]
    return sorted(zip(morceaux[1::2], morceaux[0::2]))


def cmd_livrer():
    """J-Livraison : n'exécute que ce fichier, git et la bibliothèque standard."""
    proteger_git()
    resultat = {"livre": "false", "version": "", "commit": "", "apk": "false"}
    try:
        e = lire_entrees_livraison()
        base = e["base"]
        if distant_main() != base:
            raise Arret("main a changé depuis l'inventaire : rien n'est livré")
        etat_propre(base)
        nom, blob, octets = decrire_base(base)
        if blob != e["zip_blob"] or sha256_octets(octets) != e["zip_sha256"]:
            raise Arret("le colis diffère de l'inventaire")

        refus = None
        try:
            d, arbre, _ = construire(base, nom, octets)
        except Refus as err:
            refus = nettoyer(str(err))

        if e["decision"] == "refuser":
            if refus is None or refus != nettoyer(e["motif_inventaire"]):
                raise Arret("refus de l'inventaire non reproduit à l'identique")
            motif = refus
        elif refus is not None:
            raise Arret("l'inventaire acceptait ce colis, la reconstruction le refuse")
        else:
            if arbre != e["arbre"]:
                raise Arret("arbre reconstruit différent de l'arbre attendu")
            if d["version"] != e["version"]:
                raise Arret("version différente de l'inventaire")
            motif = None
            if e["verdict"] == "refus":
                motif = e["motif_controle"] or "refusé par le contrôle"

        if motif is None:
            if e["arbre_teste"] != arbre:
                raise Arret("l'arbre testé n'est pas l'arbre livré")
            v = d["version"]
            if etiquette_existe(v) or etiquette_distante_existe(v):
                raise Arret(f"l'étiquette v{v} existe déjà")
            if d["apk"]:
                if not RE_HEX64.match(e["apk_sha256"]) or not os.path.isfile(APK_CONTROLE) \
                        or os.path.islink(APK_CONTROLE):
                    raise Arret("APK du contrôle absent")
                taille = os.path.getsize(APK_CONTROLE)
                if not 0 < taille <= APK_MAX_OCTETS or sha256_fichier(APK_CONTROLE) != e["apk_sha256"]:
                    raise Arret("APK du contrôle différent de celui annoncé")
            ligne = (f"✅ {maintenant()} — **v{v}** — "
                     f"{nettoyer(d['description'], 200) or 'sans description'} ({nettoyer(nom)})")
            ecrire_etat(ligne)
            git_ok("add", "--", FICHIER_ETAT)
            commit = commit_robot(f"Livraison v{v} : {nettoyer(d['description'], 200) or nom} [skip ci]")
            if git_texte("rev-parse", f"{commit}^") != base:
                raise Arret("le commit n'a pas la base pour parent")
            diff_arbre = git_ok("diff", "--name-only", "-z", arbre, commit)
            if [m for m in diff_arbre.split(b"\x00") if m] != [FICHIER_ETAT.encode()]:
                raise Arret("le commit diffère de l'arbre attendu")
            etiquette_robot(v, nettoyer(d["description"], 200) or f"version {v}", commit)
            refs = [f"{commit}:refs/heads/{BRANCHE_LIVRAISON}", f"refs/tags/v{v}:refs/tags/v{v}"]
            resultat.update(version=v, apk="true" if d["apk"] else "false")
        else:
            git_ok("reset", "-q", "--hard", base)
            git_ok("clean", "-fdq", "-e", "node_modules")
            etat_propre(base)
            os.remove(os.path.join(RACINE, nom))
            ecrire_etat(f"❌ {maintenant()} — colis **{nettoyer(nom)}** refusé — {motif}")
            git_ok("add", "-A", "--", nom, FICHIER_ETAT)
            commit = commit_robot(f"Colis refusé : {nettoyer(nom)} [skip ci]")
            if changements_commit(base, commit) not in (sorted([(nom, "D"), (FICHIER_ETAT, "M")]),
                                                         sorted([(nom, "D"), (FICHIER_ETAT, "A")])):
                raise Arret("le commit de refus contient autre chose que le colis et ETAT.md")
            refs = [f"{commit}:refs/heads/{BRANCHE_LIVRAISON}"]

        res = subprocess.run(["git", "push", "--atomic", "--porcelain", DISTANT, *refs],
                             cwd=RACINE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if res.returncode != 0:
            raise Arret("envoi refusé par GitHub (main a peut-être changé) : rien n'est livré")
        if distant_main() != commit:
            raise Arret("après l'envoi, main ne désigne pas le commit livré")
        resultat.update(livre="true" if motif is None else "refus", commit=commit)
        resume_github(f"## Livraison\n\n- {'livré' if motif is None else 'refus inscrit'} : {commit}")
        sorties(resultat)
        sys.exit(0)
    except Arret as err:
        resume_github(f"## Livraison\n\n- ⛔ arrêt sans écriture : {nettoyer(str(err))}")
        resultat["motif"] = nettoyer(str(err))
        sorties(resultat)
        sys.exit(1)


if __name__ == "__main__":
    commandes = {"inventaire": cmd_inventaire, "traiter": cmd_traiter, "site": cmd_site,
                 "inventaire2": cmd_inventaire2, "controler": cmd_controler,
                 "livrer": cmd_livrer}
    if len(sys.argv) != 2 or sys.argv[1] not in commandes:
        print("usage : deballer.py inventaire|traiter|site|inventaire2|controler|livrer")
        sys.exit(2)
    commandes[sys.argv[1]]()
