// === DEBUT_EXECUTEUR_ACTIONS ===
// L'intermédiaire obligatoire entre le moteur et les capacités de Naissance.
// Pour chaque demande : action connue ? niveau ? paramètres valides ? limite ?
// accord de la personne si nécessaire ? → exécution → journal → résultat pour le moteur.
// Une session couvre UN message de la personne, même si le moteur change en route :
// une action déjà exécutée n'est jamais rejouée.

export const LIMITES_ACTIONS = Object.freeze({
  maxActionsParMessage: 3,
  maxDemandesParMessage: 8,   // demandes (même refusées) avant de tout refuser
  maxTours: 3,                // allers-retours moteur ↔ actions par essai de moteur
});

function nouvelId() {
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function empreinte(nom, parametres) {
  const trie = Object.keys(parametres).sort().reduce((o, k) => ({ ...o, [k]: parametres[k] }), {});
  return `${nom}:${JSON.stringify(trie)}`;
}

export function creerSessionActions({
  catalogue,
  contexte,                           // { memoire, horloge } transmis aux actions
  journaliser = async () => {},       // (entree) → écrit dans la table « actions »
  confirmer = async () => false,      // ({ nom, resume }) → true si la personne accepte
  moteurCourant = () => null,
  limites = LIMITES_ACTIONS,
}) {
  const faites = [];      // { empreinte, nom, resume, resultat }
  const notes = [];       // phrases pour la personne
  const idsJournal = [];
  let executees = 0;
  let demandes = 0;

  async function noter(entree) {
    idsJournal.push(entree.id);
    try {
      await journaliser(entree);
    } catch {
      // le journal ne doit jamais empêcher la réponse
    }
  }

  async function refuser({ nom, parametres, niveau = null, statut, raison }) {
    const resultat = { ok: false, erreur: raison };
    await noter({
      id: nouvelId(), date: contexte.horloge().toISOString(), messageId: null,
      nom: String(nom || '?').slice(0, 60), parametres: parametres ?? null, niveau, statut, resultat, moteur: moteurCourant(),
    });
    notes.push(`Action refusée (${String(nom || '?').slice(0, 40)}) : ${raison}`);
    return resultat;
  }

  async function executer({ nom, parametres }) {
    demandes++;
    if (demandes > limites.maxDemandesParMessage) {
      return { ok: false, erreur: "Trop de demandes d'action pour ce message : réponds maintenant sans action." };
    }
    const action = catalogue.trouver(nom);
    if (!action) return refuser({ nom, parametres, statut: 'invalide', raison: `L'action « ${String(nom).slice(0, 40)} » n'existe pas.` });
    if (action.niveau === 'bloquee') return refuser({ nom, parametres, niveau: action.niveau, statut: 'refusee', raison: 'Cette action est bloquée.' });

    const v = action.valider(parametres);
    if (!v.ok) return refuser({ nom, parametres, niveau: action.niveau, statut: 'invalide', raison: v.raison });

    const cle = empreinte(nom, v.parametres);
    const deja = faites.find((f) => f.empreinte === cle);
    if (deja) {
      // Jamais rejouée : on redonne le résultat déjà obtenu.
      await noter({
        id: nouvelId(), date: contexte.horloge().toISOString(), messageId: null,
        nom, parametres: v.parametres, niveau: action.niveau, statut: 'deja-faite', resultat: deja.resultat, moteur: moteurCourant(),
      });
      return { ...deja.resultat, dejaFaite: true };
    }
    if (executees >= limites.maxActionsParMessage) {
      return refuser({ nom, parametres: v.parametres, niveau: action.niveau, statut: 'refusee', raison: "Limite d'actions atteinte pour ce message." });
    }
    const resume = action.resumer(v.parametres);
    if (action.niveau === 'accord') {
      let accord = false;
      try { accord = await confirmer({ nom, resume }); } catch { accord = false; }
      if (!accord) {
        return refuser({ nom, parametres: v.parametres, niveau: action.niveau, statut: 'refusee', raison: 'La personne n’a pas donné son accord.' });
      }
    }

    executees++;
    const id = nouvelId();
    let resultat;
    let statut = 'executee';
    try {
      resultat = { ok: true, ...(await action.executer(v.parametres, { ...contexte, idAction: id })) };
    } catch (e) {
      statut = 'echec';
      resultat = { ok: false, erreur: `L'action a échoué : ${(e && e.message) || e}` };
    }
    faites.push({ empreinte: cle, nom, resume, resultat });
    notes.push(action.noter(resultat));
    await noter({
      id, date: contexte.horloge().toISOString(), messageId: null,
      nom, parametres: v.parametres, niveau: action.niveau, statut, resultat, moteur: moteurCourant(),
    });
    return resultat;
  }

  return {
    executer,
    get notes() { return [...notes]; },
    get idsJournal() { return [...idsJournal]; },
    // Pour un nouveau moteur pris en relais : ce qui a déjà été fait.
    dejaFaites: () => faites.map((f) => {
      const r = f.resultat;
      return `${f.resume} → ${r.ok ? (r.message || 'réussie') : `échec : ${r.erreur}`}`;
    }),
  };
}
// === FIN_EXECUTEUR_ACTIONS ===
