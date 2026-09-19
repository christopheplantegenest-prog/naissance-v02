// === DEBUT_GRAND_BANC_ECRAN ===
// Écran du grand banc de diagnostic — séparé du banc rapide (Diagnostic) juste au-dessus.
// Le journal vit dans sa propre base IndexedDB (grand-banc-stockage.js), jamais dans la mémoire
// de Naissance. « Lancer » et « Reprendre » sont le même bouton : il relit toujours le journal et
// ne refait jamais un essai déjà présent — s'arrête et reprend simplement en le pressant à nouveau.

import { genererPlan, estimerDuree, EXPERIENCES } from './grand-banc-plan.js';
import { executerLot, TAILLE_LOT_PAR_DEFAUT, PAUSE_ENTRE_LOTS_MS, rapportSynthese, rapportBrut } from './grand-banc.js';

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
  const avancement = $('[data-grand-banc-avancement]');

  const plan = genererPlan();
  const estimation = estimerDuree(plan);
  let stockage = null;
  let enCours = false;
  let arreter = false;

  const minutes = (s) => Math.round(s / 60);

  async function magasin() {
    if (!stockage) stockage = await ouvrirStockage();
    return stockage;
  }

  async function dessiner() {
    const m = await magasin();
    const faits = await m.listerEssais();
    const dejaFaits = new Set(faits.map((e) => e.id));
    const restants = plan.length - dejaFaits.size;
    etatTexte.textContent = `Plan : ${plan.length} essais (${Object.values(EXPERIENCES).length} expériences). `
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
    const m = await magasin();
    const idIdentite = await identite();
    for (;;) {
      if (arreter) break;
      const faits = await m.listerEssais();
      const dejaFaits = new Set(faits.map((e) => e.id));
      const r = await executerLot({
        plan, dejaFaits, essai, identite: idIdentite,
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
    const m = await magasin();
    await copier(rapportSynthese({ plan, essais: await m.listerEssais() }));
    avancement.textContent = 'Synthèse copiée dans le presse-papiers.';
  });
  bBrut.addEventListener('click', async () => {
    const m = await magasin();
    await copier(rapportBrut({ essais: await m.listerEssais() }));
    avancement.textContent = 'Données brutes copiées dans le presse-papiers.';
  });

  return { rafraichir: dessiner, plan };
}
// === FIN_GRAND_BANC_ECRAN ===
