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
  nMax: 120,
  nFils: 4,
  delaiMs: 150000,
  format: 'chatml-lfm2',
});

// Estimation prudente du nombre de jetons (≈ 3 caractères par jeton en français).
export const estimerJetons = (texte) => Math.ceil(String(texte || '').length / 3);

// Empêche un texte d'insérer des balises spéciales du modèle.
export const neutraliser = (texte) => String(texte || '').replaceAll('<|', '< |');

// Invite au format ChatML de LFM2, en deux parties :
// préfixe stable (mis en cache par le moteur) + suite (contexte du moment, conversation, message).
export function enChatML({ prefixe, dynamique, historique }) {
  const debut = `<|startoftext|><|im_start|>system\n${neutraliser(prefixe)}<|im_end|>\n`;
  let suite = '';
  if (dynamique) suite += `<|im_start|>system\n${neutraliser(dynamique)}<|im_end|>\n`;
  for (const m of historique || []) {
    suite += `<|im_start|>${m.role === 'ia' ? 'assistant' : 'user'}\n${neutraliser(m.texte)}<|im_end|>\n`;
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
