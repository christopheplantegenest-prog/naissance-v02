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
      if (lireBrouillon()) garderBrouillon(champ.value, new Date().toISOString());
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
    if (!reprise) garderBrouillon(texte, new Date().toISOString());

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
      });
      const enAttente = lireBrouillon();
      if (!reprise && enAttente && enAttente.texte === texte) effacerBrouillon();
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
    if (lireBrouillon()) garderBrouillon(champ.value, new Date().toISOString());
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
