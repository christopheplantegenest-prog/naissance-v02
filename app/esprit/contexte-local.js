// === DEBUT_CONTEXTE_LOCAL ===
// Contexte pour un petit moteur local : budget réduit (≈ 700 jetons d'invite).
// Priorités : 1. identité essentielle ; 2. message actuel ; 3. dernier échange ;
// 4. quelques souvenirs seulement. Jamais toute la mémoire.
// Le PRÉFIXE (identité, jour, souvenirs essentiels) reste identique d'un message à l'autre
// pour que le moteur puisse le garder en cache.

import { motsCles } from '../memoire/selection.js';
import { traitsActifs } from './identite.js';
import { estimerJetons } from '../moteur-local/profil.js';

export const BUDGETS_LOCAL = Object.freeze({
  prefixe: 380,
  suite: 320,
  message: 150,
  historique: 140,
  souvenirsPrefixe: 110,
  souvenirsSuite: 60,
  ligneSouvenir: 150,
  messageHistorique: 210,
  gabaritParMessage: 6,
});

const remplir = (t, personne) => String(t).replaceAll('{personne}', personne);

function couper(texte, max) {
  const t = String(texte || '').replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

// Première phrase d'un principe (jusqu'au premier point ou deux-points).
export function premierePhrase(principe) {
  const t = String(principe).trim();
  const i = t.search(/\s?[.:](\s|$)/);
  return (i >= 0 ? t.slice(0, i) : t).trim();
}

export function identiteCompacte({ identite, moteur }) {
  const n = identite.noyau;
  const principes = n.principes.map((p) => premierePhrase(remplir(p, n.personne))).filter(Boolean);
  const traits = traitsActifs(identite).map((t) => remplir(t.texte, n.personne));
  return [
    `Tu es ${n.nom}, ${remplir(n.nature, n.personne)}. Tu parles avec ${n.personne}.`,
    `En ce moment, tu fonctionnes avec un petit moteur local (${moteur}), qui n'est pas toi. Tu ne peux faire aucune action.`,
    `Tes principes : ${principes.join(' ; ')}.`,
    traits.length ? `Ta personnalité : ${traits.join(' ; ')}.` : '',
    `${remplir(n.langue, n.personne)} Réponds brièvement, en deux à quatre phrases. Si une question te dépasse, dis-le simplement.`,
  ].filter(Boolean).join('\n');
}

function communs(a, b) {
  let n = 0;
  for (const m of a) if (b.has(m)) n++;
  return n;
}

export function composerContexteLocal({
  identite, souvenirs, recents, message, moteur, maintenant, budgets = BUDGETS_LOCAL,
}) {
  const actifs = (souvenirs || []).filter((s) => s.statut !== 'archive');

  // --- préfixe stable ---
  const jour = maintenant.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const base = `${identiteCompacte({ identite, moteur })}\nNous sommes le ${jour}.`;
  const essentiels = actifs
    .filter((s) => s.importance === 3)
    .sort((a, b) => String(a.cree || '').localeCompare(String(b.cree || '')) || String(a.id).localeCompare(String(b.id)));
  const dansPrefixe = [];
  let reste = Math.min(budgets.souvenirsPrefixe, budgets.prefixe - estimerJetons(base) - 20);
  for (const s of essentiels) {
    const ligne = `- ${couper(s.texte, budgets.ligneSouvenir)}`;
    const cout = estimerJetons(ligne) + 1;
    if (cout > reste) continue;
    dansPrefixe.push({ s, ligne });
    reste -= cout;
  }
  const prefixe = dansPrefixe.length
    ? `${base}\nCe que tu sais d'important (souvenirs, pas des certitudes) :\n${dansPrefixe.map((x) => x.ligne).join('\n')}`
    : base;

  // --- souvenirs utiles pour ce message ---
  const cles = motsCles(message);
  const dejaLa = new Set(dansPrefixe.map((x) => x.s.id));
  const candidats = actifs
    .filter((s) => !dejaLa.has(s.id))
    .map((s) => ({ s, n: communs(cles, motsCles(s.texte)) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || (b.s.importance || 1) - (a.s.importance || 1));
  const lignesSuite = [];
  const pertinents = [];
  let resteSuite = budgets.souvenirsSuite;
  for (const { s } of candidats) {
    const ligne = `- ${couper(s.texte, budgets.ligneSouvenir)}`;
    const cout = estimerJetons(ligne) + 1;
    if (cout > resteSuite) continue;
    lignesSuite.push(ligne);
    pertinents.push(s.id);
    resteSuite -= cout;
  }
  const dynamique = lignesSuite.length
    ? `Souvenirs qui peuvent servir (pas des certitudes) :\n${lignesSuite.join('\n')}`
    : '';

  // --- dernier échange seulement, raccourci ---
  const derniers = (recents || []).slice(-2);
  let echange = derniers[0] && derniers[0].role === 'moi' ? derniers : derniers.filter((m) => m.role === 'moi');
  echange = echange.map((m) => ({ role: m.role, texte: couper(m.texte, budgets.messageHistorique) }));
  while (echange.length
    && echange.reduce((t, m) => t + estimerJetons(m.texte) + budgets.gabaritParMessage, 0) > budgets.historique) {
    echange.shift();
  }
  const jetonsMessage = estimerJetons(message);
  const historique = [...echange, { role: 'moi', texte: message }];
  const suiteJetons = estimerJetons(dynamique)
    + historique.reduce((t, m) => t + estimerJetons(m.texte) + budgets.gabaritParMessage, 0);

  return {
    prefixe,
    dynamique,
    historique,
    estimation: { prefixe: estimerJetons(prefixe), suite: suiteJetons, message: jetonsMessage },
    tropLong: jetonsMessage > budgets.message || suiteJetons > budgets.suite,
    souvenirsUtilises: [...dansPrefixe.map((x) => x.s.id), ...pertinents],
    souvenirsPertinents: pertinents,
  };
}
// === FIN_CONTEXTE_LOCAL ===
