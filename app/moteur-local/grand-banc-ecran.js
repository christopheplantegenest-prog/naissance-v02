// === DEBUT_GRAND_BANC_ECRAN ===
// Écran du grand banc de diagnostic — séparé du banc rapide (Diagnostic) juste au-dessus.
// Le journal vit dans sa propre base IndexedDB (grand-banc-stockage.js), jamais dans la mémoire
// de Naissance. « Lancer » et « Reprendre » sont le même bouton : il relit toujours le journal et
// ne refait jamais un essai déjà présent — s'arrête et reprend simplement en le pressant à nouveau.

import { genererPlan, estimerDuree, EXPERIENCES } from './grand-banc-plan.js';
import { executerLot, TAILLE_LOT_PAR_DEFAUT, PAUSE_ENTRE_LOTS_MS, rapportSynthese, rapportBrut } from './grand-banc.js';

// Campagne du 19/09 invalidée par un gabarit « {personne} » jamais substitué dans les souvenirs
// imposés et certaines questions (voir ARCHITECTURE-IA.md). Cette étiquette distingue la campagne
// corrigée de l'ancienne dans le journal, SANS jamais écraser celle-ci : seules les 5 expériences
// concernées changent d'identifiant (« corrige-2026-09-19/… ») ; « absence », non affectée, garde
// les siens et n'est donc jamais refaite.
export const VERSION_CAMPAGNE = 'corrige-2026-09-19';

export function monterEcranGrandBanc({
  zone, essai, identite, ouvrirStockage, surChangement = () => {},
  confirmer = (t) => window.confirm(t), copier = (t) => navigator.clipboard.writeText(t),
  pause = (ms) => new Promise((ok) => setTimeout(ok, ms)),
}) {
  const $ = (s) => zone.querySelector(s);
  const etatTexte = $('[data-grand-banc-etat]');
  const bLancer = $('[data-grand-banc-lancer]');
  const bArreter = $('[data-grand-banc-arreter]');
  const bEffacer = $('[data-grand-banc-effacer]');
  const bSynthese = $('[data-grand-banc-copier-synthese]');
  const bBrut = $('[data-grand-banc-copier-brut]');
  const bApercu = $('[data-grand-banc-apercu]');
  const zoneApercu = $('[data-grand-banc-apercu-texte]');
  const avancement = $('[data-grand-banc-avancement]');

  let plan = null;
  let estimation = null;
  let stockage = null;
  let enCours = false;
  let arreter = false;

  const minutes = (s) => Math.round(s / 60);

  async function magasin() {
    if (!stockage) stockage = await ouvrirStockage();
    return stockage;
  }

  // Le plan dépend de l'identité réelle (Christophe, Naissance) : construit une seule fois,
  // dès qu'elle est disponible.
  async function assurerPlan() {
    if (!plan) {
      const idIdentite = await identite();
      plan = genererPlan(idIdentite, { version: VERSION_CAMPAGNE });
      estimation = estimerDuree(plan);
    }
    return plan;
  }

  // Essais du journal qui appartiennent VRAIMENT à ce plan (par identifiant) : une ancienne
  // campagne invalidée peut cohabiter dans le même journal sans jamais polluer ce compte ni les
  // rapports — ses identifiants ne correspondent à aucune ligne du plan courant.
  async function faitsDuPlan() {
    const p = await assurerPlan();
    const m = await magasin();
    const idsDuPlan = new Set(p.map((e) => e.id));
    return (await m.listerEssais()).filter((e) => idsDuPlan.has(e.id));
  }

  async function dessiner() {
    const p = await assurerPlan();
    const faits = await faitsDuPlan();
    const dejaFaits = new Set(faits.map((e) => e.id));
    const restants = p.length - dejaFaits.size;
    etatTexte.textContent = `Plan : ${p.length} essais (${Object.values(EXPERIENCES).length} expériences). `
      + `Déjà faits : ${dejaFaits.size}. Restants : ${restants}. `
      + `Durée estimée pour tout le plan : environ ${minutes(estimation.secondesBasses)} à ${minutes(estimation.secondesHautes)} minutes, écran allumé.`;
    bLancer.textContent = dejaFaits.size === 0 ? 'Lancer le grand banc' : (restants > 0 ? 'Reprendre le grand banc' : 'Terminé — relancer depuis le début après avoir effacé');
    bLancer.disabled = enCours || restants <= 0;
    bArreter.hidden = !enCours;
    bEffacer.disabled = enCours;
    bSynthese.disabled = faits.length === 0;
    bBrut.disabled = faits.length === 0;
  }

  async function boucle() {
    enCours = true;
    arreter = false;
    await dessiner();
    const p = await assurerPlan();
    const m = await magasin();
    const idIdentite = await identite();
    for (;;) {
      if (arreter) break;
      const idsDuPlan = new Set(p.map((e) => e.id));
      const dejaFaits = new Set((await m.listerEssais()).filter((e) => idsDuPlan.has(e.id)).map((e) => e.id));
      const r = await executerLot({
        plan: p, dejaFaits, essai, identite: idIdentite,
        enregistrer: (rec) => m.enregistrerEssai(rec),
        tailleLot: TAILLE_LOT_PAR_DEFAUT,
        arret: () => arreter,
        surAvancement: ({ fait, total, id }) => {
          avancement.textContent = `Essai ${fait + 1} sur ${total} : ${id}…`;
        },
      });
      if (r.termine) { avancement.textContent = 'Grand banc terminé.'; break; }
      if (arreter) { avancement.textContent = 'Grand banc arrêté — repartira du même point.'; break; }
      // Pause entre deux lots : laisse le téléphone respirer avant la suite.
      avancement.textContent = 'Pause entre deux lots…';
      await pause(PAUSE_ENTRE_LOTS_MS);
    }
    enCours = false;
    await dessiner();
    surChangement();
  }

  bLancer.addEventListener('click', () => { if (!enCours) boucle(); });
  bArreter.addEventListener('click', () => { arreter = true; avancement.textContent = 'Arrêt demandé — fin du lot en cours…'; });
  bEffacer.addEventListener('click', async () => {
    if (enCours) return;
    if (!confirmer('Effacer tout le journal du grand banc ? Naissance, sa mémoire et sa conversation ne changent pas.')) return;
    const m = await magasin();
    await m.effacerTout();
    avancement.textContent = 'Journal effacé.';
    await dessiner();
  });
  bSynthese.addEventListener('click', async () => {
    const p = await assurerPlan();
    await copier(rapportSynthese({ plan: p, essais: await faitsDuPlan() }));
    avancement.textContent = 'Synthèse copiée dans le presse-papiers.';
  });
  bBrut.addEventListener('click', async () => {
    await copier(rapportBrut({ essais: await faitsDuPlan() }));
    avancement.textContent = 'Données brutes copiées dans le presse-papiers.';
  });
  // Vérification avant lancement : le texte FINAL (question + souvenir imposé) d'un essai
  // représentatif de chaque expérience — pour voir le stimulus réel, pas le gabarit source.
  bApercu.addEventListener('click', async () => {
    const p = await assurerPlan();
    const lignes = [];
    for (const exp of Object.keys(EXPERIENCES)) {
      const ligneEssai = p.find((e) => e.experience === exp);
      if (!ligneEssai) continue;
      lignes.push(`— ${EXPERIENCES[exp]} —`);
      lignes.push(`  Question : ${ligneEssai.question}`);
      lignes.push(`  Souvenir imposé : ${(ligneEssai.souvenirsImposes || []).join(' | ') || 'aucun'}${ligneEssai.sansSouvenirs ? ' (absence forcée)' : ''}`);
      lignes.push('');
    }
    zoneApercu.textContent = lignes.join('\n');
    zoneApercu.hidden = false;
  });

  return { rafraichir: dessiner };
}
// === FIN_GRAND_BANC_ECRAN ===
