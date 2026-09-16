// === DEBUT_ECRAN_REGLAGES ===
// Fournisseur, clé (gardée sur l'appareil), test de la clé, choix du modèle.

import { listerFournisseurs, obtenirFournisseur } from '../fournisseurs/registre.js';
import { enErreurFournisseur } from '../fournisseurs/erreurs.js';
import { lireReglages, reglagesDe, modifierFournisseur } from './stockage.js';
import { nettoyerCle, longueur, resumeCle, caracteresInhabituels } from './cle.js';
import { verifierModeles, nomCourt } from '../fournisseurs/fiabilite.js';
import { lireSante, etatModele, estConfirme, estDisparu, estDisponible } from '../fournisseurs/sante.js';

export function monterReglages({ panneau, surChangement }) {
  const $ = (sel) => panneau.querySelector(sel);
  const choixFournisseur = $('[data-fournisseur]');
  const champCle = $('[data-cle]');
  const boutonVoir = $('[data-voir-cle]');
  const diagnostic = $('[data-diagnostic]');
  const boutonTester = $('[data-tester]');
  const boutonEffacer = $('[data-effacer]');
  const resultat = $('[data-resultat]');
  const zoneModele = $('[data-zone-modele]');
  const choixModele = $('[data-modele]');
  const aide = $('[data-aide-cle]');
  const lien = $('[data-lien-cle]');

  for (const f of listerFournisseurs()) {
    const o = document.createElement('option');
    o.value = f.id;
    o.textContent = f.nom;
    choixFournisseur.appendChild(o);
  }

  const idActuel = () => choixFournisseur.value;
  const reglagesActuels = () => reglagesDe(lireReglages(), idActuel());

  function ecrire(changements) {
    const { ok } = modifierFournisseur(idActuel(), changements);
    if (!ok) montrerResultat('erreur', "Impossible d'enregistrer sur cet appareil (stockage indisponible).");
    surChangement();
    return ok;
  }

  function montrerResultat(type, texte, lignesDetail = []) {
    resultat.hidden = false;
    resultat.className = `resultat resultat-${type}`;
    resultat.textContent = '';
    const p = document.createElement('p');
    p.textContent = texte;
    resultat.appendChild(p);
    if (lignesDetail.length) {
      const details = document.createElement('details');
      const resume = document.createElement('summary');
      resume.textContent = 'Détails du test';
      const pre = document.createElement('pre');
      pre.textContent = lignesDetail.join('\n');
      details.append(resume, pre);
      resultat.appendChild(details);
    }
  }

  function montrerDiagnostic(cle, retires = 0) {
    if (!cle) { diagnostic.textContent = 'Aucune clé enregistrée.'; return; }
    const morceaux = [`Clé enregistrée : ${resumeCle(cle)}`];
    if (retires > 0) morceaux.push(`${retires} caractère(s) parasite(s) retiré(s) au collage`);
    const bizarres = caracteresInhabituels(cle);
    if (bizarres > 0) morceaux.push(`attention : ${bizarres} caractère(s) inhabituel(s)`);
    diagnostic.textContent = morceaux.join(' — ');
  }

  function remplirModeles(r) {
    choixModele.textContent = '';
    const modeles = Array.isArray(r.modeles) ? r.modeles : [];
    if (!modeles.length) { zoneModele.hidden = true; return; }
    const sante = lireSante();
    const maintenant = Date.now();
    for (const m of modeles) {
      const o = document.createElement('option');
      o.value = m.id;
      const court = nomCourt(m.id);
      const etat = etatModele(sante, idActuel(), m.id);
      let marque = '';
      if (estDisparu(etat, maintenant)) marque = ' — indisponible';
      else if (!estDisponible(etat, maintenant)) marque = ' — en pause';
      else if (estConfirme(etat)) marque = ' — vérifié';
      o.textContent = `${m.nom === court ? m.nom : `${m.nom} (${court})`}${marque}`;
      choixModele.appendChild(o);
    }
    choixModele.value = r.modele || '';
    zoneModele.hidden = false;
  }

  function rafraichir() {
    const r = reglagesActuels();
    const f = obtenirFournisseur(idActuel());
    aide.textContent = f.aideCle;
    lien.href = f.lienCle;
    champCle.value = r.cle || '';
    champCle.type = 'password';
    boutonVoir.textContent = 'Afficher';
    montrerDiagnostic(r.cle || '');
    remplirModeles(r);
    boutonEffacer.hidden = !r.cle;
    resultat.hidden = true;
    if (r.cle && r.modele && r.testeLe) {
      montrerResultat('ok', `Clé testée le ${new Date(r.testeLe).toLocaleString('fr-FR')}.`);
    }
  }

  async function enregistrerEtTester() {
    const brut = champCle.value;
    const cle = nettoyerCle(brut);
    if (!cle) {
      montrerResultat('erreur', 'Aucune clé saisie : colle ta clé dans le champ.');
      return;
    }
    const retires = longueur(brut) - longueur(cle);
    champCle.value = cle;
    const avant = reglagesActuels();
    const memeCle = avant.cle === cle;
    ecrire({
      cle,
      methode: memeCle ? avant.methode : null,
      modele: memeCle ? avant.modele : null,
      modeles: memeCle ? avant.modeles : null,
      testeLe: memeCle ? avant.testeLe : null,
    });
    montrerDiagnostic(cle, retires);
    boutonEffacer.hidden = false;

    if (navigator.onLine === false) {
      montrerResultat('erreur', 'Pas de connexion internet : clé enregistrée, test impossible pour le moment.');
      return;
    }

    boutonTester.disabled = true;
    montrerResultat('attente', 'Test en cours auprès du fournisseur…');
    try {
      const f = obtenirFournisseur(idActuel());
      const res = await f.tester({ cle });
      const lignes = res.essais.map((e) => (e.ok
        ? `✅ ${e.libelle} : acceptée`
        : `❌ ${e.libelle} : ${e.message}${e.detail ? `\n   [${e.detail}]` : ''}`));
      if (res.ok) {
        const precedent = reglagesActuels().modele;
        const prefere = res.modeles.some((m) => m.id === precedent) ? precedent : res.modeleParDefaut;
        ecrire({ methode: res.methode, modeles: res.modeles, testeLe: new Date().toISOString() });
        montrerResultat('attente', `Clé acceptée. Vérification que les modèles répondent vraiment…`, lignes);
        const verif = await verifierModeles({
          fournisseur: f, acces: { cle, methode: res.methode }, prefere, modeles: res.modeles,
        });
        lignes.push(...verif.essais.map((e) => (e.ok
          ? `✅ ${nomCourt(e.modele)} répond`
          : `⛔ ${nomCourt(e.modele)} : ${e.message}${e.detail ? `\n   [${e.detail}]` : ''}`)));
        ecrire({ modele: verif.modele || prefere });
        remplirModeles(reglagesActuels());
        if (verif.modele) {
          montrerResultat('ok',
            `✅ Clé acceptée. Modèle vérifié : ${nomCourt(verif.modele)}. Tu peux fermer les Réglages et discuter.`,
            lignes);
        } else if (verif.erreur) {
          montrerResultat('erreur', `❌ ${verif.erreur.message}`, lignes);
        } else {
          montrerResultat('erreur',
            "Clé acceptée, mais aucun modèle n'a répondu pour le moment (saturés ou indisponibles). Réessaie le test dans quelques minutes.",
            lignes);
        }
      } else {
        ecrire({ methode: null, modele: null, modeles: null, testeLe: null });
        remplirModeles({});
        montrerResultat('erreur', `❌ ${res.erreur.message}`, lignes);
      }
    } catch (e) {
      const err = enErreurFournisseur(e);
      montrerResultat('erreur', `❌ ${err.message}`, err.detail ? [err.detail] : []);
    } finally {
      boutonTester.disabled = false;
    }
  }

  function effacer() {
    if (!window.confirm('Effacer la clé de cet appareil ?')) return;
    ecrire({ cle: null, methode: null, modele: null, modeles: null, testeLe: null });
    rafraichir();
    montrerResultat('ok', 'Clé effacée de cet appareil.');
  }

  boutonVoir.addEventListener('click', () => {
    const cache = champCle.type === 'password';
    champCle.type = cache ? 'text' : 'password';
    boutonVoir.textContent = cache ? 'Masquer' : 'Afficher';
  });
  boutonTester.addEventListener('click', enregistrerEtTester);
  boutonEffacer.addEventListener('click', effacer);
  choixModele.addEventListener('change', () => ecrire({ modele: choixModele.value }));
  choixFournisseur.addEventListener('change', rafraichir);

  choixFournisseur.value = lireReglages().fournisseur;
  if (!choixFournisseur.value) choixFournisseur.selectedIndex = 0;
  rafraichir();

  return { rafraichir };
}
// === FIN_ECRAN_REGLAGES ===
