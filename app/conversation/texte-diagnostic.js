// === DEBUT_CONVERSATION_TEXTE_DIAGNOSTIC ===
// v0.64.30 — OUTIL-1 « COPIER LE DIAGNOSTIC » (GO ChatGPT « GO DÉVELOPPEMENT OUTIL-1 v0.64.30 », 16/10/2026).
// OUTILLAGE NON COGNITIF — aucune acquisition de Naissance. Ce module ne connaît ni le moteur, ni la mémoire, ni aucune table : il SÉRIALISE
// en texte brut la représentation UI DÉJÀ CONSTRUITE du panneau Diagnostic, telle qu'elle est en mémoire au moment du geste.
//
// texteDiagnostic(racine) -> chaîne
//   racine : l'élément du panneau (details.diagnostic). Parcours en ordre du document, LECTURE SEULE (aucune propriété écrite, aucun
//   évènement, aucun `open` modifié : replié visuellement ≠ absent du texte copié).
//   - summary : son texte, comme titre de bloc ;
//   - bouton (button) : ignoré (bruit interactif, pas un contenu) ;
//   - élément sans aucun nœud enfant : son textContent (une ligne ; vide → rien) ;
//   - élément avec des nœuds : ses nœuds dans l'ordre (nœud texte non blanc → une ligne ; élément → récursion) ;
//   - SECTION PARESSEUSE (classe CLASSE_PARESSEUSE) dont rien n'a jamais été construit hors de son titre : la ligne MARQUE_NON_OUVERTE.
//     Elle n'est jamais ouverte, chargée ni calculée ici. Une section déjà construite puis refermée est copiée telle qu'elle est.
//   Retrait : deux espaces par niveau de bloc repliable (details) imbriqué sous la racine ; aucun autre ajout (ni résumé, ni compte, ni
//   interprétation, ni donnée absente de la représentation).
//   v0.64.32 — OUTIL-2 « DIAGNOSTIC RÉCENT EN TÊTE » (GO ChatGPT « DÉCISION VALIDATION v0.64.31 », 16/10/2026). OUTILLAGE NON COGNITIF.
//   - conteneur de classe CLASSE_RECENT_EN_TETE : ses enfants de classe CLASSE_ACTE_RECENT sont copiés EN PREMIER, puis tous les autres ; chaque
//     groupe garde l'ordre du document. Aucune ligne supprimée ni ajoutée, aucun tri : seul l'ordre du TEXTE copié change. Le marquage est posé
//     par l'écran au moment où il construit la représentation ; il n'est ni calculé ni interprété ici.
// PURETÉ : aucune écriture, aucune horloge, aucun hasard, aucun état, aucun import.
export const CLASSE_PARESSEUSE = 'section-paresseuse';
export const MARQUE_NON_OUVERTE = '(section non ouverte)';
export const CLASSE_RECENT_EN_TETE = 'recent-en-tete'; // v0.64.32
export const CLASSE_ACTE_RECENT = 'acte-recent'; // v0.64.32

const nomDe = (e) => String(e.tagName ?? '').toLowerCase();
const estTexte = (n) => n !== null && typeof n === 'object' && n.nodeType === 3;
const estAutre = (n) => n !== null && typeof n === 'object' && typeof n.nodeType === 'number' && n.nodeType !== 1 && n.nodeType !== 3; // commentaire… : ignoré
const enfantsElements = (e) => Array.from(e.childNodes ?? []).filter((n) => !estTexte(n) && !estAutre(n));
const aClasse = (e, c) => Boolean(e.classList && typeof e.classList.contains === 'function' && e.classList.contains(c));

export function texteDiagnostic(racine) {
  if (racine === null || typeof racine !== 'object') throw new TypeError('texteDiagnostic : racine doit être un élément.');
  const lignes = [];
  const pousser = (texte, retrait) => {
    const t = String(texte ?? '');
    if (t.trim().length > 0) lignes.push('  '.repeat(retrait) + t);
  };
  const parcourir = (e, retrait) => {
    const nom = nomDe(e);
    if (nom === 'button') return;
    const tous = Array.from(e.childNodes ?? []).filter((n) => !estAutre(n));
    const recent = (n) => !estTexte(n) && aClasse(n, CLASSE_ACTE_RECENT);
    const noeuds = aClasse(e, CLASSE_RECENT_EN_TETE) ? [...tous.filter(recent), ...tous.filter((n) => !recent(n))] : tous; // v0.64.32
    if (noeuds.length === 0) { pousser(e.textContent, retrait); return; }
    const elements = enfantsElements(e);
    const interieur = nom === 'details' && e !== racine ? retrait + 1 : retrait;
    for (const n of noeuds) {
      if (estTexte(n)) pousser(n.textContent, interieur);
      else if (nomDe(n) === 'summary') pousser(n.textContent, retrait);
      else parcourir(n, interieur);
    }
    if (aClasse(e, CLASSE_PARESSEUSE) && elements.every((n) => nomDe(n) === 'summary')) pousser(MARQUE_NON_OUVERTE, interieur);
  };
  parcourir(racine, 0);
  return lignes.join('\n');
}
// === FIN_CONVERSATION_TEXTE_DIAGNOSTIC ===
