// === DEBUT_OUTILS_VOIX ===
// Fonctions pures de la voix : préparer un texte à prononcer, le découper,
// traduire les erreurs de reconnaissance en phrases claires.
// Aucun son n'est jamais enregistré : seul le texte existe pour Naissance.

export class ErreurVoix extends Error {
  constructor(code, message, detail = '') {
    super(message);
    this.name = 'ErreurVoix';
    this.code = code;
    this.detail = detail;
  }
}

// Retire la mise en forme qui ne doit pas être lue à voix haute.
export function texteAPrononcer(texte) {
  return String(texte || '')
    .replace(/```[\s\S]*?(```|$)/g, ' (bloc de code) ')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/https?:\/\/\S+/g, ' (lien) ')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,;:!?]|$)/g, '$1$2')
    .replace(/^#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]*(?:[-*•]|\d+[.)])[ \t]+/gm, '')
    .replace(/\p{Extended_Pictographic}\uFE0F?/gu, '')
    .replace(/[*_#>|~]+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

// Découpe un long texte en morceaux prononçables (limite des moteurs de synthèse).
export function decouper(texte, max = 3000) {
  const t = String(texte || '').trim();
  if (!t) return [];
  const phrases = t.match(/[^.!?…\n]+[.!?…]*\s*|\n+/g) || [t];
  const morceaux = [];
  let courant = '';
  const pousser = () => { if (courant.trim()) morceaux.push(courant.trim()); courant = ''; };
  for (const p of phrases) {
    if (courant.length + p.length > max) {
      pousser();
      if (p.length > max) {
        for (let i = 0; i < p.length; i += max) {
          const bout = p.slice(i, i + max).trim();
          if (bout) morceaux.push(bout);
        }
        continue;
      }
    }
    courant += p;
  }
  pousser();
  return morceaux;
}

export function traduireErreurEcoute(e) {
  if (e instanceof ErreurVoix) return e;
  const brut = `${(e && e.code) || ''} ${(e && (e.message || e.error)) || (typeof e === 'string' ? e : '')}`.trim();
  const cas = [
    [/aborted|cancel/i, 'annule', 'Écoute annulée.'],
    [/not-allowed|permission|denied/i, 'permission',
      "Naissance n'a pas l'autorisation d'utiliser le micro. Tu peux l'accorder dans les paramètres Android de l'appli."],
    [/no-speech|no match|nomatch|no speech|didn.t understand|client side/i, 'rien',
      "Je n'ai rien entendu. Appuie sur le micro, puis parle."],
    [/network|server|réseau/i, 'reseau',
      "La reconnaissance vocale a besoin d'internet sur ce téléphone (sauf si le français est installé hors connexion)."],
    [/audio|busy|capture/i, 'micro', 'Le micro est occupé ou indisponible pour le moment.'],
    [/not available|not supported|unavailable|service/i, 'service',
      "La reconnaissance vocale d'Android n'est pas disponible sur ce téléphone."],
  ];
  for (const [motif, code, message] of cas) {
    if (motif.test(brut)) return new ErreurVoix(code, message, brut);
  }
  return new ErreurVoix('inconnu', 'La reconnaissance vocale a échoué. Tu peux écrire ton message.', brut);
}
// === FIN_OUTILS_VOIX ===
