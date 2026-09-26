// === DEBUT_SAUVEGARDE_COMPLETE ===
// v0.17.15 — SAUVEGARDE COMPLÈTE DE NAISSANCE : un seul fichier qui couvre les DEUX bases
// persistantes (naissance-memoire ET naissance-langage), pour survivre à un changement d'appareil,
// une réinstallation ou un passage APK <-> navigateur. NE REMPLACE PAS le format existant
// (transfert.js : { format:'naissance', ... }, memoire seule) : ce module ajoute un SECOND format,
// distinct et versionné séparément ({ format:'naissance-sauvegarde-complete', schema, ... }), lu et
// écrit par app/memoire/ecran.js SANS jamais casser l'ancien.
//
// EXCLUSIONS VOLONTAIRES (jamais dans le fichier produit) : clés API, configuration des
// fournisseurs, diagnostics techniques, brouillons -- tout cela vit dans localStorage
// (app/reglages/stockage.js et consorts), jamais lu par ce module. Les clés API devront être
// ressaisies après une restauration : c'est un choix de sécurité assumé, pas un oubli.
//
// ATOMICITÉ : chaque base a son propre remplacement atomique natif (une seule transaction
// IndexedDB par base, « tout ou rien » -- voir remplacerTout() dans magasin.js pour naissance-memoire
// et dans langage/connaissances.js pour naissance-langage, ajouté par ce chantier). Comme IndexedDB
// ne permet pas de transaction unique à cheval sur DEUX bases différentes, l'import complet capture
// d'abord un instantané des DEUX bases, remplace naissance-langage, puis naissance-memoire ; si le
// second remplacement échoue, naissance-langage (déjà remplacée) est restaurée à son état
// précédent -- elle aussi via un remplacement atomique. Au pire, en cas d'échec de CETTE restauration
// elle-même (double échec, non couvert par les tests), l'état pourrait rester incohérent entre les
// deux bases ; ce risque résiduel est documenté, pas caché.

import { empreinte } from './transfert.js';
import { TABLES as TABLES_LANGAGE } from '../langage/connaissances.js';

export const FORMAT_SAUVEGARDE = 'naissance-sauvegarde-complete';
export const SCHEMA_SAUVEGARDE = 1;

async function exporterTables(magasin, tables) {
  const sortie = {};
  for (const nom of tables) sortie[nom] = await magasin.lireTout(nom);
  return sortie;
}

function refus(message) {
  return { ok: false, erreur: message };
}

// Complète par des tables vides celles absentes d'une sauvegarde plus ANCIENNE que le schéma
// courant -- jamais pour le schéma courant (une table manquante y est un fichier incomplet, donc un
// refus). Ne fabrique jamais une donnée : une table absente reste vide, jamais devinée.
export function migrerDonnees(bloc, tables, schema) {
  if (schema >= SCHEMA_SAUVEGARDE) return bloc;
  const complete = { ...bloc };
  for (const nom of tables) if (!Array.isArray(complete[nom])) complete[nom] = [];
  return complete;
}

export async function construireSauvegardeComplete({ memoire, magasinLangage, idNaissance, versionAppli, maintenant }) {
  const [donneesMemoire, donneesLangage] = await Promise.all([
    memoire.exporterDonnees(),
    exporterTables(magasinLangage, TABLES_LANGAGE),
  ]);
  const donnees = { memoire: donneesMemoire, langage: donneesLangage };
  const corps = JSON.stringify(donnees);
  const exporteLe = maintenant.toISOString();
  const fichier = {
    format: FORMAT_SAUVEGARDE,
    schema: SCHEMA_SAUVEGARDE,
    exporteLe,
    versionAppli,
    idNaissance: idNaissance || null,
    empreinte: await empreinte(corps),
    donnees,
  };
  const court = (idNaissance || 'sans-id').slice(0, 8);
  return { nom: `naissance-sauvegarde-${court}-${exporteLe.slice(0, 10)}.json`, objet: fichier, contenu: JSON.stringify(fichier) };
}

export async function lireSauvegardeComplete(texte, { tablesMemoire }) {
  let f;
  try {
    f = typeof texte === 'string' ? JSON.parse(texte) : texte;
  } catch {
    return refus("Ce fichier n'est pas un fichier JSON lisible.");
  }
  if (!f || f.format !== FORMAT_SAUVEGARDE) return refus("Ce fichier n'est pas une sauvegarde complète de Naissance.");
  if (!Number.isInteger(f.schema) || f.schema < 1) return refus('Version de sauvegarde inconnue.');
  if (f.schema > SCHEMA_SAUVEGARDE) {
    return refus("Cette sauvegarde vient d'une version plus récente de Naissance : mets l'appli à jour avant de l'importer.");
  }
  const d = f.donnees;
  if (!d || typeof d !== 'object' || !d.memoire || typeof d.memoire !== 'object' || !d.langage || typeof d.langage !== 'object') {
    return refus('Fichier incomplet : données absentes.');
  }
  if (await empreinte(JSON.stringify(d)) !== f.empreinte) {
    return refus('Fichier abîmé ou modifié : son empreinte ne correspond pas.');
  }
  const memoire = migrerDonnees(d.memoire, tablesMemoire, f.schema);
  const langage = migrerDonnees(d.langage, TABLES_LANGAGE, f.schema);
  for (const nom of tablesMemoire) {
    if (!Array.isArray(memoire[nom])) return refus(`Fichier incomplet : « naissance-memoire/${nom} » manquant.`);
  }
  for (const nom of TABLES_LANGAGE) {
    if (!Array.isArray(langage[nom])) return refus(`Fichier incomplet : « naissance-langage/${nom} » manquant.`);
  }
  return {
    ok: true,
    fichier: f,
    donnees: { memoire, langage },
    resume: {
      exporteLe: f.exporteLe,
      versionAppli: f.versionAppli,
      idNaissance: f.idNaissance || null,
      schema: f.schema,
      messages: (memoire.journal || []).length,
      souvenirs: (memoire.souvenirs || []).length,
      experiences: (langage.experiences || []).length,
    },
  };
}

// IMPORT ATOMIQUE PAR BASE + FILET ENTRE LES DEUX BASES (voir commentaire d'en-tête). Remplace
// d'abord naissance-langage (remplacerTout, une seule transaction native, tout ou rien) ; si le
// remplacement de naissance-memoire échoue ENSUITE, restaure naissance-langage à son état
// précédent, capturé AVANT toute écriture, puis relance l'erreur -- jamais de silence sur l'échec.
export async function importerSauvegardeComplete({ memoire, magasinLangage, donnees }) {
  const avantLangage = await exporterTables(magasinLangage, TABLES_LANGAGE);
  const avantMemoire = await memoire.exporterDonnees();

  await magasinLangage.remplacerTout(donnees.langage);
  try {
    await memoire.remplacerDonnees(donnees.memoire, { sauvegarde: avantMemoire });
  } catch (e) {
    await magasinLangage.remplacerTout(avantLangage);
    throw e;
  }
}
// === FIN_SAUVEGARDE_COMPLETE ===
