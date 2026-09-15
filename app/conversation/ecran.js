// === DEBUT_ECRAN_CONVERSATION ===
// Zone de messages + champ de saisie + bouton Envoyer.
// Ne connaît aucun fournisseur : il reçoit une fonction envoyer(historique).

import { creerConversation, ajouterMessage, historiquePourEnvoi } from './etat.js';
import { texteEnHtml } from './texte.js';
import { CODES_REGLAGES, enErreurFournisseur } from '../fournisseurs/erreurs.js';

export function monterConversation({ liste, formulaire, envoyer, etatConfiguration, ouvrirReglages }) {
  const champ = formulaire.querySelector('textarea');
  const bouton = formulaire.querySelector('button[type="submit"]');
  const conversation = creerConversation();
  let occupe = false;
  let accueil = null;

  function defiler() {
    liste.scrollTop = liste.scrollHeight;
  }

  function bulle(role, classeEnPlus = '') {
    const el = document.createElement('div');
    el.className = `message message-${role} ${classeEnPlus}`.trim();
    liste.appendChild(el);
    return el;
  }

  function boutonReglages(parent) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lien-action';
    b.textContent = 'Ouvrir les Réglages';
    b.addEventListener('click', ouvrirReglages);
    parent.appendChild(b);
  }

  function afficherAccueil() {
    if (accueil) accueil.remove();
    if (conversation.messages.length) { accueil = null; return; }
    const etat = etatConfiguration();
    accueil = bulle('systeme');
    const p = document.createElement('p');
    if (etat === 'pret') {
      p.textContent = 'Prête. Écris ton premier message.';
      accueil.appendChild(p);
    } else {
      p.textContent = etat === 'a-tester'
        ? 'Ta clé est enregistrée mais pas encore testée. Ouvre les Réglages et appuie sur « Enregistrer et tester ».'
        : 'Bienvenue. Pour commencer, ouvre les Réglages et colle ta clé Gemini.';
      accueil.appendChild(p);
      boutonReglages(accueil);
    }
  }

  function afficherErreur(erreur) {
    const e = enErreurFournisseur(erreur);
    const el = bulle('erreur');
    const p = document.createElement('p');
    p.textContent = e.message;
    el.appendChild(p);
    if (CODES_REGLAGES.has(e.code)) boutonReglages(el);
    if (e.detail) {
      const details = document.createElement('details');
      const resume = document.createElement('summary');
      resume.textContent = 'Détails';
      const pre = document.createElement('pre');
      pre.textContent = e.detail;
      details.append(resume, pre);
      el.appendChild(details);
    }
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
    if (etatConfiguration() !== 'pret') {
      afficherAccueil();
      defiler();
      return;
    }
    if (accueil) { accueil.remove(); accueil = null; }

    const message = ajouterMessage(conversation, 'moi', texte);
    const elMoi = bulle('moi');
    elMoi.textContent = texte;
    champ.value = '';
    ajusterHauteur();

    occupe = true;
    bouton.disabled = true;
    const attente = bulle('ia', 'attente');
    attente.textContent = '…';
    attente.setAttribute('aria-label', 'Réponse en cours');
    defiler();

    try {
      const reponse = await envoyer(historiquePourEnvoi(conversation));
      ajouterMessage(conversation, 'ia', reponse);
      attente.remove();
      bulle('ia').innerHTML = texteEnHtml(reponse);
    } catch (erreur) {
      attente.remove();
      message.etat = 'echec';
      elMoi.classList.add('non-envoye');
      afficherErreur(erreur);
      if (!champ.value) {
        champ.value = texte;
        ajusterHauteur();
      }
    } finally {
      occupe = false;
      bouton.disabled = false;
      defiler();
    }
  }

  formulaire.addEventListener('submit', soumettre);
  champ.addEventListener('input', ajusterHauteur);
  afficherAccueil();

  return { rafraichir: afficherAccueil };
}
// === FIN_ECRAN_CONVERSATION ===
