// === DEBUT_CONTEXTE_LOCAL ===
// Contexte pour un petit moteur local. Deux variantes, pour pouvoir comparer :
//  - 'court'   (v0.7.1) : identité minimale en préfixe stable ; souvenirs présentés simplement,
//                         placés JUSTE AVANT la question ; réponses très courtes.
//  - 'complet' (v0.7.0) : l'ancien contexte, gardé comme référence de comparaison.
// Chaque composition renvoie une TRACE technique (souvenirs retenus, écartés, jetons par partie).

import { motsCles } from '../memoire/selection.js';
import { traitsActifs } from './identite.js';
import { estimerJetons } from '../moteur-local/profil.js';

export const VARIANTES = Object.freeze({ court: 'Court (v0.7.1)', complet: 'Complet (v0.7.0)' });
export const VARIANTE_PAR_DEFAUT = 'court';

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
  maxSouvenirs: 6,
});

// Variante courte : on serre tout.
export const BUDGETS_COURTS = Object.freeze({
  prefixe: 150,
  suite: 220,
  message: 120,
  historique: 70,
  souvenirsPrefixe: 0,
  souvenirsSuite: 80,
  ligneSouvenir: 120,
  messageHistorique: 140,
  gabaritParMessage: 6,
  maxSouvenirs: 3,
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

// Identité minimale : le strict nécessaire pour que le petit moteur sache qui il est et comment répondre.
export function identiteMinimale({ identite }) {
  const n = identite.noyau;
  return [
    `Tu es ${n.nom}, l'IA personnelle de ${n.personne}.`,
    `Tu parles directement à ${n.personne} et tu le tutoies.`,
    'Réponds en deux phrases au maximum.',
    "N'invente rien : n'ajoute aucun détail qui ne t'a pas été donné ici.",
    `Si tu ne sais pas, dis-le simplement à ${n.personne}.`,
  ].join('\n');
}

function communs(a, b) {
  const liste = [];
  for (const m of a) if (b.has(m)) liste.push(m);
  return liste;
}

// Souvenirs candidats pour une question : ceux qui partagent des mots avec elle.
export function souvenirsPourQuestion(souvenirs, message) {
  const cles = motsCles(message);
  return (souvenirs || [])
    .filter((s) => s.statut !== 'archive')
    .map((s) => ({ souvenir: s, motsCommuns: communs(cles, motsCles(s.texte)) }))
    .filter((x) => x.motsCommuns.length > 0)
    .sort((a, b) => b.motsCommuns.length - a.motsCommuns.length
      || (b.souvenir.importance || 1) - (a.souvenir.importance || 1)
      || String(a.souvenir.id).localeCompare(String(b.souvenir.id)));
}

function derniersEchanges(recents, budgets) {
  const derniers = (recents || []).slice(-2);
  let echange = derniers[0] && derniers[0].role === 'moi' ? derniers : derniers.filter((m) => m.role === 'moi');
  echange = echange.map((m) => ({ role: m.role, texte: couper(m.texte, budgets.messageHistorique) }));
  while (echange.length
    && echange.reduce((t, m) => t + estimerJetons(m.texte) + budgets.gabaritParMessage, 0) > budgets.historique) {
    echange.shift();
  }
  return echange;
}

function jour(maintenant) {
  return maintenant.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// --- variante courte ---------------------------------------------------------
function composerCourt({ identite, souvenirs, recents, message, maintenant, budgets }) {
  // Le jour est dans le préfixe : stable sur la journée, donc relu depuis le cache
  // au lieu d'être recalculé à chaque message.
  const prefixe = `${identiteMinimale({ identite })}\nNous sommes le ${jour(maintenant)}.`;
  const retenus = [];
  const trace = [];
  let reste = budgets.souvenirsSuite;
  for (const { souvenir, motsCommuns } of souvenirsPourQuestion(souvenirs, message)) {
    const ligne = couper(souvenir.texte, budgets.ligneSouvenir);
    const cout = estimerJetons(ligne) + 2;
    const place = retenus.length < budgets.maxSouvenirs && cout <= reste;
    trace.push({
      id: souvenir.id,
      texte: ligne,
      importance: souvenir.importance,
      confiance: souvenir.confiance,
      motsCommuns,
      statut: place ? 'injecté' : 'écarté (budget)',
    });
    if (!place) continue;
    retenus.push(ligne);
    reste -= cout;
  }
  const personne = identite.noyau.personne;
  const blocSouvenirs = retenus.length
    ? `Informations vraies sur ${personne}, à utiliser telles quelles, sans rien ajouter :\n${retenus.map((l) => `- ${l}`).join('\n')}`
    : `Tu n'as aucun souvenir utile pour cette question : dis-le à ${personne} plutôt que d'inventer.`;

  const elements = [
    ...derniersEchanges(recents, budgets),
    { role: 'systeme', texte: blocSouvenirs },
    { role: 'moi', texte: message },
  ];
  return { prefixe, elements, souvenirsTrace: trace, blocSouvenirs };
}

// --- variante complète (v0.7.0, pour comparer) -------------------------------
function composerComplet({ identite, souvenirs, recents, message, moteur, maintenant, budgets }) {
  const actifs = (souvenirs || []).filter((s) => s.statut !== 'archive');
  const base = `${identiteCompacte({ identite, moteur })}\nNous sommes le ${jour(maintenant)}.`;
  const essentiels = actifs
    .filter((s) => s.importance === 3)
    .sort((a, b) => String(a.cree || '').localeCompare(String(b.cree || '')) || String(a.id).localeCompare(String(b.id)));
  const trace = [];
  const dansPrefixe = [];
  let reste = Math.min(budgets.souvenirsPrefixe, budgets.prefixe - estimerJetons(base) - 20);
  for (const s of essentiels) {
    const ligne = `- ${couper(s.texte, budgets.ligneSouvenir)}`;
    const cout = estimerJetons(ligne) + 1;
    const place = cout <= reste;
    trace.push({
      id: s.id, texte: s.texte, importance: s.importance, confiance: s.confiance, motsCommuns: [],
      statut: place ? 'injecté (préfixe)' : 'écarté (budget)',
    });
    if (!place) continue;
    dansPrefixe.push({ s, ligne });
    reste -= cout;
  }
  const prefixe = dansPrefixe.length
    ? `${base}\nCe que tu sais d'important (souvenirs, pas des certitudes) :\n${dansPrefixe.map((x) => x.ligne).join('\n')}`
    : base;

  const dejaLa = new Set(dansPrefixe.map((x) => x.s.id));
  const lignesSuite = [];
  let resteSuite = budgets.souvenirsSuite;
  for (const { souvenir, motsCommuns } of souvenirsPourQuestion(actifs, message)) {
    if (dejaLa.has(souvenir.id)) continue;
    const ligne = `- ${couper(souvenir.texte, budgets.ligneSouvenir)}`;
    const cout = estimerJetons(ligne) + 1;
    const place = cout <= resteSuite;
    trace.push({
      id: souvenir.id, texte: souvenir.texte, importance: souvenir.importance, confiance: souvenir.confiance, motsCommuns,
      statut: place ? 'injecté (suite)' : 'écarté (budget)',
    });
    if (!place) continue;
    lignesSuite.push(ligne);
    resteSuite -= cout;
  }
  const blocSouvenirs = lignesSuite.length
    ? `Souvenirs qui peuvent servir (pas des certitudes) :\n${lignesSuite.join('\n')}`
    : '';
  const elements = [
    ...(blocSouvenirs ? [{ role: 'systeme', texte: blocSouvenirs }] : []),
    ...derniersEchanges(recents, budgets),
    { role: 'moi', texte: message },
  ];
  return { prefixe, elements, souvenirsTrace: trace, blocSouvenirs };
}

export function composerContexteLocal({
  identite, souvenirs, recents, message, moteur, maintenant,
  variante = VARIANTE_PAR_DEFAUT, budgets = null,
}) {
  const b = budgets || (variante === 'complet' ? BUDGETS_LOCAL : BUDGETS_COURTS);
  const construit = variante === 'complet'
    ? composerComplet({ identite, souvenirs, recents, message, moteur, maintenant, budgets: b })
    : composerCourt({ identite, souvenirs, recents, message, maintenant, budgets: b });

  const jetonsElement = (e) => estimerJetons(e.texte) + b.gabaritParMessage;
  const jetonsSuite = construit.elements.reduce((t, e) => t + jetonsElement(e), 0);
  const jetonsPrefixe = estimerJetons(construit.prefixe);
  const jetonsMessage = estimerJetons(message);
  const jetonsSouvenirs = construit.blocSouvenirs
    ? construit.elements.filter((e) => e.texte === construit.blocSouvenirs).reduce((t, e) => t + jetonsElement(e), 0)
    : 0;
  const jetonsHistorique = construit.elements
    .filter((e) => e.role !== 'systeme')
    .reduce((t, e) => t + jetonsElement(e), 0) - (jetonsMessage + b.gabaritParMessage);
  const injectes = construit.souvenirsTrace.filter((s) => s.statut.startsWith('injecté'));

  return {
    prefixe: construit.prefixe,
    elements: construit.elements,
    estimation: {
      prefixe: jetonsPrefixe,
      suite: jetonsSuite,
      souvenirs: jetonsSouvenirs,
      historique: Math.max(0, jetonsHistorique),
      message: jetonsMessage,
      total: jetonsPrefixe + jetonsSuite,
    },
    tropLong: jetonsMessage > b.message || jetonsSuite > b.suite,
    variante,
    souvenirsTrace: construit.souvenirsTrace,
    souvenirsUtilises: injectes.map((s) => s.id),
    souvenirsPertinents: injectes.map((s) => s.id),
  };
}
// === FIN_CONTEXTE_LOCAL ===
