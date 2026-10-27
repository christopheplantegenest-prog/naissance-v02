# CLASSIFICATION DES COLIS (robot de confiance) — v0.66.9, ATELIER 2, L4
#
# Chargé par deballer.py (bibliothèque standard seule, aucun code du colis exécuté). Ce dossier (.github/workflows) est interdit aux
# colis : seul un dépôt manuel de Christophe peut changer ces règles.
#
# 1. CLASSIFICATION (mode OMBRE : calculée, affichée, jamais utilisée pour décider ; toute livraison garde l'approbation V4).
#    Elle ne lit QUE la différence réelle base -> arbre reconstruit (avant l'injection de version) et le contenu des fichiers ; elle ignore
#    tout ce que le colis ou l'Atelier DÉCLARENT (description, missions, rapports).
#      E : capacité expérimentale isolée — seulement app/capacites-essai/catalogue.json (données), des modules
#          app/capacites-essai/<id>.js qui passent les règles statiques ci-dessous, et de NOUVEAUX tests tests/capacite-essai-<id>*.test.mjs.
#      O : affichage à risque limité — seulement app/styles.css (propriétés de présentation d'une liste fermée) et des icônes SVG inertes.
#      R : retrait contrôlé — seulement la suppression de capacités livrées (entrée du catalogue + module + leurs tests), rien d'autre.
#      S : TOUT le reste, y compris un colis qui mélange deux classes ou qui ne satisfait pas INTÉGRALEMENT les règles d'une classe.
#    Le résultat donne, pour chaque classe autorisable, la première règle non satisfaite : c'est la preuve du classement en S.
#
# 1 bis. VOIE AUTOMATIQUE (v0.66.14, GO « FINALISATION DE L'AUTOMATISATION ») : sous-ensemble STRICT de E, seul admissible à une livraison
#    sans V4 (robot.yml, voie « auto », interrupteur LIVRAISON_AUTO_E). Le colis AJOUTE exactement UNE capacité neuve (entrée du catalogue,
#    son module, au moins un test à son nom) et ne touche à RIEN d'existant : les autres entrées restent identiques (forme canonique), aucun
#    module ni test existant n'est modifié. Toute autre forme de E (modifier une capacité livrée, en ajouter deux) garde la V4.
#
# 1 ter. VOIE ÉLARGIE (ATELIER 3, GO « ATELIER 3 — GO CONSTRUCTION », 27/10/2026 ; coupée tant que l'administrateur n'a pas réglé la
#    variable ATELIER_VOIE_ELARGIE après l'amendement D-007) : classes E, O et S NON COGNITIVES, SEULEMENT si le colis n'ajoute ou ne
#    modifie que des fichiers de app/ HORS du socle renforcé (SOCLE_RENFORCE : langage, esprit, mémoire, actions, conversation, moteur
#    local, fournisseurs, capacités d'essai, main.js, index.html, sw.js, natif.js, clé et stockage des réglages ; ni atelier, capacités,
#    essais) et de NOUVEAUX tests : aucune suppression, aucun test existant modifié (les acquis C1/C2 et les gardes restent intacts),
#    aucun fichier racine, aucune configuration native (outils-android/), aucune migration, aucun nouvel import du socle, et aucun emploi
#    SUPPLÉMENTAIRE de stockage, de réseau, de code dynamique ou de détection du robot (PRIMITIVES_ELARGIE). Toute modification cognitive
#    garde la V4 (GO « ATELIER 3 — PRÉPARATION », points 2 et 4). Le scénario d'acceptation, joué par le robot, reste exigé en plus.
#
# 2. CONTRAT DU BRANCHEMENT DE LA PORTE D'ESSAI (refus, quelle que soit la classe) : dans app/main.js et app/index.html, les blocs balisés
#    BRANCHEMENT_ESSAIS_* et chaque ligne qui nomme les essais hors de ces blocs doivent rester identiques à la base ; aucun fichier de app/
#    hors de app/essais/ ne peut ajouter un accès à la zone d'essai, au registre des essais ou aux modules de la porte.
import json
import posixpath
import re
from collections import Counter

CLASSES = ("E", "O", "R", "S")
MOTIFS_MAX = 20

# --------------------------------------------------------------------------------------------- E : capacités livrées
DOSSIER_E = "app/capacites-essai/"
CATALOGUE_E = DOSSIER_E + "catalogue.json"
FORMAT_E = "naissance-capacites-essai"
CAPACITES_MAX = 10
MODULE_OCTETS_MAX = 20000
CATALOGUE_OCTETS_MAX = 20000
RE_ID = re.compile(r"^[a-z][a-z0-9-]{2,40}$")
RE_TABLE = re.compile(r"^[a-z][A-Za-z0-9]{1,40}$")
RE_MODULE_E = re.compile(r"^app/capacites-essai/([a-z][a-z0-9-]{2,40})\.js$")
RE_TEST_E = re.compile(r"^tests/capacite-essai-([a-z][a-z0-9-]{2,40})(?:-[a-z0-9-]+)?\.test\.mjs$")
CHAMPS_E = ("id", "titre", "description", "lit", "effet", "declencheurs", "delaiMs", "maxLignes", "invariants", "epreuves")
DECLENCHEURS = ("apres-tour", "manuel")
TYPES_INVARIANT = ("champs", "unique", "apres-installation", "max-par-execution")
EPREUVES = ("panne", "boucle", "asynchrone", "evasion", "forme", "doublon")
DELAI_MAX_MS = 5000
LIGNES_MAX = 20
INVARIANTS_MAX = 3
# Règles statiques d'un module E (plus strictes que l'analyse de la porte) : le module ne fait que calculer sur son entrée.
# Elles ne PROUVENT pas l'innocuité (voir LIMITES dans le rapport L4) : le verrou du bac reste la barrière décisive à l'exécution.
MOTS_INTERDITS_E = (
    "import", "require", "eval", "Function", "constructor", "prototype", "__proto__", "globalThis", "self", "window", "document",
    "fetch", "XMLHttpRequest", "WebSocket", "EventSource", "Worker", "SharedWorker", "ServiceWorker", "BroadcastChannel", "postMessage",
    "importScripts", "setTimeout", "setInterval", "setImmediate", "queueMicrotask", "requestAnimationFrame", "Promise", "async", "await",
    "then", "localStorage", "sessionStorage", "indexedDB", "caches", "navigator", "location", "crypto", "Reflect", "Proxy", "Symbol",
    "WebAssembly", "Atomics", "SharedArrayBuffer", "Intl", "fromCharCode", "fromCodePoint", "join", "concat", "replace", "replaceAll",
    "raw", "defineProperty", "getPrototypeOf", "setPrototypeOf", "getOwnPropertyDescriptor", "with", "arguments", "callee", "bind",
    "apply", "call", "this", "new", "class", "debugger", "atob", "btoa", "escape", "unescape", "decodeURI", "decodeURIComponent",
)
RE_MOTS_E = re.compile(r"\b(" + "|".join(MOTS_INTERDITS_E) + r")\b")
MOTIFS_TEXTE_E = (
    (re.compile(r"`"), "gabarit de texte (`) interdit"),
    (re.compile(r"\\[ux]"), "séquence d'échappement \\u ou \\x interdite"),
    (re.compile(r"""['"]\s*\+|\+\s*['"]"""), "concaténation de textes interdite"),
    (re.compile(r"[^\x09\x0a\x0d\x20-\x7e]"), "caractère hors ASCII imprimable"),
)
RE_EXPORT = re.compile(r"\bexport\b")
RE_EXPORT_EXECUTER = re.compile(r"^export function executer\(", re.M)

# --------------------------------------------------------------------------------------------- O : affichage
FEUILLE_O = "app/styles.css"
RE_ICONE_O = re.compile(r"^app/icones/[a-z0-9][a-z0-9-]{0,60}\.svg$")
ICONE_OCTETS_MAX = 50000
PROPRIETES_O = ("color", "background-color", "accent-color", "outline-color", "caret-color", "font-family", "font-size", "font-weight",
                "font-style", "line-height", "letter-spacing", "word-spacing", "text-align", "text-decoration-color", "gap", "row-gap",
                "column-gap", "box-shadow", "text-shadow", "border-radius")
PREFIXES_O = ("margin", "padding", "border-")
INTERDITS_CSS = (re.compile(r"@import", re.I), re.compile(r"url\s*\(", re.I), re.compile(r"expression\s*\(", re.I),
                 re.compile(r"-moz-binding", re.I), re.compile(r"\bbehavior\b", re.I), re.compile(r"\\"))
INTERDITS_SVG = (re.compile(r"<\s*script", re.I), re.compile(r"\son[a-z]+\s*=", re.I), re.compile(r"<\s*foreignObject", re.I),
                 re.compile(r"<!\s*(ENTITY|DOCTYPE)", re.I), re.compile(r"javascript:", re.I),
                 re.compile(r"""href\s*=\s*["'](?!#)""", re.I), re.compile(r"""url\s*\(\s*['"]?(?!#)""", re.I),
                 re.compile(r"<\s*(iframe|object|embed|image|use)\b", re.I))

# --------------------------------------------------------------------------------------------- branchement de la porte
FICHIERS_BRANCHEMENT = ("app/main.js", "app/index.html")
RE_BLOC = re.compile(r"^[ \t]*(?://|<!--) === DEBUT_BRANCHEMENT_ESSAIS_([A-Z_]+) ===(?: -->)?\n.*?^[ \t]*(?://|<!--) === FIN_BRANCHEMENT_ESSAIS_\1 ===(?: -->)?\n", re.S | re.M)
RE_BALISE = re.compile(r"(DEBUT|FIN)_BRANCHEMENT_ESSAIS_([A-Z_]+)")
RE_LIGNE_ESSAI = re.compile(r"essai", re.I)
ACCES_INTERDITS = (re.compile(r"naissance-essais"), re.compile(r"naissance-ia\.essais"), re.compile(r"""['"/]essais/"""),
                   re.compile(r"""['"]\.?\.?/?essais['"]"""))


class ContratRompu(Exception):
    """Le colis modifie le branchement de la porte d'essai : refus (dépôt manuel seulement)."""


def _texte(octets):
    if octets is None:
        return None
    try:
        return octets.decode("utf-8")
    except UnicodeDecodeError:
        return None


def _canon(x):
    return json.dumps(x, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _entier(x):
    return type(x) is int


# ------------------------------------------------------------------------------------------------ branchement
def blocs_branchement(texte, chemin):
    """{nom: texte du bloc} ; balise orpheline ou en double -> ContratRompu."""
    blocs = {}
    for m in RE_BLOC.finditer(texte):
        if m.group(1) in blocs:
            raise ContratRompu(f"{chemin} : bloc BRANCHEMENT_ESSAIS_{m.group(1)} en double")
        blocs[m.group(1)] = m.group(0)
    balises = RE_BALISE.findall(texte)
    if len(balises) != 2 * len(blocs):
        raise ContratRompu(f"{chemin} : balise BRANCHEMENT_ESSAIS orpheline ou mal formée")
    return blocs


def lignes_hors_blocs(texte):
    return [l for l in RE_BLOC.sub("", texte).split("\n") if RE_LIGNE_ESSAI.search(l)]


def controler_branchement(changements, lire_avant, lire_apres):
    """Lève ContratRompu si le branchement de la porte d'essai change. Rien à vérifier tant que la base n'a pas de bloc balisé."""
    changes = {c["chemin"]: c for c in changements}
    for chemin in FICHIERS_BRANCHEMENT:
        avant = _texte(lire_avant(chemin))
        if avant is None or not RE_BLOC.search(avant):
            continue
        if chemin not in changes:
            continue
        apres = _texte(lire_apres(chemin))
        if apres is None:
            raise ContratRompu(f"{chemin} supprimé ou illisible : branchement de la porte d'essai perdu")
        ba, bb = blocs_branchement(avant, chemin), blocs_branchement(apres, chemin)
        for nom in sorted(set(ba) | set(bb)):
            if ba.get(nom) != bb.get(nom):
                raise ContratRompu(f"{chemin} : bloc BRANCHEMENT_ESSAIS_{nom} modifié (dépôt manuel seulement)")
        if lignes_hors_blocs(avant) != lignes_hors_blocs(apres):
            raise ContratRompu(f"{chemin} : ligne nommant les essais ajoutée, retirée ou modifiée hors des blocs balisés")
    for c in changements:
        p = c["chemin"]
        if not p.startswith("app/") or p.startswith("app/essais/") or p in FICHIERS_BRANCHEMENT or c["statut"] == "D":
            continue
        texte = _texte(lire_apres(p))
        if texte is None:
            continue
        avant = _texte(lire_avant(p)) or ""
        for motif in ACCES_INTERDITS:
            if len(motif.findall(texte)) > len(motif.findall(avant)):
                raise ContratRompu(f"« {p} » ajoute un accès aux essais hors de la porte ({motif.pattern})")


# ------------------------------------------------------------------------------------------------ E
def _tables_de_la_base(lire_avant):
    texte = _texte(lire_avant("app/langage/connaissances.js")) or ""
    m = re.search(r"^export const TABLES = Object\.freeze\(\[(.*?)\]\)", texte, re.M | re.S) or \
        re.search(r"^export const TABLES = \[(.*?)\]", texte, re.M | re.S)
    return tuple(re.findall(r"'([A-Za-z0-9]+)'", m.group(1))) if m else ()


def _ids_figes(lire_avant):
    texte = _texte(lire_avant("app/essais/registre-essais.js")) or ""
    m = re.search(r"export const CATALOGUE = gel\(\[(.*?)\n\]\);", texte, re.S)
    return set(re.findall(r"\bid: '([a-z0-9-]+)'", m.group(1))) if m else set()


def valider_declaration(d, tables, reserves):
    if not isinstance(d, dict):
        return "déclaration illisible"
    intrus = [k for k in d if k not in CHAMPS_E]
    if intrus:
        return f"champ refusé ({', '.join(sorted(intrus)[:3])})"
    i = d.get("id")
    if not isinstance(i, str) or not RE_ID.match(i):
        return "identifiant invalide"
    if i in reserves:
        return f"{i} : identifiant du catalogue figé"
    if not isinstance(d.get("titre"), str) or not d["titre"]:
        return f"{i} : titre manquant"
    if "description" in d and not isinstance(d["description"], str):
        return f"{i} : description non textuelle"
    if d.get("effet") != "zone-essai":
        return f"{i} : effet autre que la zone d'essai"
    lit = d.get("lit")
    if not isinstance(lit, list) or len(set(map(str, lit))) != len(lit) or \
            any(not isinstance(t, str) or not RE_TABLE.match(t) or t not in tables for t in lit):
        return f"{i} : tables lues inconnues ou en double"
    dec = d.get("declencheurs")
    if not isinstance(dec, list) or not dec or any(x not in DECLENCHEURS for x in dec):
        return f"{i} : déclencheur refusé"
    if not _entier(d.get("delaiMs")) or not 100 <= d["delaiMs"] <= DELAI_MAX_MS:
        return f"{i} : délai refusé"
    if not _entier(d.get("maxLignes")) or not 1 <= d["maxLignes"] <= LIGNES_MAX:
        return f"{i} : nombre de lignes refusé"
    inv = d.get("invariants")
    if not isinstance(inv, list) or len(inv) > INVARIANTS_MAX:
        return f"{i} : invariants refusés"
    for x in inv:
        if not isinstance(x, dict) or x.get("type") not in TYPES_INVARIANT:
            return f"{i} : invariant inconnu"
        if x["type"] == "champs" and (not isinstance(x.get("champs"), list) or not x["champs"] or
                                      any(not isinstance(c, str) or not c for c in x["champs"])):
            return f"{i} : invariant « champs » invalide"
        if x["type"] == "unique" and (not isinstance(x.get("champ"), str) or not x["champ"]):
            return f"{i} : invariant « unique » invalide"
        if x["type"] == "max-par-execution" and (not _entier(x.get("n")) or x["n"] < 1):
            return f"{i} : invariant « max-par-execution » invalide"
    if "epreuves" in d and (not isinstance(d["epreuves"], list) or any(x not in EPREUVES for x in d["epreuves"])):
        return f"{i} : épreuve inconnue"
    return None


def lire_catalogue(octets, tables, reserves):
    """-> (liste de déclarations, None) ou (None, motif)."""
    if octets is None:
        return [], None
    if len(octets) > CATALOGUE_OCTETS_MAX:
        return None, "catalogue trop grand"
    try:
        objet = json.loads(octets.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        return None, "catalogue illisible (JSON)"
    if not isinstance(objet, dict) or set(objet) != {"format", "v", "capacites"} or objet["format"] != FORMAT_E or \
            objet["v"] != 1 or not isinstance(objet["capacites"], list):
        return None, "catalogue de forme inattendue"
    if len(objet["capacites"]) > CAPACITES_MAX:
        return None, f"catalogue : plus de {CAPACITES_MAX} capacités"
    ids = set()
    for d in objet["capacites"]:
        motif = valider_declaration(d, tables, reserves)
        if motif:
            return None, f"catalogue : {motif}"
        if d["id"] in ids:
            return None, f"catalogue : {d['id']} en double"
        ids.add(d["id"])
    return objet["capacites"], None


def examiner_module_e(chemin, octets):
    if octets is None:
        return f"{chemin} illisible"
    if len(octets) > MODULE_OCTETS_MAX:
        return f"{chemin} : module trop grand"
    texte = _texte(octets)
    if texte is None:
        return f"{chemin} : module non UTF-8"
    for motif, raison in MOTIFS_TEXTE_E:
        if motif.search(texte):
            return f"{chemin} : {raison}"
    sans_export = RE_EXPORT_EXECUTER.sub("function executer(", texte, count=1)
    if len(RE_EXPORT_EXECUTER.findall(texte)) != 1 or RE_EXPORT.search(sans_export):
        return f"{chemin} : un seul export attendu (export function executer)"
    m = RE_MOTS_E.search(texte)
    if m:
        return f"{chemin} : mot interdit « {m.group(1)} »"
    return None


def examiner_e(changements, lire_avant, lire_apres, lister_apres):
    if not changements:
        return "aucun changement"
    tables = _tables_de_la_base(lire_avant)
    if not tables:
        return "liste des tables de la base illisible"
    reserves = _ids_figes(lire_avant)
    if not reserves:
        return "catalogue figé de la base illisible"
    for c in changements:
        p, s = c["chemin"], c["statut"]
        if p == CATALOGUE_E and s in ("A", "M"):
            continue
        if RE_MODULE_E.match(p) and s in ("A", "M"):
            continue
        if RE_TEST_E.match(p) and s == "A":
            continue
        return f"« {s} {p} » hors des règles de la classe E"
    avant, motif = lire_catalogue(lire_avant(CATALOGUE_E), tables, reserves)
    if motif:
        return f"base : {motif}"
    apres, motif = lire_catalogue(lire_apres(CATALOGUE_E), tables, reserves)
    if motif:
        return motif
    ids_avant = {d["id"] for d in avant}
    ids = {d["id"] for d in apres}
    if not ids_avant <= ids:
        return f"capacité retirée ({', '.join(sorted(ids_avant - ids))}) : relève de R, pas de E"
    modules = {RE_MODULE_E.match(p).group(1) for p in lister_apres() if RE_MODULE_E.match(p)}
    autres = [p for p in lister_apres() if p.startswith(DOSSIER_E) and p != CATALOGUE_E and not RE_MODULE_E.match(p)]
    if autres:
        return f"fichier inattendu dans {DOSSIER_E} : {autres[0]}"
    if modules != ids:
        return f"modules et catalogue ne correspondent pas (modules sans entrée : {sorted(modules - ids)[:3]}, entrées sans module : {sorted(ids - modules)[:3]})"
    for c in changements:
        m = RE_MODULE_E.match(c["chemin"])
        if m:
            motif = examiner_module_e(c["chemin"], lire_apres(c["chemin"]))
            if motif:
                return motif
        t = RE_TEST_E.match(c["chemin"])
        if t and t.group(1) not in ids:
            return f"test {c['chemin']} sans capacité correspondante"
    for p in lister_apres():
        if not p.startswith("app/") or p.startswith("app/essais/") or p.startswith(DOSSIER_E):
            continue
        if posixpath.splitext(p)[1] not in (".js", ".mjs", ".html", ".css", ".json", ".webmanifest"):
            continue
        texte = _texte(lire_apres(p)) or ""
        if "capacites-essai" in texte:
            return f"« {p} » référence les capacités livrées hors de la porte"
    return None


# ------------------------------------------------------------------------------------------------ E stricte (voie automatique)
def examiner_auto(changements, lire_avant, lire_apres, lister_apres):
    """None si le colis, déjà classé E, ajoute exactement une capacité neuve sans rien toucher d'existant ; sinon la règle non satisfaite."""
    motif = examiner_e(changements, lire_avant, lire_apres, lister_apres)
    if motif:
        return f"E : {motif}"
    tables = _tables_de_la_base(lire_avant)
    reserves = _ids_figes(lire_avant)
    avant, motif = lire_catalogue(lire_avant(CATALOGUE_E), tables, reserves)
    if motif:
        return f"base : {motif}"
    apres, motif = lire_catalogue(lire_apres(CATALOGUE_E), tables, reserves)
    if motif:
        return motif
    canon_avant = {d["id"]: _canon(d) for d in avant}
    neuves = [d["id"] for d in apres if d["id"] not in canon_avant]
    if len(neuves) != 1:
        return f"{len(neuves)} capacité(s) neuve(s) : la voie automatique en exige exactement une"
    neuve = neuves[0]
    for d in apres:
        if d["id"] in canon_avant and canon_avant[d["id"]] != _canon(d):
            return f"capacité déjà livrée modifiée ({d['id']})"
    tests = 0
    for c in changements:
        p, s = c["chemin"], c["statut"]
        if p == CATALOGUE_E:
            continue
        m = RE_MODULE_E.match(p)
        if m:
            if s != "A" or m.group(1) != neuve:
                return f"« {s} {p} » : seul le module neuf {neuve}.js peut être ajouté"
            continue
        t = RE_TEST_E.match(p)
        if t and s == "A" and t.group(1) == neuve:
            tests += 1
            continue
        return f"« {s} {p} » hors de la capacité neuve {neuve}"
    if not any(c["chemin"] == f"{DOSSIER_E}{neuve}.js" and c["statut"] == "A" for c in changements):
        return f"module {neuve}.js absent"
    if tests < 1:
        return f"aucun test à son nom pour {neuve}"
    return None


# ------------------------------------------------------------------------------------------------ O
def _regles_css(texte):
    """Feuille -> liste de (contexte, sélecteur, propriété, valeur) ; None si la structure est illisible."""
    texte = re.sub(r"/\*.*?\*/", "", texte, flags=re.S)
    sortie, pile, i, debut = [], [], 0, 0
    while i < len(texte):
        ch = texte[i]
        if ch == "{":
            pile.append(" ".join(texte[debut:i].split()))
            debut = i + 1
        elif ch == "}":
            if not pile:
                return None
            selecteur = pile.pop()
            corps = texte[debut:i]
            if "{" not in corps:
                for decl in corps.split(";"):
                    if not decl.strip():
                        continue
                    if ":" not in decl:
                        return None
                    prop, val = decl.split(":", 1)
                    sortie.append((" > ".join(pile), selecteur, prop.strip().lower(), " ".join(val.split())))
            debut = i + 1
        elif ch in "\"'":
            j = texte.find(ch, i + 1)
            if j < 0:
                return None
            i = j
        i += 1
    if pile or texte[debut:].strip():
        return None
    return sortie


def _propriete_o(prop):
    return prop in PROPRIETES_O or any(prop.startswith(x) for x in PREFIXES_O)


def examiner_o(changements, lire_avant, lire_apres):
    if not changements:
        return "aucun changement"
    for c in changements:
        p, s = c["chemin"], c["statut"]
        if p == FEUILLE_O and s == "M":
            avant, apres = _texte(lire_avant(p)), _texte(lire_apres(p))
            if avant is None or apres is None:
                return f"{p} illisible"
            for motif in INTERDITS_CSS:
                if len(motif.findall(apres)) > len(motif.findall(avant)):
                    return f"{p} : construction interdite ajoutée ({motif.pattern})"
            ra, rb = _regles_css(avant), _regles_css(apres)
            if ra is None or rb is None:
                return f"{p} : feuille de style illisible"
            diff = (Counter(rb) - Counter(ra)) + (Counter(ra) - Counter(rb))
            for (_, sel, prop, _) in diff:
                if not _propriete_o(prop):
                    return f"{p} : propriété « {prop} » hors de la liste de présentation ({sel[:60]})"
                if prop.startswith("--"):
                    return f"{p} : variable CSS « {prop} » modifiée"
            continue
        if RE_ICONE_O.match(p) and s in ("A", "M"):
            octets = lire_apres(p)
            texte = _texte(octets)
            if texte is None or len(octets) > ICONE_OCTETS_MAX:
                return f"{p} : icône illisible ou trop grande"
            for motif in INTERDITS_SVG:
                if motif.search(texte):
                    return f"{p} : icône active ({motif.pattern})"
            continue
        return f"« {s} {p} » hors des règles de la classe O"
    return None


# ------------------------------------------------------------------------------------------------ R
def examiner_r(changements, lire_avant, lire_apres):
    if not changements:
        return "aucun changement"
    tables = _tables_de_la_base(lire_avant)
    reserves = _ids_figes(lire_avant)
    avant, motif = lire_catalogue(lire_avant(CATALOGUE_E), tables, reserves)
    if motif or not avant:
        return "aucune capacité livrée à retirer dans la base"
    apres_octets = lire_apres(CATALOGUE_E)
    if apres_octets is None:
        apres = []
    else:
        try:
            objet = json.loads(apres_octets.decode("utf-8"))
            apres = objet["capacites"] if isinstance(objet, dict) and objet.get("format") == FORMAT_E and objet.get("v") == 1 else None
        except (UnicodeDecodeError, ValueError, KeyError, TypeError):
            apres = None
        if not isinstance(apres, list):
            return "catalogue après retrait illisible"
    ids_avant = {d["id"]: _canon(d) for d in avant}
    restantes = {}
    for d in apres:
        if not isinstance(d, dict) or d.get("id") not in ids_avant or ids_avant[d["id"]] != _canon(d) or d["id"] in restantes:
            return "le catalogue ne fait pas que retirer des entrées (entrée ajoutée ou modifiée)"
        restantes[d["id"]] = True
    retirees = set(ids_avant) - set(restantes)
    if not retirees:
        return "aucune capacité retirée"
    attendu_d = {f"{DOSSIER_E}{i}.js" for i in retirees}
    vus = set()
    for c in changements:
        p, s = c["chemin"], c["statut"]
        if p == CATALOGUE_E and s in ("M", "D"):
            continue
        if s == "D" and p in attendu_d:
            vus.add(p)
            continue
        t = RE_TEST_E.match(p)
        if s == "D" and t and t.group(1) in retirees:
            continue
        return f"« {s} {p} » hors des règles de la classe R"
    if vus != attendu_d:
        return f"module de capacité retirée non supprimé : {sorted(attendu_d - vus)[:3]}"
    return None


# ------------------------------------------------------------------------------------------------ signaux (motifs de S)
RE_TITRE_TEST = re.compile(r"^\s*(?:test|it)\s*\(", re.M)
RE_ASSERT = re.compile(r"\bassert\b")


def signaux(changements, lire_avant, lire_apres):
    out = []
    for c in changements:
        p, s = c["chemin"], c["statut"]
        if p.startswith("tests/") and s in ("M", "D"):
            a, b = _texte(lire_avant(p)) or "", _texte(lire_apres(p)) or ""
            ta, tb = len(RE_TITRE_TEST.findall(a)), len(RE_TITRE_TEST.findall(b))
            aa, ab = len(RE_ASSERT.findall(a)), len(RE_ASSERT.findall(b))
            detail = " (supprimé)" if s == "D" else ""
            if tb < ta:
                detail += f" ; tests {ta} → {tb}"
            if ab < aa:
                detail += f" ; assertions {aa} → {ab}"
            out.append(f"test existant modifié : {p}{detail}")
        elif s == "D" and p.startswith("app/"):
            out.append(f"fichier de l'application supprimé : {p}")
    for d in ("app/langage/", "app/esprit/", "app/memoire/", "app/moteur-local/", "app/conversation/", "app/actions/"):
        n = sum(1 for c in changements if c["chemin"].startswith(d))
        if n:
            out.append(f"{n} fichier(s) cognitif(s) sous {d}")
    return out


# ------------------------------------------------------------------------------------------------ voie élargie (ATELIER 3)
RE_BASE_COGNITIVE = re.compile(r"^export const (VERSION_BASE|SCHEMA_SAUVEGARDE|TABLES) = (.*)$", re.M)
HORS_ELARGIE = ("app/atelier/", "app/capacites/", "app/essais/")
# SOCLE RENFORCÉ (GO « ATELIER 3 — PRÉPARATION », point 4) : tout ce qui pense, se souvient, parle au moteur ou branche l'application.
# Un colis qui y AJOUTE ou y MODIFIE un fichier n'est jamais livré par la voie élargie (V4 de Christophe) : aucun scénario, si bien écrit
# soit-il, ne suffit à livrer seul une modification cognitive (point 2).
SOCLE_RENFORCE = ("app/langage/", "app/esprit/", "app/memoire/", "app/actions/", "app/conversation/", "app/moteur-local/",
                  "app/fournisseurs/", "app/capacites-essai/")
SOCLE_RENFORCE_FICHIERS = ("app/main.js", "app/index.html", "app/sw.js", "app/natif.js", "app/version.js", "app/manifest.webmanifest",
                           "app/reglages/cle.js", "app/reglages/stockage.js")
# Primitives qu'un fichier de la voie élargie ne peut pas employer PLUS qu'avant : stockage (mémoire, clé), réseau, code dynamique, et
# détection du joueur d'acceptation (un candidat qui se comporterait autrement sous le robot).
PRIMITIVES_ELARGIE = ("indexedDB", "localStorage", "sessionStorage", "caches", "serviceWorker", "fetch", "XMLHttpRequest", "WebSocket",
                      "EventSource", "sendBeacon", "importScripts", "eval", "Function", "webdriver", "HeadlessChrome", "playwright",
                      "Playwright", "__pw", "navigator.userAgent")
RE_IMPORT = re.compile(r"""(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]""")


def _dans_socle(p):
    return p.startswith(SOCLE_RENFORCE) or p in SOCLE_RENFORCE_FICHIERS


def _compte(texte, mot):
    return len(re.findall(r"(?<![A-Za-z0-9_$])" + re.escape(mot) + r"(?![A-Za-z0-9_$])", texte or ""))


def _imports(chemin, texte):
    dossier = posixpath.dirname(chemin)
    out = set()
    for m in RE_IMPORT.finditer(texte or ""):
        cible = m.group(1)
        out.add(posixpath.normpath(posixpath.join(dossier, cible)) if cible.startswith(".") else cible)
    return out


def _base_cognitive(texte):
    return {m.group(1): m.group(2).split("//")[0].strip() for m in RE_BASE_COGNITIVE.finditer(texte or "")}


def examiner_elargie(changements, lire_avant, lire_apres):
    """-> None si le colis est admissible à la voie élargie, sinon la première règle non satisfaite."""
    if not changements:
        return "aucun changement"
    for c in changements:
        p, s = c["chemin"], c["statut"]
        if s not in ("A", "M"):
            return f"« {p} » : changement {s} (seuls ajouts et modifications)"
        if p.startswith("tests/"):
            if s != "A":
                return f"test existant modifié : {p}"
            continue
        if not p.startswith("app/") or p.startswith(HORS_ELARGIE):
            return f"« {p} » : hors de app/ applicatif (racine, configuration native, outillage ou protections)"
        if _dans_socle(p):
            return f"« {p} » : socle cognitif ou branchement de l'application (protection renforcée, V4)"
        avant, apres = _texte(lire_avant(p)) if s == "M" else "", _texte(lire_apres(p))
        if avant is None or apres is None:
            return f"« {p} » : fichier non textuel (protection renforcée)"
        for mot in PRIMITIVES_ELARGIE:
            if _compte(apres, mot) > _compte(avant, mot):
                return f"« {p} » : emploie davantage « {mot} » (stockage, réseau, code dynamique ou détection du robot)"
        for cible in sorted(_imports(p, apres) - _imports(p, avant)):
            if not cible.startswith("app/") or _dans_socle(cible) or cible.startswith(HORS_ELARGIE):
                return f"« {p} » : nouvel import de « {cible} » (seuls des modules applicatifs hors du socle)"
        if s == "M" and _base_cognitive(_texte(lire_avant(p))) != _base_cognitive(_texte(lire_apres(p))):
            return f"migration : VERSION_BASE, SCHEMA_SAUVEGARDE ou TABLES changé dans {p}"
        if s == "A" and _base_cognitive(_texte(lire_apres(p))):
            return f"migration : VERSION_BASE, SCHEMA_SAUVEGARDE ou TABLES déclaré dans le nouveau fichier {p}"
    return None


# ------------------------------------------------------------------------------------------------ classification
def classer(changements, lire_avant, lire_apres, lister_apres, action="livraison"):
    """-> {"classe", "motifs", "examens": {E, O, R: motif ou None}, "auto": None si E stricte, sinon motif,
    "elargie": None si admissible à la voie élargie (ATELIER 3), sinon motif}. Jamais d'exception : un doute classe en S et ferme les voies
    automatiques."""
    r = _classer(changements, lire_avant, lire_apres, lister_apres, action)
    if action != "livraison" or r["classe"] == "R":
        r["elargie"] = f"classe {r['classe']}" if action == "livraison" else f"action « {action} »"
    else:
        try:
            r["elargie"] = examiner_elargie(changements, lire_avant, lire_apres)
        except Exception as e:  # un examen qui échoue n'ouvre jamais la voie élargie
            r["elargie"] = f"examen impossible ({type(e).__name__})"
    return r


def _classer(changements, lire_avant, lire_apres, lister_apres, action):
    examens = {}
    if action != "livraison":
        examens = {k: f"action « {action} »" for k in ("E", "O", "R")}
    else:
        for cle, fn in (("R", lambda: examiner_r(changements, lire_avant, lire_apres)),
                        ("E", lambda: examiner_e(changements, lire_avant, lire_apres, lister_apres)),
                        ("O", lambda: examiner_o(changements, lire_avant, lire_apres))):
            try:
                examens[cle] = fn()
            except Exception as e:  # un examen qui échoue ne classe jamais au-dessus de S
                examens[cle] = f"examen impossible ({type(e).__name__})"
    reussies = [k for k in ("R", "E", "O") if examens[k] is None]
    if len(reussies) == 1:
        auto = "classe autre que E"
        if reussies[0] == "E":
            try:
                auto = examiner_auto(changements, lire_avant, lire_apres, lister_apres)
            except Exception as e:  # un examen qui échoue n'ouvre jamais la voie automatique
                auto = f"examen impossible ({type(e).__name__})"
        return {"classe": reussies[0], "motifs": [], "examens": examens, "auto": auto}
    motifs = [f"{k} : {examens[k]}" for k in ("E", "O", "R") if examens[k]]
    if len(reussies) > 1:
        motifs = [f"plusieurs classes satisfaites ({', '.join(reussies)}) : ambigu"]
    try:
        motifs += signaux(changements, lire_avant, lire_apres)
    except Exception as e:
        motifs.append(f"signaux impossibles ({type(e).__name__})")
    return {"classe": "S", "motifs": motifs[:MOTIFS_MAX], "examens": examens, "auto": "classe S"}


# ------------------------------------------------------------------------------------------------ comparaison (mode ombre)
def comparer(contrats, attendus):
    """contrats : [contrat.json de l'inventaire] ; attendus : {zip_sha256: classe jugée à la main}.
    -> {"total", "accords", "desaccords": [...], "sans_jugement": [...]} (préparation de l'activation : jamais utilisé pour décider)."""
    accords, desaccords, sans = 0, [], []
    for c in contrats:
        cle = c.get("zip_sha256", "")
        calc = c.get("classe", "")
        juge = attendus.get(cle)
        if juge is None:
            sans.append({"zip": c.get("zip_nom", ""), "classe": calc})
        elif juge == calc:
            accords += 1
        else:
            desaccords.append({"zip": c.get("zip_nom", ""), "calculee": calc, "jugee": juge, "motifs": c.get("classe_motifs", [])})
    return {"total": len(contrats), "accords": accords, "desaccords": desaccords, "sans_jugement": sans}
