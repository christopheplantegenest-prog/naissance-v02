// v0.65.21 — AT-10.4 « RETOUR DES FAITS SANS RECOPIE » (GO « AT-10.4 — GO RÉALISATION LOCALE », 21/10/2026). OUTILLAGE NON COGNITIF.
// Aide des tests du retour : faits RÉELS du jalon 2 du pilote AT-9 (J2 4c383d8b, J4 27185b94, AT-5 39485411, état e7ee7e87 ; mêmes
// données embarquées que tests/atelier-auto-decision.test.mjs), complétés par J1, J2 frontière et J3 PRODUITS par les fonctions pures
// d'auto.js (garder, frontiere, constater) sur la même D3 et le même run : la chaîne complète d'un run réel de développement.
import { gunzipSync } from 'node:zlib';
import { garder, frontiere, constater, nomRun, lireFaitsAuto, NOMS_RUN } from '../app/atelier/auto.js';
import { lireEtatDurable, canonique } from '../app/atelier/journal.js';
import { hacherSha256 } from '../app/atelier/empreinte.js';
import { ecrireFaits } from '../app/atelier/verification.js';

const FX = {
  j2: 'H4sIAAAAAAAC/6VWS28jNwy++1cYPscbvR+9FS3QXnoq0EOLhUFJ1GY29ow7I2fTLvLfS83Dj82mXaBGYGdIihI/ffw4n1frDRyPuN/hoRk2361Lf8I7MsauHQoUsrSn/X6ynOrj59V6vTl0bYG2PnqnGburtgJ9k3fYlh6RHIqNnyvX0PWlqS4xudhq/VIT152HpmuX5Meuacsu99DGh+ZypPVm6OIjlh0drcVYcHadsxx7pIXVvFFROplckAmclsEJ7WwOLMQoOUsyZe0gcI8cUEsufUo8JOMCSiWyQLkZMxY4jtlGgBbTGYPYHQ5NfdqgRfqjHQxIBIQQBOfKo44MbTTcBdqLg96MVdwcFLIECiIvCo/ZSqZVjiwECzFJIzWzUlGQMDmZYDWoGBzXqJ33jKPbzNUTgqcxYY9HujncVpDIUn3Hvitd7PbThgX3DfZbOJVum6Epw1YsUU/YEua4FNhjnjLm4f4BIQ33B2jaqYj+1O6gFKplRIBfrE2qBumVZYIJrf3k+tT1j3nffdoNDzCu8CxwS7gYHY3O0hNSlmkDip6B+SScFj6apcAemmGkyELHudALIxNOFcY9nBJuu+Np2OrtDDpVd+yGplxo9sVFCGIL11xkuiuJlisIXqKK2YvoDfHFE4G08ioSpZRwhogknHNWkyvoEWnKmRviLPa1k/6ohmmrypYHonk7s+l+voV7jMTydx+HafWXZ+KoctYx56BsBmeC8sYq7VKQmYgquXWJQ0QCT6BJloiuwEmBPkuU2V2yTrStIDW5wbO9oy4q9aycWaX0Yu7pFHvKe6Bmrl452l/u3iio4FCGpaTtWNKWmLCFot9V37vDWwUKzzID7Y1jyiWlMXhOTFeEr7OQrNDICAPC1zsOFKIhC66Dt3QBIPKrAmPVntfVae/fqo1PtdXv99MVHrrS5AvRyPLniaportlXxYi2HAXxhlurGSfaZ1w1twM97RjnP3z48Sn9lL7/NSX982+//22efvEwEfScTsyaOZTuuOsRJtZvsE27curn9iv4XHB3g2VEn4yllgJiJCRhvNQauGLRCiEBFFeKpCZGUCGzwCJzWgmWkXyR+3Cd+IycMlxP9r+OtF/f46m/QmFzGuADXhpq0X6vDJtRWjRfMllp9LK0c4Wn4EVL++NwWw8LgqGugpqklzZzT20XTGJScZmoEUg+lPIkgzpF5xX9zxNYJItyLIqpninxuR7BrBGjI3U0c7D/AkOrglE2UdcZUiCMkEKKCMpyZliMTFoXg9IeZYicQQwyErjWRye4CBMfz6mvduWcT9qfMwFStyIpnMfBCNoudH07jk0luRsdi5TsAowyN+rJ1H3fpia3vaZR0HgJiTkZtUFhEjBD845FqZDmpAqOkBUBSPZAGKIhBh3IyVMkwuRz0rnVKPVAZz+bn0tfp8lZ+JafNZ9bb+2n3/d3t366ryWCM8a/HsQZv4qSao5aXcXO6gZhj1cvDbcqZ2iers5a9grMWyWDJuGVdt3CaYiEQhphGBiLTNOoYFHT3BaZKYEokUaF5xyIMKTcjF4zIkl2preLbEis/z+cnL0BlZNLiBDi6zFCLoJYG/M/wcywH16jWSfQN4P5r2PhBtqzxF7AgfAWNt989zXralb6cdHmAM+70j1iW91ueVV9+z1iVq5CJ4HSPI0xx2bfFaSS/PajuJ+ru+eb1cvqH9U+DI1aCwAA',
  j4: 'H4sIAAAAAAAC/71U227bMAx9z1cEfp4T3SX2V4ahoCQKcRfbga20D0X/fbSTrLcNWF8GGLDNi3jOIannzbZJOOQuY23uts+b7baJOBN/NxJElD5KcDY5WzSQT15Yh4b/UUBWwSpIrvm2Zk04pMOaiJWOHU37U3ccK7VYoX1Q++k88Kfdy0t87uaKw1K0MSqTdOS0xhi0kM67DGQkCQOqCOejd14Ve0mcD/ilpM32hfOaTD3zpHuG8H+JvpH3i0wfaZq7cbi/4RQ7Z3fSvHe+Pf4S8Jsy9aeJuqGuycrLYCMYzYUBpRda2SBtyKo4Am0CuGStkyoU6YJQQZjkcykBZHTZrOQbqq9jksa+79ay5Imf4ItDTUgYo5LSANkkWEknQ2RtJV5ZvUOFRSMHsZcUUPFaWFOSiNFjytppK7w2HKRcyS56iyZFRk02AAhJ4Ua1dOnAnZj5zO9cZAHICA/Ud8Na5nTa35pFiRu4e5hXNB/gSDKl2FRKNL5gcNGA84ZFirpoo7T0IUtMxCOiyGXPYhoMWhEUTbqE25kXmZp+zF3p6GodU6W6IJTCG2PZtkD/hLXSXOcb2nZF215Harf4dv2fsSsQRaAFbp4J2ViKIFk2Y1QIHrNXlgTTg2ghSOQQi0VJHgmvgkNVPmBPE30GbgEW2Jvtj0X00zTWMY3Ht7vQ4rmO7W0o23UHlsBHGnht6DY8E5UliV/z/kCY532PTH8dECbLW1qZ3ApEvlq7vBg0GC+UUNbCxfU0Tj/LcXy6v14N/7zP1+GZsJvHRfvhfDwuBr6Z6vmdCtyVgY3d48r1b/u+edn8ArtoR0VRBQAA',
  at5: 'H4sIAAAAAAAC/6VV23LbNhB991d4+GxJAEiAZJ/6H50MBwAXEhySYAHQdprJv3d5FSU7mTr1i8zdxV7Pnv3+8PiY1NDKrobkj8fv+IkCJcP4ldCSKJorWgquBTdpCbnOCRcyw29JypoVnJVaJE/LOy87fZmeygiNBX/qbeMiHGQsD8/s5IcO/+Unur7QGNjWMo5PMlYDFSDSVKoiJVTkoi4ho0CykhkicpWLnBm+vn0BH6zrqjVbchT8SLN79T7EbMITtPjxNJVujbnWbay+YNIBJX9NksdFM+d6gdZ2U3F9f1oLBI1FH5/DEnayhDiHax36t7BXoWhuLSEiy5JF8ePpV+EihBjWgIcp4GHp5HHUHduPw2sP/yX29Ptl6ZoHMwSYOrCKArobJofoWDV2bfCUVrXUePNi1oSh771tb1X/uA5CFd2A5S2abRjQ9h5sF6ck0zIreEYpy2RKCpGTLBWUKV1KWlBV1ianSgE1REuplBRUZ5JKRUpWS05yncwuvYfBY0DQl87+PeySSeAN9BARIlcA6LlDZEm2BiWbBnwVLpJxMaZVqKIoZM4Zq7NCsiyVRgvCVcYAMgE1NTyXJtV5qZUkDC1rgIJLk3GGEpVsrhtpq3ZMJyXj3yofcGjV0tpRS4tCEPZ0C9DKds+gI+yROqEyvO6hOImWPRjlN5OeXYwb4qEZxrKjH+D9zKcubUAa12qc974n1OBAlNFYbyqIVqws60LJlGNHOC9rKSRPS0byMqPKcKaUpmmuCWU0F7yQ9xu7FAcfbqytoYs23rFVhcQD0d9VMWmwlZV2bWvjB8ow+KqV05rdq6I8/w8OrODNhnifz6Lr3Yryz3LerYfKzATxWS9zOyZ0bZJuHPnNqv6scUgQOKWw25Olg5/uVQv+DNXvXpsA5xaxsAHhpjCy7cCe1L9cpfdFoOzicLMcUkLTyDPc2r/nxY+Y8WFH5u+02wohsla8rsXv2jtq15tVNVbdg3rdkqWud+dv25Teu+i0a/b3+GAk9ufAktXiBboxles21dC7+XpcPCLY9RfoG4lgOwMydzzgm/OpkzaE8d3hhbC1LDxJla0X7s4LwVPCi1va0JjGMFHH7wz81fmvpnGvSFjmUxmejmcbL4M6rR6u13TLa6TIb23zJ/oOpwvIOpwmWG/t9E65K9jWy7JfGDO0M2m5r2vKz2E6LztJ+NZF+baabd4nxr96l103NLDfMTxgoPcCe+6cvzHBhEKwo4RzQX7G5GGDoYuyWYzHPB5+PPwLBDhtUw8KAAA=',
  e7: 'H4sIAAAAAAAC/9VXW2/bNhR+968g9JIWsBRJtpzIKQoE2GO3FVu2h61FQFPHCVOJcnnJUhT57zskRVmWU8dbgwErUDji5Vy/c77DrxMSsVsqNAcZLUm04XWrIaa6jO/yaIq7d62Rgta4+eeEkK/4n0RVKwSAwjX3TaIVVdB/kUjdUissK9NVdrbKykXBFsV6VsIZO0uLBZ3jN03LKj8v8pItrB537x6k4q2wd9NkUSTZPHI7j/5AxKsnbbRb7eoOmOZre+C9O0Aur+JySu5o3QqSkyWh6zVntyBJDUSY5oNJUyhlSypDNlQpeuOuFKSiQpH65FJDjVGZ4qYkdLOBmlRAKn/tHuoWlxoQmhjBPxuYEmXvNajZSMLaG8HRnCTYt6mp6GJISAgUxl5yDdLGLnoHhNFKgrUHA1FxpokGduukE9CkpqTmN8IdYFRUvKKaUMZgo71RwUO06bCLna2SgyA2+zcYlOqEGi0hGNxHWxqBoS62yxrlU83vQf1IH/BEtt3h2rvy09HR9fklj+7n46TPdSR6ydFng85asXmaL+IsjfP0Klss02xZFEmaLf7wtkX6y8Zpbw2GT1vJTtYeZAca8sMaimWaJ9nZfKzBJjNGSEir6tuKfOYddAbF4b7VIHARBlQCXDcunPMiTdOwg0vXuv0Ewp4/H260FdTOFlZTU0HcboyKi7jPU6Sp5OtrL9qKTd2/3V3VSix8Gwe/m+5UWwUDlA8cgPUa71nddftXrw8etKRcqy3Ie5TbFgMNd3WN3p9Sn/tTYJKK5E712LI6V0YPQUWitbtYdt+P0+8XXpbzsfgsTbMX1JCl2RMqZvNjVGhQWgUlMeUVJM1xMcrSl5V/PhtryPP8RVXks3KsYpbOggr/+/HlEO24YL+puWqyy5e/Xf0cjZrQ7GCLyM5si8jTvRbRd8kYewUD3yUmzhkkMGB9hwi2nGahxDA6DSqzYoSpay93HWrLhyNquOqoMrQZo1vJFQwK8CBaR0ly23FnS2L3XMomgwz8Vyx/cB4ZkObQ01/B1Io85a9lzmNc7YhQ6J4Bo3eUKIOqkM2bTe0Y7Ry/LJ0h3dN7YIQaZHyOjGYEEZYNcMFKtOPGRvorKLoVa9k6QLRiasl5j+mb1uLabqFhOGgo4jJOLoZyPNkHKc+OA51M5mVeeIvxL0f0du2aVyjnxI8NlqGtu1v/Lw3D0xo7O84fD1xpzAsRJ9Y9CZrLTs2FNYXV3ZegiEwL+ZjTpAt5cp+5AQYIMkeDZuIgZe+0WAlEoZWECxd+L0Mlu7irgHGLmAH+sSBsQPkIBt5iLGdjYzyawcJ2N8Jt7M96rkfKuNA2JXpcRw3lO+WzoewThgyXEMphsTWa1yoOGPxGrfUNcUdxaE6hvCzosJsF9t3Oh9ZuuiK/782IdmO1Iq8QCDTYEAD2OgyHCADogNMJej8cz5bkjQfG24PibPm8npLWxbDssEQsMnAougdhAZB0q1swhzro0uyR8wyIX/kviN+4AL19TRSgzxKpBtxo3nnxweRIuruz5siVabDTi3ZwZlAbjvBTtql0wykNEPGwS4jHjS+bYVoImuDbxhZjT07N/340fvyfvG96vtsOJh71gzI6qg0vnzMfTaWSum0IGXuioW4MV30+D2MsdIAB80vU4odcS8Geux+33P0DWPGdqxFCXres9fN4cK97N8eZe0VLuMH+6SBw4BnNvjAvZIf24m7kGDwl160bRorBBBSWfzFivIM9EqTLTPrPXliz5XyW5Iu9F5azM37unXUkm4/dGZn4zBNtvpydJ4t0tmdipzb24gV8t53wAMzobnDZOXG6HeHCQEkfeGMaOz7On/DpuJnyfOwTiBusAscH3TQ5eZz8DSN57wzCEQAA',
};
const fx = (nom) => gunzipSync(Buffer.from(FX[nom], 'base64')).toString('utf8');
export const CH = 'pilote-at9-j2';
export const JALON = 'run-at5';
export const T = `${CH}/${JALON}/1`;
export const CLE = `${JALON}/1`;
export const J2 = fx('j2');
export const J4 = fx('j4');
export const AT5 = fx('at5');
export const E7 = fx('e7');
export const COMMIT_E7 = 'e7ee7e87f6a3eaeabb21149e5c0e7c618bb191a5';
export const D3 = Object.freeze({ commit: COMMIT_E7, empreinte: hacherSha256(E7) });
const PROV = JSON.parse(J2).provenance;
export const RUN_AUTO = PROV.run_id;
export const SHA_AUTO = PROV.workflow_sha;
export const AT5_PROV = JSON.parse(AT5).provenance;
export const RUN_AT5 = AT5_PROV.run_id;
export const SHA_AT5 = AT5_PROV.verificateur_sha;
export const RUNS = Object.freeze({ auto: Object.freeze({ run_id: RUN_AUTO, workflow_sha: SHA_AUTO }), at5: Object.freeze({ run_id: RUN_AT5, workflow_sha: SHA_AT5 }) });
export const mission = () => structuredClone(lireEtatDurable(E7).lues[CLE].mission);
export const SONDE_OK = { code: 1, sortie: 'HTTP/2.0 403 Forbidden\nContent-Type: application/json\n\n{"message":"Resource not accessible by integration","status":"403"}\ngh: Resource not accessible by integration (HTTP 403)\n' };
export const APPROUVE = [{ state: 'approved', comment: '', environments: [{ name: 'atelier-auto' }], user: { login: 'christopheplantegenest-prog' } }];
export const CREE_AUTO = '2026-10-20T15:00:00Z';
const entrees = { chantier: CH, jalon: JALON, numero: '1', commit: COMMIT_E7, empreinte: D3.empreinte };
const contexte = { ...PROV };
const historique = { total: 1, runs: [{ id: Number(RUN_AUTO), display_title: nomRun(T), run_attempt: 1, created_at: CREE_AUTO }] };
const journal = { tete: COMMIT_E7, texte: E7 };
export const fJ1 = (patch = {}) => garder({ entrees, contexte, historique, journal, ...patch });
export const fJ2F = (patch = {}) => frontiere({ entrees, contexte, journal, approbations: APPROUVE, sonde: SONDE_OK, ...patch });
// Jobs vus par J3 (noms exacts du workflow) : garde réussie, J2 terminé, étape d'appel conclue ou sautée.
export function jobsVus({ garde = 'success', appel = 'success', etape = 'success' } = {}) {
  const jobs = [{ name: NOMS_RUN.garde, status: 'completed', conclusion: garde }];
  if (appel !== null) jobs.push({ name: NOMS_RUN.appel, status: 'completed', conclusion: appel, steps: etape === null ? [] : [{ name: NOMS_RUN.etape, status: 'completed', conclusion: etape }] });
  return jobs;
}
export const fJ3 = (vus = {}) => constater({ entrees, contexte, jobs: jobsVus(vus) });
export const J1 = fJ1().texte;
export const J2F = fJ2F().texte;
export const J3 = fJ3().texte;
export const TEXTES = Object.freeze({ j1: J1, j2f: J2F, j2: J2, j3: J3, j4: J4, at5: AT5 });
// Faits rescellés après modification d'un champ (contrôle SÉMANTIQUE, pas seulement l'empreinte).
export const sceller = (o) => { const { empreinte, ...sans } = o; return canonique({ ...sans, empreinte: hacherSha256(canonique(sans)) }); };
export const modifier = (texte, f) => { const o = JSON.parse(texte); f(o); return sceller(o); };
export { lireFaitsAuto };
// Même chaîne réelle rattachée à une AUTRE D3 et à d'autres runs (dépôt de test) : J1, J2 frontière et J3 reproduits par les fonctions
// pures ; J2 et J4 réels rescellés (provenance et état seuls changés) ; AT-5 réel réécrit par ecrireFaits (provenance seule changée).
export function chaine({ commit, run, sha, run5, sha5, depot = AT5_PROV.depot }) {
  const e = { ...entrees, commit };
  const c = { ...contexte, run_id: run, workflow_sha: sha };
  const j = { tete: commit, texte: E7 };
  const hist = { total: 1, runs: [{ id: Number(run), display_title: nomRun(T), run_attempt: 1, created_at: CREE_AUTO }] };
  const lier = (t) => modifier(t, (o) => { o.provenance = { ...o.provenance, run_id: run, workflow_sha: sha }; o.etat = { ...o.etat, commit }; });
  const f = JSON.parse(AT5);
  delete f.empreinte;
  f.provenance = { ...f.provenance, run_id: run5, verificateur_sha: sha5, depot, workflow_ref: `${depot}/.github/workflows/atelier-verification.yml@refs/heads/main` };
  return {
    j1: (p = {}) => garder({ entrees: e, contexte: c, historique: hist, journal: j, ...p }),
    j2f: (p = {}) => frontiere({ entrees: e, contexte: c, journal: j, approbations: APPROUVE, sonde: SONDE_OK, ...p }),
    j3: (vus = {}) => constater({ entrees: e, contexte: c, jobs: jobsVus(vus) }),
    textes: {
      j1: garder({ entrees: e, contexte: c, historique: hist, journal: j }).texte,
      j2f: frontiere({ entrees: e, contexte: c, journal: j, approbations: APPROUVE, sonde: SONDE_OK }).texte,
      j2: lier(J2),
      j3: constater({ entrees: e, contexte: c, jobs: jobsVus() }).texte,
      j4: lier(J4),
      at5: ecrireFaits(f, hacherSha256),
    },
  };
}
