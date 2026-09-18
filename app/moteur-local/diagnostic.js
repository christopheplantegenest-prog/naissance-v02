// === DEBUT_DIAGNOSTIC_LOCAL ===
// Traces techniques des réponses locales : ce qui a été réellement envoyé au petit moteur
// et ce qu'il a coûté. Données TECHNIQUES (localStorage), jamais dans la conversation,
// jamais exportées avec la mémoire.

export const CLE_TRACES = 'naissance-ia.diagnostic-local.v1';
const MAX_TRACES = 20;

function stockageParDefaut() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

const court = (t, n = 160) => {
  const s = String(t || '').replace(/\s+/g, ' ').trim();
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
};

export function construireTrace({ question, reponse, contexte, mesures, date }) {
  const e = (contexte && contexte.estimation) || {};
  return {
    date,
    variante: contexte ? contexte.variante : '?',
    question: court(question, 120),
    reponse: court(reponse, 300),
    souvenirs: (contexte ? contexte.souvenirsTrace : []).map((s) => ({
      id: s.id, texte: court(s.texte, 90), statut: s.statut, motsCommuns: s.motsCommuns, importance: s.importance,
    })),
    jetonsEstimes: {
      prefixe: e.prefixe, suite: e.suite, souvenirs: e.souvenirs, historique: e.historique, message: e.message, total: e.total,
    },
    jetonsReels: mesures ? { prefixe: mesures.jetonsPrefixe, suite: mesures.jetonsSuite, ecrits: mesures.jetonsEcrits } : null,
    cache: mesures ? mesures.cache : '?',
    tempsMs: mesures ? { prefixe: mesures.prefixeMs, suite: mesures.suiteMs, premierMot: mesures.premierMotMs } : null,
    vitesses: mesures ? { lecture: mesures.lectureJps, ecriture: mesures.ecritureJps } : null,
    fin: mesures ? mesures.fin : '?',
  };
}

export function lireTraces(stockage = stockageParDefaut()) {
  try {
    const t = JSON.parse((stockage && stockage.getItem(CLE_TRACES)) || '[]');
    return Array.isArray(t) ? t : [];
  } catch {
    return [];
  }
}

export function noterTrace(trace, stockage = stockageParDefaut()) {
  const liste = [...lireTraces(stockage), trace].slice(-MAX_TRACES);
  try { stockage.setItem(CLE_TRACES, JSON.stringify(liste)); } catch { /* sans effet */ }
  return liste;
}

export function effacerTraces(stockage = stockageParDefaut()) {
  try { stockage.removeItem(CLE_TRACES); } catch { /* sans effet */ }
}

const nb = (v, d = 1) => (Number.isFinite(v) ? v.toLocaleString('fr-FR', { maximumFractionDigits: d }) : '?');

export function traceEnTexte(t) {
  if (!t) return '';
  const j = t.jetonsEstimes || {};
  const r = t.jetonsReels || {};
  const ms = t.tempsMs || {};
  const v = t.vitesses || {};
  const souvenirs = t.souvenirs.length
    ? t.souvenirs.map((s) => `    • [${s.statut}] ${s.texte} (mots communs : ${s.motsCommuns.join(', ') || 'aucun'})`).join('\n')
    : '    • aucun souvenir sélectionné';
  return [
    `— ${t.date} — contexte ${t.variante}`,
    `  Question : ${t.question}`,
    `  Réponse : ${t.reponse}`,
    '  Souvenirs :',
    souvenirs,
    `  Jetons estimés : total ${j.total} (identité ${j.prefixe}, souvenirs ${j.souvenirs}, conversation ${j.historique}, question ${j.message})`,
    `  Jetons réels : identité ${r.prefixe ?? '?'}, suite ${r.suite ?? '?'}, écrits ${r.ecrits ?? '?'}`,
    `  Cache : ${t.cache} — identité ${nb((ms.prefixe || 0) / 1000)} s, suite ${nb((ms.suite || 0) / 1000)} s, premier mot ${nb((ms.premierMot || 0) / 1000)} s`,
    `  Vitesses : lecture ${nb(v.lecture)} jetons/s, écriture ${nb(v.ecriture)} jetons/s — fin : ${t.fin}`,
  ].join('\n');
}

export function rapportTraces(traces) {
  if (!traces.length) return 'Aucune réponse locale enregistrée.';
  const avec = traces.filter((t) => t.vitesses && Number.isFinite(t.vitesses.lecture));
  const moyenne = (f) => (avec.length ? avec.reduce((s, t) => s + f(t), 0) / avec.length : NaN);
  return [
    `Diagnostic du moteur local — ${traces.length} réponse(s)`,
    `Moyennes : premier mot ${nb(moyenne((t) => (t.tempsMs.premierMot || 0) / 1000))} s, `
      + `lecture ${nb(moyenne((t) => t.vitesses.lecture))} jetons/s, écriture ${nb(moyenne((t) => t.vitesses.ecriture))} jetons/s, `
      + `contexte ${nb(moyenne((t) => t.jetonsEstimes.total || 0), 0)} jetons estimés`,
    '',
    ...traces.map(traceEnTexte),
  ].join('\n');
}
// === FIN_DIAGNOSTIC_LOCAL ===
