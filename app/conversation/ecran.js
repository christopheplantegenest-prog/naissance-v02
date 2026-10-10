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
  let titreBandeauReference = null;
  // v0.63.84 — B1 : BANDEAU CAPACITÉ (visibilité de développement, faits bruts : c courant, plafond, dernière variation et sa cause, porte) et bouton
  // « Repos » (tick de temps propre EXPLICITE : dispositif de validation, pas une cadence). `capacite` = { lire, repos } injecté par main.js ;
  // absent (anciens appelants, tests) : rien n'est affiché. Aucun vocabulaire psychologique, aucune lecture pour décider.
  let bandeauCapacite = null;
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
      if (options.idTrace) {
        const refBloc = document.createElement('span');
        refBloc.className = 'reference-reponse';
        refBloc.appendChild(bouton_('Répondre', () => definirReference(options.idTrace)));
        actions.appendChild(refBloc);
      }
      // v0.63.35 — OUTIL DE DÉVELOPPEMENT : « Sollicitation (outil de développement) ». Zone repliée, seulement si CETTE bulle porte un contexte
      // vivant (options.sollicitation, rendu au moment du tour) ; une bulle restaurée n'en a pas. Voir zoneSollicitation ci-dessous.
      // v0.63.81 — J-B : lignes ÉMISES par Naissance pendant ce tour (chaque ligne = un acte emettreProduction déjà persisté, jamais fabriqué
      // pour l'affichage), avec le geste « Répondre » qui porte l'idEmission EXACT par fermeture. Puis une zone de développement repliée qui
      // rend vérifiables idEmission, exécution et la réception rattachée au message de CE tour quand il en portait une. Aucune interprétation.
      const emissions = Array.isArray(options.emissions) ? options.emissions : [];
      for (const em of emissions) {
        const ligne = document.createElement('div');
        ligne.className = 'emission-naissance';
        const texteEm = document.createElement('span');
        texteEm.className = 'emission-texte';
        texteEm.textContent = `Naissance → toi : ${valeurCourte(em.valeur)}`;
        ligne.append(texteEm, bouton_('Répondre', () => definirReferenceEmission(em.idEmission)));
        el.appendChild(ligne); // avant la ligne d'actions, qui n'est attachée qu'à la fin
      }
      if (emissions.length > 0 || options.reception || options.echecEmission) el.appendChild(zoneEmissions(emissions, options.reception || null, options.echecEmission || null));
      // v0.63.84 — B1 : les faits de capacité de CE tour (avant → après, porte, cause, échec), tels que le déclencheur les a rendus.
      if (options.capacite) el.appendChild(ligneCapaciteDuTour(options.capacite));
      // v0.63.86 — B2 : la conséquence relationnelle d'une réception déclarée pendant ce tour (faits bruts, hors zone repliée).
      if (options.reception && options.reception.relation && !options.reception.relation.echec) {
        const rel = document.createElement('div');
        rel.className = 'capacite-tour';
        rel.textContent = `relation : r ${options.reception.relation.avant} → ${options.reception.relation.apres} (cause : réception ${options.reception.reception ? options.reception.reception.id : '?'})`;
        el.appendChild(rel);
      }
      if (options.sollicitation && surSollicitation) actions.appendChild(zoneSollicitation(options.sollicitation));
      if (options.confirmation) {
        const oui = bouton_('Confirmer', () => trancher(options.confirmation.onOui));
        oui.className = 'bouton-principal bouton-plus-fort';
        const non = bouton_('Annuler', () => trancher(options.confirmation.onNon));
        non.classList.add('bouton-plus-fort');
        const trancher = async (suite) => {
          oui.disabled = true;
          non.disabled = true;
          try {
            const reponseFinale = await suite();
            oui.remove();
            non.remove();
            afficherMessage('ia', typeof reponseFinale === 'string' && reponseFinale ? reponseFinale : 'C’est fait.');
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
        const el = info(`tick ${r.variation.cause.id}\nB1 : c ${r.avant} → ${r.apres}${r.avant === r.apres ? ' (saturation : état inchangé)' : ''}${b2 ? `\nB2 : r ${b2.avant} → ${b2.apres}${b2.avant === b2.apres ? ' (saturation : état inchangé)' : ''}` : ''}`);
        el.querySelector('p').classList.add('faits-repos');
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
          el.appendChild(faits);
        }
      } catch (err) {
        info(`repos non enregistré : ${err && err.message ? err.message : err}`);
      } finally {
        repos.disabled = false;
        await rafraichirCapacite();
      }
    });
    bandeauCapacite.append(texteCapacite, repos);
    formulaire.parentNode.insertBefore(bandeauCapacite, formulaire); // juste au-dessus de la zone de saisie, sur toute la largeur
    return bandeauCapacite;
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
      texteCapacite.textContent = `capacité c = ${c.valeur} / plafond ${c.plafond}${rel} — ${derniere}${c.valeur === 0 ? ' — porte : lot mécanique retenu au prochain tour' : ''}`;
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
    const { observation, univers, applications, choixAFaire, automatiques = [], echecDeclenchement = null, attentes = [], echecAttentes = null } = contexte;
    const zone = document.createElement('details');
    zone.className = 'sollicitation-dev';
    const titre = document.createElement('summary');
    titre.textContent = 'Sollicitation (outil de développement)';
    zone.appendChild(titre);
    // v0.63.60 : lignes d'information (sans bouton) pour ce que le déclencheur mécanique a déjà fait ; un échec est montré tel quel.
    for (const r of automatiques) {
      const ligne = document.createElement('div');
      ligne.className = 'sollicitation-ligne sollicitation-automatique';
      ligne.textContent = r.statut === 'executee' ? `${r.operation} — exécutée automatiquement` : `${r.operation} — automatique : ${r.statut}${r.erreur && r.erreur.message ? ` : ${r.erreur.message}` : ''}`;
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
    const annuler = bouton_('Annuler la référence', () => { referenceEmission = null; definirReference(null); });
    bandeauReference.append(titre, annuler);
    formulaire.insertBefore(bandeauReference, champ);
    return bandeauReference;
  }

  // Affiche/masque le bandeau et met à jour l'état en mémoire, SANS toucher au stockage (utilisé
  // par recharger() pour restaurer l'affichage sans ré-écrire un brouillon déjà lu tel quel).
  function afficherReference(idTrace) {
    referenceActuelle = idTrace ? { idTrace } : null;
    if (referenceActuelle) referenceEmission = null; // v0.63.81 : exclusif
    const b = creerBandeauReference();
    if (titreBandeauReference) titreBandeauReference.textContent = 'En réponse à cette tentative';
    b.hidden = !referenceActuelle && !referenceEmission;
  }

  // v0.63.81 — J-B : sélectionne (ou annule) la référence à UNE émission pour le message en cours de composition ; remplace toute référence
  // précédente (trace ou émission) ; en mémoire seulement (le brouillon ne la garde pas) ; jamais déduite du texte.
  function definirReferenceEmission(idEmission) {
    referenceEmission = typeof idEmission === 'string' && idEmission.length > 0 ? { idEmission } : null;
    if (referenceEmission) referenceActuelle = null;
    const b = creerBandeauReference();
    if (titreBandeauReference) titreBandeauReference.textContent = referenceEmission ? 'En réponse à Naissance' : 'En réponse à cette tentative';
    b.hidden = !referenceEmission && !referenceActuelle;
    garderBrouillon(champ.value, new Date().toISOString(), undefined, referenceActuelle);
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
      if (enAttente.referenceTrace) afficherReference(enAttente.referenceTrace.idTrace);
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
        referenceTrace: reprise ? null : referenceActuelle,
        // v0.63.81 — J-B : même discipline pour la référence à une émission : donnée structurée, jamais retrouvée depuis le texte.
        referenceEmission: reprise ? null : referenceEmission,
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
        sollicitation: (resultat && resultat.sollicitation) || null,
        // v0.63.81 — J-B : lignes émises par Naissance ce tour, échec d'émission éventuel, réception déclarée pour le message envoyé.
        emissions: (resultat && resultat.sollicitation && Array.isArray(resultat.sollicitation.emises)) ? resultat.sollicitation.emises : [],
        echecEmission: (resultat && resultat.sollicitation && resultat.sollicitation.echecEmission) || null,
        reception: (resultat && resultat.reception) || null,
        // v0.63.84 — B1 : faits de capacité du tour.
        capacite: (resultat && resultat.sollicitation && resultat.sollicitation.capacite) || null,
      });
      await rafraichirCapacite();
      const enAttente = lireBrouillon();
      if (!reprise && enAttente && enAttente.texte === texte) effacerBrouillon();
      // ÉTAPE 5.2-bis — section 10 : un envoi réussi clôt la composition courante -- la référence,
      // quelle qu'ait été son issue réelle (persistée dans une expérience, ou abstention sobre sur
      // un chemin local, voir appliquerAbstentionSiReferenceIgnoree), ne doit jamais s'appliquer au
      // message SUIVANT. État en mémoire seulement : AUCUNE écriture de stockage ici (un brouillon
      // différent, encore en attente, ne doit jamais être effacé par effet de bord).
      if (!reprise) { referenceActuelle = null; referenceEmission = null; if (bandeauReference) bandeauReference.hidden = true; }
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
