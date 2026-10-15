// === DEBUT_ECRAN_CONVERSATION ===
// Zone de messages + champ + Envoyer. Ne connaît ni le moteur ni la mémoire :
//  repondre(texte, { surEtape, signal, forcerExterne, repriseDe }) → { texte, note, actions, local, idQuestion } ;
//  chargerRecents() → messages du journal ;
//  sous une réponse du moteur local : « Demander à un modèle plus fort » (même question, moteur externe).
//  pendant l'attente : progression affichée et bouton Annuler.
//  un message qui n'a pas pu partir est gardé (brouillon.js) et peut être réessayé.
//  voix (facultatif) : micro → texte dans le champ (jamais envoyé sans la personne),
//  bouton « Écouter » sous chaque réponse, lecture automatique selon les préférences.
//  une réponse peut porter { confirmation: { onOui, onNon } } : deux boutons Confirmer / Annuler sont attachés
//  dans la bulle (mécanisme générique) ; le choix appelle onOui ou onNon, qui rendent le texte de la réponse finale.
//  v0.64.17 : onOui peut aussi rendre { texte, proposition: { texte, confirmation } } (une RÈGLE proposée après un fait confirmé) ;
//  le texte s'affiche comme avant, puis la proposition dans une seconde bulle. confirmation.libelleNon remplace « Annuler » si fourni.
//  etat() → 'a-naitre' | 'sans-cle' | 'a-tester' | 'pret' ; naitre(prenom).

import { texteEnHtml } from './texte.js';
import { lireBrouillon, garderBrouillon, effacerBrouillon } from './brouillon.js';
import { CODES_REGLAGES, enErreurFournisseur } from '../fournisseurs/erreurs.js';
import { libelleEtape } from '../fournisseurs/fiabilite.js';

export function monterConversation({
  liste, formulaire, repondre, chargerRecents, etat, naitre, ouvrirReglages,
  peutDemanderPlusFort = () => false,
  voix = null, lectureAuto = () => false,
  surJugement = null,
  surActe = null,
  surSollicitation = null,
  capacite = null,
}) {
  const champ = formulaire.querySelector('textarea');
  const bouton = formulaire.querySelector('button[type="submit"]');
  const micro = formulaire.querySelector('[data-micro]');
  const placeholderNormal = champ.placeholder;
  let lectureDisponible = false;
  let ecouteEnCours = false;
  let boutonLecture = null; // bouton « Arrêter » de la réponse en cours de lecture
  let occupe = false;
  let accueil = null;
  let nbAffiches = 0;
  let echecs = []; // { texte, elements } des envois ratés encore affichés
  // ÉTAPE 5.2-bis — RÉFÉRENCE EXPLICITE D'UNE VRAIE EXPÉRIENCE À UNE TRACE : état de COMPOSITION
  // uniquement (jamais une mémoire de Naissance). referenceActuelle capture { idTrace } choisi par
  // un clic sur « Répondre » (toujours CETTE bulle précise, jamais « la dernière trace » -- voir
  // afficherMessage ci-dessous : options.idTrace est transmis par fermeture, propre à chaque bulle).
  let referenceActuelle = null;
  let bandeauReference = null;
  // v0.63.81 — J-B : RÉFÉRENCE À UNE ÉMISSION DE NAISSANCE : état de composition, en mémoire seulement (jamais dans le brouillon, jamais une
  // mémoire de Naissance). { idEmission } choisi par « Répondre » sur une ligne émise (CETTE ligne, par fermeture). Exclusif avec la référence à
  // une trace : définir l'une annule l'autre. Transporté tel quel à repondre() comme options.referenceEmission.
  let referenceEmission = null;
  // v0.64.15 — RÉFÉRENCE À UN MESSAGE DE CHRISTOPHE : même discipline exacte que referenceEmission (état de composition en mémoire seulement,
  // jamais dans le brouillon, jamais une mémoire de Naissance). { idMessage } choisi par « Répondre » sur SA bulle (CETTE bulle, par fermeture),
  // seulement quand le tour a rendu l'identité réellement conservée de ce message (resultat.idMessage). Exclusif avec les deux autres références.
  // Transporté tel quel à repondre() comme options.referenceMessage ; jamais lors d'une reprise.
  let referenceMessage = null;
  let titreBandeauReference = null;
  // v0.63.84 — B1 : BANDEAU CAPACITÉ (visibilité de développement, faits bruts : c courant, plafond, dernière variation et sa cause, porte) et bouton
  // « Repos » (tick de temps propre EXPLICITE : dispositif de validation, pas une cadence). `capacite` = { lire, repos } injecté par main.js ;
  // absent (anciens appelants, tests) : rien n'est affiché. Aucun vocabulaire psychologique, aucune lecture pour décider.
  let bandeauCapacite = null;
  let zoneBesoins = null;
  let zoneActesSitues = null; // N3b-0 — propositions de résolution vécues, relues (lecture seule)
  let zoneDiagnostic = null;
  let zoneEpisode = null;
  let zoneEvenement = null;
  let zoneEtatComplet = null; // v0.63.90 — l'ancienne phrase complète du bandeau, dans le panneau Diagnostic
  let resumeDernier = ''; // v0.63.90 — « tick → occasion oui → engagement », pour la barre compacte
  let boutonDiagnostic = null;
  let episodeAffiche = false;
  let texteCapacite = null;

  const defiler = () => { liste.scrollTop = liste.scrollHeight; };

  function bulle(role, classeEnPlus = '') {
    const el = document.createElement('div');
    el.className = `message message-${role} ${classeEnPlus}`.trim();
    if (accueil && accueil.isConnected) liste.insertBefore(el, accueil);
    else liste.appendChild(el);
    return el;
  }

  // options : { local, question, idQuestion, confirmation } pour une réponse ; { reprise } pour une question reposée.
  function afficherMessage(role, texte, options = {}) {
    const el = bulle(role);
    if (role === 'ia') {
      const contenu = document.createElement('div');
      contenu.className = 'contenu';
      contenu.innerHTML = texteEnHtml(texte);
      el.appendChild(contenu);
      const actions = document.createElement('div');
      actions.className = 'actions-message';
      if (lectureDisponible) actions.appendChild(boutonEcouter(texte));
      if (options.local) {
        el.classList.add('reponse-locale');
        const marque = document.createElement('span');
        marque.className = 'marque-locale';
        marque.textContent = 'moteur local';
        actions.appendChild(marque);
        if (options.question && options.idQuestion !== undefined && peutDemanderPlusFort()) {
          const b = bouton_('Demander à un modèle plus fort', () => {
            b.disabled = true;
            envoyerTexte(options.question, { forcerExterne: true, repriseDe: options.idQuestion, reprise: true });
          });
          b.classList.add('bouton-plus-fort');
          actions.appendChild(b);
        }
      }
      // Étape E (décision ChatGPT du 26/09/2026, « SIGNAL D'APPRENTISSAGE ») — signal FACULTATIF,
      // léger : deux boutons discrets pour juger CETTE réponse précise, seulement quand une
      // expérience B1 réelle existe pour elle (options.idExperience) et que surJugement est
      // fourni. Rien d'obligatoire, aucune fenêtre, le dialogue continue normalement sans jugement.
      if (options.idExperience && surJugement) {
        const jugerBloc = document.createElement('span');
        jugerBloc.className = 'jugement-reponse';
        const correct = bouton_('✓ correct', () => juger('correct'));
        const incorrect = bouton_('✗ incorrect', () => juger('incorrect'));
        async function juger(valeur) {
          correct.disabled = true;
          incorrect.disabled = true;
          try {
            await surJugement(options.idExperience, valeur);
            jugerBloc.textContent = valeur === 'correct' ? 'Jugée correcte.' : 'Jugée incorrecte.';
          } catch (err) {
            jugerBloc.textContent = `Jugement non enregistré : ${err.message}`;
          }
        }
        jugerBloc.append(correct, incorrect);
        actions.appendChild(jugerBloc);
      }
      // CHANTIER « PREMIER BRANCHEMENT UI DE L'ACTE EXPLICITE » (décision ChatGPT, 03/10/2026) —
      // MÊME PATRON EXACT que le bloc idExperience/surJugement ci-dessus, pour un objet totalement
      // différent et indépendant (voir connaissances.js : enregistrerActe(), v0.61.4). « Marquer »
      // n'a AUCUNE valeur cognitive : jamais correct/incorrect/utile/j'aime, seulement l'accusé
      // qu'un geste explicite a eu lieu sur CETTE trace précise. idTrace voyage UNIQUEMENT par
      // fermeture (options.idTrace, capturé pour cette bulle au moment du rendu) -- jamais une
      // recherche, jamais « la dernière trace ». Le bouton reste VOLONTAIREMENT réutilisable après
      // un acte réussi (section 6 du cadrage) : plusieurs actes distincts sur la même trace restent
      // possibles, aucune déduplication, aucun toggle.
      if (options.idTrace && surActe) {
        const acteBloc = document.createElement('span');
        acteBloc.className = 'acte-reponse';
        const marquer = bouton_('Marquer', () => declencherActe());
        const statutActe = document.createElement('span');
        statutActe.className = 'acte-statut';
        let enCours = false;
        async function declencherActe() {
          if (enCours) return;
          enCours = true;
          marquer.disabled = true;
          try {
            await surActe(options.idTrace);
            statutActe.textContent = 'Noté.';
          } catch (err) {
            statutActe.textContent = `Acte non enregistré : ${err.message}`;
          } finally {
            marquer.disabled = false;
            enCours = false;
          }
        }
        acteBloc.append(marquer, statutActe);
        actions.appendChild(acteBloc);
      }
      // ÉTAPE 5.2-bis — « RÉPONDRE » : TOTALEMENT indépendant du bloc « Marquer » ci-dessus (aucune
      // dépendance injectée, aucun état partagé, aucun appel à surActe). idTrace voyage UNIQUEMENT
      // par fermeture, exactement comme pour « Marquer » -- jamais une recherche, jamais « la
      // dernière trace ». Un clic sélectionne cette trace comme référence du message EN COURS DE
      // COMPOSITION (definirReference ci-dessus) : aucune expérience/acte/trace n'est créée ici.
      // v0.64.22 — une bulle qui porte une RÉPONSE LOCALE (options.idReponseLocale) offre aussi Répondre : la cible est cette réponse locale (et la
      // trace, seulement si cette bulle en porte une : provenance réelle d'une Action). Les notes d'histoire sont des bulles séparées : jamais la cible.
      if (options.idTrace || options.idReponseLocale) {
        const refBloc = document.createElement('span');
        refBloc.className = 'reference-reponse';
        const cibleBulle = { ...(options.idTrace ? { idTrace: options.idTrace } : {}), ...(options.idReponseLocale ? { idReponseLocale: options.idReponseLocale } : {}) };
        refBloc.appendChild(bouton_('Répondre', () => definirReference(cibleBulle)));
        actions.appendChild(refBloc);
      }
      // v0.63.35 — OUTIL DE DÉVELOPPEMENT : « Sollicitation (outil de développement) ». Zone repliée, seulement si CETTE bulle porte un contexte
      // vivant (options.sollicitation, rendu au moment du tour) ; une bulle restaurée n'en a pas. Voir zoneSollicitation ci-dessous.
      // v0.63.81 — J-B : lignes ÉMISES par Naissance pendant ce tour (chaque ligne = un acte emettreProduction déjà persisté, jamais fabriqué
      // pour l'affichage), avec le geste « Répondre » qui porte l'idEmission EXACT par fermeture. Puis une zone de développement repliée qui
      // rend vérifiables idEmission, exécution et la réception rattachée au message de CE tour quand il en portait une. Aucune interprétation.
      const emissions = Array.isArray(options.emissions) ? options.emissions : [];
      // v0.63.90 — ERGONOMIE : la bulle montre d'abord ce qui est échangé (réponse, émissions sur UNE ligne chacune avec Répondre), puis UNE ligne
      // de synthèse du tour ; toutes les informations techniques du tour (émissions outil de développement avec valeurs complètes, capacité,
      // occasions, relation, sollicitation) sont rangées, inchangées, dans le dépliant « détails du tour ».
      const detailsTour = document.createElement('details');
      detailsTour.className = 'details-tour';
      const titreDetailsTour = document.createElement('summary');
      titreDetailsTour.textContent = 'détails du tour';
      detailsTour.appendChild(titreDetailsTour);
      for (const em of emissions) {
        const ligne = document.createElement('div');
        ligne.className = 'emission-naissance';
        const texteEm = document.createElement('span');
        texteEm.className = 'emission-texte';
        texteEm.textContent = `Naissance → toi : ${valeurLisible(em.valeur)}`;
        texteEm.title = valeurCourte(em.valeur);
        ligne.append(texteEm, bouton_('Répondre', () => definirReferenceEmission(em.idEmission)));
        el.appendChild(ligne); // avant la ligne d'actions, qui n'est attachée qu'à la fin
      }
      if (emissions.length > 0 || options.reception || options.echecEmission) detailsTour.appendChild(zoneEmissions(emissions, options.reception || null, options.echecEmission || null));
      // v0.63.84 — B1 : les faits de capacité de CE tour (avant → après, porte, cause, échec), tels que le déclencheur les a rendus.
      if (options.capacite) detailsTour.appendChild(ligneCapaciteDuTour(options.capacite));
      // v0.63.88 — une ligne par événement du tour : occasion ? statut de l'épisode propre ; le dernier épisode ouvert va dans la zone de diagnostic.
      if (Array.isArray(options.episodes) && options.episodes.length > 0) {
        for (const ep of options.episodes) {
          const l = document.createElement('div');
          l.className = 'capacite-tour episode-tour';
          l.textContent = `occasion (${courtId(ep.evenement)}) : ${ep.occasion && ep.occasion.occasion ? 'oui' : 'non'} — ${ep.statut}${ep.emission ? ` — émission ${courtId(ep.emission.idEmission)} (production ${courtId(ep.emission.idExecution)})` : ''}`;
          detailsTour.appendChild(l);
          if (ep.emission) el.appendChild(ligneEmissionInitiative(ep.emission));
        }
        const dernier = options.episodes[options.episodes.length - 1];
        afficherEvenement({ evenement: dernier.evenement, type: options.reception && options.reception.reception && dernier.evenement === options.reception.reception.id ? 'reception' : 'tour', occasion: dernier.occasion, statut: dernier.statut });
        const ouverts = options.episodes.filter((ep) => ep.observation);
        if (ouverts.length > 0) afficherEpisode(ouverts[ouverts.length - 1]);
      }
      // v0.63.86 — B2 : la conséquence relationnelle d'une réception déclarée pendant ce tour (faits bruts, hors zone repliée).
      if (options.reception && options.reception.relation && !options.reception.relation.echec) {
        const rel = document.createElement('div');
        rel.className = 'capacite-tour';
        rel.textContent = `relation : r ${options.reception.relation.avant} → ${options.reception.relation.apres} (cause : réception ${options.reception.reception ? options.reception.reception.id : '?'})`;
        detailsTour.appendChild(rel);
      }
      if (options.sollicitation && surSollicitation) detailsTour.appendChild(zoneSollicitation(options.sollicitation));
      const synthese = syntheseDuTour(options);
      if (synthese) el.appendChild(ligneSynthese(synthese, 'synthese-tour'));
      if (detailsTour.childNodes.length > 1) el.appendChild(detailsTour);
      if (options.confirmation) {
        const oui = bouton_('Confirmer', () => trancher(options.confirmation.onOui));
        oui.className = 'bouton-principal bouton-plus-fort';
        // v0.64.17 — une proposition de RÈGLE porte son propre libellé (« Refuser ») ; une proposition de fait garde « Annuler ».
        const non = bouton_(options.confirmation.libelleNon || 'Annuler', () => trancher(options.confirmation.onNon));
        non.classList.add('bouton-plus-fort');
        const trancher = async (suite) => {
          oui.disabled = true;
          non.disabled = true;
          try {
            const reponseFinale = await suite();
            oui.remove();
            non.remove();
            // v0.64.17 — la réponse peut être { texte, proposition } : le texte (ex. « J'ai retenu : … ») s'affiche comme avant, puis la
            // proposition de règle dans une SECONDE bulle, avec ses propres boutons (la confirmation du fait n'est jamais remplacée).
            const suiteProposee = reponseFinale !== null && typeof reponseFinale === 'object' ? reponseFinale.proposition : null;
            const texteFinal = reponseFinale !== null && typeof reponseFinale === 'object' ? reponseFinale.texte : reponseFinale;
            afficherMessage('ia', typeof texteFinal === 'string' && texteFinal ? texteFinal : 'C’est fait.');
            if (suiteProposee && typeof suiteProposee.texte === 'string' && suiteProposee.confirmation) {
              afficherMessage('ia', suiteProposee.texte, { confirmation: suiteProposee.confirmation });
            }
          } catch (e) {
            oui.disabled = false;
            non.disabled = false;
            info(`Ça n'a pas pu se faire : ${(e && e.message) || e}`);
          }
          defiler();
        };
        actions.append(oui, non);
      }
      if (actions.childNodes.length) el.appendChild(actions);
    } else if (options.reprise) {
      el.classList.add('reprise');
      const titre = document.createElement('span');
      titre.className = 'titre-reprise';
      titre.textContent = 'Même question, pour un modèle plus fort :';
      const corps = document.createElement('span');
      corps.textContent = texte;
      el.append(titre, corps);
    } else {
      el.textContent = texte;
    }
    nbAffiches++;
    return el;
  }

  // ---------- lecture à voix haute ----------
  function remettreBouton() {
    if (boutonLecture) {
      boutonLecture.textContent = 'Écouter';
      boutonLecture.classList.remove('actif');
      boutonLecture = null;
    }
  }

  async function lire(texte, b) {
    if (!voix) return;
    remettreBouton();
    if (b) {
      boutonLecture = b;
      b.textContent = 'Arrêter';
      b.classList.add('actif');
    }
    try {
      await voix.lire(texte);
    } catch (e) {
      info(`Lecture à voix haute impossible : ${e.message}`);
    } finally {
      if (boutonLecture === b) remettreBouton();
    }
  }

  // v0.63.35 — SOLLICITATION EXTÉRIEURE (outil de développement, pas une décision de Naissance). Chaque ligne = UNE application déjà DÉTERMINÉE par
  // l'observation de ce tour ; son bouton « Exécuter » porte PAR FERMETURE l'observation, l'application et l'univers de CE tour, transmis tels quels
  // à surSollicitation (injectée). Aucune relecture, aucune recherche, aucun « dernier contexte ». Le geste signifie seulement « exécute cette
  // application précise » : aucun jugement, aucune préférence. Les opérations à plusieurs candidats sont seulement signalées (« choix à faire »).
  // v0.63.81 — J-B : présentation seule des faits d'émission / réception du tour.
  function valeurCourte(valeur) {
    let t;
    try { t = JSON.stringify(valeur); } catch { t = String(valeur); }
    if (t === undefined) t = 'aucune valeur';
    return t.length > 120 ? `${t.slice(0, 117)}…` : t;
  }
  // v0.63.90 — ERGONOMIE (présentation seulement). Une valeur émise, lisible sur UNE ligne : le texte d'une chaîne, les valeurs textuelles d'une
  // collection de { valeur }, les symboles d'une collection de chaînes ; sinon la forme courte habituelle. La valeur complète reste dans le
  // dépliant « détails du tour » (Émissions, outil de développement) et en info-bulle.
  function valeurLisible(valeur) {
    let t;
    if (typeof valeur === 'string') t = valeur;
    else if (Array.isArray(valeur) && valeur.length > 0 && valeur.every((x) => typeof x === 'string')) t = valeur.join('');
    else if (Array.isArray(valeur) && valeur.length > 0 && valeur.every((x) => x && typeof x === 'object' && typeof x.valeur === 'string')) t = valeur.map((x) => x.valeur).join(' · ');
    else t = valeurCourte(valeur);
    return t.length > 60 ? `${t.slice(0, 57)}…` : t;
  }
  // Statut court d'un épisode (compte rendu vivant de traiterOccasion, ou relecture historique).
  function statutCourt(statut) {
    if (!statut) return '';
    if (statut === 'aucune occasion') return '';
    if (statut === 'engagement') return 'engagement';
    if (statut === 'aucun acte - 0 candidat' || statut === 'aucun candidat') return 'aucun acte (0 candidat)';
    if (statut === 'aucun acte - capacite insuffisante' || statut === 'capacite insuffisante') return 'aucun acte (capacité insuffisante)';
    if (statut === 'plusieurs candidats sans engagement') return 'aucun acte (plusieurs candidats)';
    const m = /^aucun acte - (\d+) candidats$/.exec(statut);
    if (m) return `aucun acte (${m[1]} candidats)`;
    if (statut.startsWith('épisode ')) return statutCourt(statut.slice(8));
    return statut;
  }
  // La synthèse d'UN tour : « c 3 → 2 · occasion : non » (+ « · r 1 → 0 » si une réception a transformé r).
  function syntheseDuTour(options) {
    const morceaux = [];
    const c = options.capacite;
    if (c) morceaux.push(c.porte ? `c ${c.avant} (porte fermée)` : c.variation ? `c ${c.avant} → ${c.apres}` : `c ${c.avant}`);
    const rel = options.reception && options.reception.relation && !options.reception.relation.echec ? options.reception.relation : null;
    if (rel) morceaux.push(`r ${rel.avant} → ${rel.apres}`);
    const eps = Array.isArray(options.episodes) ? options.episodes : [];
    if (eps.length > 0) {
      const ouvert = eps.find((ep) => ep.occasion && ep.occasion.occasion);
      morceaux.push(ouvert ? `occasion : oui${statutCourt(ouvert.statut) ? ` → ${statutCourt(ouvert.statut)}` : ''}` : 'occasion : non');
    }
    return morceaux.join(' · ');
  }
  function ligneSynthese(texte, classe) {
    const l = document.createElement('div');
    l.className = classe;
    l.textContent = texte;
    return l;
  }

  // v0.63.84 — B1 : une ligne de faits bruts dans la bulle du tour.
  function ligneCapaciteDuTour(c) {
    const ligne = document.createElement('div');
    ligne.className = 'capacite-tour';
    if (c.porte) ligne.textContent = `capacité : c = 0 / ${c.plafond} — porte : aucun acte mécanique ce tour (observation faite)`;
    else if (c.variation) ligne.textContent = `capacité : ${c.avant} → ${c.apres} / ${c.plafond} (tour actif, cause ${c.variation.cause.type} ${c.variation.cause.id})`;
    else if (c.echec) ligne.textContent = `capacité : ${c.avant} / ${c.plafond} — variation non écrite : ${c.echec && c.echec.message ? c.echec.message : c.echec}`;
    else ligne.textContent = `capacité : ${c.avant} / ${c.plafond} — tour sans acte exécuté : aucune variation`;
    return ligne;
  }

  function creerBandeauCapacite() {
    if (bandeauCapacite || !capacite) return bandeauCapacite;
    bandeauCapacite = document.createElement('div');
    bandeauCapacite.className = 'bandeau-capacite';
    texteCapacite = document.createElement('span');
    texteCapacite.className = 'capacite-texte';
    texteCapacite.textContent = 'capacité : …';
    const repos = bouton_('Repos', async () => {
      if (occupe) return;
      repos.disabled = true;
      try {
        const r = await capacite.repos();
        // v0.63.85 — faits bruts du tick, dans l'ordre réel : tick → observation interne → désignation → variation ; aucun déclencheur mécanique.
        // v0.63.86 — B2 : le tick porte aussi la conséquence relationnelle (r), désignée dans la même observation interne.
        const b2 = r.relation || null;
        // v0.63.90 — ERGONOMIE : la bulle du Repos affiche UNE ligne (« Repos : c 1 → 2 · r 0 → 1 · occasion oui · engagement ») ; les faits
        // (tick, B1/B2, observation interne, données observées, univers, désignations, variations, occasion) sont dans le dépliant « détails ».
        const ep0 = r.episode || null;
        const el = info(['Repos', `c ${r.avant} → ${r.apres}`, ...(b2 ? [`r ${b2.avant} → ${b2.apres}`] : []), ...(ep0 ? [`occasion ${ep0.occasion && ep0.occasion.occasion ? 'oui' : 'non'}`] : []), ...(ep0 && statutCourt(ep0.statut) ? [statutCourt(ep0.statut)] : [])].join(' · ').replace('Repos · ', 'Repos : '));
        el.classList.add('repos-compact');
        const detailsRepos = document.createElement('details');
        detailsRepos.className = 'details-tour details-repos';
        const titreRepos = document.createElement('summary');
        titreRepos.textContent = 'détails';
        detailsRepos.appendChild(titreRepos);
        el.appendChild(detailsRepos);
        const faitsTick = document.createElement('p');
        faitsTick.className = 'faits-repos';
        detailsRepos.appendChild(faitsTick);
        faitsTick.textContent = (`tick ${r.variation.cause.id}\nB1 : c ${r.avant} → ${r.apres}${r.avant === r.apres ? ' (saturation : état inchangé)' : ''}${b2 ? `\nB2 : r ${b2.avant} → ${b2.apres}${b2.avant === b2.apres ? ' (saturation : état inchangé)' : ''}` : ''}`);
        if (r.observation && r.designation) {
          const faits = document.createElement('p');
          faits.className = 'faits-repos';
          faits.textContent = [
            `observation interne : ${r.observation.id}`,
            `source : ${r.observation.source || 'soi'} — données observées : ${Array.isArray(r.observation.donneesExaminees) ? r.observation.donneesExaminees.join(', ') : r.observation.idMessage}`,
            `univers : ${Array.isArray(r.univers) ? r.univers.length : '?'} — possibilités : ${Array.isArray(r.observation.possibilites) ? r.observation.possibilites.length : '?'}`,
            `conséquence B1 désignée : ${r.designation.id} (${r.designation.operation})`,
            `variation B1 : ${r.variation.id}`,
            ...(b2 && b2.designation ? [`conséquence B2 désignée : ${b2.designation.id} (${b2.designation.operation})`, `variation B2 : ${b2.variation.id}`] : []),
            'aucun acte mécanique déclenché',
          ].join('\n');
          detailsRepos.appendChild(faits);
        }
        // v0.63.88 — l'épisode propre éventuel ouvert par ce tick : une ligne dans la bulle, le détail dans la zone de diagnostic.
        if (r.episode) {
          const ep = document.createElement('p');
          ep.className = 'faits-repos episode-tour';
          ep.textContent = `occasion (tick) : ${r.episode.occasion && r.episode.occasion.occasion ? 'oui' : 'non'} — ${r.episode.statut}${r.episode.emission ? ` — émission ${courtId(r.episode.emission.idEmission)} (production ${courtId(r.episode.emission.idExecution)})` : ''}`;
          detailsRepos.appendChild(ep);
          if (r.episode.emission) el.insertBefore(ligneEmissionInitiative(r.episode.emission), detailsRepos);
          afficherEvenement({ evenement: r.episode.evenement, type: 'tick', occasion: r.episode.occasion, statut: r.episode.statut });
          if (r.episode.observation) afficherEpisode(r.episode);
        }
      } catch (err) {
        info(`repos non enregistré : ${err && err.message ? err.message : err}`);
      } finally {
        repos.disabled = false;
        await rafraichirCapacite();
      }
    });
    // v0.63.90 — BARRE COMPACTE : « c 2/3 · r 1/3 · dernier : … » [Repos] [▸] ; le bouton ▸ ouvre / ferme le panneau Diagnostic.
    boutonDiagnostic = bouton_('▸', () => { zoneDiagnostic.open = !zoneDiagnostic.open; });
    boutonDiagnostic.classList.add('bouton-diagnostic');
    boutonDiagnostic.setAttribute('aria-label', 'Diagnostic');
    bandeauCapacite.append(texteCapacite, repos, boutonDiagnostic);
    // v0.63.88 — ZONE DE DIAGNOSTIC dédiée, sur toute la largeur (la zone .87 dans le bandeau était illisible) : les besoins déclarés (.87 : états,
    // satiétés, motifs, moyens connus, preuves) et le DERNIER ÉPISODE PROPRE (occasion, évaluation, engagement, coût, émission). Faits seulement.
    zoneDiagnostic = document.createElement('details');
    zoneDiagnostic.className = 'diagnostic';
    zoneDiagnostic.open = false; // v0.63.89 — replié par défaut (lisibilité)
    const titreDiagnostic = document.createElement('summary');
    titreDiagnostic.textContent = 'Diagnostic : besoins, moyens connus, dernier épisode propre';
    zoneBesoins = document.createElement('div');
    zoneBesoins.className = 'besoins-zone';
    zoneActesSitues = document.createElement('div');
    zoneActesSitues.className = 'actes-situes-zone';
    zoneEvenement = document.createElement('div');
    zoneEvenement.className = 'evenement-zone';
    zoneEpisode = document.createElement('div');
    zoneEpisode.className = 'episode-zone';
    zoneEtatComplet = document.createElement('div');
    zoneEtatComplet.className = 'etat-complet';
    zoneDiagnostic.append(titreDiagnostic, zoneEtatComplet, zoneBesoins, zoneActesSitues, zoneEvenement, zoneEpisode);
    zoneDiagnostic.addEventListener('toggle', () => { if (boutonDiagnostic) boutonDiagnostic.textContent = zoneDiagnostic.open ? '▾' : '▸'; });
    formulaire.parentNode.insertBefore(zoneDiagnostic, formulaire);
    formulaire.parentNode.insertBefore(bandeauCapacite, formulaire); // juste au-dessus de la zone de saisie, sur toute la largeur
    return bandeauCapacite;
  }

  // v0.63.87 — affichage brut, lecture seule : « <besoin> <état> / <plafond> / satiété <s> / motif : oui|non / moyens connus : n » puis une ligne par moyen
  // (production exacte) avec ses preuves (identités). Rien n'est cliquable, rien ne déclenche quoi que ce soit.
  const ETIQUETTE_BESOIN = Object.freeze({ capacite: ['capacité c', 'capacité'], relation: ['relation r', 'relation'] });
  // v0.63.89 — LISIBILITÉ (décision ChatGPT, 11/10/2026) : identités RACCOURCIES À L'AFFICHAGE SEULEMENT (les identités persistées ne changent
  // jamais) ; une ligne de résumé par besoin et par épisode ; les détails complets (preuves, identités entières) dans des dépliants.
  const courtId = (id) => { const s = String(id ?? '?'); const m = s.match(/^([a-z-]+?)-\d{10,}-(\d+-\d+)$/); return m ? `${m[1]}…${m[2]}` : s; };
  function depliant(titre, lignes, classe = 'diagnostic-details') {
    const d = document.createElement('details');
    d.className = classe;
    const t = document.createElement('summary');
    t.textContent = titre;
    d.appendChild(t);
    for (const texte of lignes) { const l = document.createElement('div'); l.className = 'diagnostic-ligne'; l.textContent = texte; d.appendChild(l); }
    return d;
  }
  const ligneTexte = (texte, classe) => { const l = document.createElement('div'); l.className = classe; l.textContent = texte; return l; };
  function afficherBesoins(besoins, plafonds) {
    zoneBesoins.textContent = '';
    for (const b of besoins) {
      const [etat, nom] = ETIQUETTE_BESOIN[b.besoin] || [b.besoin, b.besoin];
      const sans = b.satisfactionsSansProduction.length;
      zoneBesoins.appendChild(ligneTexte(`${etat} = ${b.valeurActuelle} / ${plafonds[b.besoin]} (satiété ${b.satiete}) · motif ${nom} : ${b.motif ? 'oui' : 'non'} · ${b.moyens.length} moyen${b.moyens.length > 1 ? 's' : ''} connu${b.moyens.length > 1 ? 's' : ''}${Array.isArray(b.strategies) && b.moyens.length > 0 ? ` (${b.strategies.length} stratégie${b.strategies.length > 1 ? 's' : ''})` : ''}${sans > 0 ? ` · ${sans} satisfaction${sans > 1 ? 's' : ''} vécue${sans > 1 ? 's' : ''} sans production` : ''}`, 'besoin-ligne'));
      // v0.63.91 — stratégies = applications ; chaque stratégie liste ses occurrences (productions) et l'occurrence support (faits seulement).
      if (Array.isArray(b.strategies) && b.strategies.length > 0) zoneBesoins.appendChild(depliant(`stratégies (${nom})`, b.strategies.flatMap((st) => [`stratégie ${st.operation} — ${st.occurrences.length} occurrence${st.occurrences.length > 1 ? 's' : ''} — support ${st.occurrenceSupport}`, ...st.occurrences.map((o) => `   occurrence ${o}`)])));
      if (b.moyens.length > 0) zoneBesoins.appendChild(depliant(`détail des moyens connus (${nom})`, b.moyens.flatMap((m) => [`production ${m.production} (${m.operation}) — ${m.preuves.length} preuve${m.preuves.length > 1 ? 's' : ''}`, ...m.preuves.map((p) => `   preuve : réception ${p.reception} — émission ${p.emission} — ${p.valeurAvant} → ${p.valeurApres}`)])));
    }
  }

  // v0.63.88 — l'ÉMISSION D'UN ÉPISODE PROPRE (réémission d'une production exacte connue) : une ligne « Naissance → toi », avec le même bouton
  // « Répondre » que les émissions du lot (la réponse est le seul moyen pour la réception d'exister : rien n'est déclaré sans ce geste).
  function ligneEmissionInitiative(em) {
    const ligne = document.createElement('div');
    ligne.className = 'emission-naissance emission-initiative';
    const texteEm = document.createElement('span');
    texteEm.className = 'emission-texte';
    texteEm.textContent = `Naissance → toi (épisode propre) : ${valeurLisible(em.valeur)}`; // v0.63.90 — une ligne ; l'identité de l'émission en info-bulle et dans les détails
    texteEm.title = `émission ${em.idEmission} — ${valeurCourte(em.valeur)}`;
    ligne.append(texteEm, bouton_('Répondre', () => definirReferenceEmission(em.idEmission)));
    return ligne;
  }

  // v0.63.89 — l'épisode propre, en UNE ligne de résumé + un dépliant de détails. Deux formes acceptées : le compte rendu vivant de traiterOccasion
  // ({ statut, evaluation, engagement, cout, emission }) et la RELECTURE HISTORIQUE (reconstruireEpisode : { resultat, etats, besoins, designations,
  // cout, emission }). Vocabulaire : occasion, motif, candidat, autorisé, engagement, émission, preuve. Rien de cliquable.
  const NOM_BESOIN = Object.freeze({ capacite: 'capacité', relation: 'relation' });
  const RESULTAT_TEXTE = Object.freeze({ 'aucun candidat': 'aucun acte — 0 candidat', 'capacite insuffisante': 'aucun acte — capacité insuffisante', 'plusieurs candidats sans engagement': 'aucun acte — plusieurs candidats / indétermination', incoherence: 'INCOHÉRENCE (candidat unique autorisé sans engagement, ou engagement sans candidat)', engagement: 'engagement' });
  function normaliserEpisode(ep) {
    if (!ep) return null;
    const vivant = typeof ep.statut === 'string';
    const occ = ep.occasion || null;
    const ev = vivant ? ep.evaluation : null;
    const motifs = vivant ? (ev ? ev.besoins : []) : ep.besoins;
    const candidats = vivant ? (ev ? ev.candidats : []) : ep.candidats;
    const autorises = vivant ? (ev ? ev.autorises : []) : ep.autorises;
    const porte = vivant ? (ev ? ev.porte : null) : ep.porte;
    const c = vivant ? (ev ? ev.capacite : null) : (ep.etats && ep.etats.capacite ? ep.etats.capacite.valeur : null);
    const engagement = vivant ? ep.engagement : (ep.engagements && ep.engagements[0]) || null;
    const coutRow = ep.cout ? (ep.cout.variation || ep.cout) : null;
    const emission = ep.emission ? { id: ep.emission.idEmission || ep.emission.id, production: ep.emission.idExecution } : null;
    const rotation = vivant ? (ev ? ev.rotation || null : null) : ep.rotation || null;
    let resultat;
    if (vivant) {
      resultat = ep.statut === 'engagement' ? `engagement → production ${courtId(engagement ? engagement.liaisons[0].donnee : '?')}`
        : ep.statut === 'aucun acte - 0 candidat' ? RESULTAT_TEXTE['aucun candidat']
        : ep.statut === 'aucun acte - capacite insuffisante' ? RESULTAT_TEXTE['capacite insuffisante']
        : ep.statut.startsWith('aucun acte - ') ? `${ep.statut.replace('aucun acte - ', 'aucun acte — ')} / indétermination`
        : ep.statut === 'cout refuse' || ep.statut === 'emission refusee' || ep.statut === 'echec' ? `${ep.statut} : ${ep.echec && ep.echec.message ? ep.echec.message : ep.echec}` : ep.statut;
    } else resultat = ep.resultat === 'engagement' ? `engagement → production ${courtId(engagement ? engagement.liaisons[0].donnee : '?')}` : (RESULTAT_TEXTE[ep.resultat] || ep.resultat);
    return { vivant, evenement: ep.evenement, occ, observation: ep.observation || null, motifs, candidats, autorises, porte, c, engagement, coutRow, coutAvant: vivant && ep.cout ? ep.cout.avant : null, emission, resultat, rotation };
  }
  function texteRotation(nombre, rot) {
    if (!rot.ordonnable) return `${nombre} stratégies non ordonnables (même opération : ${rot.ordre.join(', ')}) · aucun acte`;
    return `${nombre} stratégies ordonnables (${rot.ordre.join(' → ')}) · précédent : ${rot.precedent || 'aucun'} · actualisation : ${rot.actualisee ? rot.actualisee.operation : '?'}`;
  }
  function texteOccasion(occ) {
    if (!occ) return 'occasion : ?';
    const agg = occ.aggravations.length === 0 ? 'aucune aggravation' : occ.aggravations.map((a) => `${NOM_BESOIN[a.dimension] || a.dimension} ${a.valeurAvant} → ${a.valeurApres}`).join(', ');
    const couts = Array.isArray(occ.coutsDActivite) && occ.coutsDActivite.length > 0 ? ` (coût d'activité, pas une occasion : ${occ.coutsDActivite.map((a) => `${NOM_BESOIN[a.dimension] || a.dimension} ${a.valeurAvant} → ${a.valeurApres}`).join(', ')})` : '';
    return `${agg}${couts} → occasion : ${occ.occasion ? 'oui' : 'non'}${occ.propre ? ' (activité propre)' : ''}`;
  }
  function afficherEpisode(ep, { reconstruit = false } = {}) {
    if (!zoneEpisode) return;
    zoneEpisode.textContent = '';
    const n = normaliserEpisode(ep);
    if (!n) { zoneEpisode.appendChild(ligneTexte('dernier épisode propre : aucun', 'episode-titre')); return; }
    if (!n.observation) { zoneEpisode.appendChild(ligneTexte(`dernier épisode propre : aucun (événement ${courtId(n.evenement)} : ${texteOccasion(n.occ)})`, 'episode-titre')); return; }
    const resume = `dernier épisode propre${reconstruit ? ' (relu depuis le vécu)' : ''} : ${texteOccasion(n.occ)} · ${n.candidats.length} candidat${n.candidats.length > 1 ? 's' : ''} · porte B1 ${n.porte === null ? '?' : n.porte ? 'ouverte' : 'fermée'} (c = ${n.c ?? '?'})${n.rotation ? ` · ${n.rotation.ordonnable ? `${n.autorises.length} stratégies ordonnables · actualisation : ${n.rotation.actualisee ? n.rotation.actualisee.operation : '?'}` : `${n.autorises.length} stratégies non ordonnables · aucun acte`}` : ''} · ${n.resultat}`;
    zoneEpisode.appendChild(ligneTexte(resume, 'episode-titre'));
    const details = [
      `événement : ${n.evenement}`,
      `observation O : ${n.observation.id} (source ${n.observation.source || 'soi'}, occasion ${n.observation.occasion || '?'})`,
      `motifs à O : ${n.motifs.map((b) => `${NOM_BESOIN[b.besoin] || b.besoin} ${b.valeurActuelle ?? '?'} / satiété ${b.satiete} : ${b.motif === null ? '?' : b.motif ? 'oui' : 'non'}`).join(' ; ')}`,
      `candidats motivés : ${n.candidats.length}`,
      ...n.candidats.map((c) => `   ${Array.isArray(c.occurrences) ? `stratégie ${c.operation} (${c.occurrences.length} occurrence${c.occurrences.length > 1 ? 's' : ''}, support ${c.production})` : `production ${c.production} (${c.operation})`} — ${c.raisons.map((r) => `${NOM_BESOIN[r.besoin] || r.besoin}, ${r.preuves.length} preuve${r.preuves.length > 1 ? 's' : ''}`).join(' ; ')}`),
      `porte B1 : ${n.porte === null ? '?' : n.porte ? 'ouverte' : 'fermée'} (c = ${n.c ?? '?'}) · candidats autorisés : ${n.autorises.length}`,
      // v0.63.92 — rotation d'actualisation : faits seulement (ordre des noms, dernier engagement dans L, stratégie actualisée), aucun mot de préférence.
      ...(n.rotation ? [texteRotation(n.autorises.length, n.rotation)] : []),
      `résultat : ${n.resultat}`,
      ...(n.engagement ? [`engagement : ${n.engagement.id} (origine ${n.engagement.origine}) → production ${n.engagement.liaisons[0].donnee}`] : []),
      ...(n.coutRow ? [`coût B1 : ${n.coutAvant !== null && n.coutAvant !== undefined ? `c ${n.coutAvant} → ${n.coutRow.valeur}` : `→ ${n.coutRow.valeur}`} (variation ${n.coutRow.id}, cause ${n.coutRow.cause ? `${n.coutRow.cause.type} ${n.coutRow.cause.id}` : '?'}, désignation ${n.coutRow.idDesignation || '?'})`] : []),
      ...(n.emission ? [`émission : ${n.emission.id} (production ${n.emission.production})`] : []),
    ];
    zoneEpisode.appendChild(depliant('détail de l\'épisode (identités complètes)', details));
    episodeAffiche = true;
  }
  // v0.63.89 — le DERNIER ÉVÉNEMENT, même sans épisode : une ligne de résumé (type, aggravations / coût d'activité, occasion oui/non).
  function afficherEvenement(ev) {
    if (!zoneEvenement) return;
    zoneEvenement.textContent = '';
    if (!ev) { zoneEvenement.appendChild(ligneTexte('dernier événement : aucun', 'evenement-ligne')); return; }
    const type = ev.type ? `${ev.type} ` : '';
    const statut = ev.statut || (ev.episode ? `épisode ${ev.episode.resultat}` : (ev.occasion && ev.occasion.occasion ? 'épisode non retrouvé' : 'aucune occasion'));
    resumeDernier = `${ev.type || 'événement'} → occasion ${ev.occasion && ev.occasion.occasion ? 'oui' : 'non'}${statutCourt(statut) ? ` → ${statutCourt(statut)}` : ''}`;
    zoneEvenement.appendChild(ligneTexte(`dernier événement : ${type}${courtId(ev.evenement)} — ${texteOccasion(ev.occasion)} — ${statut}`, 'evenement-ligne'));
  }

  // N3b-0 — « Propositions de résolution vécues (relecture) » : une entrée par acte, faits bruts, aucune valence, aucun compte, aucune comparaison.
  // Ce que Naissance POSSÈDE (historique) est séparé de ce qu'elle RECONSTRUIT aujourd'hui (« relu aujourd'hui, déclaration actuelle »).
  const ISSUE_TEXTE = Object.freeze({ ouverte: 'ouverte (aucune issue)', annulee: 'annulée', perimee: 'périmée', confirmee: 'confirmée' });
  const PORTEE_TEXTE = Object.freeze({ 'incompatible-sous-identite': 'incompatible sous la même identité', indeterminee: 'indéterminée' });
  const fleche = (f) => `${f.sujet} → ${f.relation} → ${f.valeur}`;
  function lignesExperienceSituee(x) {
    const h = x.situation.historique;
    const r = x.situation.relecture;
    const lignes = [
      `« ${h.question === null ? '(question introuvable)' : h.question} » (acte ${courtId(x.acte.idReponseAttendue)}) — tu attendais ${h.attendu === null ? '(réponse attendue absente)' : h.attendu}`,
      `appui (historique) : ${fleche(x.acte.ancien)}`,
      r.statut === 'relue'
        ? `relu aujourd'hui (déclaration actuelle) : contraintes ${r.contraintes.join(' + ')} · champ délivré ${r.delivre} (${r.valeurDelivree}) · portée ${PORTEE_TEXTE[r.porteeSurIdentite] || r.porteeSurIdentite}`
        : 'relu aujourd\'hui : non relue',
      `proposé : ${x.acte.ancien.valeur} → ${x.acte.nouveau.valeur}`,
      `issue : ${ISSUE_TEXTE[x.issue.nature] || x.issue.nature}${x.issue.nature === 'perimee' ? ` (${x.issue.raison})` : ''}`,
    ];
    if (x.issue.nature === 'confirmee') {
      lignes.push(x.apres.faitResultant ? `résultat historique : ${fleche(x.apres.faitResultant)} · encore actuel : ${x.apres.resultatActuel ? 'oui' : 'non'}` : 'résultat historique : (manifestation introuvable)');
    }
    if (h.absences.length) lignes.push(`données absentes : ${h.absences.join(', ')}`);
    return lignes;
  }
  function afficherExperiencesSituees(liste) {
    if (!zoneActesSitues) return;
    zoneActesSitues.textContent = '';
    const d = document.createElement('details');
    d.className = 'diagnostic-details';
    const t = document.createElement('summary');
    t.textContent = 'Propositions de résolution vécues (relecture)';
    d.appendChild(t);
    if (!Array.isArray(liste)) d.appendChild(ligneTexte('relecture non lisible', 'diagnostic-ligne'));
    else if (!liste.length) d.appendChild(ligneTexte('aucune proposition vécue', 'diagnostic-ligne'));
    else for (const x of liste) {
      const bloc = document.createElement('div');
      bloc.className = 'acte-situe';
      for (const texte of lignesExperienceSituee(x)) bloc.appendChild(ligneTexte(texte, 'diagnostic-ligne'));
      d.appendChild(bloc);
    }
    zoneActesSitues.appendChild(d);
  }

  // N3b-1 — « Deux expériences mises en regard (descriptions) » : toutes les paires, dans l'ordre technique reçu (sans signification), sans
  // aucun nombre, aucun classement, aucun verdict. L'historique (traces) et l'actuel (reconstruit aujourd'hui) restent dans deux sections.
  const texteValeur = (v) => (Array.isArray(v) ? `[${v.map(texteValeur).join(', ')}]` : v && typeof v === 'object' ? `{ ${Object.entries(v).map(([k, w]) => `${k}: ${texteValeur(w)}`).join(', ')} }` : typeof v === 'string' ? `« ${v} »` : String(v));
  const texteChemin = (c) => c.join(' › ');
  const ABSENTE_TEXTE = Object.freeze({ premiere: 'absente dans la première', seconde: 'absente dans la seconde', 'les-deux': 'absente des deux côtés' });
  function lignesRegard(r) {
    const lignes = [];
    for (const x of r.communs) lignes.push(`égal · ${texteChemin(x.chemin)} : ${texteValeur(x.valeur)}`);
    for (const x of r.differents) lignes.push(`différent · ${texteChemin(x.chemin)} : ${texteValeur(x.premiere)} / ${texteValeur(x.seconde)}`);
    for (const [cote, nom] of [['premiere', 'première'], ['seconde', 'seconde']]) {
      for (const x of r.propres[cote]) lignes.push(`seulement dans la ${nom} · ${texteChemin(x.chemin)}${x.absente ? ' (donnée absente)' : ` : ${texteValeur(x.valeur)}`}`);
    }
    for (const x of r.indeterminables) lignes.push(`indéterminable · ${texteChemin(x.chemin)} (${ABSENTE_TEXTE[x.absente] || x.absente})`);
    return lignes.length ? lignes : ['(rien à cet endroit)'];
  }
  function afficherConfrontations(liste) {
    if (!zoneActesSitues) return;
    const d = document.createElement('details');
    d.className = 'diagnostic-details';
    const t = document.createElement('summary');
    t.textContent = 'Deux expériences mises en regard (descriptions)';
    d.appendChild(t);
    if (!Array.isArray(liste)) d.appendChild(ligneTexte('mise en regard non lisible', 'diagnostic-ligne'));
    else if (!liste.length) d.appendChild(ligneTexte('il faut au moins deux propositions vécues', 'diagnostic-ligne'));
    else for (const c of liste) {
      const bloc = document.createElement('div');
      bloc.className = 'acte-situe';
      const [i1, i2] = c.identites;
      bloc.appendChild(ligneTexte(`première : acte ${courtId(i1[0].valeur)} — seconde : acte ${courtId(i2[0].valeur)}`, 'diagnostic-ligne'));
      if (c.refus) bloc.appendChild(ligneTexte('même expérience des deux côtés : non mise en regard', 'diagnostic-ligne'));
      else {
        bloc.appendChild(ligneTexte('traces historiques :', 'diagnostic-ligne'));
        for (const texte of lignesRegard(c.historique)) bloc.appendChild(ligneTexte(texte, 'diagnostic-ligne'));
        bloc.appendChild(ligneTexte('reconstruit aujourd\'hui (déclaration et état actuels) :', 'diagnostic-ligne'));
        for (const texte of lignesRegard(c.actuel)) bloc.appendChild(ligneTexte(texte, 'diagnostic-ligne'));
      }
      d.appendChild(bloc);
    }
    zoneActesSitues.appendChild(d);
  }

  async function rafraichirCapacite() {
    if (!capacite) return;
    try { if (await etat() !== 'pret') return; } catch { return; }
    creerBandeauCapacite();
    try {
      const c = await capacite.lire();
      const d = c.derniere;
      const derniere = d ? `dernière variation : ${d.cause.type} → ${d.valeur} (cause ${d.cause.id})` : 'aucune variation (origine)';
      // v0.63.86 — B2 : la relation (r) à côté de la capacité ; faits bruts, aucun vocabulaire psychologique.
      const rel = c.relation ? ` — relation r = ${c.relation.valeur} / ${c.relation.plafond}${c.relation.derniere ? ` (dernière variation : ${c.relation.derniere.cause.type} → ${c.relation.derniere.valeur})` : ' (origine)'}` : '';
      if (zoneBesoins && Array.isArray(c.besoins)) afficherBesoins(c.besoins, { capacite: c.plafond, relation: c.relation ? c.relation.plafond : '?' });
      if (zoneActesSitues && capacite.experiencesSituees) {
        let experiences = null;
        try { experiences = await capacite.experiencesSituees(); afficherExperiencesSituees(experiences); } catch { afficherExperiencesSituees(null); }
        // N3b-1 — sous la relecture, dans la même zone : les paires mises en regard (aucune autre lecture du magasin).
        if (capacite.confrontationsSituees) { try { afficherConfrontations(Array.isArray(experiences) ? capacite.confrontationsSituees(experiences) : null); } catch { afficherConfrontations(null); } }
      }
      if (!episodeAffiche && zoneEvenement && capacite.dernierEvenement) { try { afficherEvenement(await capacite.dernierEvenement()); } catch { afficherEvenement(null); } }
      if (!episodeAffiche && zoneEpisode && capacite.dernierEpisode) { try { afficherEpisode(await capacite.dernierEpisode(), { reconstruit: true }); } catch { afficherEpisode(null); } }
      // v0.63.90 — la phrase complète va dans le panneau Diagnostic ; la barre ne garde que c, r et le dernier événement utile.
      if (zoneEtatComplet) zoneEtatComplet.textContent = `capacité c = ${c.valeur} / plafond ${c.plafond}${rel} — ${derniere}${c.valeur === 0 ? ' — porte : lot mécanique retenu au prochain tour' : ''}`;
      texteCapacite.textContent = `c ${c.valeur}/${c.plafond}${c.relation ? ` · r ${c.relation.valeur}/${c.relation.plafond}` : ''}${resumeDernier ? ` · dernier : ${resumeDernier}` : ''}`;
    } catch (err) {
      texteCapacite.textContent = `capacité non lisible : ${err && err.message ? err.message : err}`;
    }
  }

  function zoneEmissions(emissions, reception, echecEmission) {
    const zone = document.createElement('details');
    zone.className = 'emissions-dev';
    const titre = document.createElement('summary');
    titre.textContent = 'Émissions (outil de développement)';
    zone.appendChild(titre);
    for (const em of emissions) {
      const ligne = document.createElement('div');
      ligne.className = 'emission-ligne';
      ligne.textContent = `émission ${em.idEmission} — production ${em.idExecution} (${em.operation}) — remise : ${em.remise}`;
      zone.appendChild(ligne);
      const valeur = document.createElement('div');
      valeur.className = 'emission-ligne emission-valeur';
      valeur.textContent = `valeur : ${valeurCourte(em.valeur)}`; // v0.63.90 — la valeur (forme habituelle) reste lisible ici
      zone.appendChild(valeur);
    }
    if (echecEmission) {
      const ligne = document.createElement('div');
      ligne.className = 'emission-ligne';
      ligne.textContent = `émission en échec : ${echecEmission && echecEmission.message ? echecEmission.message : echecEmission}`;
      zone.appendChild(ligne);
    }
    if (reception) {
      const ligne = document.createElement('div');
      ligne.className = 'emission-ligne reception-ligne';
      ligne.textContent = reception.reception
        ? `réception ${reception.reception.id} — ton message ${reception.idDonnee} rattaché à l'émission ${reception.idEmission}`
        : `réception refusée pour l'émission ${reception.idEmission} : ${reception.echec && reception.echec.message ? reception.echec.message : reception.echec}`;
      zone.appendChild(ligne);
      // v0.63.86 — B2 : la conséquence relationnelle de cette réception déclarée (faits bruts).
      if (reception.relation) {
        const rel = document.createElement('div');
        rel.className = 'emission-ligne relation-ligne';
        const x = reception.relation;
        rel.textContent = x.echec
          ? `relation : variation non écrite : ${x.echec && x.echec.message ? x.echec.message : x.echec}`
          : `relation : r ${x.avant} → ${x.apres} — cause : réception ${reception.reception.id} — observation interne ${x.observation ? x.observation.id : '?'} — conséquence B2 désignée : ${x.designation ? x.designation.id : '?'} (soi:reception) — variation : ${x.variation ? x.variation.id : '?'}`;
        zone.appendChild(rel);
      }
    }
    return zone;
  }

  function zoneSollicitation(contexte) {
    const { observation, univers, applications, choixAFaire, automatiques = [], dejaExecutees = [], relatives = [], echecDeclenchement = null, attentes = [], echecAttentes = null } = contexte;
    const zone = document.createElement('details');
    zone.className = 'sollicitation-dev';
    const titre = document.createElement('summary');
    titre.textContent = 'Sollicitation (outil de développement)';
    zone.appendChild(titre);
    // v0.63.94 — causalité locale : une opération déterminée relativement à l'observation porte la mention factuelle correspondante (une opération
    // n'est jamais à la fois déterminée par structure et relativement à O dans un même lot) ; sans mention : déterminée par structure.
    const relativesA = new Set();
    for (const a of relatives) relativesA.add(a.operation);
    const mention = (operation) => (relativesA.has(operation) ? ' (déterminée relativement à l\'observation)' : '');
    // v0.63.60 : lignes d'information (sans bouton) pour ce que le déclencheur mécanique a déjà fait ; un échec est montré tel quel.
    for (const r of automatiques) {
      const ligne = document.createElement('div');
      ligne.className = 'sollicitation-ligne sollicitation-automatique';
      ligne.textContent = r.statut === 'executee' ? `${r.operation} — exécutée automatiquement${mention(r.operation)}` : `${r.operation} — automatique : ${r.statut}${r.erreur && r.erreur.message ? ` : ${r.erreur.message}` : ''}${mention(r.operation)}`;
      zone.appendChild(ligne);
    }
    // v0.63.93 — DT6 : une application déterminée DÉJÀ exécutée n'est plus relancée par le lot (fait, sans bouton).
    for (const d of dejaExecutees) {
      const ligne = document.createElement('div');
      ligne.className = 'sollicitation-ligne sollicitation-deja';
      ligne.textContent = `${d.operation} — déjà exécutée (non relancée)${mention(d.operation)}`;
      zone.appendChild(ligne);
    }
    if (echecDeclenchement) {
      const ligne = document.createElement('div');
      ligne.className = 'sollicitation-ligne sollicitation-automatique';
      ligne.textContent = `déclencheur automatique en échec : ${echecDeclenchement && echecDeclenchement.message ? echecDeclenchement.message : echecDeclenchement}`;
      zone.appendChild(ligne);
    }
    // v0.63.78 — jalon 1 : lignes d'information (sans bouton) pour les ATTENTES que les exécutions automatiques de ce tour ont écrites AVANT
    // leur issue, puis l'issue de chacune telle que la vue la rend (réalisée / autre / absente), ou « sans issue » si rien n'est advenu.
    // Présentation seule : rien n'est lu pour décider, rien n'est écrit.
    for (const a of attentes) {
      const ligne = document.createElement('div');
      ligne.className = 'sollicitation-ligne sollicitation-attente';
      const constat = (c) => c && Object.hasOwn(c, 'valeur') ? `${c.type} ${JSON.stringify(c.valeur)}` : (c ? c.type : '');
      const heure = (iso) => typeof iso === 'string' && iso.length >= 19 ? iso.slice(11, 19) : '?';
      let issue;
      if (a.erreur) issue = `issue non calculable : ${a.erreur}`;
      else if (a.issue === null) issue = 'sans issue';
      else {
        const statut = a.issue.statut === 'realisee' ? 'réalisée' : a.issue.statut;
        issue = `issue (${heure(a.issue.horodatageExecution)}) : ${statut}${a.issue.reel ? ` — réel : ${constat(a.issue.reel)}` : ''}`;
      }
      ligne.textContent = `${a.operation} — attente écrite avant l'exécution (${heure(a.horodatageAttente)}) : ${a.chemin} = ${constat(a.constat)} [${a.structure}] → ${issue}`;
      zone.appendChild(ligne);
    }
    if (echecAttentes) {
      const ligne = document.createElement('div');
      ligne.className = 'sollicitation-ligne sollicitation-attente';
      ligne.textContent = `attentes non lisibles : ${echecAttentes && echecAttentes.message ? echecAttentes.message : echecAttentes}`;
      zone.appendChild(ligne);
    }
    for (const application of applications) {
      const ligne = document.createElement('div');
      ligne.className = 'sollicitation-ligne';
      const nom = document.createElement('span');
      nom.className = 'sollicitation-operation';
      nom.textContent = application.operation;
      const statut = document.createElement('span');
      statut.className = 'sollicitation-statut';
      let enCours = false;
      const executer = bouton_('Exécuter', async () => {
        if (enCours) return;
        enCours = true;
        executer.disabled = true;
        try {
          const r = await surSollicitation({ observation, application, univers });
          if (r && r.statut === 'executee') {
            statut.textContent = 'Exécutée';
          } else {
            const detail = r && r.erreur && r.erreur.message ? ` : ${r.erreur.message}` : '';
            const trace = r && r.designation !== null && r.designation !== undefined ? 'sollicitation conservée' : 'aucune trace écrite';
            statut.textContent = `${r ? r.statut : 'echec'}${detail} — ${trace}`;
          }
        } catch (err) {
          statut.textContent = `Sollicitation non exécutée : ${err && err.message ? err.message : err}`;
        } finally {
          executer.disabled = false;
          enCours = false;
        }
      });
      ligne.append(nom, executer, statut);
      zone.appendChild(ligne);
    }
    for (const operation of choixAFaire) {
      const ligne = document.createElement('div');
      ligne.className = 'sollicitation-ligne sollicitation-choix';
      ligne.textContent = `${operation} — choix à faire`;
      zone.appendChild(ligne);
    }
    if (applications.length === 0 && choixAFaire.length === 0 && automatiques.length === 0 && !echecDeclenchement) {
      const vide = document.createElement('div');
      vide.className = 'sollicitation-ligne';
      vide.textContent = 'aucune application déterminée';
      zone.appendChild(vide);
    }
    return zone;
  }

  function boutonEcouter(texte) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bouton-ecouter';
    b.textContent = 'Écouter';
    b.addEventListener('click', () => {
      if (boutonLecture === b) {
        voix.arreterLecture();
        remettreBouton();
      } else {
        lire(texte, b);
      }
    });
    return b;
  }

  // ---------- dictée ----------
  function etatMicro(actif) {
    ecouteEnCours = actif;
    micro.classList.toggle('actif', actif);
    micro.setAttribute('aria-label', actif ? "Arrêter l'écoute" : 'Parler');
    micro.setAttribute('aria-pressed', actif ? 'true' : 'false');
    champ.placeholder = actif ? 'Je t’écoute…' : placeholderNormal;
  }

  async function basculerMicro() {
    if (!voix) return;
    if (ecouteEnCours) {
      voix.arreterEcoute();
      return;
    }
    if (voix.enLecture) {
      await voix.arreterLecture();
      remettreBouton();
    }
    etatMicro(true);
    try {
      const dicte = await voix.ecouter();
      const avant = champ.value.trim();
      champ.value = avant ? `${avant} ${dicte}` : dicte;
      ajusterHauteur();
      if (lireBrouillon()) garderBrouillon(champ.value, new Date().toISOString(), undefined, referenceActuelle);
    } catch (e) {
      if (e.code !== 'annule') info(e.message);
    } finally {
      etatMicro(false);
    }
  }

  async function preparerVoix() {
    if (!voix) return;
    const [ecoute, lecture] = await Promise.all([
      voix.ecouteDisponible().catch(() => false),
      voix.lectureDisponible().catch(() => false),
    ]);
    lectureDisponible = lecture;
    if (micro) {
      micro.hidden = !ecoute;
      micro.addEventListener('click', basculerMicro);
    }
  }

  function bouton_(texte, action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lien-action';
    b.textContent = texte;
    b.addEventListener('click', action);
    return b;
  }

  // ÉTAPE 5.2-bis — bandeau « En réponse à cette tentative », créé une seule fois, inséré DANS le
  // formulaire (avant le champ). Convention UI pure destinée à Christophe : jamais analysée par
  // Naissance (section 5 du cadrage). Réutilise le patron visuel « reprise » déjà présent.
  function creerBandeauReference() {
    if (bandeauReference) return bandeauReference;
    bandeauReference = document.createElement('div');
    bandeauReference.className = 'bandeau-reference reprise';
    bandeauReference.hidden = true;
    const titre = document.createElement('span');
    titre.className = 'titre-reprise';
    titre.textContent = 'En réponse à cette tentative';
    titreBandeauReference = titre;
    const annuler = bouton_('Annuler la référence', () => { referenceEmission = null; referenceMessage = null; definirReference(null); });
    bandeauReference.append(titre, annuler);
    // v0.63.90 — AU-DESSUS de la ligne de saisie (hors de la ligne flex micro / champ / Envoyer) : le champ garde toute sa largeur.
    // Repli (DOM sans parent, environnements de test) : comportement antérieur, dans le formulaire avant le champ.
    const hote = formulaire.parentNode;
    if (hote && typeof hote.insertBefore === 'function') hote.insertBefore(bandeauReference, formulaire);
    else formulaire.insertBefore(bandeauReference, champ);
    return bandeauReference;
  }

  // Affiche/masque le bandeau et met à jour l'état en mémoire, SANS toucher au stockage (utilisé
  // par recharger() pour restaurer l'affichage sans ré-écrire un brouillon déjà lu tel quel).
  // v0.64.22 — accepte l'ancienne forme (idTrace, chaîne) ou la cible { idTrace?, idReponseLocale? } (au moins une identité réelle).
  function afficherReference(idTrace) {
    const cible = idTrace && typeof idTrace === 'object'
      ? { ...(typeof idTrace.idTrace === 'string' && idTrace.idTrace ? { idTrace: idTrace.idTrace } : {}), ...(typeof idTrace.idReponseLocale === 'string' && idTrace.idReponseLocale ? { idReponseLocale: idTrace.idReponseLocale } : {}) }
      : (idTrace ? { idTrace } : null);
    referenceActuelle = cible && Object.keys(cible).length ? cible : null;
    if (referenceActuelle) { referenceEmission = null; referenceMessage = null; } // v0.63.81 : exclusif (v0.64.15 : + referenceMessage)
    const b = creerBandeauReference();
    if (titreBandeauReference) titreBandeauReference.textContent = 'En réponse à cette tentative';
    b.hidden = !referenceActuelle && !referenceEmission && !referenceMessage;
    ajusterHauteur(); // v0.63.90 — hauteur du champ recalculée dès que la référence change
  }

  // v0.63.81 — J-B : sélectionne (ou annule) la référence à UNE émission pour le message en cours de composition ; remplace toute référence
  // précédente (trace ou émission) ; en mémoire seulement (le brouillon ne la garde pas) ; jamais déduite du texte.
  function definirReferenceEmission(idEmission) {
    referenceEmission = typeof idEmission === 'string' && idEmission.length > 0 ? { idEmission } : null;
    if (referenceEmission) { referenceActuelle = null; referenceMessage = null; } // v0.64.15 : + referenceMessage
    const b = creerBandeauReference();
    if (titreBandeauReference) titreBandeauReference.textContent = referenceEmission ? 'En réponse à Naissance' : 'En réponse à cette tentative';
    b.hidden = !referenceEmission && !referenceActuelle && !referenceMessage;
    garderBrouillon(champ.value, new Date().toISOString(), undefined, referenceActuelle);
    ajusterHauteur(); // v0.63.90 — hauteur du champ recalculée dès que la référence change
  }

  // v0.64.15 — sélectionne la référence à UN message de Christophe pour le message en cours de composition ; remplace toute référence
  // précédente (trace, émission ou message) ; en mémoire seulement ; jamais déduite du texte. Le bandeau montre un court extrait de CETTE bulle
  // (affichage seul : seul l'identifiant voyage), pour qu'aucune référence ne soit invisible.
  function definirReferenceMessage(idMessage, texteBulle) {
    referenceMessage = typeof idMessage === 'string' && idMessage.length > 0 ? { idMessage } : null;
    if (referenceMessage) { referenceActuelle = null; referenceEmission = null; }
    const b = creerBandeauReference();
    const t = String(texteBulle || '');
    const extrait = t.length > 40 ? `${t.slice(0, 40)}…` : t;
    if (titreBandeauReference) titreBandeauReference.textContent = referenceMessage ? `En réponse à ton message : « ${extrait} »` : 'En réponse à cette tentative';
    b.hidden = !referenceMessage && !referenceEmission && !referenceActuelle;
    garderBrouillon(champ.value, new Date().toISOString(), undefined, referenceActuelle);
    ajusterHauteur();
  }

  // Sélectionne (ou annule, si idTrace est falsy) la référence du message EN COURS DE COMPOSITION.
  // Un second appel REMPLACE toujours le précédent -- jamais une accumulation (section 3 du
  // cadrage). Répercutée dans le brouillon existant, minimalement étendu (brouillon.js) : le texte
  // déjà tapé n'est jamais touché, seule la clé referenceTrace change.
  function definirReference(idTrace) {
    afficherReference(idTrace);
    garderBrouillon(champ.value, new Date().toISOString(), undefined, referenceActuelle);
  }

  function info(texte, { action = null, libelle = '' } = {}) {
    const el = bulle('systeme');
    const p = document.createElement('p');
    p.textContent = texte;
    el.appendChild(p);
    if (action) el.appendChild(bouton_(libelle, action));
    defiler();
    return el;
  }

  function carteNaissance(parent) {
    const p = document.createElement('p');
    p.textContent = "Naissance n'est pas encore née. Comment t'appelles-tu ?";
    const form = document.createElement('form');
    form.className = 'ligne centre';
    const entree = document.createElement('input');
    entree.type = 'text';
    entree.placeholder = 'Ton prénom';
    entree.autocomplete = 'given-name';
    entree.setAttribute('aria-label', 'Ton prénom');
    const valider = document.createElement('button');
    valider.type = 'submit';
    valider.className = 'bouton-principal';
    valider.textContent = 'Faire naître Naissance';
    form.append(entree, valider);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!entree.value.trim()) { entree.focus(); return; }
      valider.disabled = true;
      try {
        await naitre(entree.value);
        await rafraichir();
      } catch (err) {
        valider.disabled = false;
        info(`Naissance n'a pas pu naître : ${err.message || err}`);
      }
    });
    parent.append(p, form);
  }

  async function rafraichir() {
    if (accueil) { accueil.remove(); accueil = null; }
    const e = await etat();
    if (e === 'pret') await rafraichirCapacite(); // v0.63.84 — B1 : le bandeau capacité suit l'état « prêt » (naissance, démarrage).
    if (e === 'pret' && nbAffiches > 0) return;
    accueil = document.createElement('div');
    accueil.className = 'message message-systeme';
    liste.appendChild(accueil);
    if (e === 'a-naitre') {
      carteNaissance(accueil);
    } else {
      const p = document.createElement('p');
      p.textContent = {
        'sans-cle': 'Naissance a besoin d’un moteur pour parler. Ouvre les Réglages et colle ta clé.',
        'a-tester': 'Ta clé est enregistrée mais pas encore testée. Ouvre les Réglages et appuie sur « Enregistrer et tester ».',
        pret: 'Naissance est prête. Écris ton premier message.',
      }[e];
      accueil.appendChild(p);
      if (e !== 'pret') accueil.appendChild(bouton_('Ouvrir les Réglages', ouvrirReglages));
    }
    defiler();
  }

  async function recharger() {
    if (voix && voix.enLecture) voix.arreterLecture();
    boutonLecture = null;
    liste.textContent = '';
    accueil = null;
    nbAffiches = 0;
    echecs = [];
    const messages = await chargerRecents();
    messages.forEach((m, i) => {
      if (m.role === 'ia') {
        const precedent = messages[i - 1];
        const question = precedent && precedent.role === 'moi' && precedent.id === m.id - 1 ? precedent : null;
        afficherMessage('ia', m.texte, {
          local: String(m.moteur || '').startsWith('Moteur local'),
          question: question ? question.texte : null,
          idQuestion: question ? question.id : undefined,
        });
      } else {
        afficherMessage('moi', m.texte, { reprise: m.reprise !== undefined && m.reprise !== null });
      }
    });
    await rafraichir();
    const enAttente = lireBrouillon();
    if (enAttente && !champ.value.trim()) {
      champ.value = enAttente.texte;
      ajusterHauteur();
      info("Un message n'avait pas pu partir. Il est dans le champ : appuie sur Envoyer quand tu veux.");
      // ÉTAPE 5.2-bis — H : une référence déjà tenue par ce brouillon survit au rechargement
      // exactement comme son texte. Affichage seul (afficherReference), jamais une ré-écriture :
      // le brouillon vient d'être lu tel quel, rien n'a changé à persister.
      if (enAttente.referenceTrace || enAttente.referenceReponseLocale) {
        afficherReference({ ...(enAttente.referenceTrace ? { idTrace: enAttente.referenceTrace.idTrace } : {}), ...(enAttente.referenceReponseLocale ? { idReponseLocale: enAttente.referenceReponseLocale.idReponseLocale } : {}) });
      }
    }
    defiler();
  }

  function afficherErreur(erreur, reessayer) {
    const e = enErreurFournisseur(erreur);
    const el = bulle('erreur');
    const p = document.createElement('p');
    p.textContent = e.message;
    el.appendChild(p);
    if (reessayer) {
      const garde = document.createElement('p');
      garde.className = 'petit';
      garde.textContent = 'Ton message est gardé, même si tu fermes l’appli.';
      el.appendChild(garde);
    }
    if (CODES_REGLAGES.has(e.code)) el.appendChild(bouton_('Ouvrir les Réglages', ouvrirReglages));
    else if (reessayer) el.appendChild(bouton_('Réessayer', reessayer));
    if (e.detail) {
      const details = document.createElement('details');
      const resume = document.createElement('summary');
      resume.textContent = 'Détails';
      const pre = document.createElement('pre');
      pre.textContent = e.detail;
      details.append(resume, pre);
      el.appendChild(details);
    }
    return el;
  }

  function ajusterHauteur() {
    // v0.63.90 — un champ VIDE retrouve sa hauteur normale (feuille de style), jamais une hauteur héritée d'un état antérieur.
    if (champ.value === '') { champ.style.height = ''; return; }
    champ.style.height = 'auto';
    champ.style.height = `${Math.min(champ.scrollHeight, 160)}px`;
  }

  async function soumettre(evenement) {
    evenement.preventDefault();
    if (occupe) return;
    const texte = champ.value.trim();
    if (!texte) return;
    if (await etat() !== 'pret') { await rafraichir(); return; }
    await envoyerTexte(texte, {});
  }

  // options : { forcerExterne, repriseDe, reprise } — reprise = question reposée à un modèle plus fort.
  async function envoyerTexte(texte, options) {
    if (occupe) return;
    const reprise = !!options.reprise;
    if (accueil) { accueil.remove(); accueil = null; }
    const cle = `${reprise ? `reprise:${options.repriseDe}:` : ''}${texte}`;

    // Un nouvel essai du même texte remplace l'essai raté affiché.
    echecs = echecs.filter((x) => {
      if (x.texte !== cle) return true;
      x.elements.forEach((e) => e.remove());
      return false;
    });
    if (!reprise) garderBrouillon(texte, new Date().toISOString(), undefined, referenceActuelle);

    const elMoi = afficherMessage('moi', texte, { reprise });
    if (!reprise) {
      champ.value = '';
      ajusterHauteur();
    }
    occupe = true;
    bouton.disabled = true;
    const attente = bulle('ia', 'attente');
    attente.setAttribute('aria-label', 'Réponse en cours');
    const etatAttente = document.createElement('p');
    etatAttente.className = 'etat-attente';
    etatAttente.setAttribute('aria-live', 'polite');
    etatAttente.textContent = libelleEtape(null);
    const controleur = new AbortController();
    const annuler = bouton_('Annuler', () => {
      annuler.disabled = true;
      etatAttente.textContent = 'Annulation…';
      controleur.abort();
    });
    annuler.classList.add('bouton-annuler');
    attente.append(etatAttente, annuler);
    defiler();
    try {
      const resultat = await repondre(texte, {
        signal: controleur.signal,
        forcerExterne: !!options.forcerExterne,
        repriseDe: options.repriseDe === undefined ? null : options.repriseDe,
        // ÉTAPE 5.2-bis — F6 : voyage comme donnée STRUCTURÉE, jamais retrouvée depuis le texte.
        // Une reprise (« Demander à un modèle plus fort ») est une re-pose d'une question déjà
        // posée, hors de la composition courante : elle ne porte jamais la référence en cours.
        referenceTrace: reprise || !referenceActuelle || !referenceActuelle.idTrace ? null : { idTrace: referenceActuelle.idTrace },
        // v0.64.22 — la réponse locale ciblée (même discipline : donnée structurée, jamais pour une reprise).
        referenceReponseLocale: reprise || !referenceActuelle || !referenceActuelle.idReponseLocale ? null : { idReponseLocale: referenceActuelle.idReponseLocale },
        // v0.63.81 — J-B : même discipline pour la référence à une émission : donnée structurée, jamais retrouvée depuis le texte.
        referenceEmission: reprise ? null : referenceEmission,
        // v0.64.15 — même discipline pour la référence à un message de Christophe.
        referenceMessage: reprise ? null : referenceMessage,
        surEtape: (e) => {
          if (controleur.signal.aborted) return;
          if (e && e.type === 'partiel') {
            etatAttente.textContent = e.texte || 'Moteur local : écriture…';
            defiler();
          } else {
            etatAttente.textContent = libelleEtape(e);
          }
        },
      });
      const reponse = typeof resultat === 'string' ? resultat : resultat.texte;
      attente.remove();
      const elReponse = afficherMessage('ia', reponse, {
        local: !!(resultat && resultat.local),
        question: texte,
        idQuestion: resultat && resultat.idQuestion,
        confirmation: (resultat && resultat.confirmation) || null,
        idExperience: resultat && resultat.idExperience,
        idTrace: resultat && resultat.idTrace,
        idReponseLocale: resultat && resultat.idReponseLocale, // v0.64.22
        sollicitation: (resultat && resultat.sollicitation) || null,
        // v0.63.81 — J-B : lignes émises par Naissance ce tour, échec d'émission éventuel, réception déclarée pour le message envoyé.
        emissions: (resultat && resultat.sollicitation && Array.isArray(resultat.sollicitation.emises)) ? resultat.sollicitation.emises : [],
        echecEmission: (resultat && resultat.sollicitation && resultat.sollicitation.echecEmission) || null,
        reception: (resultat && resultat.reception) || null,
        // v0.63.84 — B1 : faits de capacité du tour.
        capacite: (resultat && resultat.sollicitation && resultat.sollicitation.capacite) || null,
        // v0.63.88 — épisodes propres ouverts par les événements de ce tour (observation du message, réception déclarée).
        episodes: (resultat && Array.isArray(resultat.episodes)) ? resultat.episodes : [],
      });
      await rafraichirCapacite();
      const enAttente = lireBrouillon();
      if (!reprise && enAttente && enAttente.texte === texte) effacerBrouillon();
      // ÉTAPE 5.2-bis — section 10 : un envoi réussi clôt la composition courante -- la référence,
      // quelle qu'ait été son issue réelle (persistée dans une expérience, ou abstention sobre sur
      // un chemin local, voir appliquerAbstentionSiReferenceIgnoree), ne doit jamais s'appliquer au
      // message SUIVANT. État en mémoire seulement : AUCUNE écriture de stockage ici (un brouillon
      // différent, encore en attente, ne doit jamais être effacé par effet de bord).
      if (!reprise) { referenceActuelle = null; referenceEmission = null; referenceMessage = null; if (bandeauReference) bandeauReference.hidden = true; }
      // v0.64.15 — « Répondre » sur la bulle de Christophe, SEULEMENT si ce tour a rendu l'identité réellement conservée de CE message (jamais
      // pour une reprise, jamais après un échec, jamais pour une bulle restaurée : elles n'ont pas d'identité). L'identité voyage par fermeture.
      const idMessageBulle = resultat && typeof resultat === 'object' ? resultat.idMessage : undefined;
      if (!reprise && typeof idMessageBulle === 'string' && idMessageBulle.length > 0) {
        const refMoi = document.createElement('span');
        refMoi.className = 'reference-message';
        refMoi.appendChild(bouton_('Répondre', () => definirReferenceMessage(idMessageBulle, texte)));
        elMoi.appendChild(refMoi);
      }
      for (const n of (resultat && resultat.actions) || []) {
        info(n).classList.add('note-action');
      }
      if (resultat && resultat.note) {
        const note = info(resultat.note);
        note.classList.add('note-moteur');
      }
      if (lectureDisponible && lectureAuto()) {
        lire(reponse, elReponse.querySelector('.bouton-ecouter'));
      }
    } catch (erreur) {
      attente.remove();
      elMoi.classList.add('non-envoye');
      if (erreur && erreur.code === 'annule') {
        const elNote = info(reprise ? 'Demande au modèle plus fort annulée.' : 'Envoi annulé. Ton message est de nouveau dans le champ.');
        const notesAnnulees = ((erreur.actions) || []).map((n) => {
          const el = info(`Déjà fait avant l'annulation : ${n}`);
          el.classList.add('note-action');
          return el;
        });
        echecs.push({ texte: cle, elements: [elMoi, elNote, ...notesAnnulees] });
        if (!reprise && !champ.value) { champ.value = texte; ajusterHauteur(); }
        return;
      }
      const reessayer = reprise
        ? () => { setTimeout(() => envoyerTexte(texte, options), 0); }
        : () => {
          champ.value = texte;
          ajusterHauteur();
          formulaire.requestSubmit();
        };
      const elErreur = afficherErreur(erreur, reessayer);
      const notesActions = ((erreur && erreur.actions) || []).map((n) => {
        const el = info(`Déjà fait malgré l'erreur : ${n}`);
        el.classList.add('note-action');
        return el;
      });
      echecs.push({ texte: cle, elements: [elMoi, elErreur, ...notesActions] });
      if (!reprise && !champ.value) { champ.value = texte; ajusterHauteur(); }
    } finally {
      occupe = false;
      bouton.disabled = false;
      defiler();
    }
  }

  formulaire.addEventListener('submit', soumettre);
  champ.addEventListener('input', () => {
    ajusterHauteur();
    // Le message en attente suit les corrections faites dans le champ.
    if (lireBrouillon()) garderBrouillon(champ.value, new Date().toISOString(), undefined, referenceActuelle);
  });

  const pret = preparerVoix();

  return {
    recharger: async () => { await pret; await recharger(); await rafraichirCapacite(); },
    rafraichir,
    info,
    arreterVoix: () => {
      if (!voix) return;
      if (ecouteEnCours) voix.arreterEcoute();
      if (voix.enLecture) { voix.arreterLecture(); remettreBouton(); }
    },
  };
}
// === FIN_ECRAN_CONVERSATION ===
