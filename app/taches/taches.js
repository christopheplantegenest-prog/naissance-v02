// === DEBUT_TACHES ===
// Petite liste de tâches de l'utilisateur, gardée UNIQUEMENT sur l'appareil (stockage local, clé dédiée).
// Ce n'est PAS la mémoire de Naissance : rien ici ne lit ni n'écrit sa mémoire, aucune table, aucune base.
// Module pur, autonome (aucune dépendance). Le stockage est injectable (interface getItem/setItem) ; par défaut le stockage
// local du navigateur, lu dans un try (null s'il est indisponible).
// Format enregistré : { v: 1, taches: [{ id, texte, terminee }] }, dans l'ordre de création, jamais trié.
// Aucune horloge, aucun hasard, aucun réseau, aucun score, aucune normalisation du texte.

export const CLE_TACHES = 'naissance-ia.taches.v1';

function stockageParDefaut() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

function tacheValide(t) {
  return t !== null && typeof t === 'object'
    && Number.isInteger(t.id) && t.id > 0
    && typeof t.texte === 'string'
    && typeof t.terminee === 'boolean';
}

// Rend les seules tâches valides, copiées ; [] dès que le contenu n'est pas lisible. Jamais d'exception.
export function lireTaches(stockage = stockageParDefaut()) {
  try {
    if (!stockage) return [];
    const brut = stockage.getItem(CLE_TACHES);
    if (typeof brut !== 'string') return [];
    const objet = JSON.parse(brut);
    if (!objet || typeof objet !== 'object' || objet.v !== 1 || !Array.isArray(objet.taches)) return [];
    const taches = [];
    for (const t of objet.taches) {
      if (tacheValide(t)) taches.push({ id: t.id, texte: t.texte, terminee: t.terminee });
    }
    return taches;
  } catch {
    return [];
  }
}

function copier(taches) {
  return taches.map((t) => ({ id: t.id, texte: t.texte, terminee: t.terminee }));
}

function ecrire(taches, stockage) {
  try {
    stockage.setItem(CLE_TACHES, JSON.stringify({ v: 1, taches: copier(taches) }));
    return true;
  } catch {
    return false;
  }
}

// Ajoute une tâche en fin de liste. Le texte est gardé TEL QUEL ; trim() sert seulement à refuser le vide.
export function ajouterTache(texte, stockage = stockageParDefaut()) {
  const avant = lireTaches(stockage);
  if (typeof texte !== 'string' || texte.trim() === '') return { ok: false, erreur: 'vide', taches: avant };
  let plusGrand = 0;
  for (const t of avant) if (t.id > plusGrand) plusGrand = t.id;
  const id = plusGrand + 1;
  const apres = [...copier(avant), { id, texte, terminee: false }];
  if (!ecrire(apres, stockage)) return { ok: false, erreur: 'stockage', taches: avant };
  return { ok: true, id, taches: copier(apres) };
}

// Marque la seule tâche d'identifiant id comme terminée (idempotent).
export function terminerTache(id, stockage = stockageParDefaut()) {
  const avant = lireTaches(stockage);
  let trouvee = false;
  for (const t of avant) if (t.id === id) trouvee = true;
  if (!trouvee) return { ok: false, erreur: 'inconnue', taches: avant };
  const apres = avant.map((t) => (t.id === id ? { id: t.id, texte: t.texte, terminee: true } : { id: t.id, texte: t.texte, terminee: t.terminee }));
  if (!ecrire(apres, stockage)) return { ok: false, erreur: 'stockage', taches: avant };
  return { ok: true, taches: copier(apres) };
}
// === FIN_TACHES ===
