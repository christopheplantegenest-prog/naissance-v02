// === DEBUT_ESSAIS_ECRAN ===
// v0.66.8 — ATELIER 2, L3 : écran « Capacités en essai » (mécanisme technique, non cognitif ; protégé : app/essais/).
//   monterEssais({ zone, porte, partager }) -> { rafraichir }
// Chargé seulement au toucher « Capacités en essai » des Réglages (import dynamique dans main.js).
// Pour chaque capacité du registre : état (inactive, active, coupée et pourquoi), compteurs, dernières lignes écrites avec leur provenance.
// Gestes : « Activer » / « Réactiver » s'ARMENT au premier toucher (rappel de sauvegarder la mémoire) et agissent au second ; « Couper » agit
// au premier toucher ; « Exécuter maintenant », « Vérifier les invariants », épreuves de panne du témoin (armées) ; export de la zone d'essai.
// Rien ici ne lit ni n'écrit la mémoire de Naissance : l'écran ne parle qu'à la porte.
import { exporterZone } from './zone.js';

const LIBELLES = { inactif: 'Inactive', actif: 'Active', coupe: 'Coupée' };
const NOMS_EPREUVES = { panne: 'panne (exception)', boucle: 'boucle sans fin (délai)', asynchrone: 'résultat asynchrone', evasion: 'évasion du bac', forme: 'trop de lignes', doublon: 'clé déjà écrite' };
const jour = (iso) => (typeof iso === 'string' ? iso.replace('T', ' ').slice(0, 19) : '');

export function monterEssais({ zone, porte, partager = null }) {
  const ui = { arme: null, message: null, occupe: false, lignes: {}, ouvertes: {} };

  const el = (tag, { classe, texte, attrs } = {}, ...enfants) => {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texte !== undefined) e.textContent = texte;
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    e.append(...enfants.filter(Boolean));
    return e;
  };
  const bouton = (texte, nom, action, { principal = false, actif = true } = {}) => {
    const b = el('button', { classe: principal ? 'bouton-principal' : 'bouton-secondaire', texte, attrs: { type: 'button', 'data-essais': nom } });
    b.disabled = !actif || ui.occupe;
    b.addEventListener('click', () => (b.disabled ? undefined : action()));
    return b;
  };
  const boutonArme = (texte, nom, action, rappel = null) => (ui.arme === nom
    ? [bouton(`Confirmer : ${texte}`, nom, () => { ui.arme = null; return action(); }, { principal: true }), rappel ? el('p', { classe: 'aide', texte: rappel, attrs: { 'data-essais': `${nom}-rappel` } }) : null]
    : [bouton(texte, nom, () => { ui.arme = nom; ui.message = null; rendre(); })]);
  const dire = (section, texte, erreur = false) => { ui.message = { section, texte, erreur }; };
  const message = (section) => (ui.message && ui.message.section === section
    ? el('p', { classe: `resultat ${ui.message.erreur ? 'resultat-erreur' : 'resultat-ok'}`, texte: ui.message.texte, attrs: { 'data-essais': 'message' } }) : null);

  async function agir(section, operation) {
    ui.occupe = true;
    ui.message = null;
    rendre();
    try {
      const r = await operation();
      if (r) dire(section, r.texte, r.erreur);
    } catch (e) {
      dire(section, `Échec : ${e && e.message ? e.message : e}`, true);
    } finally {
      ui.occupe = false;
      await chargerLignes();
      rendre();
    }
  }
  const compteRendu = (r) => {
    if (!r) return { texte: 'Rien à faire.' };
    if (r.statut === 'ecrit') return { texte: `Exécutée : ${r.lignes} ligne(s) ajoutée(s) dans la zone d'essai.` };
    if (r.statut === 'coupe') return { texte: `Coupée automatiquement : ${r.motif}`, erreur: true };
    if (r.statut === 'ecarte') return { texte: 'Résultat écarté (capacité coupée pendant l\'exécution) : rien n\'est écrit.' };
    if (r.statut === 'conforme') return { texte: `Invariants respectés (${r.lignes} ligne(s) relue(s)).` };
    if (r.statut === 'saute') return { texte: 'Exécution sautée (lecture impossible).', erreur: true };
    return { texte: 'Rien à faire (capacité non active).' };
  };

  async function chargerLignes() {
    for (const { declaration: d } of porte.liste()) {
      try { ui.lignes[d.id] = (await porte.lignes(d.id)).sort((a, b) => (a.horodatage < b.horodatage ? 1 : -1)); } catch { ui.lignes[d.id] = []; }
    }
  }

  function carte({ declaration: d, etat, detail }) {
    const k = d.id;
    const enfants = [
      el('h3', { texte: d.titre }),
      el('p', { classe: 'aide', texte: d.description || '' }),
      el('p', { texte: `État : ${LIBELLES[etat]}${detail && detail.depuis ? ` depuis ${jour(detail.depuis)}` : ''}`, attrs: { 'data-essais': `${k}-etat` } }),
    ];
    if (etat === 'coupe' && detail) enfants.push(el('p', { classe: 'resultat resultat-erreur', texte: `${detail.auto ? 'Coupure automatique' : 'Coupée à la main'} : ${detail.motif}`, attrs: { 'data-essais': `${k}-motif` } }));
    if (detail) enfants.push(el('p', { classe: 'aide', texte: `Exécutions : ${detail.executions} — lignes écrites : ${detail.lignes} — anomalies : ${detail.anomalies}${detail.derniere ? ` — dernière : ${jour(detail.derniere)}` : ''}`, attrs: { 'data-essais': `${k}-compteurs` } }));
    enfants.push(el('p', { classe: 'aide', texte: `Lit (copie, lecture seule) : ${d.lit.length ? d.lit.join(', ') : 'rien'} ; écrit seulement dans la zone d'essai.` }));
    const rappel = 'Rappel : sauvegarder la mémoire avant (Réglages → Mémoire). La capacité n\'écrit que dans la zone d\'essai, jamais dans la mémoire.';
    if (etat === 'actif') {
      enfants.push(bouton('Couper', `${k}-couper`, () => { porte.couper(k); dire(k, 'Coupée : le comportement d\'avant est rétabli ; les lignes déjà écrites restent, marquées.'); rendre(); }, { principal: true }));
      if (d.declencheurs.includes('manuel')) enfants.push(bouton('Exécuter maintenant', `${k}-executer`, () => agir(k, async () => compteRendu(await porte.executerMaintenant(k)))));
      enfants.push(bouton('Vérifier les invariants', `${k}-relire`, () => agir(k, async () => compteRendu(await porte.relire(k)))));
      if (d.epreuves && d.epreuves.length && d.declencheurs.includes('manuel')) {
        enfants.push(el('p', { classe: 'aide', texte: 'Épreuves de la porte : chacune doit couper la capacité automatiquement.' }));
        for (const ep of d.epreuves) enfants.push(...boutonArme(`Provoquer : ${NOMS_EPREUVES[ep]}`, `${k}-epreuve-${ep}`, () => agir(k, async () => compteRendu(await porte.executerMaintenant(k, { epreuve: ep })))));
      }
    } else {
      enfants.push(...boutonArme(etat === 'coupe' ? 'Réactiver' : 'Activer', `${k}-activer`, () => agir(k, async () => {
        const r = await porte.activer(k);
        return r.ok ? { texte: 'Active : elle s\'exécutera après chaque tour.' } : { texte: `Activation refusée : ${r.motif}`, erreur: true };
      }), rappel));
    }
    const lignes = ui.lignes[k] || [];
    enfants.push(el('p', { classe: 'aide', texte: `Zone d'essai : ${lignes.length} ligne(s).`, attrs: { 'data-essais': `${k}-zone` } }));
    for (const l of lignes.slice(0, 5)) enfants.push(el('p', { classe: 'aide', texte: `${jour(l.horodatage)} — ${l.cle} — ${l.provenance} — ${JSON.stringify(l.donnees)}`, attrs: { 'data-essais': `${k}-ligne` } }));
    enfants.push(message(k));
    return el('div', { classe: 'bloc', attrs: { 'data-essais': k } }, ...enfants);
  }

  function sectionJournal() {
    const j = porte.journal().slice(-10).reverse();
    return el('div', { classe: 'bloc', attrs: { 'data-essais': 'journal' } }, el('h3', { texte: 'Journal technique' }),
      ...(j.length ? j.map((x) => el('p', { classe: 'aide', texte: `${jour(x.quand)} — ${x.id} — ${x.type} : ${x.texte}`, attrs: { 'data-essais': 'journal-ligne' } })) : [el('p', { classe: 'aide', texte: 'Vide.' })]));
  }

  function sectionExport() {
    if (!partager) return null;
    return el('div', { classe: 'bloc', attrs: { 'data-essais': 'export' } }, el('h3', { texte: 'Zone d\'essai' }),
      el('p', { classe: 'aide', texte: 'Les données des capacités en essai sont gardées à part de la mémoire de Naissance. La sauvegarde de la mémoire ne les contient pas : elles s\'exportent ici.' }),
      bouton('Exporter la zone d\'essai', 'exporter', () => agir('export', async () => {
        const objet = await exporterZone(await porte.zone(), { versionAppli: porte.version });
        await partager({ nom: `naissance-zone-essais-${porte.version}.json`, contenu: JSON.stringify(objet, null, 2) });
        return { texte: `Zone exportée : ${objet.lignes.length} ligne(s).` };
      })),
      message('export'));
  }

  function rendre() {
    zone.textContent = '';
    zone.append(...[
      el('p', { classe: 'aide', texte: 'Une capacité en essai s\'exécute dans un bac isolé, n\'écrit que dans la zone d\'essai et se coupe d\'elle-même à la première anomalie. La couper rétablit le comportement d\'avant. Une capacité en essai n\'est pas un acquis de Naissance.' }),
      ...porte.liste().map(carte),
      sectionJournal(),
      sectionExport(),
    ].filter(Boolean));
  }

  const rafraichir = async () => { ui.arme = null; await chargerLignes(); rendre(); };
  rendre();
  rafraichir();
  return { rafraichir };
}
// === FIN_ESSAIS_ECRAN ===
