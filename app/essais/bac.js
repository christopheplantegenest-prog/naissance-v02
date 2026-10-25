// === DEBUT_ESSAIS_BAC ===
// v0.66.8 — ATELIER 2, L3 : BAC D'ESSAI = script du Worker (module) dans lequel s'exécute UNE capacité, UNE fois (mécanisme technique, non
// cognitif ; protégé : app/essais/). Un Worker neuf par exécution : realm séparé (aucun accès aux objets, au DOM, au localStorage ni à la
// mémoire de l'application), état jamais partagé d'une exécution à l'autre, et la porte peut le TERMINER à tout instant (délai, coupure) :
// tout ce qu'il aurait lancé (promesses, boucles) disparaît avec lui.
// Protocole : la porte envoie UN message { module, entree } ; le bac verrouille son realm (verrou.js), charge le module de la capacité,
// appelle executer(entree) de façon SYNCHRONE et renvoie UN message :
//   { type: 'resultat', sortie } | { type: 'exception', message } | { type: 'asynchrone' } | { type: 'forme', message } | { type: 'verrou', restants }
// Le bac n'écrit rien nulle part : seule la porte, dans l'application, décide d'écrire (ou non) ce qu'il rend, dans la zone d'essai.
import { verrouiller } from './verrou.js';

const repondre = globalThis.postMessage.bind(globalThis);
const ici = import.meta.url;
const resoudre = (m) => new URL(m, ici).href;
const texte = (e) => { try { return String(e && e.message ? e.message : e).slice(0, 200); } catch { return 'exception illisible'; } };
let recu = false;

globalThis.onmessage = async (ev) => {
  if (recu) return;
  recu = true;
  const donnees = ev && ev.data;
  if (!donnees || typeof donnees.module !== 'string') { repondre({ type: 'forme', message: 'message du bac illisible' }); return; }
  let url;
  try { url = resoudre(donnees.module); } catch { repondre({ type: 'forme', message: 'module illisible' }); return; }
  const entree = donnees.entree;
  const { restants } = verrouiller(globalThis);
  if (restants.length) { repondre({ type: 'verrou', restants: restants.slice(0, 20) }); return; }
  let mod;
  try { mod = await import(url); } catch (e) { repondre({ type: 'exception', message: `chargement : ${texte(e)}` }); return; }
  if (!mod || typeof mod.executer !== 'function') { repondre({ type: 'forme', message: 'executer absent' }); return; }
  let sortie;
  try { sortie = mod.executer(entree); } catch (e) { repondre({ type: 'exception', message: texte(e) }); return; }
  let promesse = false;
  try { promesse = sortie !== null && (typeof sortie === 'object' || typeof sortie === 'function') && typeof sortie.then === 'function'; } catch { promesse = true; }
  if (promesse) { repondre({ type: 'asynchrone' }); return; }
  try { repondre({ type: 'resultat', sortie }); } catch (e) { repondre({ type: 'forme', message: `résultat non transmissible : ${texte(e)}` }); }
};
// === FIN_ESSAIS_BAC ===
