// === DEBUT_ECRAN_TACHES ===
// Section « Mes tâches » : créer, consulter et terminer une tâche de l'utilisateur.
// Affichage seul : la lecture et l'écriture passent UNIQUEMENT par ./taches.js (stockage injectable,
// par défaut celui de l'appareil). Ce n'est pas la mémoire de Naissance ; aucun réseau.
// Le montage ne fait que LIRE : rien n'est écrit tant que l'utilisateur n'ajoute ni ne termine une tâche.

import { lireTaches, ajouterTache, terminerTache } from './taches.js';

const MESSAGE_VIDE = "Écris d'abord le texte de la tâche.";
const MESSAGE_STOCKAGE = "Impossible d'enregistrer sur cet appareil.";

export function monterTaches({ apres, stockage }) {
  const zone = document.createElement('div');
  zone.className = 'bloc';
  zone.setAttribute('data-taches', '');

  const titre = document.createElement('h3');
  titre.textContent = 'Mes tâches';

  const formulaire = document.createElement('form');
  const champ = document.createElement('input');
  champ.type = 'text';
  champ.placeholder = 'Nouvelle tâche';
  champ.setAttribute('aria-label', 'Nouvelle tâche');
  champ.setAttribute('autocomplete', 'off');
  const boutonAjouter = document.createElement('button');
  boutonAjouter.type = 'submit';
  boutonAjouter.className = 'bouton-principal';
  boutonAjouter.textContent = 'Ajouter la tâche';
  formulaire.append(champ, boutonAjouter);

  const message = document.createElement('p');
  message.className = 'aide';
  message.setAttribute('aria-live', 'polite');

  const liste = document.createElement('ul');
  liste.setAttribute('data-taches-liste', '');

  function ligneDe(tache) {
    const li = document.createElement('li');
    if (tache.terminee) {
      li.textContent = `${tache.texte} — terminée`;
      return li;
    }
    const texte = document.createElement('span');
    texte.textContent = tache.texte;
    const boutonTerminer = document.createElement('button');
    boutonTerminer.type = 'button';
    boutonTerminer.className = 'bouton-secondaire';
    boutonTerminer.textContent = 'Terminer';
    boutonTerminer.addEventListener('click', () => {
      const r = terminerTache(tache.id, stockage);
      message.textContent = (!r.ok && r.erreur === 'stockage') ? MESSAGE_STOCKAGE : '';
      rafraichir();
    });
    li.append(texte, boutonTerminer);
    return li;
  }

  function rafraichir() {
    const taches = lireTaches(stockage);
    liste.textContent = '';
    if (!taches.length) {
      const vide = document.createElement('li');
      vide.textContent = 'Aucune tâche pour le moment.';
      liste.appendChild(vide);
      return;
    }
    for (const t of taches) liste.appendChild(ligneDe(t));
  }

  formulaire.addEventListener('submit', (evenement) => {
    evenement.preventDefault();
    const r = ajouterTache(champ.value, stockage);
    if (r.ok) {
      champ.value = '';
      message.textContent = '';
      rafraichir();
      return;
    }
    message.textContent = r.erreur === 'vide' ? MESSAGE_VIDE : MESSAGE_STOCKAGE;
  });

  zone.append(titre, formulaire, message, liste);
  rafraichir();
  apres.after(zone);
  return { zone, rafraichir };
}
// === FIN_ECRAN_TACHES ===
