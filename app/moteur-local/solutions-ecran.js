// === DEBUT_SOLUTIONS_ECRAN ===
// Écran du banc comparatif de solutions — troisième bloc du Diagnostic, à côté du banc rapide et
// du grand banc. Même principe de robustesse : chaque essai est enregistré aussitôt dans le journal
// séparé (identifiants préfixés « solutions/ »), et « Lancer » vaut « Reprendre ».
// N'utilise JAMAIS la vraie mémoire de Naissance : le banc travaille sur sa mémoire de test isolée.

import { QUESTIONS, MEMOIRE_TEST, GRAINE_COMPARAISON } from './solutions-memoire.js';
import { APPROCHES } from './solutions-approches.js';
import { planComplet, executerEssai, rapportComparatif, PREFIXE_IDS } from './solutions-banc.js';

export function monterEcranSolutions({
  zone, essaiBrut, ouvrirStockage, confirmer = (t) => window.confirm(t),
  copier = (t) => navigator.clipboard.writeText(t), pause = (ms) => new Promise((ok) => setTimeout(ok, ms)),
}) {
  const $ = (s) => zone.querySelector(s);
  const etatTexte = $('[data-solutions-etat]');
  const bLancer = $('[data-solutions-lancer]');
  const bArreter = $('[data-solutions-arreter]');
  const bEffacer = $('[data-solutions-effacer]');
  const bCopier = $('[data-solutions-copier]');
  const avancement = $('[data-solutions-avancement]');

  const plan = planComplet(QUESTIONS, Object.keys(APPROCHES));
  let stockage = null;
  let enCours = false;
  let arreter = false;

  async function magasin() {
    if (!stockage) stockage = await ouvrirStockage();
    return stockage;
  }

  const idDe = ({ approche, q }) => `${PREFIXE_IDS}/${approche}/${q.id}`;

  async function faitsDuBanc() {
    const m = await magasin();
    const ids = new Set(plan.map(idDe));
    return (await m.listerEssais()).filter((e) => ids.has(e.id));
  }

  async function dessiner() {
    const faits = await faitsDuBanc();
    const restants = plan.length - faits.length;
    const appelsEstimes = plan.length + QUESTIONS.length * 2; // l'approche 3 fait 3 appels au lieu d'1
    etatTexte.textContent = `${Object.keys(APPROCHES).length} approches × ${QUESTIONS.length} questions = ${plan.length} essais. `
      + `Déjà faits : ${faits.length}. Restants : ${restants}. `
      + `Environ ${appelsEstimes} appels au moteur local, soit à peu près ${Math.round(appelsEstimes * 5 / 60)} à ${Math.round(appelsEstimes * 9 / 60)} minutes, écran allumé. `
      + `Mémoire de test isolée (${MEMOIRE_TEST.length} faits) : la mémoire réelle de Naissance n'est jamais utilisée ni modifiée.`;
    bLancer.textContent = faits.length === 0 ? 'Lancer le banc comparatif' : (restants > 0 ? 'Reprendre le banc comparatif' : 'Terminé — effacer pour relancer');
    bLancer.disabled = enCours || restants <= 0;
    bArreter.hidden = !enCours;
    bEffacer.disabled = enCours;
    bCopier.disabled = faits.length === 0;
  }

  async function boucle() {
    enCours = true;
    arreter = false;
    await dessiner();
    const m = await magasin();
    for (;;) {
      if (arreter) break;
      const dejaFaits = new Set((await faitsDuBanc()).map((e) => e.id));
      const restants = plan.filter((x) => !dejaFaits.has(idDe(x)));
      if (!restants.length) { avancement.textContent = 'Banc comparatif terminé.'; break; }
      const lot = restants.slice(0, 6);
      for (const { approche, q } of lot) {
        if (arreter) break;
        avancement.textContent = `${APPROCHES[approche]} — ${q.id} (${dejaFaits.size + 1} sur ${plan.length})…`;
        let resultat;
        try {
          resultat = await executerEssai({ approche, q, essai: essaiBrut, graine: GRAINE_COMPARAISON });
        } catch (e) {
          resultat = { id: idDe({ approche, q }), approche, questionId: q.id, question: q.question, categorie: q.categorie,
            date: new Date().toISOString(), succes: false, erreur: e.message || String(e),
            reponseBrute: '', sorties: [], faitAttendu: null, appelEvite: false,
            mesures: { faitCorrect: false, referentCorrect: false, aucuneInvention: false, ajouts: [], absenceReconnue: null, formatRespecte: false, mots: 0, appels: 0, dureeMs: 0 } };
        }
        await m.enregistrerEssai(resultat);
        dejaFaits.add(resultat.id);
      }
      if (arreter) { avancement.textContent = 'Banc arrêté — repartira du même point.'; break; }
      avancement.textContent = 'Pause entre deux lots…';
      // Pause découpée : un arrêt demandé pendant la pause est pris en compte tout de suite,
      // au lieu d'attendre la fin des 2,5 s puis d'afficher « Arrêt demandé… » indéfiniment.
      for (let reste = 2500; reste > 0 && !arreter; reste -= 250) await pause(250);
      if (arreter) { avancement.textContent = 'Banc arrêté — repartira du même point.'; break; }
    }
    enCours = false;
    await dessiner();
  }

  bLancer.addEventListener('click', () => { if (!enCours) boucle(); });
  bArreter.addEventListener('click', () => { arreter = true; avancement.textContent = 'Arrêt demandé…'; });
  bEffacer.addEventListener('click', async () => {
    if (enCours) return;
    if (!confirmer('Effacer les résultats du banc comparatif ? Naissance, sa mémoire et les résultats du grand banc ne changent pas.')) return;
    const m = await magasin();
    // On ne vide pas tout le journal : le grand banc partage la même base. On retire uniquement
    // les essais de ce banc-ci, reconnaissables à leur identifiant préfixé « solutions/ ».
    const faits = await faitsDuBanc();
    for (const e of faits) await m.supprimerEssai(e.id);
    avancement.textContent = `Résultats du banc comparatif effacés (${faits.length}). Le grand banc est intact.`;
    await dessiner();
  });
  bCopier.addEventListener('click', async () => {
    await copier(rapportComparatif(await faitsDuBanc()));
    avancement.textContent = 'Rapport comparatif copié dans le presse-papiers.';
  });

  return { rafraichir: dessiner };
}
// === FIN_SOLUTIONS_ECRAN ===
