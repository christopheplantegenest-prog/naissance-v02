// === DEBUT_ACTION_RETENIR ===
// Action « retenir » : enregistre MAINTENANT une information dans les souvenirs.
// Niveau « libre » : interne et réversible (le souvenir reste modifiable et supprimable).
// Le rangement automatique continue par ailleurs de découvrir des souvenirs.

import {
  CATEGORIES, NIVEAUX_CONFIANCE, texteValide, categorieValide, importanceValide,
  normaliserTexte, niveauSuperieur, REGLES,
} from '../esprit/consolidation.js';
import { motsCles } from '../memoire/selection.js';
import { controlerSchema } from './schema.js';

const SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    information: {
      type: 'string',
      description: "L'information à retenir, en une phrase complète et autonome, à la troisième personne (exemple : « {personne} aime la raclette. »).",
    },
    categorie: {
      type: 'string',
      enum: Object.keys(CATEGORIES),
      description: 'personne, preference, projet, proches, naissance ou autre.',
    },
    importance: {
      type: 'integer',
      description: '3 = essentiel et durable, 2 = utile, 1 = détail.',
    },
    confiance: {
      type: 'string',
      enum: [...NIVEAUX_CONFIANCE],
      description: "certain si {personne} l'affirme clairement ; probable ou incertain sinon.",
    },
  },
  required: ['information'],
});

// Deux textes disent-ils la même chose ? (égalité normalisée, inclusion, ou mots-clés quasi identiques)
// Des nombres différents (âge, date, quantité) = des informations différentes.
const nombres = (t) => (normaliserTexte(t).match(/\d+/g) || []).sort().join(',');

export function dejaConnu(texte, souvenirs) {
  const cle = normaliserTexte(texte);
  const mots = motsCles(texte);
  const chiffres = nombres(texte);
  return souvenirs.find((s) => {
    if (s.statut === 'archive') return false;
    const autre = normaliserTexte(s.texte);
    if (autre === cle) return true;
    if (nombres(s.texte) !== chiffres) return false;
    if (Math.min(autre.length, cle.length) >= 12 && (autre.includes(cle) || cle.includes(autre))) return true;
    const siens = motsCles(s.texte);
    if (mots.size < 2 || siens.size < 2) return false;
    let communs = 0;
    for (const m of mots) if (siens.has(m)) communs++;
    return communs / (mots.size + siens.size - communs) >= 0.75;
  }) || null;
}

export const retenir = {
  nom: 'retenir',
  niveau: 'libre',
  enCours: 'Naissance enregistre un souvenir…',
  description: "Enregistre durablement une information dans ta mémoire, tout de suite. Utilise-la quand {personne} te demande explicitement de retenir ou de noter quelque chose, ou quand une information importante sur {personne} doit absolument être gardée. Ne l'utilise pas pour la conversation ordinaire (un rangement automatique s'en charge plus tard), ni pour une information déjà présente dans tes souvenirs.",
  resumeCapacite: "enregistrer tout de suite une information dans tes souvenirs, quand {personne} le demande ou quand c'est vraiment important (pas pour la conversation ordinaire).",
  parametres: SCHEMA,

  valider(brut) {
    if (!brut || typeof brut !== 'object' || Array.isArray(brut)) {
      return { ok: false, raison: 'Paramètres absents ou mal formés.' };
    }
    const normalises = { ...brut };
    if (normalises.categorie !== undefined) normalises.categorie = categorieValide(normalises.categorie);
    if (normalises.importance !== undefined) normalises.importance = importanceValide(normalises.importance);
    if (typeof normalises.confiance === 'string') normalises.confiance = normalises.confiance.toLowerCase().trim();
    const schema = controlerSchema(SCHEMA, normalises);
    if (!schema.ok) return schema;
    const information = texteValide(normalises.information, REGLES.maxTexteSouvenir);
    if (!information) return { ok: false, raison: "L'information à retenir est vide ou trop courte." };
    if (String(normalises.information).trim().length > REGLES.maxTexteSouvenir) {
      return { ok: false, raison: `L'information dépasse ${REGLES.maxTexteSouvenir} caractères : résume-la.` };
    }
    return {
      ok: true,
      parametres: {
        information,
        categorie: normalises.categorie || 'autre',
        importance: normalises.importance || 2,
        confiance: normalises.confiance || 'certain',
      },
    };
  },

  async executer(p, { memoire, horloge, idAction, personne = 'la personne' }) {
    const consigne = `Réponds directement à ${personne}, en le tutoyant et avec tes propres mots ; ne recopie pas cette formulation interne.`;
    const date = horloge().toISOString();
    const souvenirs = await memoire.souvenirs();
    const connu = dejaConnu(p.information, souvenirs);
    if (connu) {
      const confiance = NIVEAUX_CONFIANCE.indexOf(p.confiance) > NIVEAUX_CONFIANCE.indexOf(connu.confiance)
        ? p.confiance
        : niveauSuperieur(connu.confiance);
      await memoire.ecrireSouvenirs([{
        ...connu,
        confiance,
        importance: Math.max(connu.importance || 1, p.importance),
        modifie: date,
        historique: [...(connu.historique || []), { date, action: 'confirmé par l’action retenir', action_id: idAction }],
      }]);
      return {
        etat: 'deja-connu',
        souvenir: connu.texte,
        message: 'Cette information était déjà dans tes souvenirs : elle est confirmée, sans doublon.',
        consigne,
      };
    }
    const souvenir = {
      id: `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      texte: p.information,
      categorie: p.categorie,
      importance: p.importance,
      confiance: p.confiance,
      source: 'demande',
      statut: 'actif',
      cree: date,
      modifie: date,
      dernierRappel: null,
      nbRappels: 0,
      origine: { action: idAction },
      historique: [],
    };
    await memoire.ecrireSouvenirs([souvenir]);
    return { etat: 'ajoute', souvenir: souvenir.texte, message: 'Souvenir enregistré.', consigne };
  },

  resumer: (p) => `retenir : « ${p.information} »`,

  noter(resultat) {
    if (resultat.ok === false) return `Souvenir non enregistré : ${resultat.erreur}`;
    if (resultat.etat === 'deja-connu') return `Déjà dans ses souvenirs (confirmé) : ${resultat.souvenir}`;
    return `Souvenir ajouté : ${resultat.souvenir}`;
  },
};
// === FIN_ACTION_RETENIR ===
