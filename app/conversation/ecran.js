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
  function zoneSollicitation(contexte) {
    const { observation, univers, applications, choixAFaire } = contexte;
    const zone = document.createElement('details');
    zone.className = 'sollicitation-dev';
    const titre = document.createElement('summary');
    titre.textContent = 'Sollicitation (outil de développement)';
    zone.appendChild(titre);
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
    if (applications.length === 0 && choixAFaire.length === 0) {
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
    const annuler = bouton_('Annuler la référence', () => definirReference(null));
    bandeauReference.append(titre, annuler);
    formulaire.insertBefore(bandeauReference, champ);
    return bandeauReference;
  }

  // Affiche/masque le bandeau et met à jour l'état en mémoire, SANS toucher au stockage (utilisé
  // par recharger() pour restaurer l'affichage sans ré-écrire un brouillon déjà lu tel quel).
  function afficherReference(idTrace) {
    referenceActuelle = idTrace ? { idTrace } : null;
    const b = creerBandeauReference();
    b.hidden = !referenceActuelle;
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
      });
      const enAttente = lireBrouillon();
      if (!reprise && enAttente && enAttente.texte === texte) effacerBrouillon();
      // ÉTAPE 5.2-bis — section 10 : un envoi réussi clôt la composition courante -- la référence,
      // quelle qu'ait été son issue réelle (persistée dans une expérience, ou abstention sobre sur
      // un chemin local, voir appliquerAbstentionSiReferenceIgnoree), ne doit jamais s'appliquer au
      // message SUIVANT. État en mémoire seulement : AUCUNE écriture de stockage ici (un brouillon
      // différent, encore en attente, ne doit jamais être effacé par effet de bord).
      if (!reprise) { referenceActuelle = null; if (bandeauReference) bandeauReference.hidden = true; }
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
    recharger: async () => { await pret; await recharger(); },
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
