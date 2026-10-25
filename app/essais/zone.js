// === DEBUT_ESSAIS_ZONE ===
// v0.66.8 — ATELIER 2, L3 : ZONE D'ESSAI = base IndexedDB SÉPARÉE 'naissance-essais' (mécanisme technique, non cognitif ; protégé : app/essais/).
// Les données produites par une capacité en essai y sont conservées avec leur PROVENANCE ; la base de Naissance ('naissance-langage', 36
// tables, VERSION_BASE, SCHEMA_SAUVEGARDE) n'est ni ouverte en écriture, ni migrée, ni touchée : les acquis antérieurs ne peuvent être ni
// modifiés ni effacés par un essai, et aucun mécanisme existant ne lit cette zone (couper un essai rend donc le comportement antérieur).
// Ligne : { id: '<essai>/<cle>', essai, cle, version, provenance: '<essai>@<version>', horodatage, declencheur, execution, donnees }.
// Écriture : AJOUT SEUL, tout ou rien (une clé déjà présente refuse le lot entier) ; aucune suppression, aucun remplacement (D-002).
// Export / import : fichier propre à la zone (la sauvegarde de Naissance reste inchangée) ; l'import AJOUTE les lignes absentes, refuse toute
// ligne qui contredirait une ligne présente, n'écrase jamais rien.
export const NOM_ZONE = 'naissance-essais';
export const VERSION_ZONE = 1;
export const TABLE_ZONE = 'donnees';
export const FORMAT_ZONE = 'naissance-zone-essais';
const RE_PROVENANCE = /^[a-z][a-z0-9-]{2,40}@\d+\.\d+\.\d+$/;
const objetSimple = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
const canon = (v) => JSON.stringify(v, (k, x) => (objetSimple(x) ? Object.fromEntries(Object.keys(x).sort().map((c) => [c, x[c]])) : x));

export function ligneValide(l) {
  return objetSimple(l) && typeof l.id === 'string' && typeof l.essai === 'string' && typeof l.cle === 'string' && l.id === `${l.essai}/${l.cle}`
    && typeof l.version === 'string' && l.provenance === `${l.essai}@${l.version}` && RE_PROVENANCE.test(l.provenance)
    && typeof l.horodatage === 'string' && typeof l.declencheur === 'string' && typeof l.execution === 'string' && objetSimple(l.donnees);
}
const refusAjout = (lignes, presentes) => {
  const ids = new Set();
  for (let i = 0; i < lignes.length; i += 1) {
    if (!ligneValide(lignes[i])) return 'ligne de zone invalide';
    if (ids.has(lignes[i].id) || presentes[i] !== undefined) return `clé déjà écrite : ${lignes[i].id}`;
    ids.add(lignes[i].id);
  }
  return null;
};

function demande(r) { return new Promise((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); }); }

export function ouvrirZone(fabrique = globalThis.indexedDB) {
  return new Promise((ok, ko) => {
    if (!fabrique) { ko(new Error('IndexedDB indisponible')); return; }
    const r = fabrique.open(NOM_ZONE, VERSION_ZONE);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(TABLE_ZONE)) r.result.createObjectStore(TABLE_ZONE, { keyPath: 'id' }); };
    r.onsuccess = () => { const db = r.result; db.onversionchange = () => db.close(); ok(zoneIndexedDB(db)); };
    r.onerror = () => ko(r.error);
  });
}

function zoneIndexedDB(db) {
  return {
    persistante: true,
    async lireTout() { return (await demande(db.transaction([TABLE_ZONE], 'readonly').objectStore(TABLE_ZONE).getAll())) || []; },
    async lire(essai) { return (await this.lireTout()).filter((l) => l.essai === essai); },
    // Une transaction : lectures des clés, vérification, puis écritures ; refus = abort, rien n'est écrit.
    async ajouter(lignes) {
      if (!Array.isArray(lignes) || lignes.length === 0) return;
      const tx = db.transaction([TABLE_ZONE], 'readwrite');
      const store = tx.objectStore(TABLE_ZONE);
      let refus = null;
      const fin = new Promise((ok, ko) => {
        tx.oncomplete = () => ok();
        tx.onerror = () => ko(refus || tx.error);
        tx.onabort = () => ko(refus || tx.error || new Error('Écriture annulée.'));
      });
      const presentes = new Array(lignes.length);
      let restantes = lignes.length;
      lignes.forEach((l, i) => {
        const r = store.get(objetSimple(l) && typeof l.id === 'string' ? l.id : '');
        r.onsuccess = () => {
          presentes[i] = r.result;
          restantes -= 1;
          if (restantes > 0) return;
          const motif = refusAjout(lignes, presentes);
          if (motif) { refus = new Error(motif); tx.abort(); return; }
          for (const x of lignes) store.add(x);
        };
      });
      await fin;
    },
    fermer() { db.close(); },
  };
}

// Même contrat, en mémoire (tests ; secours si IndexedDB manque : persistante = false, et la porte refuse alors toute activation).
export function zoneMemoireVive({ persistante = false } = {}) {
  const lignes = new Map();
  return {
    persistante,
    async lireTout() { return [...lignes.values()].map((l) => structuredClone(l)); },
    async lire(essai) { return (await this.lireTout()).filter((l) => l.essai === essai); },
    async ajouter(nouvelles) {
      if (!Array.isArray(nouvelles) || nouvelles.length === 0) return;
      const motif = refusAjout(nouvelles, nouvelles.map((l) => (objetSimple(l) ? lignes.get(l.id) : undefined)));
      if (motif) throw new Error(motif);
      for (const l of nouvelles) lignes.set(l.id, structuredClone(l));
    },
    fermer() {},
  };
}

export async function exporterZone(zone, { versionAppli, maintenant = new Date().toISOString() }) {
  const lignes = (await zone.lireTout()).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { format: FORMAT_ZONE, v: VERSION_ZONE, versionAppli, exporteLe: maintenant, lignes };
}
// -> { ajoutees, deja, refusees: [motifs] } ; rien n'est remplacé. Les lignes ajoutables partent en UN lot (tout ou rien).
export async function importerZone(zone, objet) {
  if (!objetSimple(objet) || objet.format !== FORMAT_ZONE || objet.v !== VERSION_ZONE || !Array.isArray(objet.lignes)) return { ajoutees: 0, deja: 0, refusees: ['fichier de zone illisible'] };
  const presentes = new Map((await zone.lireTout()).map((l) => [l.id, l]));
  const aAjouter = [];
  const refusees = [];
  let deja = 0;
  for (const l of objet.lignes) {
    if (!ligneValide(l)) { refusees.push('ligne invalide'); continue; }
    const p = presentes.get(l.id);
    if (p === undefined) { aAjouter.push(l); presentes.set(l.id, l); } else if (canon(p) === canon(l)) deja += 1; else refusees.push(`contradiction avec la ligne présente ${l.id} (conservée)`);
  }
  await zone.ajouter(aAjouter);
  return { ajoutees: aAjouter.length, deja, refusees };
}
// === FIN_ESSAIS_ZONE ===
