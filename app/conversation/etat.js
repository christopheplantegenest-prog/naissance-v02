// === DEBUT_ETAT_CONVERSATION ===
// La conversation en cours, en mémoire vive seulement (perdue à la fermeture).
// Rôles : 'moi', 'ia' (envoyés au modèle) ; 'systeme', 'erreur' (affichage seul).

export function creerConversation() {
  return { messages: [], prochainId: 1 };
}

export function ajouterMessage(conversation, role, texte, extra = {}) {
  const message = { id: conversation.prochainId++, role, texte, etat: 'ok', ...extra };
  conversation.messages.push(message);
  return message;
}

// Historique transmis au modèle : seulement les échanges réussis,
// les plus récents, et toujours en commençant par un message de l'utilisateur.
export function historiquePourEnvoi(conversation, max = 40) {
  let h = conversation.messages
    .filter((m) => (m.role === 'moi' || m.role === 'ia') && m.etat === 'ok')
    .slice(-max);
  while (h.length && h[0].role !== 'moi') h = h.slice(1);
  return h.map(({ role, texte }) => ({ role, texte }));
}
// === FIN_ETAT_CONVERSATION ===
