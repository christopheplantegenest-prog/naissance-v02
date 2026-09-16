// === DEBUT_TRANSFERT ===
// Le fichier qui protège la continuité de Naissance.
// { format: "naissance", schema, exporteLe, versionAppli, idNaissance, empreinte, donnees }
// Schéma 1 (v0.4–v0.5) : cles, journal, souvenirs, resumes. Schéma 2 (v0.6) : + actions.
// empreinte = SHA-256 du texte JSON de « donnees ». Aucune clé ni réglage technique dedans.

import { SCHEMA } from './memoire.js';
import { estNatif, appelNatif } from '../natif.js';

const ROLES = new Set(['moi', 'ia']);

export async function empreinte(texte) {
  const octets = new TextEncoder().encode(texte);
  const hache = await globalThis.crypto.subtle.digest('SHA-256', octets);
  return [...new Uint8Array(hache)].map((o) => o.toString(16).padStart(2, '0')).join('');
}

export async function construireFichier({ donnees, idNaissance, versionAppli, maintenant }) {
  const corps = JSON.stringify(donnees);
  const exporteLe = maintenant.toISOString();
  const fichier = {
    format: 'naissance',
    schema: SCHEMA,
    exporteLe,
    versionAppli,
    idNaissance: idNaissance || null,
    empreinte: await empreinte(corps),
    donnees,
  };
  const court = (idNaissance || 'sans-id').slice(0, 8);
  return { nom: `naissance-${court}-${exporteLe.slice(0, 10)}.json`, objet: fichier, contenu: JSON.stringify(fichier) };
}

// Migration des anciens schémas vers le schéma actuel.
function migrer(donnees, schema) {
  if (schema < 2) return { ...donnees, actions: [] };
  return donnees;
}

function refus(message) {
  return { ok: false, erreur: message };
}

export async function lireFichier(texte) {
  let f;
  try {
    f = typeof texte === 'string' ? JSON.parse(texte) : texte;
  } catch {
    return refus("Ce fichier n'est pas un fichier JSON lisible.");
  }
  if (!f || f.format !== 'naissance') return refus("Ce fichier n'est pas une mémoire de Naissance.");
  if (!Number.isInteger(f.schema) || f.schema < 1) return refus('Version de fichier inconnue.');
  if (f.schema > SCHEMA) {
    return refus("Ce fichier vient d'une version plus récente de Naissance : mets l'appli à jour avant de l'importer.");
  }
  const d = f.donnees;
  if (!d || typeof d !== 'object') return refus('Fichier incomplet : données absentes.');
  if (await empreinte(JSON.stringify(d)) !== f.empreinte) {
    return refus('Fichier abîmé ou modifié : son empreinte ne correspond pas.');
  }
  const tables = f.schema >= 2 ? ['cles', 'journal', 'souvenirs', 'resumes', 'actions'] : ['cles', 'journal', 'souvenirs', 'resumes'];
  for (const nom of tables) {
    if (!Array.isArray(d[nom])) return refus(`Fichier incomplet : « ${nom} » manquant.`);
  }
  if (f.schema >= 2 && !d.actions.every((a) => a && typeof a.id === 'string' && typeof a.nom === 'string')) {
    return refus('Fichier invalide : une action du journal est mal formée.');
  }
  if (!d.journal.every((m) => m && Number.isInteger(m.id) && ROLES.has(m.role) && typeof m.texte === 'string')) {
    return refus('Fichier invalide : un message du journal est mal formé.');
  }
  if (!d.souvenirs.every((s) => s && typeof s.id === 'string' && typeof s.texte === 'string')) {
    return refus('Fichier invalide : un souvenir est mal formé.');
  }
  if (!d.resumes.every((r) => r && typeof r.id === 'string')) {
    return refus('Fichier invalide : un résumé est mal formé.');
  }
  if (!d.cles.every((c) => c && typeof c.cle === 'string')) {
    return refus('Fichier invalide : une donnée interne est mal formée.');
  }
  const donnees = migrer(d, f.schema);
  const meta = (donnees.cles.find((c) => c.cle === 'meta') || {}).valeur || {};
  return {
    ok: true,
    fichier: f,
    donnees,
    resume: {
      idNaissance: f.idNaissance || meta.idNaissance || null,
      exporteLe: f.exporteLe,
      versionAppli: f.versionAppli,
      messages: donnees.journal.length,
      souvenirs: donnees.souvenirs.filter((s) => s.statut !== 'archive').length,
      schema: f.schema,
      neeLe: meta.neeLe || null,
    },
  };
}

// APK : fichier temporaire puis menu « Partager » d'Android. PWA : téléchargement.
// Renvoie 'partage', 'telechargement' ou 'annule'.
export async function partagerOuTelecharger({ nom, contenu }) {
  if (estNatif()) {
    const ecrit = await appelNatif('Filesystem', 'writeFile', {
      path: nom, data: contenu, directory: 'CACHE', encoding: 'utf8',
    });
    try {
      await appelNatif('Share', 'share', {
        title: 'Mémoire de Naissance',
        dialogTitle: 'Enregistrer la mémoire de Naissance',
        files: [ecrit.uri],
      });
    } catch (e) {
      if (/cancel/i.test(String(e && (e.message || e)))) return 'annule';
      throw e;
    }
    return 'partage';
  }
  const url = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'telechargement';
}
// === FIN_TRANSFERT ===
