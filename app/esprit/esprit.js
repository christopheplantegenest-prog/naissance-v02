// === DEBUT_ESPRIT ===
// Relie l'identité, la mémoire et un moteur interchangeable.
// moteurActuel() → null, ou {
//   envoyer({ preparer, actions, executer, message, forcerExterne, surEtape, signal }) → { texte, libelle, note, local }
//     preparer(libelle, profil) → contexte ; profil 'externe' (complet) ou 'local' (compact, préfixe stable)
//     actions  : descriptions des actions que le moteur peut DEMANDER
//     executer : l'exécuteur de Naissance (seul à pouvoir agir)
//   generer({ instructions, entree }) → objet
// }
// Le moteur peut changer d'un essai à l'autre (repli) : le contexte est recomposé
// avec le nom du moteur réellement utilisé, et c'est lui qui est inscrit au journal.

import { composerContexte } from './contexte.js';
import { composerContexteLocal, VARIANTE_PAR_DEFAUT } from './contexte-local.js';
import { creerIdentite, changerPersonne, appliquerAmendements } from './identite.js';
import { REGLES, decider, construireDemande, validerReponse, appliquerOperations } from './consolidation.js';
import { ErreurFournisseur } from '../fournisseurs/erreurs.js';
import { catalogueParDefaut } from '../actions/catalogue.js';
import { creerSessionActions } from '../actions/executeur.js';

function nouvelIdSouvenir() {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function creerEsprit({
  memoire, moteurActuel, horloge = () => new Date(), surActivite = () => {},
  catalogue = catalogueParDefaut, confirmerAction = async () => false,
  appelsAujourdhui = () => 0, varianteLocale = () => VARIANTE_PAR_DEFAUT,
}) {
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

  // Applique une seule fois les modifications du noyau validées par la personne.
  async function identiteAJour() {
    const identite = await memoire.identite();
    if (!identite) return null;
    const { identite: nouvelle, change } = appliquerAmendements(identite, horloge().toISOString());
    if (change) await memoire.poserIdentite(nouvelle);
    return nouvelle;
  }

  async function noterRappels(ids, date) {
    for (const id of ids) {
      const s = await memoire.lireSouvenir(id);
      if (!s) continue;
      await memoire.ecrireSouvenirs([{ ...s, dernierRappel: date, nbRappels: (s.nbRappels || 0) + 1 }]);
    }
  }

  // options : { surEtape(evenement), signal } — progression affichée et bouton Annuler ;
  // forcerExterne + repriseDe : « Demander à un modèle plus fort » pour la question repriseDe.
  async function repondre(texte, { surEtape = () => {}, signal = null, forcerExterne = false, repriseDe = null } = {}) {
    const moteur = moteurActuel();
    if (!moteur) {
      throw new ErreurFournisseur('reglage', "Naissance n'a pas encore de moteur : ouvre les Réglages et teste ta clé.");
    }
    const identite = await identiteAJour();
    if (!identite) throw new ErreurFournisseur('reglage', "Naissance n'est pas encore née.");
    const dateQuestion = horloge().toISOString();
    const [meta, fil, souvenirs, tousRecents] = await Promise.all([
      memoire.meta(), memoire.fil(), memoire.souvenirs(), memoire.derniersMessages(80),
    ]);
    // Une reprise ne montre pas au moteur la réponse qu'on lui demande de refaire.
    const recents = repriseDe === null ? tousRecents : tousRecents.filter((m) => m.id < repriseDe);
    const personne = identite.noyau.personne;
    let libelleCourant = moteur.libelle || null;
    const session = creerSessionActions({
      catalogue,
      contexte: { memoire, horloge, personne: identite.noyau.personne },
      journaliser: (entree) => memoire.ajouterAction(entree),
      confirmer: confirmerAction,
      moteurCourant: () => libelleCourant,
    });
    let contexte = null;
    // Recomposé à chaque essai de moteur : nom du moteur réel, souvenirs à jour
    // (une action a pu en ajouter), et actions déjà faites à ne pas redemander.
    const preparer = async (libelle, profil = 'externe') => {
      libelleCourant = libelle;
      const souvenirsFrais = session.dejaFaites().length ? await memoire.souvenirs() : souvenirs;
      if (profil === 'local') {
        contexte = composerContexteLocal({
          identite, souvenirs: souvenirsFrais, recents, message: texte, moteur: libelle, maintenant: horloge(),
          variante: varianteLocale(),
        });
        return contexte;
      }
      contexte = composerContexte({
        identite, meta, fil, souvenirs: souvenirsFrais, recents, message: texte, moteur: libelle, maintenant: horloge(),
        actions: catalogue.resumes(personne), dejaFaites: session.dejaFaites(),
      });
      return { instructions: contexte.instructions, historique: contexte.historique };
    };
    let resultat;
    try {
      const executer = async (demande) => {
        const action = catalogue.trouver(demande.nom);
        surEtape({ type: 'action', nom: demande.nom, texte: action && action.enCours });
        return session.executer(demande);
      };
      resultat = await moteur.envoyer({
        preparer, actions: catalogue.declarations(personne), executer, surEtape, signal,
        message: texte, forcerExterne,
      });
    } catch (e) {
      // La réponse a échoué, mais des actions ont pu être faites : on le dit.
      if (e && typeof e === 'object') e.actions = session.notes;
      throw e;
    }
    const { texte: reponse, libelle, note } = resultat;
    const dateReponse = horloge().toISOString();
    const [idQuestion] = await memoire.ajouterEchange({
      question: texte, reponse, moteur: libelle, dateQuestion, dateReponse, repriseDe,
    });
    await memoire.lierActions(session.idsJournal, idQuestion);
    await noterRappels(contexte ? contexte.souvenirsPertinents : [], dateReponse);
    await memoire.majMeta({ derniereActivite: dateReponse });
    return { texte: reponse, note: note || '', actions: session.notes, local: !!resultat.local, idQuestion };
  }

  async function estRevenueApresAbsence() {
    const meta = await memoire.meta();
    if (!meta.derniereActivite) return false;
    return horloge().getTime() - Date.parse(meta.derniereActivite) > REGLES.absenceMs;
  }

  // Contexte local pour un essai du banc : rien n'est lu ni écrit dans la conversation.
  async function contexteLocalPourEssai(question, moteur = 'Moteur local', options = {}) {
    const identite = await memoire.identite();
    if (!identite) throw new Error('Naissance n’est pas encore née.');
    const souvenirs = await memoire.souvenirs();
    return composerContexteLocal({
      identite, souvenirs, recents: [], message: question, moteur, maintenant: horloge(), variante: varianteLocale(),
      souvenirsImposes: options.souvenirsImposes || null,
      sansSouvenirs: !!options.sansSouvenirs,
      sansIdentite: !!options.sansIdentite,
    });
  }

  async function identiteCourante() {
    const identite = await memoire.identite();
    return identite ? { personne: identite.noyau.personne, ia: identite.noyau.nom } : null;
  }

  async function consolider({ absence = false, force = false } = {}) {
    const moteur = moteurActuel();
    const identite = await memoire.identite();
    // Le rangement demande un moteur capable de produire du JSON fiable : jamais le moteur local.
    if (!moteur || typeof moteur.generer !== 'function' || !identite) return { fait: false, raison: 'pas-prete' };
    const maintenant = horloge();
    const [meta, fil] = await Promise.all([memoire.meta(), memoire.fil()]);
    const [nbApresFil, nbNonAnalyses] = await Promise.all([
      memoire.compterMessages(fil.jusqua), memoire.compterMessages(meta.extraitJusqua),
    ]);
    const choix = decider({
      nbApresFil, nbNonAnalyses, absence, force, meta, maintenant: maintenant.getTime(), appelsAujourdhui: appelsAujourdhui(),
    });
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
      await memoire.majMeta({
        echecConsolidation: maintenant.toISOString(),
        messageEchec: e.message || String(e),
        ...(force ? {} : { derniereConsolidationAuto: maintenant.toISOString() }),
      });
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
      ...(force ? {} : { derniereConsolidationAuto: date }),
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
    identiteAJour,
    repondre,
    contexteLocalPourEssai,
    identiteCourante,
    consoliderSiBesoin,
    estRevenueApresAbsence,
    get consolidationEnCours() { return enCours !== null; },
  };
}
// === FIN_ESPRIT ===
