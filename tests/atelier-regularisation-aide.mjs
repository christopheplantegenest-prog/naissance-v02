// v0.65.23 — R1 « RÉGULARISATION SUR PREUVE FINALE » (GO « R1 — CONCEPTION B ACCEPTÉE », 23/10/2026). OUTILLAGE NON COGNITIF.
// Aide des tests de la régularisation : données RÉELLES de la recette R1 (chantier recette-at104, D3 8e5e3ece / chantier.json aaeaa362,
// run 39799596191 essai 1, J1 bde7195e, J2 frontière 172354bb, J3 ISSUE INCONNUE 7b48bf9f, jobs finaux, approbation V2 réelle). Le commit
// D3 se recrée à l'identique (même arbre, même auteur, même date, même message : même SHA). Preuve et autorisation sont construites ici
// comme les construit outils-atelier/auto-retour.mjs ; l'heure de lecture et le commentaire N2 sont FICTIFS (aucun commentaire réel).
import { gunzipSync } from 'node:zlib';
import { texteBlocPreuve, lirePreuve, texteBlocAutorisation, lireAutorisation, texteAutorisation, PROTOCOLE_PREUVE, PROTOCOLE_AUTORISATION } from '../app/atelier/retour.js';
import { hacherSha256 } from '../app/atelier/empreinte.js';
import { canonique } from '../app/atelier/journal.js';

const FX = {
  chantier: 'H4sIAAAAAAACA81WTW/bOBC9+1cMeLYUSpa/dDPatHDgJkDqXjYbBAw1TumVSZWkghSF//uCpGTLH026KFDsSSCHnHl8M/NGP3pA+FcmrUBNciAaOVqLEbMJzUi/B2Stai1ZSXK46wH86AEAKZSUiIbkYQ3kkRncrYCYr8w5K5IiLVKcDqaTLB1PGOXTbJg8csanBU7omE6zUcqLqYvj7z2jNkJJd5fGo2GcJsRbtuEAEcVZjM6kHtfIrVi5A7fhAMyWUULjDHLQtYTZl+UN/F1TihQeSyY5VKrWUGlVP6OGEg0wKZVlVihpYLa8XMwvb6MPs/nyc5TEMKt5LYFVFZZ9YG6BUHh/0wqlwbiFUpVMNnQBtJwA4VpY1I4mssCfINIoC7hK+nCVwkoraYU3TzQCWrgawPXNtb/Bp5/mnwFlF3ILYEeU9xkl+22L0p19RvOJvZAckr1F2ADtipVKHoAKKYCt/9z3dukgcueBfKuZ9CFTmo6ihEZpukyynA7ywTAeZYO/AgZiv1c+iqfcOs/e10lVdSKkr0fIcjqOh9nkOIJLQsSqkN2fBwoZ80nt1K9fmw5BBKXViA8bT1tKKaWtZcNeHqz6B6U/3zWoAkuPhUWByNZimRarh+CyudS5F6xGaSucdRisB32wdkk6zbAP6bZdYZGjTA1e53GSD7OYjqbHPO5KJnKhMFDZg3snDZVAvqOxxXKRtESSAjdMekSyLsvgd8WEdVfu7sN6I0zT8m0uaqu0MN7vXUsJGmsuDvo+dnvxZm1Ced73/6gQvSqZnWbvPmJxJDBF7UXAKGmhrNGAYdKARq4qgfHhswrkwgEyZ3Ql9Pr7iNJxt9NfbCgFi6VADcVOrJ6xVFWFG5QWcrj5spwvFrOPl15a3t18vJ4v5x9ieFeyukCnjkUtLBRogDNZiIJZ04c12zBh/C7j32phRKNAB1rRgA9C1rLR7gppURcHxbAv7DZ/XG0qpa0H21X2A9HMgxqfed9OEc8L4tuqt/3/TZddQ+7lKfRHp9SCM7cLOvjA0uE8w15baB210KxypDdtG/p9u+/391jVohVHUmllFVeN0IVii5p/hsA00fgkTCD6lV8I/p0HJ20/hY39TF0pL1yNWrZ62Vpuaz+Ohgc2jQa1Zyqlexn9L+OLDmI6GR6LoocWvTXEflEq9k8bnAeZvgUyG8fT0xnbBo5CAIm/jRRfkNe20cWDExd78W9HEXsRm3rj4A9Pn/RLw2h8MoxQPrGnIAbNGOpte/8CrdXEmMMKAAA=',
  j1: 'H4sIAAAAAAACA1WS2W7sIAyG7+cpIq4bDWsC8zKRA6ZFTSACpq1U9d2PyNKjXvrz+tv+vnUEtg0X8ui+b91pFPLo2EszMb7CK64YK3l0XFFKT1wz4rTCV8P0F5caVqghxT/RK3xNNb1j3Ov+0uRwQfLoCPTzAtGSHVfIwU9HgzP8yjhcJeUamksdrlv383KpmHANrYmHpWCjuG4ZQ6x7HweUSi1nmCkVQIcBFRNGMKuopIIC1dxyMfiBOz5zY8zomDODFJo5b5wke8UK217tFbLDC9Vrfzata2gW0ahQoEWJRo52lNJrBnTmjHoFliuOatTa6kP2n0EBEEAMnGJLFMiYG63WQoFRwIVlSg6MSkM910oJrfXoqJeD5+PgLHpy7sTnFGvA3IrG57I0tuVUk03n5isuAXMPz5p6D6GWnpEz6gMjRIuXsIy+ZWT05f6G4Mp9hRCP4fMzTlArrtuunP2nwTUgzGiMMgMzp+sz5Xe/pM+pvMF+Gea442iE0ZKPGqg1UrHZgjUONR2pkQO3zlzCMoSyP9mlKmN5LscZSBOTQzluUzFWqOEDj+Et1oo9VEblfX+6nt0Zuf3c/gEFgPHyCQMAAA==',
  j2f: 'H4sIAAAAAAACA1VT227rIBB8z1dYPNcKVxvyM9EalgQdGywgbaWq/36E7aTK487sZWYXfk4dgXXFmVy6n1N3BIVcOvbRQow3uOGCsZJLxxWl9IBrRrwu8N1g+oJLDQvUkOJb9gLf15r+Ydz6vtDkcEZy6Qj00wzRkg2ukIO/7gOO9GfFTpWUa2iU2qlT9/vxdHHFJbQhHuaCDcVlzRhi3eZYLQCGSYyOAjcgUQhrlVXcs2lggwEruKCTEag1VZYaFExPQnE9orAWyNaxwrp18znFGjDjE67PHdq0LKFFRKNCgRYlGjnaUUqvGdCJM+oVWK44qlFrq3frb2IBEEAMnGIrFMiYG63WQoFRwIVlSg6MSkM910oJrfXoqJeD5+PgLHpy7OVP5t+Fc5qeV2rQS/3OfaLb9HRkTrcQt83dcyg1rXdcZ4gVbxix1H7N6UZO3TaoIy6VEjBf32wMhtFxYk23EM6MAvngjRwm5yl1QlI3KeEVM+iM4NbCgBOME/rRTX6wSN5aJ1uxtgMLzeTGlBQdvnzYFH3KSwNqfuDuolSoj2ZPUtHEHotZc6rJpuMJVpwD5h4eNfUeQi09I0fWJ0aI9rW/jL5VZPTlfEdw5bxAiLvO/IhXqBWXdVsn+0ODa4AwozHKDMwc1FfK//ycvq7lDi3BMccdRyOMlnzUQK2Rik0WrHGo6UiNHLh15nndDKFsd4yPed4ALI/5uOaasfbQbz8D82anYqxQwyfuFizWij1URuV5+4M9OzNy+j39BwJmZo4YBAAA',
  j3: 'H4sIAAAAAAACA21Sy27kIBC8+ysszmsNYLAhPzNqmiZBa4PX4Mwhyr+v7PEks9He6EdVVzX90bQMloWmK82xsJc2bdP0q2kZ5lQqVPbSfjTt2XMGRxGnrcScvhFty3bAtpOwG8Qa0ytr2vZzrzGqsNBTM3uF1dP/CVnZEKkU9pMV87xMVMkfvM1BzTBv9Un3buNfYYzmZaWY6j6OAQY9olBSDwOhdtJ5q4SRSjvHpeXGoXOGBx9Gct44GgbvvPXOjkMw1rCD8XTztaUz+bUuzPMc94gZ0tQTkiKrRhyVCkYAd1LwoAGllqRHY/Dg/SkVCKAfJKcd2JMQfkRjeg1Wg+xRaDUIriwP0mjdG2NGz4MaghwHjxTYuaFYynYQHo8uJswpbXSIXtZcM+bpPrDSFGntYKu5CxBr6eSj650SJHz8GFsp7IiVQrm8EfhymSGmu4l1S1eolebl2ID4zka/J3o7WqvtIOxZuuX1d5jy7VreYG/wwksvyfbWKDka4GiVFg4BrSfDR27VINHbh8EVYrlfzv4H3XGru01a6ymKrbTkVJ4ukK30Z6P6nKmUKtT4TndnSLVSB1VwdXETJOzERbDms/kLIzrj/jQDAAA=',
};
const fx = (nom) => gunzipSync(Buffer.from(FX[nom], 'base64')).toString('utf8');
export const GITHUB = 'christopheplantegenest-prog/naissance-v02';
export const CH = 'recette-at104';
export const JALON = 'blanc-1';
export const T = `${CH}/${JALON}/1`;
export const CHANTIER = fx('chantier');
export const J1 = fx('j1');
export const J2F = fx('j2f');
export const J3 = fx('j3');
export const COMMIT = '8e5e3ece4e947c744f81a0b210f5ac252e5788c8';
export const D3 = Object.freeze({ commit: COMMIT, empreinte: hacherSha256(CHANTIER) });
// Recréation du commit D3 réel : arbre chantier.json seul, auteur et date exacts, message exact.
export const COMMIT_OBJET = Object.freeze({ date: '1792678264 +0000', nom: 'Claude', courriel: 'noreply@anthropic.com', message: `journal-atelier/${CH} : sauvegarde ${D3.empreinte}` });
export const RUN_ID = '39799596191';
export const SHA_RUN = 'd1d2d2e93984278a0c9451bcac9de80709462cd9';
export const RUN = Object.freeze({ id: Number(RUN_ID), run_attempt: 1, head_sha: SHA_RUN, created_at: '2026-10-22T14:52:52Z', updated_at: '2026-10-22T15:04:17Z', conclusion: 'failure', status: 'completed' });
export const V2 = Object.freeze({ user_id: 308310970, login: 'christopheplantegenest-prog' });
export const APPROBATIONS = Object.freeze([{ state: 'approved', comment: '', user: { login: V2.login, id: V2.user_id }, environments: [{ name: 'atelier-auto' }] }]);
const e = (name, conclusion) => ({ name, status: 'completed', conclusion });
// Jobs FINAUX du run (API relue après la fin) : J2 « Préparer l'appel » en échec, « Appel (une seule requête) » sauté ; J4 sauté.
export const JOBS = Object.freeze([
  { id: 119896201551, name: "J1 garde", conclusion: "success", steps: [e("Set up job", "success"), e("Récupérer main (outils de la garde)", "success"), e("Run actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020", "success"), e("Lire la tête du journal et chantier.json", "success"), e("Lire l'historique des runs de ce workflow (témoin)", "success"), e("Garde (J1)", "success"), e("Post Run actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020", "success"), e("Post Récupérer main (outils de la garde)", "success"), e("Complete job", "success")] },
  { id: 119896287428, name: "J2 frontière et appel", conclusion: "failure", steps: [e("Set up job", "success"), e("Récupérer main (outils de la frontière)", "success"), e("Run actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020", "success"), e("Relire la tête du journal et chantier.json (après l'approbation)", "success"), e("Lire l'approbation de ce run", "success"), e("Sonde d'écriture du jeton (doit être refusée, 403)", "success"), e("Frontière (J2) — aucun appel", "success"), e("Lire les fichiers autorisés à la base (aucune requête)", "success"), e("Préparer l'appel (aucune requête)", "failure"), e("Appel (une seule requête)", "skipped"), e("Proposition à conserver ?", "skipped"), e("Conserver la proposition (remplacements validés, pour J4)", "skipped"), e("Post Run actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020", "skipped"), e("Post Récupérer main (outils de la frontière)", "success"), e("Complete job", "success")] },
  { id: 119902168681, name: "J3 constat", conclusion: "failure", steps: [e("Set up job", "success"), e("Récupérer main (outil du constat)", "success"), e("Run actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020", "success"), e("Lire les jobs de ce run (essai courant)", "success"), e("Constat (J3)", "failure"), e("Post Run actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020", "skipped"), e("Post Récupérer main (outil du constat)", "success"), e("Complete job", "success")] },
  { id: 119902661484, name: "J4 candidat", conclusion: "skipped", steps: [] },
]);
export const ETAPE_APPEL = 'Appel (une seule requête)';
const NOMS = { garde: 'J1 garde', appel: 'J2 frontière et appel', constat: 'J3 constat', candidat: 'J4 candidat' };
const etatJob = (x) => ({ status: x.status ?? 'completed', conclusion: x.conclusion });
// Valeur de la preuve finale, construite comme auto-retour.mjs --mode preuve (modifier : retouche d'un essai négatif).
export function valeurPreuve({ luLe = '2026-10-23T09:00:00.000Z', jobs = JOBS, approbations = APPROBATIONS, j3 = J3, run = RUN, tentative = T, modifier = (v) => v } = {}) {
  const job = (cle) => jobs.find((x) => x.name === NOMS[cle]) || null;
  const a = job('appel');
  const v = {
    protocole: PROTOCOLE_PREUVE, tentative,
    run: { id: String(run.id), run_attempt: run.run_attempt, head_sha: run.head_sha, created_at: run.created_at, updated_at: run.updated_at, conclusion: run.conclusion },
    approbations: approbations.map((x) => ({ environnements: x.environments.map((y) => y.name), etat: x.state, login: x.user.login, user_id: x.user.id })),
    jobs: {
      garde: job('garde') && etatJob(job('garde')),
      appel: a && { ...etatJob(a), etapes: a.steps.filter((x) => x.name === ETAPE_APPEL).map(etatJob) },
      candidat: job('candidat') && etatJob(job('candidat')),
      constat: job('constat') && etatJob(job('constat')),
    },
    j3, lu_le: luLe,
  };
  return modifier(v);
}
export const blocPreuve = (o) => texteBlocPreuve(valeurPreuve(o));
export const preuveLue = (o) => lirePreuve(blocPreuve(o)).preuve;
// Commentaire N2 FICTIF (même forme que l'API REST issues/comments/{id}) et bloc d'autorisation relu par Claude.
export const ISSUE = 9;
export const COMMENTAIRE_ID = '4000000001';
export function commentaire({ preuve = preuveLue(), texte = null, creeLe = '2026-10-23T09:10:00Z', modifieLe = null, login = V2.login, id = V2.user_id, association = 'OWNER', numero = COMMENTAIRE_ID, issue = ISSUE } = {}) {
  return {
    id: Number(numero), issue_url: `https://api.github.com/repos/${GITHUB}/issues/${issue}`, html_url: `https://github.com/${GITHUB}/issues/${issue}#issuecomment-${numero}`,
    user: { login, id }, author_association: association, created_at: creeLe, updated_at: modifieLe || creeLe,
    body: texte ?? texteAutorisation({ tentative: T, run: RUN_ID, preuve: preuve.empreinte }),
  };
}
export function valeurAutorisation({ preuve = preuveLue(), c = commentaire({ preuve }), luLe = '2026-10-23T09:12:00.000Z', tentative = T, run = RUN_ID, empreinte = preuve.empreinte, modifier = (v) => v } = {}) {
  return modifier({
    protocole: PROTOCOLE_AUTORISATION, source: 'commentaire-github', tentative, run, preuve: empreinte, depot: GITHUB,
    commentaire: { id: String(c.id), issue: Number(c.issue_url.split('/').at(-1)), url: c.html_url, user_id: c.user.id, login: c.user.login, association: c.author_association, cree_le: c.created_at, modifie_le: c.updated_at, texte: c.body },
    lu_le: luLe,
  });
}
export const blocAutorisation = (o) => texteBlocAutorisation(valeurAutorisation(o));
export const autorisationLue = (o) => lireAutorisation(blocAutorisation(o)).autorisation;
// Faits AUTO retouchés puis RESCELLÉS (même écriture qu'auto.js : texte canonique, empreinte du texte canonique sans empreinte) :
// variantes contrôlées du J3 réel pour les essais négatifs et les autres issues.
export function resceller(texte, f) {
  const { empreinte, ...sans } = JSON.parse(texte);
  f(sans);
  return canonique({ ...sans, empreinte: hacherSha256(canonique(sans)) });
}
