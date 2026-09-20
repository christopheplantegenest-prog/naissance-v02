// === DEBUT_LANGAGE_ECRAN ===
// L'écran du langage propre à Naissance. Isolé du reste : ni la conversation normale, ni la
// mémoire réelle, ni LFM2 ne sont touchés. Tout ce qui s'y passe vit dans la base « naissance-langage ».
//
// Il est fait pour être OBSERVABLE : à chaque réponse, elle dit ce qu'elle a compris, quel fait
// elle a retrouvé, quelle règle (le cas échéant) a servi à choisir le possessif, et quel patron
// elle a utilisé. On voit donc toujours POURQUOI elle répond ça.

import {
  chargerEsprit, repondre, apprendreFait, apprendreMot, apprendreRelation, apprendrePropriete,
  apprendreRegle, apprendrePatron, expliquer, COMPRIS, PARTIEL,
} from './esprit.js';
import { noterIncomprise } from './connaissances.js';
import { tailleBagage } from './bagage.js';

export function monterEcranLangage({ zone, ouvrirStockage, confirmer = (t) => window.confirm(t) }) {
  const $ = (s) => zone.querySelector(s);
  const fil = $('[data-langage-fil]');
  const formulaire = $('[data-langage-formulaire]');
  const champ = $('[data-langage-question]');
  const etat = $('[data-langage-etat]');
  const bSavoir = $('[data-langage-savoir]');
  const bJournal = $('[data-langage-journal]');
  const bOublier = $('[data-langage-oublier]');
  const formFait = $('[data-langage-form-fait]');
  const formMot = $('[data-langage-form-mot]');
  const formRelation = $('[data-langage-form-relation]');
  const formPropriete = $('[data-langage-form-propriete]');
  const formRegle = $('[data-langage-form-regle]');
  const formPatron = $('[data-langage-form-patron]');

  let magasin = null;
  let esprit = null;

  async function assurer() {
    if (!esprit) {
      magasin = await ouvrirStockage();
      esprit = await chargerEsprit(magasin);
    }
    return esprit;
  }

  function ajouter(qui, texte, details = null) {
    const bloc = document.createElement('div');
    bloc.className = qui === 'moi' ? 'message message-moi' : 'message message-ia';
    const p = document.createElement('p');
    p.textContent = texte;
    bloc.appendChild(p);
    if (details) {
      const d = document.createElement('p');
      d.className = 'aide';
      d.textContent = details;
      bloc.appendChild(d);
    }
    fil.appendChild(bloc);
    fil.scrollTop = fil.scrollHeight;
  }

  async function dessiner() {
    const e = await assurer();
    const depart = tailleBagage();
    const reglesActives = e.regles.filter((r) => r.statut === 'validee').length;
    etat.textContent = `Elle connaît ${Object.keys(e.lexique).length} mots (${depart.mots} au départ), `
      + `${e.faits.size} faits (${depart.faits} au départ), `
      + `${e.patrons.length} façons de dire (${depart.patrons} au départ), `
      + `${[...e.proprietes.values()].reduce((n, m) => n + m.size, 0)} propriétés, `
      + `${reglesActives} règles actives.`;
  }

  formulaire.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const question = champ.value.trim();
    if (!question) return;
    champ.value = '';
    ajouter('moi', question);
    const e = await assurer();
    const r = repondre(e, question);
    const details = [
      expliquer(r.comprehension),
      r.fait ? `Fait retrouvé : ${r.fait.sujet} → ${r.fait.relation} → ${r.fait.valeur}.` : null,
      r.regleUtilisee ? `Règle utilisée pour le possessif : ${r.regleUtilisee.conditions.map((c) => `${c.propriete}=${c.valeur}`).join(', ')} → ${r.regleUtilisee.resultat}.` : null,
      r.patron ? `Façon de dire : ${r.patron.origine === 'appris' ? 'apprise' : 'de départ'} (${r.patron.gabarit}).` : null,
    ].filter(Boolean).join(' ');
    ajouter('ia', r.texte, details);
    let etatJournal = null;
    if (r.conflit) etatJournal = 'conflit';
    else if (r.regleManquante) etatJournal = 'regle-manquante';
    else if (r.etat !== COMPRIS || !r.fait) etatJournal = r.etat === COMPRIS ? 'fait-manquant' : r.etat;
    if (etatJournal) {
      await noterIncomprise(magasin, {
        phrase: question, etat: etatJournal,
        sujet: r.comprehension.sujet, relation: r.comprehension.relation,
        motsInconnus: r.comprehension.motsInconnus,
      });
    }
    await dessiner();
  });

  formFait.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = new FormData(formFait);
    const e = await assurer();
    try {
      const r = await apprendreFait(e, {
        sujet: String(d.get('sujet')).trim(), relation: String(d.get('relation')).trim().toLowerCase(), valeur: String(d.get('valeur')).trim(),
      });
      ajouter('ia', r.explication);
      formFait.reset();
    } catch (err) { ajouter('ia', err.message); }
    await dessiner();
  });

  formMot.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = new FormData(formMot);
    const e = await assurer();
    try {
      const r = await apprendreMot(e, { motNouveau: String(d.get('nouveau')), motConnu: String(d.get('connu')) });
      ajouter('ia', r.explication);
      formMot.reset();
    } catch (err) { ajouter('ia', err.message); }
    await dessiner();
  });

  formRelation.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = new FormData(formRelation);
    const e = await assurer();
    try {
      const r = await apprendreRelation(e, { mot: String(d.get('mot')), relation: String(d.get('relation')) });
      ajouter('ia', r.explication);
      formRelation.reset();
    } catch (err) { ajouter('ia', err.message); }
    await dessiner();
  });

  formPropriete.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = new FormData(formPropriete);
    const e = await assurer();
    try {
      const r = await apprendrePropriete(e, { mot: String(d.get('mot')), propriete: String(d.get('propriete')), valeur: String(d.get('valeur')) });
      ajouter('ia', r.explication);
      formPropriete.reset();
    } catch (err) { ajouter('ia', err.message); }
    await dessiner();
  });

  formRegle.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = new FormData(formRegle);
    const e = await assurer();
    try {
      const r = await apprendreRegle(e, {
        role: String(d.get('role')).trim(),
        conditions: [{ propriete: String(d.get('propriete')).trim().toLowerCase(), valeur: String(d.get('valeurPropriete')).trim().toLowerCase() }],
        resultat: String(d.get('resultat')).trim(),
        exemple: String(d.get('exemple') || '').trim() || null,
      });
      ajouter('ia', r.explication);
      formRegle.reset();
    } catch (err) { ajouter('ia', err.message); }
    await dessiner();
  });

  formPatron.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = new FormData(formPatron);
    const e = await assurer();
    try {
      const r = await apprendrePatron(e, {
        correction: String(d.get('correction')), sujet: String(d.get('sujet')).trim(),
        relation: String(d.get('relation')).trim().toLowerCase(),
        portee: d.get('portee') === 'toutes' ? 'toutes' : 'relation',
        dynamiserPossessif: d.get('possessif') === 'oui',
      });
      ajouter('ia', r.explication);
      formPatron.reset();
    } catch (err) { ajouter('ia', err.message); }
    await dessiner();
  });

  bSavoir.addEventListener('click', async () => {
    const e = await assurer();
    const lignes = ['— Ce que je sais —'];
    for (const f of e.faits.values()) lignes.push(`${f.sujet} → ${f.relation} → ${f.valeur}`);
    lignes.push('— Mes propriétés —');
    for (const [mot, props] of e.proprietes) for (const [p, v] of props) lignes.push(`${mot} → ${p} → ${v}`);
    lignes.push('— Mes règles —');
    for (const r of e.regles) {
      lignes.push(`[${r.statut}] ${r.role} : ${r.conditions.map((c) => `${c.propriete}=${c.valeur}`).join(', ')} → ${r.resultat}`
        + `${r.precedente ? ' (remplace une règle précédente)' : ''}`);
    }
    lignes.push('— Mes façons de dire —');
    for (const p of e.patrons) lignes.push(`${p.relation === '*' ? 'toutes' : p.relation} : ${p.gabarit}${p.origine === 'appris' ? ' (appris)' : ''}`);
    ajouter('ia', lignes.join('\n'));
  });

  bJournal.addEventListener('click', async () => {
    await assurer();
    const entrees = await magasin.lireTout('journal');
    if (!entrees.length) { ajouter('ia', 'Rien : j’ai compris tout ce que tu m’as dit jusqu’ici.'); return; }
    const lignes = ['— Ce que je n’ai pas su traiter —'];
    const CAUSES = {
      'fait-manquant': 'comprise, mais je ne sais pas la réponse',
      [PARTIEL]: 'comprise à moitié',
      'regle-manquante': 'comprise, mais je ne sais pas comment le dire',
      conflit: 'comprise, mais deux règles se contredisent',
    };
    for (const e of entrees.sort((a, b) => b.fois - a.fois)) {
      const cause = CAUSES[e.etat] || 'pas comprise';
      lignes.push(`« ${e.phrase} » — ${cause} (${e.fois} fois)${e.motsInconnus.length ? ` — mots inconnus : ${e.motsInconnus.join(', ')}` : ''}`);
    }
    ajouter('ia', lignes.join('\n'));
  });

  bOublier.addEventListener('click', async () => {
    if (!confirmer('Tout effacer de ce qu’elle a appris ici ? Sa mémoire réelle et sa conversation ne changent pas.')) return;
    await assurer();
    await magasin.vider();
    esprit = await chargerEsprit(magasin);
    ajouter('ia', 'J’ai tout oublié de ce que tu m’as appris ici. Je repars avec mon bagage de départ.');
    await dessiner();
  });

  return { rafraichir: dessiner };
}
// === FIN_LANGAGE_ECRAN ===
