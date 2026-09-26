// === DEBUT_ECRAN_MEMOIRE ===
// Ce que Naissance sait et qui elle est ; export, import, rangement.
// La personne peut modifier ou oublier n'importe quel souvenir.
// Seul le prénom est modifiable dans l'identité.

import { CATEGORIES } from '../esprit/consolidation.js';
import { LIBELLES_CONFIANCE, origineSouvenir } from '../esprit/contexte.js';
import { construireFichier, lireFichier, partagerOuTelecharger } from './transfert.js';
import { TABLES as TABLES_MEMOIRE } from './magasin.js';
import {
  FORMAT_SAUVEGARDE, construireSauvegardeComplete, lireSauvegardeComplete, importerSauvegardeComplete,
} from './sauvegarde.js';

// Devine le format d'un fichier déposé (ancien format 'naissance', mémoire seule ; ou nouveau
// format 'naissance-sauvegarde-complete', v0.17.15, mémoire + langage) SANS rien y écrire ni
// choisir à la place de la personne quel chemin d'import suivre plus bas.
function formatDeposeDe(texte) {
  try {
    const o = typeof texte === 'string' ? JSON.parse(texte) : texte;
    return o && o.format;
  } catch {
    return null;
  }
}

const dateValide = (iso) => (iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso) : null);
const dateCourte = (iso) => {
  const d = dateValide(iso);
  if (d) return d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
  return iso ? '—' : 'jamais';
};
const dateJour = (iso) => {
  const d = dateValide(iso);
  return d ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
};

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
  panneau, memoire, esprit, versionAppli, moteurLibelle, surChangement, magasinLangage,
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
  const journalActions = $('[data-journal-actions]');

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

  // ---------- journal des actions ----------
  const STATUTS = {
    executee: 'faite',
    'deja-faite': 'déjà faite, non rejouée',
    refusee: 'refusée',
    invalide: 'demande invalide',
    echec: 'échec',
  };
  async function dessinerActions() {
    const actions = await memoire.actionsRecentes(10);
    if (!actions.length) {
      journalActions.replaceChildren(el('li', { texte: 'Aucune action pour le moment.' }));
      return;
    }
    journalActions.replaceChildren(...actions.map((a) => {
      const detail = a.parametres && a.parametres.information ? ` « ${a.parametres.information} »` : '';
      const res = a.resultat && a.resultat.ok === false ? ` — ${a.resultat.erreur}`
        : a.resultat && a.resultat.etat === 'deja-connu' ? ' — déjà connu, confirmé' : '';
      return el('li', { texte: `${dateCourte(a.date)} : ${a.nom}${detail} → ${STATUTS[a.statut] || a.statut}${res}` });
    }));
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

  // v0.17.15 — L'export produit désormais une SAUVEGARDE COMPLÈTE (mémoire + langage), format
  // 'naissance-sauvegarde-complete' (sauvegarde.js). L'ancien format 'naissance' (mémoire seule,
  // transfert.js) N'EST PAS CASSÉ : il reste lisible en import (voir importerDepuis), pour tout
  // fichier déjà exporté par une version antérieure de Naissance.
  async function exporter() {
    try {
      const meta = await memoire.meta();
      const fichier = await construireSauvegardeComplete({
        memoire,
        magasinLangage: await magasinLangage(),
        idNaissance: meta.idNaissance,
        versionAppli,
        maintenant: horloge(),
      });
      const mode = await partagerOuTelecharger(fichier);
      if (mode === 'annule') { montrer('attente', 'Export annulé.'); return; }
      await memoire.majMeta({ dernierExport: horloge().toISOString() });
      montrer('ok', mode === 'partage'
        ? `Sauvegarde complète ${fichier.nom} prête : choisis où l'enregistrer (Drive, mail…).`
        : `Sauvegarde complète ${fichier.nom} téléchargée.`);
      await dessinerReste();
    } catch (e) {
      montrer('erreur', `Export impossible : ${e.message || e}`);
    }
  }

  // === DEBUT_DIAGNOSTIC_TEMPORAIRE_IMPORT (à retirer une fois la cause de l'échec téléphone
  // v0.17.15 confirmée) ===
  // Instrumentation VISIBLE À L'ÉCRAN, sans dépendre de console/devtools (Christophe travaille
  // uniquement sur téléphone) : chaque étape réellement franchie par l'import est notée dans
  // `trace`, puis affichée EN ENTIER dans le même bloc `resultat` déjà utilisé par montrer() --
  // aucun nouvel élément DOM, aucun changement de comportement, seulement un texte plus complet.
  // N'INTERCEPTE ni ne masque aucune exception : toute erreur est ajoutée à la trace puis montrée,
  // jamais avalée. Ne modifie ni les conditions ni l'ordre des appels déjà existants.
  const DIAGNOSTIC_TITRE = '— Diagnostic temporaire (import) —';
  function texteAvecTrace(titre, trace) {
    return [titre, '', DIAGNOSTIC_TITRE, ...trace].join('\n');
  }
  // === FIN_DIAGNOSTIC_TEMPORAIRE_IMPORT (suite du fichier, fonctions instrumentées ci-dessous) ===

  // Chemin ANCIEN format (mémoire seule) -- code inchangé depuis avant ce chantier, gardé tel quel
  // pour ne jamais casser l'import d'une sauvegarde déjà exportée par une version antérieure.
  async function importerAncienDepuis(objet, { estRestauration = false, trace = [] } = {}) {
    trace.push('chemin choisi : ANCIEN (mémoire seule) — naissance-langage ne sera PAS touchée');
    const lu = await lireFichier(objet);
    if (!lu.ok) { trace.push(`échec lecture fichier : ${lu.erreur}`); montrer('erreur', texteAvecTrace('Import impossible.', trace)); return; }
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
    trace.push('confirmation demandée (chemin ancien)');
    const confirmation = confirmer(avertissements.join('\n\n'));
    trace.push(`confirmation renvoyée : ${JSON.stringify(confirmation)} (typeof ${typeof confirmation})`);
    if (!confirmation) { trace.push('→ import ANNULÉ (chemin ancien) : aucune écriture'); montrer('attente', texteAvecTrace('Import annulé.', trace)); return; }

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
    trace.push('remplacement (mémoire seule) terminé sans exception');
    await apresModification();
    trace.push('apresModification() terminé');
    montrer('ok', texteAvecTrace(estRestauration ? 'Mémoire d’avant l’import restaurée.' : 'Mémoire importée.', trace));
  }

  // Chemin NOUVEAU format (sauvegarde complète, mémoire + langage) -- v0.17.15.
  async function importerCompletDepuis(objet, trace = []) {
    trace.push('chemin choisi : COMPLET (mémoire + langage)');
    try {
      const magLangage = await magasinLangage();
      const avantLangage = await magLangage.lireTout('experiences');
      trace.push(`naissance-langage AVANT remplacement : ${avantLangage.length} expérience(s) (${avantLangage.map((e) => e.texteRecu).join(' / ') || 'aucune'})`);

      const lu = await lireSauvegardeComplete(objet, { tablesMemoire: TABLES_MEMOIRE });
      if (!lu.ok) { trace.push(`échec lecture fichier : ${lu.erreur}`); montrer('erreur', texteAvecTrace('Import impossible.', trace)); return; }
      trace.push(`sauvegarde lue : ${lu.resume.experiences} expérience(s) de langage dans le fichier`);

      const [metaActuelle, nbActuel] = await Promise.all([memoire.meta(), memoire.compterMessages()]);
      const r = lu.resume;
      const avertissements = [
        `Sauvegarde complète : ${r.messages} message(s), ${r.souvenirs} souvenir(s), ${r.experiences} expérience(s) de langage, exportée le ${dateCourte(r.exporteLe)}.`,
      ];
      if (metaActuelle.idNaissance && r.idNaissance && metaActuelle.idNaissance !== r.idNaissance) {
        avertissements.push('⚠️ Elle vient d’une AUTRE Naissance que celle de cet appareil.');
      }
      if (nbActuel > 0 && metaActuelle.derniereActivite && Date.parse(r.exporteLe) < Date.parse(metaActuelle.derniereActivite)) {
        avertissements.push('⚠️ Elle est plus ancienne que la mémoire actuelle.');
      }
      avertissements.push(`La mémoire ET le langage appris actuels (${nbActuel} message(s)) seront remplacés.`);

      trace.push('confirmation demandée');
      const confirmation = confirmer(avertissements.join('\n\n'));
      trace.push(`confirmation renvoyée : ${JSON.stringify(confirmation)} (typeof ${typeof confirmation})`);
      if (!confirmation) { trace.push('→ import ANNULÉ (confirmation refusée ou absente) : aucune écriture effectuée'); montrer('attente', texteAvecTrace('Import annulé.', trace)); return; }

      trace.push('importerSauvegardeComplete() appelé');
      await importerSauvegardeComplete({ memoire, magasinLangage: magLangage, donnees: lu.donnees });
      trace.push('remplacement (mémoire + langage) terminé sans exception');

      const apresLangage = await magLangage.lireTout('experiences');
      trace.push(`naissance-langage APRÈS remplacement : ${apresLangage.length} expérience(s) (${apresLangage.map((e) => e.texteRecu).join(' / ') || 'aucune'})`);

      await memoire.majMeta({ derniereImportation: horloge().toISOString() });
      await apresModification();
      trace.push('apresModification() terminé');
      montrer('ok', texteAvecTrace('Sauvegarde complète importée (mémoire et langage).', trace));
    } catch (e) {
      trace.push(`ERREUR NON MASQUÉE : ${e && e.name ? e.name : 'Erreur'} — ${e && e.message ? e.message : e}`);
      montrer('erreur', texteAvecTrace('Import impossible.', trace));
    }
  }

  // Devine le format déposé et suit le chemin correspondant -- jamais l'inverse : ne remplace ni ne
  // touche à un fichier tant que son format n'est pas identifié.
  async function importerDepuis(objet, { estRestauration = false, trace = [] } = {}) {
    const format = formatDeposeDe(objet);
    trace.push(`format détecté : ${format === FORMAT_SAUVEGARDE ? 'complet (naissance-sauvegarde-complete)' : format ? `AUTRE (« ${format} »)` : 'illisible / non-JSON'}`);
    if (format === FORMAT_SAUVEGARDE) return importerCompletDepuis(objet, trace);
    return importerAncienDepuis(objet, { estRestauration, trace });
  }

  async function importer() {
    const fichier = choixFichier.files && choixFichier.files[0];
    choixFichier.value = '';
    if (!fichier) return;
    const trace = [`fichier sélectionné : ${fichier.name || '(sans nom)'}${Number.isFinite(fichier.size) ? ` (${fichier.size} octet(s))` : ''}`];
    try {
      await importerDepuis(await fichier.text(), { trace });
    } catch (e) {
      trace.push(`ERREUR NON MASQUÉE (hors chemin instrumenté) : ${e && e.message ? e.message : e}`);
      montrer('erreur', texteAvecTrace('Import impossible.', trace));
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
    await Promise.all([dessinerIdentite(), dessinerSouvenirs(), dessinerActions(), dessinerReste()]);
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
