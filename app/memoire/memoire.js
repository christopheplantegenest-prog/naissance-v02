// === DEBUT_MEMOIRE ===
// La mémoire de Naissance, au-dessus d'un magasin (IndexedDB ou mémoire vive).
// Ne connaît aucun modèle de langage. Les réglages techniques et la clé n'y sont JAMAIS.
//
// Table « cles » :
//   identite → { noyau, traits, changements }
//   meta     → { schema, idNaissance, neeLe, extraitJusqua, derniereActivite,
//                derniereConsolidation, derniereConsolidationAuto, echecConsolidation, messageEchec,
//                dernierExport, derniereImportation }
//   fil      → { texte, jusqua, modifie }       résumé glissant de l'histoire ancienne
//   sauvegardeAvantImport → fichier complet (jamais exporté)
// Table « journal »   : { id, date, role: 'moi'|'ia', texte, moteur, reprise? }
// Table « souvenirs » : voir esprit/consolidation.js
// Table « resumes »   : { id, de, a, texte, cree }  archives des tranches résumées
// Table « actions »   : { id, date, messageId, nom, parametres, niveau, statut, resultat, moteur }
//                       statut : executee | deja-faite | refusee | invalide | echec

export const SCHEMA = 2;
const CLES_NON_EXPORTEES = new Set(['sauvegardeAvantImport']);

export const META_VIDE = Object.freeze({
  schema: SCHEMA,
  idNaissance: null,
  neeLe: null,
  extraitJusqua: 0,
  derniereActivite: null,
  derniereConsolidation: null,
  derniereConsolidationAuto: null,
  echecConsolidation: null,
  messageEchec: null,
  dernierExport: null,
  derniereImportation: null,
});

export const FIL_VIDE = Object.freeze({ texte: '', jusqua: 0, modifie: null });

function nouvelIdentifiant() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function creerMemoire(magasin) {
  let prochainId = null;

  const lireCle = async (nom, defaut) => {
    const r = await magasin.lire('cles', nom);
    return r ? r.valeur : defaut;
  };
  const poserCle = (nom, valeur) => magasin.ecrire('cles', { cle: nom, valeur });

  async function idSuivant() {
    if (prochainId === null) {
      const dernier = await magasin.plage('journal', { sens: 'desc', limite: 1 });
      prochainId = dernier.length ? dernier[0].id + 1 : 1;
    }
    return prochainId++;
  }

  const memoire = {
    magasin,

    // --- naissance, identité, méta ---
    async meta() {
      return { ...META_VIDE, ...(await lireCle('meta', {})) };
    },
    async majMeta(changements) {
      const m = { ...(await memoire.meta()), ...changements };
      await poserCle('meta', m);
      return m;
    },
    identite: () => lireCle('identite', null),
    poserIdentite: (identite) => poserCle('identite', identite),
    async estNee() {
      const [m, i] = await Promise.all([memoire.meta(), memoire.identite()]);
      return !!(m.idNaissance && i);
    },
    async naitre(identite, date) {
      if (await memoire.estNee()) throw new Error('Naissance est déjà née.');
      const idNaissance = nouvelIdentifiant();
      await poserCle('identite', identite);
      await memoire.majMeta({ schema: SCHEMA, idNaissance, neeLe: date });
      return idNaissance;
    },

    // --- fil de l'histoire ---
    async fil() {
      return { ...FIL_VIDE, ...(await lireCle('fil', {})) };
    },
    poserFil: (fil) => poserCle('fil', fil),

    // --- journal ---
    // Un échange n'est écrit qu'une fois la réponse reçue : un envoi raté ne laisse aucune trace.
    // repriseDe : identifiant de la question reposée à un modèle plus fort (champ facultatif).
    async ajouterEchange({ question, reponse, moteur, dateQuestion, dateReponse, repriseDe = null }) {
      const idQ = await idSuivant();
      const idR = await idSuivant();
      const entreeQuestion = { id: idQ, date: dateQuestion, role: 'moi', texte: question, moteur };
      if (repriseDe !== null) entreeQuestion.reprise = repriseDe;
      await magasin.ecrire('journal', [
        entreeQuestion,
        { id: idR, date: dateReponse, role: 'ia', texte: reponse, moteur },
      ]);
      return [idQ, idR];
    },
    async derniersMessages(n) {
      return (await magasin.plage('journal', { sens: 'desc', limite: n })).reverse();
    },
    messagesApres: (id, limite = Infinity, avant = null) => magasin.plage('journal', { apres: id, avant, limite }),
    compterMessages: (apres = null) => magasin.compter('journal', { apres }),

    // --- souvenirs ---
    souvenirs: () => magasin.lireTout('souvenirs'),
    lireSouvenir: (id) => magasin.lire('souvenirs', id),
    ecrireSouvenirs: (liste) => (liste.length ? magasin.ecrire('souvenirs', liste) : Promise.resolve()),
    supprimerSouvenir: (id) => magasin.supprimer('souvenirs', id),

    // --- archives de résumés ---
    ajouterResume: (resume) => magasin.ecrire('resumes', resume),
    resumes: () => magasin.lireTout('resumes'),

    // --- journal des actions ---
    ajouterAction: (entree) => magasin.ecrire('actions', entree),
    actions: () => magasin.lireTout('actions'),
    async actionsRecentes(n) {
      const toutes = await magasin.lireTout('actions');
      return toutes.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, n);
    },
    async lierActions(ids, messageId) {
      for (const id of ids) {
        const a = await magasin.lire('actions', id);
        if (a) await magasin.ecrire('actions', { ...a, messageId });
      }
    },

    // --- export / import (données brutes) ---
    async exporterDonnees() {
      const [cles, journal, souvenirs, resumes, actions] = await Promise.all([
        magasin.lireTout('cles'), magasin.lireTout('journal'),
        magasin.lireTout('souvenirs'), magasin.lireTout('resumes'), magasin.lireTout('actions'),
      ]);
      return {
        cles: cles.filter((c) => !CLES_NON_EXPORTEES.has(c.cle)),
        journal,
        souvenirs,
        resumes,
        actions,
      };
    },
    async remplacerDonnees(donnees, { sauvegarde = null } = {}) {
      const cles = (donnees.cles || []).filter((c) => !CLES_NON_EXPORTEES.has(c.cle));
      if (sauvegarde) cles.push({ cle: 'sauvegardeAvantImport', valeur: sauvegarde });
      await magasin.remplacerTout({ ...donnees, actions: donnees.actions || [], cles });
      prochainId = null;
    },
    sauvegardeAvantImport: () => lireCle('sauvegardeAvantImport', null),
  };
  return memoire;
}
// === FIN_MEMOIRE ===
