// === DEBUT_ECRAN_MEMOIRE ===
// Ce que Naissance sait et qui elle est ; export, import, rangement.
// La personne peut modifier ou oublier n'importe quel souvenir.
// Seul le prénom est modifiable dans l'identité.

import { CATEGORIES } from '../esprit/consolidation.js';
import { LIBELLES_CONFIANCE, origineSouvenir } from '../esprit/contexte.js';
import { construireFichier, lireFichier, partagerOuTelecharger } from './transfert.js';

const dateCourte = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : 'jamais');
const dateJour = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

function el(tag, { classe = '', texte = null, attrs = {} } = {}, enfants = []) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texte !== null) e.textContent = texte;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const c of enfants) if (c) e.append(c);
  return e;
}

function btn(texte, action, classe = 'bouton-secondaire') {
  const b = el('button', { classe, texte, attrs: { type: 'button' } });
  b.addEventListener('click', action);
  return b;
}

export function monterEcranMemoire({
  panneau, memoire, esprit, versionAppli, moteurLibelle, surChangement,
  confirmer = (t) => window.confirm(t), horloge = () => new Date(),
}) {
  const $ = (s) => panneau.querySelector(s);
  const blocIdentite = $('[data-bloc-identite]');
  const listeSouvenirs = $('[data-liste-souvenirs]');
  const listeArchives = $('[data-liste-archives]');
  const zoneArchives = $('[data-zone-archives]');
  const nbSouvenirs = $('[data-nb-souvenirs]');
  const zoneFil = $('[data-fil]');
  const infoExport = $('[data-info-export]');
  const resultat = $('[data-resultat-memoire]');
  const choixFichier = $('[data-fichier]');
  const boutonRestaurer = $('[data-restaurer]');
  const infoRangement = $('[data-info-rangement]');
  const nouveauTexte = $('[data-nouveau-souvenir]');
  const nouvelleCategorie = $('[data-nouvelle-categorie]');

  for (const [k, v] of Object.entries(CATEGORIES)) {
    nouvelleCategorie.append(el('option', { texte: v, attrs: { value: k } }));
  }

  function montrer(type, texte) {
    resultat.hidden = false;
    resultat.className = `resultat resultat-${type}`;
    resultat.textContent = texte;
  }

  async function apresModification() {
    await rafraichir();
    await surChangement();
  }

  // ---------- identité ----------
  async function dessinerIdentite() {
    blocIdentite.textContent = '';
    const [identite, meta, nbMessages] = await Promise.all([
      memoire.identite(), memoire.meta(), memoire.compterMessages(),
    ]);
    blocIdentite.append(el('h3', { texte: 'Identité' }));
    if (!identite) {
      blocIdentite.append(el('p', { classe: 'aide', texte: "Naissance n'est pas encore née. Tu peux la faire naître depuis la conversation, ou importer une mémoire existante." }));
      return;
    }
    const n = identite.noyau;
    const lignes = [
      ['Nom', n.nom],
      ['Née le', dateJour(meta.neeLe)],
      ['Identifiant', (meta.idNaissance || '').slice(0, 8)],
      ['Moteur actuel', moteurLibelle() || 'aucun (clé à tester dans Réglages)'],
      ['Messages', String(nbMessages)],
    ];
    const dl = el('dl', { classe: 'fiche' });
    for (const [k, v] of lignes) dl.append(el('dt', { texte: k }), el('dd', { texte: v }));
    blocIdentite.append(dl);

    const entree = el('input', { attrs: { type: 'text', 'aria-label': 'Ton prénom' } });
    entree.value = n.personne;
    const enregistrer = btn('Enregistrer', async () => {
      try {
        await esprit.changerPrenom(entree.value);
        montrer('ok', 'Prénom enregistré.');
        await apresModification();
      } catch (e) {
        montrer('erreur', e.message);
      }
    });
    blocIdentite.append(el('label', { classe: 'champ' }, [el('span', { texte: 'Ton prénom' }), el('div', { classe: 'ligne' }, [entree, enregistrer])]));

    const actifs = (identite.traits || []).filter((t) => t.statut === 'actif');
    blocIdentite.append(el('p', {
      classe: 'aide',
      texte: actifs.length
        ? `Traits de personnalité : ${actifs.map((t) => t.texte).join(' ; ')}`
        : "Personnalité : aucun trait pour l'instant. Toute évolution de son identité te sera proposée avant d'être adoptée.",
    }));
  }

  // ---------- souvenirs ----------
  function carteSouvenir(s, personne) {
    const carte = el('div', { classe: `souvenir${s.statut === 'archive' ? ' archive' : ''}` });
    const texte = el('p', { classe: 'souvenir-texte', texte: s.texte });
    const infos = [
      CATEGORIES[s.categorie] || 'Autre',
      LIBELLES_CONFIANCE[s.confiance] || 'incertain',
      origineSouvenir(s, personne),
      `importance ${s.importance || 1}`,
      dateJour(s.modifie || s.cree),
    ];
    const detail = el('p', { classe: 'aide', texte: infos.join(' — ') });
    const actions = el('div', { classe: 'ligne' });
    carte.append(texte, detail, actions);

    if (s.statut === 'archive') {
      actions.append(
        btn('Réactiver', async () => {
          await memoire.ecrireSouvenirs([{ ...s, statut: 'actif', modifie: horloge().toISOString(),
            historique: [...(s.historique || []), { date: horloge().toISOString(), action: `réactivé par ${personne}` }] }]);
          await apresModification();
        }),
        btn('Supprimer', async () => {
          if (!confirmer('Supprimer définitivement ce souvenir ?')) return;
          await memoire.supprimerSouvenir(s.id);
          await apresModification();
        }),
      );
      return carte;
    }

    actions.append(
      btn('Modifier', () => {
        const zone = el('textarea', { attrs: { rows: '3', 'aria-label': 'Texte du souvenir' } });
        zone.value = s.texte;
        const garder = btn('Enregistrer', async () => {
          const t = zone.value.replace(/\s+/g, ' ').trim();
          if (t.length < 3) { montrer('erreur', 'Souvenir trop court.'); return; }
          const date = horloge().toISOString();
          await memoire.ecrireSouvenirs([{
            ...s, texte: t, confiance: 'certain', modifie: date,
            historique: [...(s.historique || []), { date, action: `modifié par ${personne}`, ancienTexte: s.texte }],
          }]);
          await apresModification();
        }, 'bouton-principal');
        const annuler = btn('Annuler', () => rafraichir());
        texte.replaceWith(zone);
        actions.replaceChildren(garder, annuler);
        zone.focus();
      }),
      btn('Oublier', async () => {
        if (!confirmer('Naissance va oublier ce souvenir pour de bon. Continuer ?')) return;
        await memoire.supprimerSouvenir(s.id);
        await apresModification();
      }),
    );
    return carte;
  }

  async function dessinerSouvenirs() {
    const [souvenirs, identite] = await Promise.all([memoire.souvenirs(), memoire.identite()]);
    const personne = identite ? identite.noyau.personne : 'toi';
    const actifs = souvenirs.filter((s) => s.statut !== 'archive')
      .sort((a, b) => (b.importance || 1) - (a.importance || 1) || String(b.modifie).localeCompare(String(a.modifie)));
    const archives = souvenirs.filter((s) => s.statut === 'archive');
    nbSouvenirs.textContent = `${actifs.length} actif(s)`;
    listeSouvenirs.replaceChildren(...(actifs.length
      ? actifs.map((s) => carteSouvenir(s, personne))
      : [el('p', { classe: 'aide', texte: 'Aucun souvenir pour le moment. Naissance en retiendra au fil de vos conversations.' })]));
    zoneArchives.hidden = archives.length === 0;
    zoneArchives.querySelector('summary').textContent = `Souvenirs archivés (${archives.length})`;
    listeArchives.replaceChildren(...archives.map((s) => carteSouvenir(s, personne)));
  }

  async function ajouterSouvenir() {
    if (!(await memoire.estNee())) { montrer('erreur', "Naissance n'est pas encore née."); return; }
    const t = nouveauTexte.value.replace(/\s+/g, ' ').trim();
    if (t.length < 3) { montrer('erreur', 'Écris le souvenir à ajouter.'); return; }
    const date = horloge().toISOString();
    await memoire.ecrireSouvenirs([{
      id: `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      texte: t.slice(0, 300), categorie: nouvelleCategorie.value, importance: 2,
      confiance: 'certain', source: 'manuel', statut: 'actif',
      cree: date, modifie: date, dernierRappel: null, nbRappels: 0, origine: null, historique: [],
    }]);
    nouveauTexte.value = '';
    montrer('ok', 'Souvenir ajouté.');
    await apresModification();
  }

  // ---------- fil, sauvegarde, rangement ----------
  async function dessinerReste() {
    const [fil, meta, sauvegarde] = await Promise.all([memoire.fil(), memoire.meta(), memoire.sauvegardeAvantImport()]);
    zoneFil.textContent = fil.texte || "Pas encore de résumé : il apparaîtra quand la conversation aura assez grandi.";
    infoExport.textContent = `Dernier export : ${dateCourte(meta.dernierExport)}.`;
    boutonRestaurer.hidden = !sauvegarde;
    const morceaux = [`Dernier rangement : ${dateCourte(meta.derniereConsolidation)}.`];
    if (meta.echecConsolidation) morceaux.push(`Dernier problème : ${meta.messageEchec || 'inconnu'} (${dateCourte(meta.echecConsolidation)}).`);
    if (memoire.magasin.persistant === false) morceaux.push('⚠️ Mémoire non enregistrée sur cet appareil : elle sera perdue à la fermeture.');
    infoRangement.textContent = morceaux.join(' ');
  }

  async function exporter() {
    try {
      const meta = await memoire.meta();
      const fichier = await construireFichier({
        donnees: await memoire.exporterDonnees(),
        idNaissance: meta.idNaissance,
        versionAppli,
        maintenant: horloge(),
      });
      const mode = await partagerOuTelecharger(fichier);
      if (mode === 'annule') { montrer('attente', 'Export annulé.'); return; }
      await memoire.majMeta({ dernierExport: horloge().toISOString() });
      montrer('ok', mode === 'partage'
        ? `Fichier ${fichier.nom} prêt : choisis où l'enregistrer (Drive, mail…).`
        : `Fichier ${fichier.nom} téléchargé.`);
      await dessinerReste();
    } catch (e) {
      montrer('erreur', `Export impossible : ${e.message || e}`);
    }
  }

  async function importerDepuis(objet, { estRestauration = false } = {}) {
    const lu = await lireFichier(objet);
    if (!lu.ok) { montrer('erreur', lu.erreur); return; }
    const [metaActuelle, nbActuel] = await Promise.all([memoire.meta(), memoire.compterMessages()]);
    const r = lu.resume;
    const avertissements = [
      `${estRestauration ? 'Copie de secours' : 'Ce fichier'} : ${r.messages} message(s), ${r.souvenirs} souvenir(s), exporté le ${dateCourte(r.exporteLe)}.`,
    ];
    if (metaActuelle.idNaissance && r.idNaissance && metaActuelle.idNaissance !== r.idNaissance) {
      avertissements.push('⚠️ Il vient d’une AUTRE Naissance que celle de cet appareil.');
    }
    if (nbActuel > 0 && metaActuelle.derniereActivite && Date.parse(r.exporteLe) < Date.parse(metaActuelle.derniereActivite)) {
      avertissements.push('⚠️ Il est plus ancien que la mémoire actuelle.');
    }
    avertissements.push(`La mémoire actuelle (${nbActuel} message(s)) sera remplacée. Une copie de secours sera gardée sur cet appareil.`);
    if (!confirmer(avertissements.join('\n\n'))) { montrer('attente', 'Import annulé.'); return; }

    const secours = (await memoire.estNee()) || nbActuel > 0
      ? (await construireFichier({
        donnees: await memoire.exporterDonnees(),
        idNaissance: metaActuelle.idNaissance,
        versionAppli,
        maintenant: horloge(),
      })).objet
      : null;
    await memoire.remplacerDonnees(lu.donnees, { sauvegarde: secours });
    await memoire.majMeta({ derniereImportation: horloge().toISOString() });
    montrer('ok', estRestauration ? 'Mémoire d’avant l’import restaurée.' : 'Mémoire importée.');
    await apresModification();
  }

  async function importer() {
    const fichier = choixFichier.files && choixFichier.files[0];
    choixFichier.value = '';
    if (!fichier) return;
    try {
      await importerDepuis(await fichier.text());
    } catch (e) {
      montrer('erreur', `Import impossible : ${e.message || e}`);
    }
  }

  async function restaurer() {
    const sauvegarde = await memoire.sauvegardeAvantImport();
    if (!sauvegarde) return;
    try {
      await importerDepuis(sauvegarde, { estRestauration: true });
    } catch (e) {
      montrer('erreur', `Restauration impossible : ${e.message || e}`);
    }
  }

  async function ranger() {
    const bouton = $('[data-ranger]');
    bouton.disabled = true;
    montrer('attente', 'Naissance range sa mémoire…');
    try {
      const r = await esprit.consoliderSiBesoin({ force: true });
      if (r.fait) {
        const s = r.stats || {};
        montrer('ok', `Rangement fait : ${r.analyses} message(s) relus, ${s.ajoutes || 0} souvenir(s) ajouté(s), ${s.corriges || 0} corrigé(s), ${s.confirmes || 0} confirmé(s), ${s.oublies || 0} archivé(s)${r.resume ? ', résumé mis à jour' : ''}.`);
      } else if (r.raison === 'echec') {
        montrer('erreur', `Rangement impossible : ${r.erreur && r.erreur.message ? r.erreur.message : 'erreur'}`);
      } else if (r.raison === 'pas-prete') {
        montrer('erreur', 'Naissance doit être née et avoir un moteur testé.');
      } else {
        montrer('ok', 'Rien de nouveau à ranger.');
      }
      await apresModification();
    } finally {
      bouton.disabled = false;
    }
  }

  async function rafraichir() {
    await Promise.all([dessinerIdentite(), dessinerSouvenirs(), dessinerReste()]);
  }

  $('[data-ajouter-souvenir]').addEventListener('click', ajouterSouvenir);
  $('[data-exporter]').addEventListener('click', exporter);
  $('[data-importer]').addEventListener('click', () => choixFichier.click());
  choixFichier.addEventListener('change', importer);
  boutonRestaurer.addEventListener('click', restaurer);
  $('[data-ranger]').addEventListener('click', ranger);

  return {
    rafraichir,
    ouvrir: () => { resultat.hidden = true; return rafraichir(); },
  };
}
// === FIN_ECRAN_MEMOIRE ===
