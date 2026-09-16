// === DEBUT_ECRAN_CONVERSATION ===
// Zone de messages + champ + Envoyer. Ne connaît ni le moteur ni la mémoire :
//  repondre(texte, { surEtape, signal }) → { texte, note, actions } ; chargerRecents() → messages du journal ;
//  pendant l'attente : progression affichée et bouton Annuler.
//  un message qui n'a pas pu partir est gardé (brouillon.js) et peut être réessayé.
//  voix (facultatif) : micro → texte dans le champ (jamais envoyé sans la personne),
//  bouton « Écouter » sous chaque réponse, lecture automatique selon les préférences.
//  etat() → 'a-naitre' | 'sans-cle' | 'a-tester' | 'pret' ; naitre(prenom).

import { texteEnHtml } from './texte.js';
import { lireBrouillon, garderBrouillon, effacerBrouillon } from './brouillon.js';
import { CODES_REGLAGES, enErreurFournisseur } from '../fournisseurs/erreurs.js';
import { libelleEtape } from '../fournisseurs/fiabilite.js';

export function monterConversation({
  liste, formulaire, repondre, chargerRecents, etat, naitre, ouvrirReglages,
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

  function afficherMessage(role, texte) {
    const el = bulle(role);
    if (role === 'ia') {
      const contenu = document.createElement('div');
      contenu.className = 'contenu';
      contenu.innerHTML = texteEnHtml(texte);
      el.appendChild(contenu);
      if (lectureDisponible) el.appendChild(boutonEcouter(texte));
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
    for (const m of messages) afficherMessage(m.role, m.texte);
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
    if (accueil) { accueil.remove(); accueil = null; }

    // Un nouvel essai du même texte remplace l'essai raté affiché.
    echecs = echecs.filter((x) => {
      if (x.texte !== texte) return true;
      x.elements.forEach((e) => e.remove());
      return false;
    });
    garderBrouillon(texte, new Date().toISOString());

    const elMoi = afficherMessage('moi', texte);
    champ.value = '';
    ajusterHauteur();
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
        surEtape: (e) => { if (!controleur.signal.aborted) etatAttente.textContent = libelleEtape(e); },
      });
      const reponse = typeof resultat === 'string' ? resultat : resultat.texte;
      attente.remove();
      const elReponse = afficherMessage('ia', reponse);
      const enAttente = lireBrouillon();
      if (enAttente && enAttente.texte === texte) effacerBrouillon();
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
        const elNote = info('Envoi annulé. Ton message est de nouveau dans le champ.');
        const notesAnnulees = ((erreur.actions) || []).map((n) => {
          const el = info(`Déjà fait avant l'annulation : ${n}`);
          el.classList.add('note-action');
          return el;
        });
        echecs.push({ texte, elements: [elMoi, elNote, ...notesAnnulees] });
        if (!champ.value) { champ.value = texte; ajusterHauteur(); }
        return;
      }
      const reessayer = () => {
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
      echecs.push({ texte, elements: [elMoi, elErreur, ...notesActions] });
      if (!champ.value) { champ.value = texte; ajusterHauteur(); }
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
