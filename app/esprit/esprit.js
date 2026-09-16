// === DEBUT_ESPRIT ===
// Relie l'identité, la mémoire et un moteur interchangeable.
// moteurActuel() → null, ou {
//   envoyer({ preparer }) → { texte, libelle, note }   preparer(libelle) → { instructions, historique }
//   generer({ instructions, entree }) → objet
// }
// Le moteur peut changer d'un essai à l'autre (repli) : le contexte est recomposé
// avec le nom du moteur réellement utilisé, et c'est lui qui est inscrit au journal.

import { composerContexte } from './contexte.js';
import { creerIdentite, changerPersonne } from './identite.js';
import { REGLES, decider, construireDemande, validerReponse, appliquerOperations } from './consolidation.js';
import { ErreurFournisseur } from '../fournisseurs/erreurs.js';

function nouvelIdSouvenir() {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function creerEsprit({ memoire, moteurActuel, horloge = () => new Date(), surActivite = () => {} }) {
  let enCours = null;

  async function naitre(prenom) {
    const personne = String(prenom || '').trim();
    if (!personne) throw new Error('Il faut un prénom.');
    const date = horloge().toISOString();
    const identite = creerIdentite({ personne, date });
    await memoire.naitre(identite, date);
    return identite;
  }

  async function changerPrenom(prenom) {
    const identite = await memoire.identite();
    if (!identite) throw new Error("Naissance n'est pas encore née.");
    const nouvelle = changerPersonne(identite, prenom, horloge().toISOString());
    await memoire.poserIdentite(nouvelle);
    return nouvelle;
  }

  async function noterRappels(ids, date) {
    for (const id of ids) {
      const s = await memoire.lireSouvenir(id);
      if (!s) continue;
      await memoire.ecrireSouvenirs([{ ...s, dernierRappel: date, nbRappels: (s.nbRappels || 0) + 1 }]);
    }
  }

  async function repondre(texte) {
    const moteur = moteurActuel();
    if (!moteur) {
      throw new ErreurFournisseur('reglage', "Naissance n'a pas encore de moteur : ouvre les Réglages et teste ta clé.");
    }
    const identite = await memoire.identite();
    if (!identite) throw new ErreurFournisseur('reglage', "Naissance n'est pas encore née.");
    const dateQuestion = horloge().toISOString();
    const [meta, fil, souvenirs, recents] = await Promise.all([
      memoire.meta(), memoire.fil(), memoire.souvenirs(), memoire.derniersMessages(80),
    ]);
    let contexte = null;
    const preparer = (libelle) => {
      contexte = composerContexte({
        identite, meta, fil, souvenirs, recents, message: texte, moteur: libelle, maintenant: horloge(),
      });
      return { instructions: contexte.instructions, historique: contexte.historique };
    };
    const { texte: reponse, libelle, note } = await moteur.envoyer({ preparer });
    const dateReponse = horloge().toISOString();
    await memoire.ajouterEchange({ question: texte, reponse, moteur: libelle, dateQuestion, dateReponse });
    await noterRappels(contexte ? contexte.souvenirsPertinents : [], dateReponse);
    await memoire.majMeta({ derniereActivite: dateReponse });
    return { texte: reponse, note: note || '' };
  }

  async function estRevenueApresAbsence() {
    const meta = await memoire.meta();
    if (!meta.derniereActivite) return false;
    return horloge().getTime() - Date.parse(meta.derniereActivite) > REGLES.absenceMs;
  }

  async function consolider({ absence = false, force = false } = {}) {
    const moteur = moteurActuel();
    const identite = await memoire.identite();
    if (!moteur || !identite) return { fait: false, raison: 'pas-prete' };
    const maintenant = horloge();
    const [meta, fil] = await Promise.all([memoire.meta(), memoire.fil()]);
    const [nbApresFil, nbNonAnalyses] = await Promise.all([
      memoire.compterMessages(fil.jusqua), memoire.compterMessages(meta.extraitJusqua),
    ]);
    const choix = decider({ nbApresFil, nbNonAnalyses, absence, force, meta, maintenant: maintenant.getTime() });
    if (!choix.resumer && !choix.extraire) return { fait: false, raison: 'rien' };

    let aResumer = [];
    if (choix.resumer) {
      const gardes = await memoire.derniersMessages(REGLES.garderRecents);
      const limite = gardes.length ? gardes[0].id : null;
      aResumer = await memoire.messagesApres(fil.jusqua, REGLES.maxTranche, limite);
    }
    const aAnalyser = choix.extraire ? await memoire.messagesApres(meta.extraitJusqua, REGLES.maxTranche) : [];
    if (!aResumer.length && !aAnalyser.length) return { fait: false, raison: 'rien' };

    surActivite(true);
    const souvenirs = await memoire.souvenirs();
    const versions = Object.fromEntries(souvenirs.map((s) => [s.id, s.modifie]));
    let reponse;
    try {
      reponse = await moteur.generer(construireDemande({ identite, fil, souvenirs, aResumer, aAnalyser }));
    } catch (e) {
      await memoire.majMeta({ echecConsolidation: maintenant.toISOString(), messageEchec: e.message || String(e) });
      return { fait: false, raison: 'echec', erreur: e };
    }

    const valide = validerReponse(reponse, souvenirs.map((s) => s.id), { resumeAttendu: aResumer.length > 0 });
    const date = horloge().toISOString();
    let stats = null;
    if (aAnalyser.length) {
      const frais = await memoire.souvenirs();
      const resultat = appliquerOperations({
        souvenirs: frais,
        operations: valide.operations,
        versions,
        maintenant: horloge(),
        origine: { de: aAnalyser[0].id, a: aAnalyser.at(-1).id },
        nouvelId: nouvelIdSouvenir,
      });
      await memoire.ecrireSouvenirs(resultat.aEcrire);
      stats = resultat.stats;
    }
    if (valide.resume) {
      const de = aResumer[0].id;
      const a = aResumer.at(-1).id;
      await memoire.ajouterResume({ id: `r-${String(a).padStart(10, '0')}`, de, a, texte: valide.resume, cree: date });
      await memoire.poserFil({ texte: valide.resume, jusqua: a, modifie: date });
    }
    const resumeManquant = aResumer.length > 0 && !valide.resume;
    await memoire.majMeta({
      extraitJusqua: aAnalyser.length ? aAnalyser.at(-1).id : meta.extraitJusqua,
      derniereConsolidation: date,
      echecConsolidation: resumeManquant ? date : null,
      messageEchec: resumeManquant ? 'Le moteur n’a pas fourni de résumé : nouvel essai plus tard.' : null,
    });
    return {
      fait: true,
      stats,
      resume: !!valide.resume,
      analyses: aAnalyser.length,
      resumes: valide.resume ? aResumer.length : 0,
      rejetees: valide.rejetees,
    };
  }

  function consoliderSiBesoin(options = {}) {
    if (enCours) return enCours;
    enCours = consolider(options)
      .catch((e) => ({ fait: false, raison: 'echec', erreur: e }))
      .finally(() => {
        enCours = null;
        surActivite(false);
      });
    return enCours;
  }

  return {
    naitre,
    changerPrenom,
    repondre,
    consoliderSiBesoin,
    estRevenueApresAbsence,
    get consolidationEnCours() { return enCours !== null; },
  };
}
// === FIN_ESPRIT ===
