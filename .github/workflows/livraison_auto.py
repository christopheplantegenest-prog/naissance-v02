# VOIE AUTOMATIQUE DU ROBOT — v0.66.14 (GO ChatGPT « FINALISATION DE L'AUTOMATISATION », 26/10/2026)
#
# Bibliothèque standard seule, aucun code du colis exécuté. Ce dossier (.github/workflows) est interdit aux colis : seul un dépôt manuel
# (PR P1) peut changer ces règles.
#
#   voie        (job inventaire, de confiance) : choisit la voie de livraison du colis.
#               « auto »  : livraison sans V4 par l'environnement livraison-essai, après le contrôle et le délai d'opposition ;
#               « v4 »    : livraison avec l'approbation de Christophe (environnement livraison), comme avant ;
#               « arret » : la voie automatique était ouverte mais un fait n'a pas pu être établi : rien n'est livré, aucune question.
#               La voie « auto » exige TOUT : dépôt de l'Atelier (github-actions[bot]), inventaire « controler », classe E STRICTE
#               (classer.examiner_auto), APK demandé, ticket identifié (branche livraison/ticket-N-k pointant exactement sur le dépôt)
#               ouvert, « Atelier : … », ouvert par le propriétaire, et l'interrupteur LIVRAISON_AUTO_E (variable du dépôt, réglée par
#               l'administrateur seul) égal à « actif ». Interrupteur absent ou autre valeur = voie « v4 » (mode ombre : la voie que le
#               robot AURAIT prise est affichée).
#   opposition  (job opposition, puis job livraison juste avant l'écriture) : relit le ticket. Un « /stop » du propriétaire publié
#               depuis le dépôt, un ticket fermé, ou une lecture impossible = arrêt sans écriture.
#
#   scenario    (ATELIER 3, job inventaire) : pour un dépôt de l'Atelier, lit dans le journal du chantier (branche
#               journal-atelier/autonome, écrite par les seuls jobs de l'Atelier) le scénario d'acceptation du plan COURANT : empreinte
#               recalculée égale à celle gelée au plan, avis indépendant conforme, dépôt inscrit au journal APRÈS ce plan. Il est joué
#               ensuite par le job « acceptation ». Plan sans scénario (chantier d'avant l'Atelier 3) : aucun scénario, aucune voie élargie.
#
# ATELIER 3 — VOIE ÉLARGIE (choisir_voie_complete) : si la voie E stricte n'est pas prise, un colis de l'Atelier de classe E, O ou S
# admissible (classer.examiner_elargie : app/ applicatif et nouveaux tests seulement, aucune suppression, aucune migration, aucun test
# existant modifié), APK demandé, avec un scénario gelé, prend la voie « auto » (règle « elargie ») si l'interrupteur
# ATELIER_VOIE_ELARGIE (variable du dépôt, réglée par l'administrateur après l'amendement D-007) vaut « actif » ; la livraison exige alors
# en plus le verdict « ok » du job acceptation (robot.yml et deballer.py livrer). Sinon : « v4 » (mode ombre affiché).
#
# Tout doute ferme la voie automatique : jamais d'exception qui laisserait passer, jamais de valeur par défaut « auto ».
import base64
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

INTERRUPTEUR_ACTIF = "actif"
ACTEUR_ATELIER = "github-actions[bot]"
RE_SHA = re.compile(r"^[0-9a-f]{40}$")
RE_BRANCHE = re.compile(r"^refs/heads/livraison/ticket-([1-9][0-9]{0,6})-([1-9][0-9]{0,3})$")
RE_TITRE = re.compile(r"^Atelier\s*:")
RE_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
RE_HEX64 = re.compile(r"^[0-9a-f]{64}$")
BRANCHE_JOURNAL = "refs/heads/journal-atelier/autonome"
CLASSES_ELARGIE = ("E", "O", "S")
API_PAR_DEFAUT = "https://api.github.com"
PAGES_MAX = 20


class Doute(Exception):
    """Un fait nécessaire à la voie automatique n'a pas pu être établi."""


# ------------------------------------------------------------------------------------------------ décisions pures (testées)
def ticket_du_depot(lignes_ls_remote, depot):
    """lignes « <sha>\\t<ref> » de git ls-remote -> numéro du ticket dont UNE SEULE branche livraison/ticket-N-k pointe sur le dépôt."""
    trouves = set()
    for ligne in lignes_ls_remote:
        sha, _, ref = ligne.partition("\t")
        m = RE_BRANCHE.match(ref.strip())
        if m and sha.strip() == depot:
            trouves.add(int(m.group(1)))
    if len(trouves) != 1:
        raise Doute(f"{len(trouves)} ticket(s) pour le dépôt {depot[:12]} : un seul attendu")
    return trouves.pop()


def controler_ticket(ticket, proprietaire):
    """Le ticket doit être une demande ouverte « Atelier : … » du propriétaire (pas une PR)."""
    if not isinstance(ticket, dict) or "pull_request" in ticket:
        raise Doute("ticket illisible ou demande de fusion")
    if ticket.get("state") != "open":
        raise Doute("ticket fermé")
    if not isinstance(ticket.get("title"), str) or not RE_TITRE.match(ticket["title"]):
        raise Doute("le ticket n'est pas une demande « Atelier : … »")
    if not isinstance(ticket.get("user"), dict) or ticket["user"].get("id") != proprietaire:
        raise Doute("ticket ouvert par un autre compte que le propriétaire")


def choisir_voie(f):
    """f : faits établis par le job de confiance -> (voie, motif). Aucune exception : un fait illisible ouvre au plus la V4 ou l'arrêt."""
    if f.get("decision") != "controler":
        return "v4", "inventaire sans livraison possible"
    if f.get("evenement") != "workflow_dispatch" or not RE_SHA.match(f.get("depot") or "") or f.get("acteur") != ACTEUR_ATELIER:
        return "v4", "colis qui ne vient pas de l'Atelier"
    if f.get("classe") != "E":
        return "v4", f"classe {f.get('classe') or '?'} (seule la classe E stricte peut être automatique)"
    if f.get("e_auto") != "oui":
        return "v4", f"classe E non stricte : {f.get('e_auto_motif') or '?'}"
    if f.get("apk") != "true":
        return "v4", "pas d'APK demandé"
    actif = f.get("interrupteur") == INTERRUPTEUR_ACTIF
    if f.get("doute"):
        return ("arret" if actif else "v4"), f"fait non établi : {f['doute']}"
    if not actif:
        return "v4", "voie automatique possible, mais interrupteur LIVRAISON_AUTO_E coupé (mode ombre)"
    return "auto", f"capacité d'essai neuve et isolée (ticket {f.get('ticket')}) : livraison automatique après contrôle et délai"


def choisir_voie_complete(f):
    """ATELIER 3 : -> (voie, motif, regle). regle : « e-stricte » ou « elargie » pour la voie « auto », vide sinon."""
    voie, motif = choisir_voie(f)
    if voie != "v4":
        return voie, motif, ("e-stricte" if voie == "auto" else "")
    if f.get("decision") != "controler" or f.get("evenement") != "workflow_dispatch" or not RE_SHA.match(f.get("depot") or "") \
            or f.get("acteur") != ACTEUR_ATELIER:
        return voie, motif, ""
    if f.get("classe") not in CLASSES_ELARGIE:
        return "v4", f"{motif} ; voie élargie : classe {f.get('classe') or '?'} exclue", ""
    if f.get("e_elargie") != "oui":
        return "v4", f"{motif} ; voie élargie : {f.get('e_elargie_motif') or '?'}", ""
    if f.get("apk") != "true":
        return "v4", f"{motif} ; voie élargie : pas d'APK demandé", ""
    if not RE_HEX64.match(f.get("scenario") or ""):
        return "v4", f"{motif} ; voie élargie : aucun scénario d'acceptation gelé ({f.get('scenario_motif') or 'plan sans scénario'})", ""
    actif = f.get("interrupteur_elargie") == INTERRUPTEUR_ACTIF
    if f.get("doute"):
        return ("arret" if actif else "v4"), f"voie élargie, fait non établi : {f['doute']}", ""
    if not actif:
        return "v4", "voie élargie possible, mais interrupteur ATELIER_VOIE_ELARGIE coupé (mode ombre)", ""
    return "auto", f"voie élargie (ticket {f.get('ticket')}) : livraison automatique après contrôle, scénario d'acceptation vert et délai", "elargie"


def scenario_du_journal(journal, depot):
    """journal : événements du chantier -> (canonique, empreinte, android) du scénario du plan courant, lié au dépôt ; None si le plan
    courant n'a pas de scénario ; Doute si un fait manque."""
    if not isinstance(journal, list) or not all(isinstance(e, dict) for e in journal):
        raise Doute("journal du chantier illisible")
    debut = max((i for i, e in enumerate(journal) if e.get("type") == "lot"), default=-1)
    plans = [i for i, e in enumerate(journal) if i > debut and e.get("type") == "plan"]
    if not plans:
        raise Doute("aucun plan dans le lot courant")
    i = plans[-1]
    d = journal[i].get("donnees")
    if not isinstance(d, dict) or not isinstance(d.get("plan"), dict):
        raise Doute("plan illisible")
    scenario = d["plan"].get("scenario")
    if scenario is None:
        return None
    canon = json.dumps(scenario, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    empreinte = hashlib.sha256(canon.encode("utf-8")).hexdigest()
    if empreinte != d.get("scenario_sha256"):
        raise Doute("empreinte du scénario différente de celle gelée au plan")
    suite = journal[i + 1:]
    if not any(e.get("type") == "avis-scenario" and isinstance(e.get("donnees"), dict) and e["donnees"].get("conforme") is True for e in suite):
        raise Doute("scénario sans avis indépendant conforme")
    if not any(e.get("type") == "livraison" and isinstance(e.get("donnees"), dict) and e["donnees"].get("depot") == depot for e in suite):
        raise Doute("dépôt absent du journal après le plan")
    android = isinstance(scenario, dict) and isinstance(scenario.get("android"), list) and len(scenario["android"]) > 0
    return canon, empreinte, android


def opposition(ticket, commentaires, depuis, proprietaire):
    """-> None si rien ne s'oppose à la livraison automatique ; sinon le motif d'arrêt."""
    try:
        controler_ticket(ticket, proprietaire)
    except Doute as e:
        return str(e)
    if not RE_DATE.match(depuis or ""):
        return "date du dépôt illisible"
    if not isinstance(commentaires, list):
        return "commentaires illisibles"
    for c in commentaires:
        if not isinstance(c, dict) or not isinstance(c.get("body"), str) or not isinstance(c.get("created_at"), str):
            return "commentaire illisible"
        if not isinstance(c.get("user"), dict) or c["user"].get("id") != proprietaire:
            continue
        premiere = c["body"].replace("\r", "").split("\n", 1)[0].strip()
        if premiere == "/stop" and c["created_at"] >= depuis:
            return f"/stop de Christophe à {c['created_at']}"
    return None


# ------------------------------------------------------------------------------------------------ entrées / sorties
def appel(chemin):
    jeton = os.environ.get("GH_TOKEN", "")
    api = os.environ.get("GITHUB_API_URL") or API_PAR_DEFAUT  # posée par GitHub Actions ; un serveur local dans les tests
    if not re.match(r"^https?://[A-Za-z0-9.:-]+$", api):
        raise Doute("adresse de l'API illisible")
    req = urllib.request.Request(api + chemin, headers={
        "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "naissance-robot",
        **({"Authorization": f"Bearer {jeton}"} if jeton else {})})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))
    except (urllib.error.URLError, ValueError, TimeoutError, OSError) as e:
        raise Doute(f"lecture GitHub impossible ({type(e).__name__})")


def depot_github():
    d = os.environ.get("GITHUB_REPOSITORY", "")
    if not re.match(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", d):
        raise Doute("dépôt GitHub illisible")
    return d


def lire_ticket(n):
    return appel(f"/repos/{depot_github()}/issues/{n}")


def lire_commentaires(n):
    tout = []
    for page in range(1, PAGES_MAX + 1):
        lot = appel(f"/repos/{depot_github()}/issues/{n}/comments?per_page=100&page={page}")
        if not isinstance(lot, list):
            raise Doute("commentaires illisibles")
        tout += lot
        if len(lot) < 100:
            return tout
    raise Doute("trop de commentaires")


def proprietaire():
    p = os.environ.get("PROPRIETAIRE_ID", "")
    if not re.match(r"^[1-9][0-9]{0,12}$", p):
        raise Doute("identifiant du propriétaire illisible")
    return int(p)


def date_du_depot(depot):
    r = subprocess.run(["git", "show", "-s", "--format=%cd", "--date=format-local:%Y-%m-%dT%H:%M:%SZ", depot],
                       stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env={**os.environ, "TZ": "UTC"}, check=False)
    d = r.stdout.decode().strip()
    if r.returncode != 0 or not RE_DATE.match(d):
        raise Doute("date du dépôt illisible")
    return d


def sorties(valeurs):
    chemin = os.environ.get("GITHUB_OUTPUT")
    for k, v in valeurs.items():
        v = str(v).replace("\n", " ").replace("\r", " ")
        print(f"{k}={v}")
        if chemin:
            with open(chemin, "a", encoding="utf-8") as f:
                f.write(f"{k}={v}\n")


def resume(texte):
    chemin = os.environ.get("GITHUB_STEP_SUMMARY")
    if chemin:
        with open(chemin, "a", encoding="utf-8") as f:
            f.write(texte + "\n")


def depot_de_l_atelier():
    e = os.environ.get
    return e("EVENEMENT", "") == "workflow_dispatch" and e("ACTEUR", "") == ACTEUR_ATELIER and RE_SHA.match(e("ROBOT_DEPOT", "")) is not None


def lire_journal_chantier(n):
    """Journal du chantier N sur la branche journal-atelier/autonome (git fetch, lecture seule)."""
    r = subprocess.run(["git", "fetch", "--no-tags", "--quiet", "origin", f"+{BRANCHE_JOURNAL}:refs/robot/journal"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    if r.returncode != 0:
        raise Doute("journal de l'Atelier illisible")
    r = subprocess.run(["git", "show", f"refs/robot/journal:chantiers/{n}.json"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, check=False)
    if r.returncode != 0:
        raise Doute("journal du chantier absent")
    try:
        return json.loads(r.stdout.decode("utf-8"))
    except ValueError:
        raise Doute("journal du chantier illisible")


def cmd_scenario():
    """Inventaire : scénario d'acceptation gelé du dépôt de l'Atelier (vide si aucun). Le journal est relu quelques fois : l'Atelier inscrit
    le dépôt juste avant de lancer le robot."""
    valeurs = {"scenario": "", "scenario_sha256": "", "scenario_android": "false", "scenario_motif": "dépôt hors Atelier"}
    if depot_de_l_atelier():
        depot = os.environ["ROBOT_DEPOT"]
        essais = int(os.environ.get("SCENARIO_ESSAIS", "6"))
        for essai in range(essais):
            try:
                r = subprocess.run(["git", "ls-remote", "origin", "refs/heads/livraison/*"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, check=False)
                if r.returncode != 0:
                    raise Doute("branches de livraison illisibles")
                n = ticket_du_depot(r.stdout.decode().splitlines(), depot)
                s = scenario_du_journal(lire_journal_chantier(n), depot)
                if s is None:
                    valeurs["scenario_motif"] = "plan sans scénario (chantier d'avant l'Atelier 3)"
                else:
                    canon, empreinte, android = s
                    valeurs.update(scenario=base64.b64encode(canon.encode("utf-8")).decode("ascii"), scenario_sha256=empreinte,
                                   scenario_android="true" if android else "false", scenario_motif="scénario gelé, relu, lié au dépôt")
                break
            except Doute as d:
                valeurs["scenario_motif"] = str(d)
                if essai + 1 < essais:
                    time.sleep(float(os.environ.get("SCENARIO_PAUSE", "10")))
    sorties(valeurs)
    resume(f"\n## Scénario d'acceptation (ATELIER 3)\n\n- {'empreinte ' + valeurs['scenario_sha256'] if valeurs['scenario_sha256'] else 'aucun'} — {valeurs['scenario_motif']}\n")
    return 0


def cmd_voie():
    e = os.environ.get
    f = {"decision": e("INV_DECISION", ""), "evenement": e("EVENEMENT", ""), "acteur": e("ACTEUR", ""), "depot": e("ROBOT_DEPOT", ""),
         "classe": e("INV_CLASSE", ""), "e_auto": e("INV_E_AUTO", ""), "e_auto_motif": e("INV_E_AUTO_MOTIF", ""), "apk": e("INV_APK", ""),
         "interrupteur": e("INTERRUPTEUR", ""),
         # ATELIER 3 : voie élargie
         "e_elargie": e("INV_E_ELARGIE", ""), "e_elargie_motif": e("INV_E_ELARGIE_MOTIF", ""), "scenario": e("SCENARIO_SHA256", ""),
         "scenario_motif": e("SCENARIO_MOTIF", ""), "interrupteur_elargie": e("INTERRUPTEUR_ELARGIE", "")}
    ticket, depuis = "", ""
    preliminaire = choisir_voie_complete({**f, "interrupteur": INTERRUPTEUR_ACTIF, "interrupteur_elargie": INTERRUPTEUR_ACTIF})
    if preliminaire[0] == "auto":  # les faits du ticket ne sont lus que si tout le reste ouvre la voie automatique
        try:
            r = subprocess.run(["git", "ls-remote", "origin", "refs/heads/livraison/*"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, check=False)
            if r.returncode != 0:
                raise Doute("branches de livraison illisibles")
            n = ticket_du_depot(r.stdout.decode().splitlines(), f["depot"])
            controler_ticket(lire_ticket(n), proprietaire())
            depuis = date_du_depot(f["depot"])
            ticket = str(n)
            f["ticket"] = ticket
        except Doute as d:
            f["doute"] = str(d)
    voie, motif, regle = choisir_voie_complete(f)
    sorties({"voie": voie, "voie_motif": motif, "regle": regle if voie == "auto" else "", "ticket": ticket if voie == "auto" else "",
             "depuis": depuis if voie == "auto" else ""})
    titre = {"auto": "🤖 automatique (sans V4)", "v4": "🔒 approbation de Christophe (V4)", "arret": "⛔ arrêt (rien n'est livré)"}[voie]
    resume(f"\n## Voie de livraison\n\n- voie : **{titre}**{' — règle ' + regle if voie == 'auto' else ''}\n- motif : {motif}\n")
    return 0


def cmd_opposition():
    try:
        n = os.environ.get("TICKET", "")
        if not re.match(r"^[1-9][0-9]{0,6}$", n):
            raise Doute("ticket illisible")
        motif = opposition(lire_ticket(int(n)), lire_commentaires(int(n)), os.environ.get("DEPUIS", ""), proprietaire())
    except Doute as d:
        motif = str(d)
    if motif:
        print(f"Opposition : {motif}. Rien n'est livré.")
        resume(f"\n## Opposition\n\n- ⛔ livraison automatique arrêtée : {motif} (rien n'est écrit)\n")
        return 1
    print("Aucune opposition : la livraison automatique peut continuer.")
    resume("\n## Opposition\n\n- ✅ aucune opposition (ticket ouvert, aucun /stop depuis le dépôt)\n")
    return 0


if __name__ == "__main__":
    commandes = {"voie": cmd_voie, "opposition": cmd_opposition, "scenario": cmd_scenario}
    if len(sys.argv) != 2 or sys.argv[1] not in commandes:
        print("usage : livraison_auto.py voie|opposition|scenario")
        sys.exit(2)
    sys.exit(commandes[sys.argv[1]]())
