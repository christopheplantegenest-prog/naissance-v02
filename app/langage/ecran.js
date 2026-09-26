// === DEBUT_LANGAGE_ECRAN ===
// L'écran du langage propre à Naissance. Isolé du reste : ni la conversation normale, ni la
// mémoire réelle, ni LFM2 ne sont touchés. Tout ce qui s'y passe vit dans la base « naissance-langage ».
//
// Il est fait pour être OBSERVABLE : à chaque réponse, elle dit ce qu'elle a compris, quel fait
// elle a retrouvé, quelle règle (le cas échéant) a servi à choisir le possessif, et quel patron
// elle a utilisé. On voit donc toujours POURQUOI elle répond ça.

import {
  chargerEsprit, repondre, apprendreFait, apprendreMot, apprendreRelation, apprendrePropriete,
  apprendreRegle, apprendreGabaritType, apprendrePatron, apprendrePatronDirect, oublierPatron, oublierFait, oublierPropriete,
  oublierRelation, oublierRegle, expliquer, COMPRIS, PARTIEL,
} from './esprit.js';
import { induire, repererMotifs, repartirMotifsParEtat, chronologieMotifs } from './induction.js';
import { extraireLecon, apercuLecon, TYPES_LECON, reconstruireLeconRegle } from './lecon.js';
import { demanderEnseignement } from './gemini-professeur.js';
import { noterIncomprise, preparerEntreesInduction } from './connaissances.js';
import { tailleBagage, ROLES, LEXIQUE_DEPART } from './bagage.js';
import { verifierCours, donnerCours, testerCours, formaterApercu, formaterRapport } from './cours.js';
import { VERSION } from '../version.js';

export function monterEcranLangage({ zone, ouvrirStockage, confirmer = (t) => window.confirm(t), appelerGemini = null, copier = (t) => navigator.clipboard.writeText(t) }) {
  const $ = (s) => zone.querySelector(s);
  const fil = $('[data-langage-fil]');
  const formulaire = $('[data-langage-formulaire]');
  const champ = $('[data-langage-question]');
  const etat = $('[data-langage-etat]');
  const bSavoir = $('[data-langage-savoir]');
  const bGererTout = $('[data-langage-gerer-tout]');
  const zoneListeTout = $('[data-langage-liste-tout]');
  const bJournal = $('[data-langage-journal]');
  const bOublier = $('[data-langage-oublier]');
  const formFait = $('[data-langage-form-fait]');
  const formMot = $('[data-langage-form-mot]');
  const formRelation = $('[data-langage-form-relation]');
  const formPropriete = $('[data-langage-form-propriete]');
  const formRegle = $('[data-langage-form-regle]');
  const formLecon = $('[data-langage-form-lecon]');
  const zoneConfirmation = $('[data-langage-confirmation]');
  const texteConfirmation = $('[data-langage-confirmation-texte]');
  const bConfirmer = $('[data-langage-confirmer]');
  const bAnnuler = $('[data-langage-annuler]');
  const formPatron = $('[data-langage-form-patron]');
  const formEnseignement = $('[data-langage-form-enseignement]');
  const etatGemini = $('[data-langage-gemini-etat]');
  const zoneNote = $('[data-langage-gemini-note]');
  const texteNote = $('[data-langage-gemini-note-texte]');
  const zoneRejetees = $('[data-langage-gemini-rejetees]');
  const listeRejetees = $('[data-langage-gemini-rejetees-liste]');
  const zoneCandidats = $('[data-langage-gemini-candidats]');
  const bTestPrerequis = $('[data-langage-test-prerequis]');
  const bTestSujet = $('[data-langage-test-sujet]');
  const bTestQuestion = $('[data-langage-test-question]');
  const bTestXyzz = $('[data-langage-test-xyzz]');
  const bTestGrbl = $('[data-langage-test-grbl]');
  const bTestSequence = $('[data-langage-test-sequence]');
  const etatTest = $('[data-langage-test-etat]');
  const champCours = $('[data-langage-cours-texte]');
  const bCoursVerifier = $('[data-langage-cours-verifier]');
  const bCoursConfirmer = $('[data-langage-cours-confirmer]');
  const bCoursTester = $('[data-langage-cours-tester]');
  const bCoursCopier = $('[data-langage-cours-copier]');
  const etatCours = $('[data-langage-cours-etat]');
  const apercuCours = $('[data-langage-cours-apercu]');
  const rapportCours = $('[data-langage-cours-rapport]');
  const champInductionPositifs = $('[data-langage-induction-positifs]');
  const champInductionNegatifs = $('[data-langage-induction-negatifs]');
  const champInductionSignification = $('[data-langage-induction-signification]');
  const bInductionLancer = $('[data-langage-induction-lancer]');
  const bInductionConfirmer = $('[data-langage-induction-confirmer]');
  const bInductionAnnuler = $('[data-langage-induction-annuler]');
  const etatInduction = $('[data-langage-induction-etat]');
  const rapportInduction = $('[data-langage-induction-rapport]');
  const champInductionTestTexte = $('[data-langage-induction-test-texte]');
  const bInductionTestLancer = $('[data-langage-induction-test-lancer]');
  const resultatInductionTest = $('[data-langage-induction-test-resultat]');
  const bExperiencesLister = $('[data-langage-experiences-lister]');
  const etatExperiences = $('[data-langage-experiences-etat]');
  const rapportExperiences = $('[data-langage-experiences-rapport]');
  const champSelectionPositifs = $('[data-langage-selection-positifs]');
  const champSelectionNegatifs = $('[data-langage-selection-negatifs]');
  const bSelectionEnvoyer = $('[data-langage-selection-envoyer]');
  const etatSelection = $('[data-langage-selection-etat]');

  let magasin = null;
  let esprit = null;
  let leconEnAttente = null;

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
    // v0.17.1 — compteur de faits = nombre de LIGNES réellement en jeu (diagnosticFaits.lignes),
    // pas le nombre d'identités : une identité en conflit correspond à plusieurs lignes.
    etat.textContent = `Elle connaît ${Object.keys(e.lexique).length} mots (${depart.mots} au départ), `
      + `${e.diagnosticFaits.lignes} faits (${depart.faits} au départ), `
      + `${e.patrons.length} façons de dire (${depart.patrons} au départ), `
      + `${[...e.proprietes.values()].reduce((n, m) => n + m.size, 0)} propriétés, `
      + `${reglesActives} règles actives.`
      + (e.diagnosticFaits.conflits ? ` ${e.diagnosticFaits.conflits} conflit${e.diagnosticFaits.conflits > 1 ? 's' : ''} de faits.` : '')
      + (e.diagnosticFaits.ancienneGraphie ? ` ${e.diagnosticFaits.ancienneGraphie} fait${e.diagnosticFaits.ancienneGraphie > 1 ? 's' : ''} enregistré${e.diagnosticFaits.ancienneGraphie > 1 ? 's' : ''} sous une ancienne graphie.` : '');
  }

  formulaire.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const question = champ.value.trim();
    if (!question) return;
    champ.value = '';
    ajouter('moi', question);
    // Une question ne doit JAMAIS échouer en silence : si quelque chose se passe mal, on le montre,
    // au lieu de laisser l'écran sans réponse sans que Christophe sache pourquoi.
    try {
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
      else if (r.conflitPatron) etatJournal = 'conflit-patron';
      else if (r.regleManquante) etatJournal = 'regle-manquante';
      else if (r.etat !== COMPRIS || !r.fait) etatJournal = r.etat === COMPRIS ? 'fait-manquant' : r.etat;
      if (etatJournal) {
        await noterIncomprise(magasin, {
          phrase: question, etat: etatJournal,
          sujet: r.comprehension.sujet, relation: r.comprehension.relation,
          motsInconnus: r.comprehension.motsInconnus,
        });
      }
    } catch (err) {
      ajouter('ia', `(Un problème technique m'a empêchée de répondre : ${err.message})`);
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
        conditions: [{ propriete: String(d.get('propriete')).trim(), valeur: String(d.get('valeurPropriete')).trim() }],
        resultat: String(d.get('resultat')).trim(),
        exemple: String(d.get('exemple') || '').trim() || null,
      });
      ajouter('ia', r.explication);
      formRegle.reset();
    } catch (err) { ajouter('ia', err.message); }
    await dessiner();
  });

  // Le canal pédagogique (v0.11, généralisé en v0.12 à quatre types) : une phrase à forme fixe,
  // jamais devinée si elle ne la respecte pas. Rien n'est enregistré avant confirmation explicite —
  // c'est ce qui permet de voir une mauvaise interprétation AVANT qu'elle n'entre en mémoire.
  formLecon.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = new FormData(formLecon);
    const texteLecon = String(d.get('lecon')).trim();
    formLecon.reset();
    const extrait = extraireLecon(texteLecon);
    if (!extrait) {
      const formes = Object.values(TYPES_LECON).map((f) => `\n• ${f}`).join('');
      ajouter('ia', `Je ne reconnais pas cette forme de leçon. Les formes que je comprends sont :${formes}`);
      return;
    }
    leconEnAttente = { ...extrait, texteLecon };
    texteConfirmation.textContent = apercuLecon(extrait);
    zoneConfirmation.hidden = false;
  });

  // Dispatch vers le mécanisme d'apprentissage EXISTANT correspondant au type reconnu — aucune de
  // ces quatre fonctions n'est réécrite pour le canal pédagogique, seul l'aiguillage est nouveau.
  // Partagé entre une leçon tapée par Christophe et une leçon proposée par Gemini (v0.13) : le
  // chemin d'écriture est rigoureusement le même, seule l'origine tracée diffère.
  async function ecrireConnaissance(e, { type, donnees }, { origine, exemple } = {}) {
    if (type === 'relation') return apprendreRelation(e, donnees);
    if (type === 'fait') return apprendreFait(e, donnees);
    if (type === 'propriete') return apprendrePropriete(e, { ...donnees, origine: origine || 'apprise-christophe' });
    if (type === 'regle') return apprendreRegle(e, { ...donnees, origine: origine || 'apprise-christophe', exemple: exemple || null });
    if (type === 'patron') return apprendrePatronDirect(e, donnees);
    throw new Error('Type de leçon inconnu.');
  }

  bConfirmer.addEventListener('click', async () => {
    if (!leconEnAttente) return;
    const { type, donnees, texteLecon } = leconEnAttente;
    const e = await assurer();
    try {
      const r = await ecrireConnaissance(e, { type, donnees }, { origine: 'apprise-lecon', exemple: texteLecon });
      ajouter('ia', r.explication);
    } catch (err) { ajouter('ia', err.message); }
    leconEnAttente = null;
    zoneConfirmation.hidden = true;
    await dessiner();
  });

  bAnnuler.addEventListener('click', () => {
    leconEnAttente = null;
    zoneConfirmation.hidden = true;
    ajouter('ia', "D'accord, je n'ai rien retenu de cette leçon.");
  });

  // --- Gemini comme professeur ponctuel (v0.13) ---------------------------------------------------
  // Gemini n'est jamais considéré comme fiable par défaut : chaque ligne reçue repasse par le même
  // extraireLecon() qu'une leçon tapée à la main (voir demanderEnseignement, gemini-professeur.js).
  // Plusieurs propositions peuvent arriver à la fois ; chacune reste confirmée ou rejetée
  // individuellement, jamais en bloc.
  function afficherCandidatGemini({ texte, extrait }) {
    const bloc = document.createElement('div');
    bloc.className = 'candidat-gemini';
    const p = document.createElement('p');
    p.className = 'aide';
    p.textContent = apercuLecon(extrait);
    bloc.appendChild(p);
    const ligne = document.createElement('div');
    ligne.className = 'ligne';
    const bOk = document.createElement('button');
    bOk.type = 'button'; bOk.className = 'bouton-principal'; bOk.textContent = 'Confirmer';
    const bNon = document.createElement('button');
    bNon.type = 'button'; bNon.className = 'bouton-secondaire'; bNon.textContent = 'Rejeter';
    ligne.appendChild(bOk); ligne.appendChild(bNon);
    bloc.appendChild(ligne);
    bOk.addEventListener('click', async () => {
      const e = await assurer();
      try {
        const r = await ecrireConnaissance(e, extrait, { origine: 'apprise-gemini', exemple: texte });
        ajouter('ia', r.explication);
      } catch (err) { ajouter('ia', err.message); }
      bloc.remove();
      await dessiner();
    });
    bNon.addEventListener('click', () => bloc.remove());
    zoneCandidats.appendChild(bloc);
  }

  if (formEnseignement) {
    formEnseignement.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const sujet = String(new FormData(formEnseignement).get('sujet')).trim();
      if (!sujet) return;
      zoneNote.hidden = true;
      zoneRejetees.hidden = true;
      zoneCandidats.textContent = '';
      etatGemini.textContent = 'Je demande à Gemini…';
      try {
        if (!appelerGemini) throw new Error("Aucun professeur externe n'est disponible ici.");
        const e = await assurer();
        // Un exemple de ce que Naissance sait déjà, dans son propre format — pour ancrer le
        // vocabulaire de Gemini (même rôle, même propriété) sans jamais lui faire confiance pour
        // autant : la vérification par extraireLecon() reste la même, avec ou sans exemple.
        const exemplesConnus = e.regles
          .filter((r) => r.statut === 'validee' && r.role === 'possessif_toi')
          .map((r) => reconstruireLeconRegle(r));
        const { note, reconnues, rejetees } = await demanderEnseignement({ sujet, exemplesConnus, appelerGemini });
        etatGemini.textContent = reconnues.length || rejetees.length
          ? `Gemini a proposé ${reconnues.length + rejetees.length} ligne(s) : ${reconnues.length} reconnue(s), ${rejetees.length} refusée(s).`
          : 'Gemini n’a proposé aucune leçon exploitable cette fois.';
        if (note) { texteNote.textContent = note; zoneNote.hidden = false; }
        if (rejetees.length) {
          listeRejetees.textContent = '';
          for (const r of rejetees) {
            const li = document.createElement('li');
            li.textContent = r;
            listeRejetees.appendChild(li);
          }
          zoneRejetees.hidden = false;
        }
        for (const candidat of reconnues) afficherCandidatGemini(candidat);
      } catch (err) {
        etatGemini.textContent = `Je n'ai pas pu obtenir d'enseignement : ${err.message}`;
      }
    });
  }

  // --- Protocole de test rapide (v0.13) : réduit la recopie, jamais l'écriture réelle -------------
  // Chaque bouton PRÉREMPLIT ou exécute un geste normal — rien n'est simulé, rien n'est caché.
  if (bTestPrerequis) {
    bTestPrerequis.addEventListener('click', async () => {
      const e = await assurer();
      const faits = [];
      try {
        await apprendreRelation(e, { mot: 'stylo', relation: 'stylo' }); faits.push('relation « stylo »');
        await apprendreFait(e, { sujet: 'moi', relation: 'stylo', valeur: 'un Bic' }); faits.push('fait moi/stylo/un Bic');
        await apprendrePropriete(e, { mot: 'stylo', propriete: 'genre', valeur: 'masculin' }); faits.push('propriété stylo/genre/masculin');
        await apprendrePatron(e, { correction: 'Ta stylo, c’est un Bic.', sujet: 'moi', relation: 'stylo', portee: 'toutes', dynamiserPossessif: true });
        faits.push('façon de dire générale (possessif calculé)');
        etatTest.textContent = `Prérequis prêts : ${faits.join(', ')}.`;
      } catch (err) {
        etatTest.textContent = `Interrompu après « ${faits.join(', ') || 'rien'} » : ${err.message}`;
      }
      await dessiner();
    });
  }
  if (bTestSujet) {
    bTestSujet.addEventListener('click', () => {
      const champSujet = zone.querySelector('[data-langage-form-enseignement] [name=sujet]');
      if (champSujet) champSujet.value = 'le possessif masculin : comment dit-on « ton » plutôt que « ta » devant un nom masculin en français ?';
      etatTest.textContent = 'Sujet prérempli : ouvre « Demander un enseignement à Gemini » ci-dessus et appuie sur Demander.';
    });
  }
  if (bTestQuestion) {
    bTestQuestion.addEventListener('click', () => {
      champ.value = 'Quel est mon stylo ?';
      etatTest.textContent = 'Question préremplie tout en haut : appuie sur Demander.';
    });
  }

  // Chantier 2 (v0.14.1) : préparer un rôle jamais codé en JavaScript, de bout en bout, par les
  // vrais mécanismes (relation, fait, propriété, règle, patron) — un seul tap, une vraie écriture.
  // Patron délibérément SPÉCIFIQUE (portee: 'relation', pas 'toutes') : une façon de dire générale
  // existe déjà en mémoire depuis les chantiers précédents, et la rendre générale aussi créerait
  // un conflit qui n'aurait rien à voir avec ce qu'on teste ici.
  async function preparerTestRole({ role, resultat, mot, valeurFait, propriete, valeurPropriete }) {
    const e = await assurer();
    const etapes = [];
    try {
      await apprendreRelation(e, { mot, relation: mot }); etapes.push(`relation « ${mot} »`);
      await apprendreFait(e, { sujet: 'moi', relation: mot, valeur: valeurFait }); etapes.push('fait');
      await apprendrePropriete(e, { mot, propriete, valeur: valeurPropriete }); etapes.push('propriété');
      await apprendreRegle(e, { role, conditions: [{ propriete, valeur: valeurPropriete }], resultat }); etapes.push(`règle « ${role} »`);
      await apprendrePatron(e, { correction: `{${role}} ${mot}, c’est ${valeurFait}.`, sujet: 'moi', relation: mot });
      etapes.push('façon de dire (spécifique à ce mot)');
      etatTest.textContent = `Prêt : ${etapes.join(', ')}. Demande maintenant « Quel est mon ${mot} ? » — attendu : « ${resultat} ${mot}, c’est ${valeurFait}. »`;
    } catch (err) {
      etatTest.textContent = `Interrompu après « ${etapes.join(', ') || 'rien'} » : ${err.message}`;
    }
    await dessiner();
  }
  if (bTestXyzz) {
    bTestXyzz.addEventListener('click', () => preparerTestRole({
      role: 'xyzz', resultat: 'QUD', mot: 'gadget', valeurFait: 'un widget', propriete: 'attribut', valeurPropriete: 'zorx',
    }));
  }
  if (bTestGrbl) {
    bTestGrbl.addEventListener('click', () => preparerTestRole({
      role: 'grbl', resultat: 'PLOP', mot: 'artefact', valeurFait: 'un item', propriete: 'marque', valeurPropriete: 'bar',
    }));
  }

  // Chantier « patrons pédagogiques » (v0.14.2) : contrairement aux préréglages ci-dessus, celui-ci
  // ne PRÉPARE rien directement — il préremplit le champ « Une leçon » avec la phrase suivante d'une
  // séquence, mais chaque écriture (y compris la façon de dire) doit encore passer par le vrai
  // canal : Proposer, puis Confirmer. C'est précisément ce que ce test démontre, donc rien ne doit
  // le contourner. Aucun bouton d'installation manuelle du patron n'existe ici, volontairement.
  const SEQUENCE_TEST_PATRON = [
    'Mot : gadget désigne gadget.',
    'Fait : moi / gadget / un widget.',
    'Propriété : gadget / attribut / zorx.',
    'Pour blurf : si attribut vaut zorx, on dit ZAP.',
    'Façon de dire : gadget / moi / {blurf} gadget, c’est {valeur}.',
    'Mot : chose désigne chose.',
    'Fait : moi / chose / un item.',
    'Propriété : chose / truc / bar.',
    'Pour nork : si truc vaut bar, on dit YOP.',
    'Façon de dire : chose / moi / {nork} chose, c’est {valeur}.',
  ];
  let indexSequenceTest = 0;
  if (bTestSequence) {
    bTestSequence.addEventListener('click', () => {
      const champLecon = zone.querySelector('[data-langage-form-lecon] [name=lecon]');
      if (indexSequenceTest >= SEQUENCE_TEST_PATRON.length) {
        etatTest.textContent = 'Séquence terminée : demande « Quel est mon gadget ? » puis « Quelle est ma chose ? » tout en haut.';
        indexSequenceTest = 0;
        return;
      }
      if (champLecon) champLecon.value = SEQUENCE_TEST_PATRON[indexSequenceTest];
      etatTest.textContent = `Leçon ${indexSequenceTest + 1}/${SEQUENCE_TEST_PATRON.length} prête dans « Une leçon » ci-dessus : appuie sur « Proposer cette leçon », puis « Confirmer ». Reviens ici ensuite pour la suivante.`;
      indexSequenceTest++;
    });
  }

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
    for (const candidats of e.conflitsFaits.values()) {
      lignes.push(`${candidats[0].sujet} → ${candidats[0].relation} → [CONFLIT : ${candidats.map((c) => c.valeur).join(' / ')}]`);
    }
    lignes.push('— Mes propriétés —');
    for (const [mot, props] of e.proprietes) for (const [p, v] of props) lignes.push(`${mot} → ${p} → ${v}`);
    lignes.push('— Mes règles —');
    for (const r of e.regles) {
      lignes.push(`[${r.statut}] ${r.role} : ${r.conditions.map((c) => `${c.propriete}=${c.valeur}`).join(', ')} → ${r.resultat}`
        + ` (${r.origine})${r.precedente ? ' — remplace une règle précédente' : ''}`);
    }
    lignes.push('— Mes façons de dire —');
    for (const p of e.patrons) lignes.push(`${p.relation === '*' ? 'toutes' : p.relation} : ${p.gabarit}${p.origine === 'appris' ? ' (appris)' : ''}`);
    ajouter('ia', lignes.join('\n'));
  });

  // Les façons de dire n'ont pas de mécanisme de version (contrairement aux règles) : en réapprendre
  // une n'efface jamais l'ancienne, ce qui peut en laisser deux générales se contredire. Ce panneau
  // permet de retirer UNE SEULE façon de dire précise, sans toucher au reste — l'alternative,
  // « Tout lui faire oublier », efface tout, ce qui est disproportionné pour ce cas.
  // Panneau unique « Gérer ce qu'elle sait » (v0.14) : les cinq types de connaissances à la suite,
  // chacun avec un retrait ciblé quand c'est possible. Le bagage de départ n'a jamais de bouton :
  // il n'existe pas en base, le « retirer » n'y survivrait pas à un redémarrage.
  function ligneGestion(texte, onRetrait) {
    const bloc = document.createElement('div');
    bloc.className = 'ligne-patron';
    const p = document.createElement('p');
    p.className = 'aide';
    p.textContent = texte;
    bloc.appendChild(p);
    if (onRetrait) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bouton-secondaire';
      b.textContent = 'Oublier';
      b.addEventListener('click', onRetrait);
      bloc.appendChild(b);
    }
    zoneListeTout.appendChild(bloc);
  }
  function titreGestion(texte) {
    const p = document.createElement('p');
    p.className = 'aide';
    const strong = document.createElement('strong');
    strong.textContent = texte;
    p.appendChild(strong);
    zoneListeTout.appendChild(p);
  }

  bGererTout.addEventListener('click', async () => {
    const e = await assurer();
    zoneListeTout.textContent = '';

    titreGestion('Mots qu\'elle connaît (informations et synonymes)');
    for (const [mot, entree] of Object.entries(e.lexique)) {
      if (entree.role !== ROLES.RELATION) continue;
      const appris = !LEXIQUE_DEPART[mot];
      ligneGestion(`${mot} → ${entree.relation}${appris ? ' (apprise)' : ' (de départ)'}`, appris ? async () => {
        if (!confirmer(`Oublier que « ${mot} » désigne une information ? Les faits et propriétés déjà donnés à son sujet resteront en mémoire, réutilisables si tu réenseignes ce mot.`)) return;
        try { const r = await oublierRelation(e, mot); ajouter('ia', r.explication); } catch (err) { ajouter('ia', err.message); }
        bGererTout.click();
        await dessiner();
      } : null);
    }

    titreGestion('Faits');
    for (const f of e.faits.values()) {
      ligneGestion(`${f.sujet} → ${f.relation} → ${f.valeur}`, async () => {
        if (!confirmer(`Oublier ce fait : ${f.sujet} → ${f.relation} → ${f.valeur} ?`)) return;
        try { const r = await oublierFait(e, { sujet: f.sujet, relation: f.relation }); ajouter('ia', r.explication); } catch (err) { ajouter('ia', err.message); }
        bGererTout.click();
        await dessiner();
      });
    }
    // v0.17.1 — un conflit vient de PLUSIEURS lignes réellement stockées pour la même identité
    // (héritées d'avant cette version). Chacune reste visible, avec son propre Oublier ciblé par sa
    // clé de ligne : jamais de choix automatique entre elles.
    for (const [, candidats] of e.conflitsFaits) {
      for (const ligne of candidats) {
        ligneGestion(`[CONFLIT] ${ligne.sujet} → ${ligne.relation} → ${ligne.valeur}`, async () => {
          if (!confirmer(`Oublier cette ligne en conflit : ${ligne.sujet} → ${ligne.relation} → ${ligne.valeur} ?`)) return;
          try {
            const r = await oublierFait(e, { sujet: ligne.sujet, relation: ligne.relation, cle: ligne.cle });
            ajouter('ia', r.explication);
          } catch (err) { ajouter('ia', err.message); }
          bGererTout.click();
          await dessiner();
        });
      }
    }

    titreGestion('Propriétés');
    for (const [mot, props] of e.proprietes) {
      for (const [prop, valeur] of props) {
        ligneGestion(`${mot} → ${prop} → ${valeur}`, async () => {
          if (!confirmer(`Oublier cette propriété : ${mot} → ${prop} → ${valeur} ?`)) return;
          try { const r = await oublierPropriete(e, { mot, propriete: prop }); ajouter('ia', r.explication); } catch (err) { ajouter('ia', err.message); }
          bGererTout.click();
          await dessiner();
        });
      }
    }

    titreGestion('Règles');
    for (const r of e.regles) {
      const texte = `[${r.statut}] ${r.role} : ${r.conditions.map((c) => `${c.propriete}=${c.valeur}`).join(', ')} → ${r.resultat} (${r.origine})`;
      ligneGestion(texte, r.statut === 'validee' ? async () => {
        if (!confirmer(`Désactiver cette règle : ${r.role} → ${r.resultat} ? Son historique reste consultable, elle ne sera simplement plus utilisée.`)) return;
        try { const res = await oublierRegle(e, r.id); ajouter('ia', res.explication); } catch (err) { ajouter('ia', err.message); }
        bGererTout.click();
        await dessiner();
      } : null);
    }

    titreGestion('Façons de dire');
    for (const patron of e.patrons) {
      const appris = patron.origine === 'appris';
      ligneGestion(`${patron.relation === '*' ? 'toutes les informations' : patron.relation} : ${patron.gabarit}${appris ? ' (apprise)' : ' (de départ)'}`, appris ? async () => {
        if (!confirmer(`Oublier cette façon de dire : « ${patron.gabarit} » ?`)) return;
        try { const r = await oublierPatron(e, patron.id); ajouter('ia', r.explication); } catch (err) { ajouter('ia', err.message); }
        bGererTout.click();
        await dessiner();
      } : null);
    }
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
      'conflit-patron': 'comprise, mais deux façons de dire se contredisent',
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

  // --- v0.17 : « Donner un cours » ------------------------------------------------------------------------
  // Une leçon groupée collée depuis ChatGPT / Claude (format et logique : cours.js, module pur). Ici, seulement
  // le câblage : Vérifier (aucune écriture) → Confirmer la leçon (UNE confirmation) ; « Tester seulement »
  // n'écrit rien. Le Décor n'est jamais écrit dans la vraie base. Les exercices passent par repondre().
  let coursVerifie = null;
  let dernierRapport = '';
  const boutonsCours = [bCoursVerifier, bCoursConfirmer, bCoursTester];

  function afficherRapport(res) {
    dernierRapport = formaterRapport(res, { version: VERSION });
    rapportCours.textContent = dernierRapport;
    rapportCours.hidden = false;
    bCoursCopier.disabled = false;
  }
  async function contexteCours() {
    const e = await assurer();
    return { magasin, esprit: e, ecrire: ecrireConnaissance };
  }
  async function executerCours(action) {
    boutonsCours.forEach((b) => { b.disabled = true; });
    try { await action(); } catch (err) {
      etatCours.textContent = `Un problème technique m'a arrêtée : ${err && err.message ? err.message : err}`;
    } finally {
      bCoursVerifier.disabled = false;
      bCoursTester.disabled = false;
      bCoursConfirmer.disabled = coursVerifie === null;
    }
  }

  champCours.addEventListener('input', () => {
    if (coursVerifie !== null && champCours.value !== coursVerifie) {
      coursVerifie = null;
      bCoursConfirmer.disabled = true;
      etatCours.textContent = 'Le texte a changé : vérifie-le à nouveau avant de confirmer.';
    }
  });

  bCoursVerifier.addEventListener('click', () => executerCours(async () => {
    coursVerifie = null;
    const texte = champCours.value;
    const v = await verifierCours(texte, await contexteCours());
    apercuCours.textContent = formaterApercu(v);
    apercuCours.hidden = false;
    if (v.ok) {
      coursVerifie = texte;
      etatCours.textContent = 'Vérifié : rien n\'est écrit. Appuie sur « Confirmer la leçon » pour l\'enseigner puis lancer les exercices.';
    } else {
      etatCours.textContent = 'Le bloc n\'est pas exécutable : corrige-le puis vérifie à nouveau.';
    }
  }));

  bCoursConfirmer.addEventListener('click', () => executerCours(async () => {
    const texte = champCours.value;
    if (coursVerifie === null || coursVerifie !== texte) {
      coursVerifie = null;
      etatCours.textContent = 'Vérifie d\'abord le texte actuel.';
      return;
    }
    coursVerifie = null;
    const res = await donnerCours(texte, await contexteCours());
    afficherRapport(res);
    etatCours.textContent = res.ok ? `Cours donné : ${res.verdict.texte}.` : 'Le bloc n\'est pas exécutable : rien n\'a été écrit.';
    await dessiner();
  }));

  bCoursTester.addEventListener('click', () => executerCours(async () => {
    const res = await testerCours(champCours.value, await contexteCours());
    afficherRapport(res);
    etatCours.textContent = res.ok ? `Test seulement (rien n'est écrit) : ${res.verdict.texte}.` : 'Le bloc n\'est pas exécutable.';
  }));

  bCoursCopier.addEventListener('click', async () => {
    try {
      await copier(dernierRapport);
      etatCours.textContent = 'Rapport copié : colle-le dans ChatGPT ou Claude.';
    } catch {
      etatCours.textContent = 'Copie impossible ici : sélectionne le texte du rapport ci-dessous et copie-le à la main.';
    }
  });

  // --- v0.17.7 : « Tester une hypothèse » — BANC D'ESSAI PROVISOIRE pour le pont induction → compréhension
  // (v0.17.6). Aucune logique d'induction ni de compréhension recopiée ici : induire() (induction.js,
  // inchangé) et apprendreGabaritType()/repondre() (esprit.js, inchangés) sont seulement APPELÉS.
  // « Plusieurs hypothèses SÛRES et DISJOINTES » n'est PAS un conflit : Confirmer les apprend TOUTES
  // sous la même signification, sans qu'aucun sélecteur d'hypothèse n'existe dans cette interface —
  // c'est déjà la garantie de induire() lui-même (r.hypotheses ne contient jamais deux entrées dont les
  // ensembles couverts se chevauchent ; un vrai chevauchement va dans r.conflits, jamais dans r.hypotheses).
  let dernierRapportInduction = null;

  function formaterRapportInduction(r) {
    const lignes = [];
    if (r.hypotheses.length) {
      lignes.push(`${r.hypotheses.length} hypothèse(s) sûre(s) :`);
      for (const h of r.hypotheses) lignes.push(`  [${h.candidats.join(' = ')}] couvre : ${h.couverture.join(' | ')}`);
    } else {
      lignes.push('Aucune hypothèse suffisamment soutenue.');
    }
    if (r.conflits.length) {
      lignes.push('', 'CONFLIT NON RÉSOLU (rien ne sera confirmé tant qu’il n’est pas levé) :');
      for (const c of r.conflits) for (const g of c.groupes) lignes.push(`  [${g.candidats.join(' = ')}] couvre : ${g.couvre.join(' | ')}`);
    }
    if (r.inexpliques.length) lignes.push('', 'Inexpliqué(s) : ' + r.inexpliques.join(' | '));
    return lignes.join('\n');
  }
  function lignesDe(el) { return el.value.split('\n').map((l) => l.trim()).filter(Boolean); }

  bInductionLancer.addEventListener('click', async () => {
    const positifs = lignesDe(champInductionPositifs);
    const negatifs = lignesDe(champInductionNegatifs);
    dernierRapportInduction = null;
    bInductionConfirmer.disabled = true;
    if (!positifs.length) { etatInduction.textContent = 'Il faut au moins une phrase positive.'; rapportInduction.hidden = true; bInductionAnnuler.disabled = true; return; }
    const e = await assurer();
    const r = induire(positifs, negatifs, { lexique: e.lexique });
    rapportInduction.textContent = formaterRapportInduction(r);
    rapportInduction.hidden = false;
    bInductionAnnuler.disabled = false;
    const confirmable = r.hypotheses.length > 0 && r.conflits.length === 0;
    if (confirmable) dernierRapportInduction = r;
    bInductionConfirmer.disabled = !confirmable;
    etatInduction.textContent = confirmable
      ? `${r.hypotheses.length} hypothèse(s) trouvée(s) : rien n'est encore écrit.`
      : r.conflits.length ? 'Conflit non résolu : rien à confirmer.' : 'Aucune hypothèse assez soutenue : rien à confirmer.';
  });

  bInductionConfirmer.addEventListener('click', async () => {
    if (!dernierRapportInduction || !dernierRapportInduction.hypotheses.length) return;
    const signification = champInductionSignification.value.trim();
    if (!signification) { etatInduction.textContent = 'Il faut un nom pour la signification visée.'; return; }
    const e = await assurer();
    for (const h of dernierRapportInduction.hypotheses) {
      await apprendreGabaritType(e, { candidats: h.candidats, gabarits: h.gabarits, signification, exemples: h.couverture });
    }
    etatInduction.textContent = `Confirmé : ${dernierRapportInduction.hypotheses.length} hypothèse(s) apprise(s) sous « ${signification} ».`;
    dernierRapportInduction = null;
    bInductionConfirmer.disabled = true;
    bInductionAnnuler.disabled = true;
  });

  bInductionAnnuler.addEventListener('click', () => {
    dernierRapportInduction = null;
    bInductionConfirmer.disabled = true;
    bInductionAnnuler.disabled = true;
    etatInduction.textContent = 'Annulé : rien n\'a été écrit.';
    rapportInduction.hidden = true;
  });

  bInductionTestLancer.addEventListener('click', async () => {
    const texte = champInductionTestTexte.value.trim();
    if (!texte) { resultatInductionTest.textContent = ''; return; }
    const e = await assurer();
    const r = repondre(e, texte);
    resultatInductionTest.textContent = `type = ${r.comprehension.type}`;
  });

  // --- DIAGNOSTIC PROVISOIRE (B1) : « Voir les expériences » ---------------------------------------
  // LECTURE SEULE, volontairement : appelle uniquement magasin.lireTout('experiences'), déjà utilisé
  // ailleurs pour lire — aucune nouvelle fonction de production, aucune écriture, aucun apprentissage,
  // aucun changement du comportement conversationnel. Pourra disparaître dès qu'un vrai écran existera.
  function formaterExperiences(liste) {
    if (!liste.length) return 'Aucune expérience conservée pour l’instant.';
    const lignes = [`${liste.length} expérience(s) :`, ''];
    for (const exp of [...liste].sort((a, b) => (a.date < b.date ? 1 : -1))) {
      lignes.push(`— ${exp.date}`);
      lignes.push(`  id : ${exp.id}`);
      lignes.push(`  reçu : « ${exp.texteRecu} »`);
      lignes.push(`  répondu : « ${exp.texteRepondu} »`);
      lignes.push(`  source : ${exp.source}`);
      lignes.push(`  référence mémoire : ${exp.referenceMemoire ? `idQuestion=${exp.referenceMemoire.idQuestion}, idReponse=${exp.referenceMemoire.idReponse}` : 'aucune'}`);
      lignes.push(`  interprétation(s) : ${exp.interpretations.length}`);
      for (const interp of exp.interpretations) {
        lignes.push(`    - origine=${interp.origine} : ${JSON.stringify(interp.donnees)}`);
      }
      lignes.push('');
    }
    return lignes.join('\n').trimEnd();
  }

  bExperiencesLister.addEventListener('click', async () => {
    const e = await assurer();
    const liste = await e.magasin.lireTout('experiences');
    rapportExperiences.textContent = formaterExperiences(liste);
    rapportExperiences.hidden = false;
    etatExperiences.textContent = `${liste.length} expérience(s) trouvée(s).`;
  });

  // === SÉLECTION D'EXPÉRIENCES POUR L'INDUCTION (pont B1 -> banc d'essai existant, v0.17.7) ===
  // Ne retape jamais aucune phrase : les identifiants d'expériences (copiés depuis « Voir les
  // expériences » ci-dessus) sont résolus par preparerEntreesInduction() (connaissances.js, pure,
  // lecture seule, inchangée dans ce chantier), puis les VRAIS champs du banc d'essai d'induction
  // déjà existant (au-dessus) sont simplement remplis. Aucun second moteur d'induction : ce bloc
  // n'appelle jamais induire() lui-même — seulement Lancer/Confirmer/Annuler, déjà câblés plus haut,
  // le font. Une expérience non désignée (ni positive ni négative) n'a AUCUN effet : elle n'entre
  // jamais implicitement dans les négatifs par complément — décision explicite de Christophe.
  function analyserIds(texte) {
    return texte.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  }

  bSelectionEnvoyer.addEventListener('click', async () => {
    const idsPositifs = analyserIds(champSelectionPositifs.value);
    const idsNegatifs = analyserIds(champSelectionNegatifs.value);
    if (!idsPositifs.length) { etatSelection.textContent = 'Il faut au moins un identifiant d’expérience positive.'; return; }
    const e = await assurer();
    try {
      const { positifs, negatifs } = await preparerEntreesInduction(e.magasin, { idsPositifs, idsNegatifs });
      champInductionPositifs.value = positifs.join('\n');
      champInductionNegatifs.value = negatifs.join('\n');
      etatSelection.textContent = `${positifs.length} positif(s), ${negatifs.length} négatif(s) envoyé(s) au banc d'essai — rien n'est encore lancé.`;
    } catch (err) {
      etatSelection.textContent = `Une expérience désignée est introuvable : ${err.message}`;
    }
  });

  // === REPÉRAGE DE MOTIFS RÉCURRENTS SUR TOUT LE VÉCU B1 (B3a, v0.17.10) ===
  // Outil de VALIDATION, en LECTURE SEULE : contrairement au bloc de sélection ci-dessus, Christophe
  // ne choisit AUCUNE expérience — data-langage-motifs-lister lit systématiquement TOUTES les
  // expériences B1 via magasin.lireTout('experiences'), ne garde que {id, texteRecu}, et appelle le
  // vrai repererMotifs() (induction.js, inchangée dans ce chantier) avec le lexique COURANT de
  // l'esprit. Recalculé intégralement à chaque clic : rien n'est persisté. N'appelle jamais induire()
  // ni apprendreGabaritType(), n'écrit rien dans B1 ni dans les connaissances, n'élimine aucun motif
  // trivial, ne donne aucune signification, ne se déclenche jamais tout seul.
  const bMotifsLister = $('[data-langage-motifs-lister]');
  const etatMotifs = $('[data-langage-motifs-etat]');
  const rapportMotifs = $('[data-langage-motifs-rapport]');

  function formaterMotifs(motifs) {
    if (!motifs.length) return 'Aucun motif récurrent constaté pour l’instant.';
    const lignes = [`${motifs.length} motif(s) constaté(s) :`, ''];
    for (const m of motifs) {
      lignes.push(`— ${m.cle}`);
      lignes.push(`  couverture : ${m.couverture.length} expérience(s)`);
      lignes.push(`  ids : ${m.couverture.join(', ')}`);
      if (m.chronologie && m.chronologie.length) {
        lignes.push('  chronologie (séquence historique observée, sans jugement) :');
        for (const groupe of m.chronologie) {
          const etats = groupe.observations.map((o) => o.etat).join(', ');
          lignes.push(`    ${groupe.date} : ${etats}`);
        }
      }
      if (m.nonResolues && m.nonResolues.length) {
        lignes.push(`  observations non résolues (date absente/invalide ou expérience introuvable) : ${m.nonResolues.length}`);
      }
      lignes.push(`  compris : ${m.parEtat.compris.length}`);
      lignes.push(`  partiel : ${m.parEtat.partiel.length}`);
      lignes.push(`  incompris : ${m.parEtat.incompris.length}`);
      lignes.push(`  inconnu : ${m.parEtat.inconnu.length}`);
      lignes.push('');
    }
    return lignes.join('\n').trimEnd();
  }

  // Constat de la répartition par état ET de la chronologie brute (feu verts « répartition des
  // motifs par état de compréhension » puis « chronologie brute des états de compréhension ») --
  // résout ici, et SEULEMENT ici, la date réelle et l'état COMPRIS/PARTIEL/INCOMPRIS de chaque
  // expérience, à partir de sa PROPRE date B1 et de sa PROPRE interprétation d'origine 'comprendre'
  // (jamais recalculé, jamais un second appel à comprendre()/repondre(), jamais Date.now()) :
  // induction.js reste totalement ignorant de ce schéma. Une expérience sans interprétation
  // 'comprendre' (rien ne l'empêche, le schéma est libre) est explicitement INCONNUE -- jamais
  // implicitement COMPRISE.
  function infoParIdDepuis(liste) {
    return new Map(liste.map((exp) => {
      const interp = exp.interpretations.find((i) => i.origine === 'comprendre');
      return [exp.id, { date: exp.date, etat: interp ? interp.donnees.etat : undefined }];
    }));
  }

  bMotifsLister.addEventListener('click', async () => {
    const e = await assurer();
    const liste = await e.magasin.lireTout('experiences');
    const entrees = liste.map((exp) => ({ id: exp.id, texteRecu: exp.texteRecu }));
    const motifs = repererMotifs(entrees, { lexique: e.lexique });
    const infos = infoParIdDepuis(liste);
    const etatParId = new Map([...infos].map(([id, info]) => [id, info.etat]));
    const repartis = repartirMotifsParEtat(motifs, etatParId);
    const chronologies = chronologieMotifs(motifs, infos);
    const fusionnes = repartis.map((m, i) => ({ ...m, chronologie: chronologies[i].chronologie, nonResolues: chronologies[i].nonResolues }));
    rapportMotifs.textContent = formaterMotifs(fusionnes);
    rapportMotifs.hidden = false;
    etatMotifs.textContent = `${motifs.length} motif(s) constaté(s) parmi ${liste.length} expérience(s), sans aucune sélection.`;
  });

  // Exposés pour le pont conversationnel (main.js, v0.15) : UN SEUL esprit partagé entre le laboratoire et
  // la conversation — jamais une seconde copie de la base en mémoire. Deux fonctions déjà internes, non réécrites.
  return { rafraichir: dessiner, assurerEsprit: assurer, ecrireConnaissance };
}
// === FIN_LANGAGE_ECRAN ===
