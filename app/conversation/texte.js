// === DEBUT_MISE_EN_FORME ===
// Mise en forme minimale et sûre des réponses : tout le texte est échappé,
// puis seuls quelques repères simples sont transformés (code, gras, titres, puces).

export function echapper(texte) {
  return String(texte).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function enligne(morceau) {
  let h = echapper(morceau);
  h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  h = h.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/^#{1,6}[ \t]+(.+)$/gm, '<strong>$1</strong>');
  h = h.replace(/^([ \t]*)[*-][ \t]+/gm, '$1• ');
  return h;
}

export function texteEnHtml(texte) {
  return String(texte)
    .split('```')
    .map((morceau, i) => {
      if (i % 2 === 0) return enligne(morceau);
      const code = morceau.replace(/^[\w+.-]*\n/, '').replace(/\n$/, '');
      return `<pre><code>${echapper(code)}</code></pre>`;
    })
    .join('');
}
// === FIN_MISE_EN_FORME ===
