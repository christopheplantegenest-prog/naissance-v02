// === DEBUT_PROFIL_MOTEUR_LOCAL ===
// Profil du premier moteur local : des DONNÉES (fichier, format, budgets),
// pour pouvoir remplacer plus tard ce modèle par un autre sans toucher au reste.

export const PROFIL_LFM2 = Object.freeze({
  id: 'lfm2-350m-q4_0',
  nom: 'LFM2-350M Q4_0',
  libelle: 'Moteur local — LFM2-350M Q4_0',
  url: 'https://huggingface.co/LiquidAI/LFM2-350M-GGUF/resolve/main/LFM2-350M-Q4_0.gguf',
  fichier: 'LFM2-350M-Q4_0.gguf',
  tailleApproxMo: 218,
  nCtx: 1024,
  nMax: 60,            // v0.7.1 : réponses nettement plus courtes
  nFils: 4,
  delaiMs: 150000,
  format: 'chatml-lfm2',
  // v0.7.1 : moins de hasard dans le choix des mots, pour limiter les inventions.
  echantillonnage: Object.freeze({ temperature: 0.15, topK: 20, minP: 0.1, penalite: 1.05 }),
});

// Estimation prudente du nombre de jetons (≈ 3 caractères par jeton en français).
export const estimerJetons = (texte) => Math.ceil(String(texte || '').length / 3);

// Empêche un texte d'insérer des balises spéciales du modèle.
export const neutraliser = (texte) => String(texte || '').replaceAll('<|', '< |');

const ROLES = { systeme: 'system', ia: 'assistant', moi: 'user' };

// Invite au format ChatML de LFM2, en deux parties :
// préfixe stable (mis en cache par le moteur) + suite (éléments du moment, dans l'ordre).
export function enChatML({ prefixe, elements }) {
  const debut = `<|startoftext|><|im_start|>system\n${neutraliser(prefixe)}<|im_end|>\n`;
  let suite = '';
  for (const e of elements || []) {
    suite += `<|im_start|>${ROLES[e.role] || 'user'}\n${neutraliser(e.texte)}<|im_end|>\n`;
  }
  suite += '<|im_start|>assistant\n';
  return { prefixe: debut, suite };
}

// Nettoie une réponse locale (espaces, balises résiduelles).
export function nettoyerReponse(texte) {
  return String(texte || '')
    .replace(/<\|[^|]*\|>/g, '')
    .replace(/<\/?think>/g, '')
    .trim();
}
// === FIN_PROFIL_MOTEUR_LOCAL ===
