// v0.65.16 — AT-10.5 « DÉCISION HUMAINE SUR UN CANDIDAT AUTO » (GO « AT-10.5 — GO RÉALISATION LOCALE », 20/10/2026). OUTILLAGE NON COGNITIF.
// Rejeu des faits RÉELS du jalon 2 du pilote AT-9 (J2 4c383d8b, J4 27185b94, AT-5 39485411, état e7ee7e87) et non-régression des 5 D3
// réelles (2c5bb010, 4abe76c1, 50c798f4, 980eb8fe, aba5d83b). Données embarquées octet pour octet (gzip puis Base64, ASCII) ; attendus
// relevés avec le code v0.65.15 (3eb1dbf1) : lecture durable et empreinte SHA-256 du texte complet de l'écran restauré, par mode.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { monterEcran, conduire, stockageMemoire } from './atelier-aide.mjs';
import { lireRetourAuto, garder, nomRun } from '../app/atelier/auto.js';
import { lireEtatDurable, canonique, decouper, comparerEtats, etatDurableDe, texteConfirmation, confrontationDe, lirePieces } from '../app/atelier/journal.js';
import { raisonPieces, etapeDe, tentativesDuJournal, texteDemande } from '../app/atelier/parcours.js';
import { etatDe, appliquer } from '../app/atelier/chantier.js';
import { etatBudget, appliquerBudget } from '../app/atelier/budget.js';
import { ecrireFaits, lireFaits } from '../app/atelier/verification.js';
import { hacherSha256 } from '../app/atelier/empreinte.js';
import { CLE_ATELIER } from '../app/atelier/ecran.js';

const FX = {
  'j2': 'H4sIAAAAAAAC/6VWS28jNwy++1cYPscbvR+9FS3QXnoq0EOLhUFJ1GY29ow7I2fTLvLfS83Dj82mXaBGYGdIihI/ffw4n1frDRyPuN/hoRk2361Lf8I7MsauHQoUsrSn/X6ynOrj59V6vTl0bYG2PnqnGburtgJ9k3fYlh6RHIqNnyvX0PWlqS4xudhq/VIT152HpmuX5Meuacsu99DGh+ZypPVm6OIjlh0drcVYcHadsxx7pIXVvFFROplckAmclsEJ7WwOLMQoOUsyZe0gcI8cUEsufUo8JOMCSiWyQLkZMxY4jtlGgBbTGYPYHQ5NfdqgRfqjHQxIBIQQBOfKo44MbTTcBdqLg96MVdwcFLIECiIvCo/ZSqZVjiwECzFJIzWzUlGQMDmZYDWoGBzXqJ33jKPbzNUTgqcxYY9HujncVpDIUn3Hvitd7PbThgX3DfZbOJVum6Epw1YsUU/YEua4FNhjnjLm4f4BIQ33B2jaqYj+1O6gFKplRIBfrE2qBumVZYIJrf3k+tT1j3nffdoNDzCu8CxwS7gYHY3O0hNSlmkDip6B+SScFj6apcAemmGkyELHudALIxNOFcY9nBJuu+Np2OrtDDpVd+yGplxo9sVFCGIL11xkuiuJlisIXqKK2YvoDfHFE4G08ioSpZRwhogknHNWkyvoEWnKmRviLPa1k/6ohmmrypYHonk7s+l+voV7jMTydx+HafWXZ+KoctYx56BsBmeC8sYq7VKQmYgquXWJQ0QCT6BJloiuwEmBPkuU2V2yTrStIDW5wbO9oy4q9aycWaX0Yu7pFHvKe6Bmrl452l/u3iio4FCGpaTtWNKWmLCFot9V37vDWwUKzzID7Y1jyiWlMXhOTFeEr7OQrNDICAPC1zsOFKIhC66Dt3QBIPKrAmPVntfVae/fqo1PtdXv99MVHrrS5AvRyPLniaportlXxYi2HAXxhlurGSfaZ1w1twM97RjnP3z48Sn9lL7/NSX982+//22efvEwEfScTsyaOZTuuOsRJtZvsE27curn9iv4XHB3g2VEn4yllgJiJCRhvNQauGLRCiEBFFeKpCZGUCGzwCJzWgmWkXyR+3Cd+IycMlxP9r+OtF/f46m/QmFzGuADXhpq0X6vDJtRWjRfMllp9LK0c4Wn4EVL++NwWw8LgqGugpqklzZzT20XTGJScZmoEUg+lPIkgzpF5xX9zxNYJItyLIqpninxuR7BrBGjI3U0c7D/AkOrglE2UdcZUiCMkEKKCMpyZliMTFoXg9IeZYicQQwyErjWRye4CBMfz6mvduWcT9qfMwFStyIpnMfBCNoudH07jk0luRsdi5TsAowyN+rJ1H3fpia3vaZR0HgJiTkZtUFhEjBD845FqZDmpAqOkBUBSPZAGKIhBh3IyVMkwuRz0rnVKPVAZz+bn0tfp8lZ+JafNZ9bb+2n3/d3t366ryWCM8a/HsQZv4qSao5aXcXO6gZhj1cvDbcqZ2iers5a9grMWyWDJuGVdt3CaYiEQhphGBiLTNOoYFHT3BaZKYEokUaF5xyIMKTcjF4zIkl2preLbEis/z+cnL0BlZNLiBDi6zFCLoJYG/M/wcywH16jWSfQN4P5r2PhBtqzxF7AgfAWNt989zXralb6cdHmAM+70j1iW91ueVV9+z1iVq5CJ4HSPI0xx2bfFaSS/PajuJ+ru+eb1cvqH9U+DI1aCwAA',
  'j4': 'H4sIAAAAAAAC/71U227bMAx9z1cEfp4T3SX2V4ahoCQKcRfbga20D0X/fbSTrLcNWF8GGLDNi3jOIannzbZJOOQuY23uts+b7baJOBN/NxJElD5KcDY5WzSQT15Yh4b/UUBWwSpIrvm2Zk04pMOaiJWOHU37U3ccK7VYoX1Q++k88Kfdy0t87uaKw1K0MSqTdOS0xhi0kM67DGQkCQOqCOejd14Ve0mcD/ilpM32hfOaTD3zpHuG8H+JvpH3i0wfaZq7cbi/4RQ7Z3fSvHe+Pf4S8Jsy9aeJuqGuycrLYCMYzYUBpRda2SBtyKo4Am0CuGStkyoU6YJQQZjkcykBZHTZrOQbqq9jksa+79ay5Imf4ItDTUgYo5LSANkkWEknQ2RtJV5ZvUOFRSMHsZcUUPFaWFOSiNFjytppK7w2HKRcyS56iyZFRk02AAhJ4Ua1dOnAnZj5zO9cZAHICA/Ud8Na5nTa35pFiRu4e5hXNB/gSDKl2FRKNL5gcNGA84ZFirpoo7T0IUtMxCOiyGXPYhoMWhEUTbqE25kXmZp+zF3p6GodU6W6IJTCG2PZtkD/hLXSXOcb2nZF215Harf4dv2fsSsQRaAFbp4J2ViKIFk2Y1QIHrNXlgTTg2ghSOQQi0VJHgmvgkNVPmBPE30GbgEW2Jvtj0X00zTWMY3Ht7vQ4rmO7W0o23UHlsBHGnht6DY8E5UliV/z/kCY532PTH8dECbLW1qZ3ApEvlq7vBg0GC+UUNbCxfU0Tj/LcXy6v14N/7zP1+GZsJvHRfvhfDwuBr6Z6vmdCtyVgY3d48r1b/u+edn8ArtoR0VRBQAA',
  'at5': 'H4sIAAAAAAAC/6VV23LbNhB991d4+GxJAEiAZJ/6H50MBwAXEhySYAHQdprJv3d5FSU7mTr1i8zdxV7Pnv3+8PiY1NDKrobkj8fv+IkCJcP4ldCSKJorWgquBTdpCbnOCRcyw29JypoVnJVaJE/LOy87fZmeygiNBX/qbeMiHGQsD8/s5IcO/+Unur7QGNjWMo5PMlYDFSDSVKoiJVTkoi4ho0CykhkicpWLnBm+vn0BH6zrqjVbchT8SLN79T7EbMITtPjxNJVujbnWbay+YNIBJX9NksdFM+d6gdZ2U3F9f1oLBI1FH5/DEnayhDiHax36t7BXoWhuLSEiy5JF8ePpV+EihBjWgIcp4GHp5HHUHduPw2sP/yX29Ptl6ZoHMwSYOrCKArobJofoWDV2bfCUVrXUePNi1oSh771tb1X/uA5CFd2A5S2abRjQ9h5sF6ck0zIreEYpy2RKCpGTLBWUKV1KWlBV1ianSgE1REuplBRUZ5JKRUpWS05yncwuvYfBY0DQl87+PeySSeAN9BARIlcA6LlDZEm2BiWbBnwVLpJxMaZVqKIoZM4Zq7NCsiyVRgvCVcYAMgE1NTyXJtV5qZUkDC1rgIJLk3GGEpVsrhtpq3ZMJyXj3yofcGjV0tpRS4tCEPZ0C9DKds+gI+yROqEyvO6hOImWPRjlN5OeXYwb4qEZxrKjH+D9zKcubUAa12qc974n1OBAlNFYbyqIVqws60LJlGNHOC9rKSRPS0byMqPKcKaUpmmuCWU0F7yQ9xu7FAcfbqytoYs23rFVhcQD0d9VMWmwlZV2bWvjB8ow+KqV05rdq6I8/w8OrODNhnifz6Lr3Yryz3LerYfKzATxWS9zOyZ0bZJuHPnNqv6scUgQOKWw25Olg5/uVQv+DNXvXpsA5xaxsAHhpjCy7cCe1L9cpfdFoOzicLMcUkLTyDPc2r/nxY+Y8WFH5u+02wohsla8rsXv2jtq15tVNVbdg3rdkqWud+dv25Teu+i0a/b3+GAk9ufAktXiBboxles21dC7+XpcPCLY9RfoG4lgOwMydzzgm/OpkzaE8d3hhbC1LDxJla0X7s4LwVPCi1va0JjGMFHH7wz81fmvpnGvSFjmUxmejmcbL4M6rR6u13TLa6TIb23zJ/oOpwvIOpwmWG/t9E65K9jWy7JfGDO0M2m5r2vKz2E6LztJ+NZF+baabd4nxr96l103NLDfMTxgoPcCe+6cvzHBhEKwo4RzQX7G5GGDoYuyWYzHPB5+PPwLBDhtUw8KAAA=',
  'd3-e7ee7e87': 'H4sIAAAAAAAC/9VXW2/bNhR+968g9JIWsBRJtpzIKQoE2GO3FVu2h61FQFPHCVOJcnnJUhT57zskRVmWU8dbgwErUDji5Vy/c77DrxMSsVsqNAcZLUm04XWrIaa6jO/yaIq7d62Rgta4+eeEkK/4n0RVKwSAwjX3TaIVVdB/kUjdUissK9NVdrbKykXBFsV6VsIZO0uLBZ3jN03LKj8v8pItrB537x6k4q2wd9NkUSTZPHI7j/5AxKsnbbRb7eoOmOZre+C9O0Aur+JySu5o3QqSkyWh6zVntyBJDUSY5oNJUyhlSypDNlQpeuOuFKSiQpH65FJDjVGZ4qYkdLOBmlRAKn/tHuoWlxoQmhjBPxuYEmXvNajZSMLaG8HRnCTYt6mp6GJISAgUxl5yDdLGLnoHhNFKgrUHA1FxpokGduukE9CkpqTmN8IdYFRUvKKaUMZgo71RwUO06bCLna2SgyA2+zcYlOqEGi0hGNxHWxqBoS62yxrlU83vQf1IH/BEtt3h2rvy09HR9fklj+7n46TPdSR6ydFng85asXmaL+IsjfP0Klss02xZFEmaLf7wtkX6y8Zpbw2GT1vJTtYeZAca8sMaimWaJ9nZfKzBJjNGSEir6tuKfOYddAbF4b7VIHARBlQCXDcunPMiTdOwg0vXuv0Ewp4/H260FdTOFlZTU0HcboyKi7jPU6Sp5OtrL9qKTd2/3V3VSix8Gwe/m+5UWwUDlA8cgPUa71nddftXrw8etKRcqy3Ie5TbFgMNd3WN3p9Sn/tTYJKK5E712LI6V0YPQUWitbtYdt+P0+8XXpbzsfgsTbMX1JCl2RMqZvNjVGhQWgUlMeUVJM1xMcrSl5V/PhtryPP8RVXks3KsYpbOggr/+/HlEO24YL+puWqyy5e/Xf0cjZrQ7GCLyM5si8jTvRbRd8kYewUD3yUmzhkkMGB9hwi2nGahxDA6DSqzYoSpay93HWrLhyNquOqoMrQZo1vJFQwK8CBaR0ly23FnS2L3XMomgwz8Vyx/cB4ZkObQ01/B1Io85a9lzmNc7YhQ6J4Bo3eUKIOqkM2bTe0Y7Ry/LJ0h3dN7YIQaZHyOjGYEEZYNcMFKtOPGRvorKLoVa9k6QLRiasl5j+mb1uLabqFhOGgo4jJOLoZyPNkHKc+OA51M5mVeeIvxL0f0du2aVyjnxI8NlqGtu1v/Lw3D0xo7O84fD1xpzAsRJ9Y9CZrLTs2FNYXV3ZegiEwL+ZjTpAt5cp+5AQYIMkeDZuIgZe+0WAlEoZWECxd+L0Mlu7irgHGLmAH+sSBsQPkIBt5iLGdjYzyawcJ2N8Jt7M96rkfKuNA2JXpcRw3lO+WzoewThgyXEMphsTWa1yoOGPxGrfUNcUdxaE6hvCzosJsF9t3Oh9ZuuiK/782IdmO1Iq8QCDTYEAD2OgyHCADogNMJej8cz5bkjQfG24PibPm8npLWxbDssEQsMnAougdhAZB0q1swhzro0uyR8wyIX/kviN+4AL19TRSgzxKpBtxo3nnxweRIuruz5siVabDTi3ZwZlAbjvBTtql0wykNEPGwS4jHjS+bYVoImuDbxhZjT07N/340fvyfvG96vtsOJh71gzI6qg0vnzMfTaWSum0IGXuioW4MV30+D2MsdIAB80vU4odcS8Geux+33P0DWPGdqxFCXres9fN4cK97N8eZe0VLuMH+6SBw4BnNvjAvZIf24m7kGDwl160bRorBBBSWfzFivIM9EqTLTPrPXliz5XyW5Iu9F5azM37unXUkm4/dGZn4zBNtvpydJ4t0tmdipzb24gV8t53wAMzobnDZOXG6HeHCQEkfeGMaOz7On/DpuJnyfOwTiBusAscH3TQ5eZz8DSN57wzCEQAA',
  'd3-2c5bb010': 'H4sIAAAAAAAC/8UZaY/ctvX7/gpiUMAxMDMmRYqktkUBwzmA1HGM1gmKZI0BRT7tytZIEx0bJ8H+9z5Sx2hm9myM1liPJD7p3Rcf/zgjC3tlyjaHenFOFru8qFpYmTZZLBH0oerq0hQI+fmMkD/wP1m4qiwBGlwLz2SRmgamJ7JorozHJB1wlQjHtBLcxC7LUsGVAgEsoTKyWrpEcwBPJ3x3DXWTV6X/lq5lvGZ8ESA3/QuL3J0y6Ner9APYNs889G2AkpfvVgk5Jw66T/jTttCQH/6Nd6R49rKFAmUlO1MTs9tB4ZfdRUcpJNdQVLi0hbIlXZn/0sGSNKZsyBaRdjWx1WWZI6X1SHpXmHLQDSGjAlChdd5C7XWyeP2sR21rU5KRtsmy3F4hN4YMQpMiv677N2Hg8+0/iPO026prSAGeCQfNwFCdQ0m83S4RnXtmuraGkatJVQPuldl93INaFM60+TU035lP+BbbQ/K25/nHgadDPibV9VYhN+Hy/myy0KKc0C1+6UwZeIhoJFeMriL6jvFzwc6pWEeC/dQztGh/2wWSVYfMth5zwHXiaDMK0f0U5DmN1wmLjyl4U6EmdrUndTeh3q7BMWYuHZ6bmbYWqMUaYLMNOuSSUjpCcGnTVh+hDO8fQNCARWDGFqZzsKp2XbOKV/EUAq2p82zT48b3BA3/DqFNVWOwekX0UHoQJA5mTjyTALIMv/O0i+rXiR58amuTt83ehycn9mkBtnkIRxT/hemN/wK8J68/NJNHeZpp185diSyy8GEyPN8sPwNyLY/RM/05CSgVHRNQCf+cEkSROhEh4uoxJDCDtc1IZGVyB+vt42zA6GfFH3F6TCGKJzP01/efz50/mKKvCKe5LISTB7384d33i6M0xO9NEnFyzpO1VNFxkpiS4wqzhYUH80Tmg2eD2bfyX/9xUZKLPldsULHNBS62NRaRsG6rskHkfrHsimJc7MKK/xQftxXSL8OKpAkVy355rseLmSLn0F6PFzNFIvSmp+KZ8dqbUdpVedluMnRWe5XPGUVYU9mP0G6sl9a2MELn+HY14PcBhI9axRm1kIFUhnFGmTCp0TpiykRx5pyOVMTASUUt5zRNsgRYKjnWf2cgSS8WA9rW7AaUQYmz9bmSbLXd5m3/ns6yiGcsYSkFZzHAlE0sd1Rl3DkXxwYo0rLQozplnTrOhbGKGSVjaZKIWWmokInRWIqFik0WYa8iwQrmUia05UhJIWJhlM3ii8VeK6jjbkBbww6tDSuvwg5GObD2tJWtilHGMdrQfVbBk1bR7NVrKL0PzgSvIRvRZ82LKzCuebE1eTkJV3flxmC3s90N6mEHoNz1qzwRgnLJWJJM8F+r+mOGpWGD3Vv/1mP7t7kKsJg0vZvtXXzQxYGX+zrYUzmqhBM/qIBd1WCzNfPaU/O5SKfKxiCtyIRyyqbInuI20UxnQiiruaaptczpJOI2oklmM6ARCCZZqtRADjH5hgyNEWL257A20AweF/Lk5JknyX5EcwuHMUSZ4qmjmttYQiSdoRK4wEgQwJ0RqeaCRalJOBh0NewA0zhFIHM2zWh2gHqIg6DBPMthDqwwUtvAPqMypmoPqZGlwtjQEfQv9KCb5X1yHlaEIOlqSMJrD/P14R65USwXpUmKDZCOkwhltSKiyklt08iC01ZlYNAaSZokkYoVpzamRjrKJBcSbpfbhgR4q9CMJo8QOVzej0bHtj7P5t7qF7Hrb0a3m6/75N0NfBx4p4ffjGEG4fMp1PB5Qxl7dfkl/P7T7kP55m0KP6q37bV5G02+vsccTUm9aavdpgYzhBMqoXSbFjdj01ctNm+wOVK7jrWywiacMUO1MSLBhVhwbZ1O4zjTliqhVapZDDFDUyTGRVJpyZlIrE6PsM/0m0g5grBYbqCucUd0oKOLRdeYSzgI16lkKRHLSZNTqWJxLIL6ZinEa7CFg3xf75pjQWNsRCxwKnSiASsOFyLTgKnAoigZCgwUqImxisYYVhh8wiqtUL8Yg0ZqNwnaY58JKoWMB5irsGxCfUwbMBtKIVKhdMwUU5hNGfBIplYhfZoxJnWCFy4xPWmZporHklvG0pTFKtoXoxH/jHqs9Ui9b9l7kpiZ9yWs33qkVV0GhnisJ9uMaWzj9+T7XDaE+BMy2UlAZ4lCYVLusiizOnNUCptZgelM2yh2GuPaKIOplTuh0sSyhKOajcWEFmcmyeaYp3hGCg34fmcPG3Ykszw8XbG5He+S4eb98uQdLZf7+7vf8+3+dJ/wu/H5rn3/wNX4Zn99P3He52STFnDQTp3kZp7osD6k31tNc3s7frdxJMNsi+4mMYMqoDEIi+kUHS/KqIgAOPYyNsGcgFZCh6QxZ5iOOTZPkEmQ7vMah9E7tem3D9N9nDxOl5kpmluViSKwJ+rygUJ2pNl9/j/QjEnvU8wTXcLT6IXwv++HQN5PES6mMcIjuqd9Hp22MoMxp7HZi9lW6gXznyDhcU+139Dsk57f2vzZFn/EH3pkj/CwQ148dbs3rY1zP6z4YbIWJnrjJK3oB4HXpsiHCV8Y+726Mu03b9+RL775Hn3oPObP1+SfXUlmffGSBE2QbyMyir4c0QbGSc/4Eq9+NUtbYk1hu2KgE7ZvxD+k8V/W5BXuQ3NnWgIRTw22quSLgYAgJuVRFgn2fEmu+69xP5db47sLL0BMmoGwGQWbBpBlt4Xabz7Z0QZY3LMBjs8pO4+StaDq7g2wQfGKYQd8Frb06ENgp93v4sCNxi3xwsEWKcIYO2eTU/WREZ6H3ehs3Ib+VucNzOZQ9w5VHhXT/ZhymEX8r2bUd4/SZ3PhuZj/gq5oyG3CEmjJY+QcxsBlO81/F68NaTokhc6JfXDwGY1PO9NgHiXmGiwxHdlWedkQ9PvSj0RxwWMk5/OpNPJlahMQIDdQku+//pr0d9+9fPPDV6/JXxGT7UogYQRNfq/wFv96nvYcvfQvkdBUEviUN37KQcpnnmANbT74NWJD4naMoRJ3k43fA69ysx6UsL5mnoECCDZHWwwoF8botkLnJNgstyQvA/EeR7M+dAMHNveSzdwR/bOugtEODNNzjEkHo+Bk8D+Ch6yyCylAtEfEfPKs3cF4Nbi137PPvXln7EdsnHGpKqfFqmvzolmNXnGIecyTozt7O2OvOA59F1+V5AoN0k/wTw8glsRbrMgv8ddDTUrejLom138brP/3Pn2ltx1XeFcajyvClRI/u4J6onDL2QX5At1nOXjOkvhE/nw6YAkb2jq8HFypIXOhmr3m7zzbeOIBxs3///hoyrb7wW2f2mYO86gUcP4U2zwc1aMfz2pKjR/1Bwg+r/dF4WZfFL6EXZePByT7QVeYjg+sD0eJKxYOFmu4xCwQzHXPyaL9zfZI9rl0NVSy2RFcVoUax+bj5XEd6zqC4jnEt7V10Dl92uFVhK3CGnvs46IZuFw9dIT1mAJxIswRgw+cfYlzwdZS6hMGB6KrHn8Jf45L+AS2a4cyeFdjObVo5lO+7ba+JZHiVKLHDepPTvOgvMSMGdLdA6I8idkH2tNhPD9O5/+bluv06NMfAYxd1tnN2X8AFWvfI5EfAAA=',
  'd3-4abe76c1': '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',
  'd3-50c798f4': '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',
  'd3-980eb8fe': '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',
  'd3-aba5d83b': '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',
};
const RELEVE_AVANT = {"2c5bb010": {"etape": "chantier-bloque", "verdicts": {}, "empreinte": "176b3261db8b44370e3aa1ae0360ecf174b31557993cee510039c25a38a3c90a", "octets": 8081, "ecran": {"OFF": "4632b32b65445b7c81c0695eff4e53612da5d3d9f46439efa09eb85e79e7f85a", "MANUEL": "5227f4f5f93d8371ef4e70f821fb26c8b6268fcacc8466f55ae51d02b0445b81", "AUTO": "27be1f2708d3be7f27a755d05e3e0cd62a3acdd15a866a1702b431873994b53e"}}, "4abe76c1": {"etape": "chantier-bloque", "verdicts": {}, "empreinte": "a40141e5b55b04c29a337e480ae368961da0b64fbfb6993acac5e9d3a2f7d742", "octets": 8589, "ecran": {"OFF": "0aff4d19754e236a6b99f852c8b0551c6408e3b9a50b52fbbe9660bd11415737", "MANUEL": "132fef6ff58e60342876eac280b733587228df67812ef6daa7782a5b7f6d06ca", "AUTO": "595eb2105b1bd399a23b2066cbe11695a25daed84004d9e08584b455ae1f7717"}}, "50c798f4": {"etape": "chantier-termine", "verdicts": {"temoin-1/1": "verification-technique-conforme"}, "empreinte": "505d3b1a7e9e5b017b62460c5aa5607d0b0910fd9b05bd02fe594d5122fd24b3", "octets": 6953, "ecran": {"OFF": "288e70d5ff7fae11f8617428d14838185c545e1d74b4b8777de52cd236899436", "MANUEL": "0ce557b7e25fe3f53fd4930d59337006d3ae7ca3b4907492bebd11743dd2eb09", "AUTO": "59c46fb03d200a11b64a556a38952fd148dfec6d0a4902f20594a2d79dac69d4"}}, "980eb8fe": {"etape": "mission-a-lancer", "verdicts": {}, "empreinte": "37b814dff9a8fd6ede1ad68ad281067e797eef1b6194bdab0c3ea45dfa35034d", "octets": 4820, "ecran": {"OFF": "13e94492db9ce5379fb7fa5124407843175bd858622068adafc453973b9ec4df", "MANUEL": "314c0ca994fb901b56fe7e7e965a203dd32839ed435e15a7521323be0b8e3cd0", "AUTO": "50702d1ca7900df657e18932ce517e54de525590d6415e55f99250ce2850948c"}}, "aba5d83b": {"etape": "mission-a-lancer", "verdicts": {}, "empreinte": "4e93e8e1caeeae239a301a53e632d25b1cc706cf88d6207cca9ac14ab41c82e5", "octets": 5539, "ecran": {"OFF": "36a363f8ddc7bc6bbfe3d074bce54e5396153ae948d01d30d794bdaf3aa0f708", "MANUEL": "01e6178a3b24673c1f1d97f22e5c08128284ab07a69cff22fa8a3065e24a7423", "AUTO": "34a8af879c85dfc901bb4c31f816e577b850d1e20e46e2d2bb56d4879eb355ba"}}, "e7ee7e87": {"etape": "rapport-attendu", "verdicts": {}, "empreinte": "af3a0e791ae29ef73054fc0bb7acd36350734af326fd6b75a4cb815e589901e8", "octets": 4546, "ecran": {"OFF": "5efce853f0e5e471fc7090ccd14d3597e43077af83058fdd6d05d14f3de54c21", "MANUEL": "6815b7b60c999cccb7fdeaaf710dd0d1194d0aba9267d1a0e709585ceec88796"}}};
const MANUEL_AVANT = {"conforme": [["ouvert", "77ff365937dfd44b092ef4ff25112d654f06577628858577fe5449f74f8460a4"], ["en-cours", "3b2d6b70fab66af1a62f0d0c2dae8460ecb61a6cfd3f23ff3c6570d2bead2d2a"], ["lancee", "0d0492226366a1be0068b63fd171b7a6eceab44ba8e175007b61e05dabe6bcfa"], ["lancee-sauvegardee", "99ee0cdae4035a7bec3f7687e52aed9e3fa1e64f95050d9f24f2f79a8616867c"], ["rendue", "ad9fd4da3d105f30b75363d5c13ba0bee75277638d8902e83d88f0f0b0fafba5"], ["demandee", "2a84648d174331d1551c841963f0b48f8c935b6178c5a48f762f450cf9254af0"], ["faits", "8fe7397bcece9ebdbdc4302b02192ca7aca2c5ed366334322cfa3dec0916cac8"], ["decide", "e7c419317e4ecc55d23f17f122a3d1853cff1d4dd8957717c267460171d76efd"], ["faits-off", "9a3a32bebb7cd793030008d2a2aa258929f81e6ceb27690ab6460d16b0ed8bb6"], ["faits-auto", "ef8dfe85c92e5e2c2e9eca76a168c568109e0636f2a53b468abbfe4d6dac8950"]], "non-conforme": [["ouvert", "77ff365937dfd44b092ef4ff25112d654f06577628858577fe5449f74f8460a4"], ["en-cours", "3b2d6b70fab66af1a62f0d0c2dae8460ecb61a6cfd3f23ff3c6570d2bead2d2a"], ["lancee", "0d0492226366a1be0068b63fd171b7a6eceab44ba8e175007b61e05dabe6bcfa"], ["lancee-sauvegardee", "99ee0cdae4035a7bec3f7687e52aed9e3fa1e64f95050d9f24f2f79a8616867c"], ["rendue", "ad9fd4da3d105f30b75363d5c13ba0bee75277638d8902e83d88f0f0b0fafba5"], ["demandee", "2a84648d174331d1551c841963f0b48f8c935b6178c5a48f762f450cf9254af0"], ["faits", "388734c84753c6fcb97da1f084bd60e0a295f23d391c90366c067c055a73ff1f"], ["decide", "865710894c7a13ac3f65b96ca156206592c11af7dd7ff187419b6c54e7675710"], ["faits-off", "6cc799e51bcdcbecce01da34809005f7fbc8e85817f52d49e281c18bd5cd27ac"], ["faits-auto", "90f0987c2864a1a2763bba806e5f7c7b1f36192473ac1e1b8d49e5031a9f7cd3"]], "impossible": [["ouvert", "77ff365937dfd44b092ef4ff25112d654f06577628858577fe5449f74f8460a4"], ["en-cours", "3b2d6b70fab66af1a62f0d0c2dae8460ecb61a6cfd3f23ff3c6570d2bead2d2a"], ["lancee", "0d0492226366a1be0068b63fd171b7a6eceab44ba8e175007b61e05dabe6bcfa"], ["lancee-sauvegardee", "99ee0cdae4035a7bec3f7687e52aed9e3fa1e64f95050d9f24f2f79a8616867c"], ["rendue", "ad9fd4da3d105f30b75363d5c13ba0bee75277638d8902e83d88f0f0b0fafba5"], ["demandee", "2a84648d174331d1551c841963f0b48f8c935b6178c5a48f762f450cf9254af0"], ["faits", "1621e2b3f5d42d5c0548fcbc612ddbc38f51cbf0f05b710f78b6f0646b70ede5"], ["decide", "86ec5943a8f87c7a2175ddcfb7154ebe38d3bd1f72b0bcfea795fe218091617a"], ["faits-off", "89c249a75cbbf5040b0765c29f5f74c9bca62f1e0597090642e25f96ce604b6c"], ["faits-auto", "ad794cd45d7af3df63c2cb0ac2a2c80774a11c03b5745d43f139e99cad5c5e4e"]]};

const fx = (nom) => gunzipSync(Buffer.from(FX[nom], 'base64')).toString('utf8');
const VERSION = '0.65.15';
const CH = 'pilote-at9-j2';
const JALON = 'run-at5';
const T = `${CH}/${JALON}/1`;
const CLE = `${JALON}/1`;
const COMMIT_E7 = 'e7ee7e87f6a3eaeabb21149e5c0e7c618bb191a5';
const SHA_CANDIDAT = '42de16e633ab8301676d9e41e0492f067b7672f5';
const RUN_AT5 = '39478653058';
const J2 = fx('j2');
const J4 = fx('j4');
const AT5 = fx('at5');
const E7 = fx('d3-e7ee7e87');
const h = (t) => createHash('sha256').update(t).digest('hex');
// MISE À JOUR DÉLIBÉRÉE v0.65.18 (AT-10.1) : la section « 12. Carnet de trois missions » s'ajoute en fin d'écran, indépendante du chantier.
// Les empreintes v0.65.15 portent sur tout le reste de l'écran, inchangé ; la section 12 est contrôlée à part (aucun carnet : texte fixe).
const textesDe = (e) => [e._texte, ...e.children.flatMap(textesDe)].filter(Boolean);
function horsCarnet(a) {
  const [carnet, ...autres] = a.zone.children.filter((c) => c.attrs['data-atelier-section'] === 'carnet');
  assert.equal(autres.length, 0);
  assert.ok(carnet && textesDe(carnet).join('\n').includes('Aucun carnet sur cet appareil.'), 'section 12 présente, sans carnet');
  // MISE À JOUR DÉLIBÉRÉE v0.65.19 (AT-10.2, E-T1) : le bouton d'effacement du chantier nomme le CHANTIER et son identifiant ; il est
  // ramené à son libellé v0.65.15 (une seule occurrence, forme exacte contrôlée) avant l'empreinte : tout le reste de l'écran est inchangé.
  const texte = a.zone.children.filter((c) => c !== carnet).flatMap(textesDe).join('\n');
  const libelles = texte.match(/^(Confirmer : effacer le CHANTIER « [a-z0-9-]+ » \(mode OFF, chantier local perdu, sauvegarde GitHub intacte\)|Effacer le CHANTIER( « [a-z0-9-]+ »)? de cet appareil)$/gm) || [];
  assert.equal(libelles.length, 1, 'un seul bouton d\'effacement du chantier, nommé');
  return texte.replace(libelles[0], libelles[0].startsWith('Confirmer') ? 'Confirmer : effacer l\'atelier de cet appareil' : 'Effacer l\'atelier de cet appareil');
}
const durable = (c) => canonique(etatDurableDe(c));
const CONSIGNE_DEV = 'Appel de développement lancé : sauvegarde-le, copie la demande AUTO pour Claude, puis colle ici les faits J2 et J4 du run, lis-les, puis enregistre le candidat ou clos la tentative (section 11).';
// Faits AT-5 valides FABRIQUÉS à partir des faits réels (champ remplacé, empreinte rescellée par ecrireFaits).
const at5 = (patch) => { const f = JSON.parse(AT5); delete f.empreinte; return ecrireFaits({ ...f, ...patch }, hacherSha256); };
// Faits AUTO (J2, J4) modifiés d'un champ puis rescellés : le contrôle SÉMANTIQUE est testé, pas seulement l'empreinte.
const sceller = (o) => { const { empreinte, ...sans } = o; return canonique({ ...sans, empreinte: hacherSha256(canonique(sans)) }); };
const modifier = (texte, f) => { const o = JSON.parse(texte); f(o); return sceller(o); };
const missionE7 = () => structuredClone(lireEtatDurable(E7).lues[CLE].mission);

async function restaurer(texte) {
  const a = monterEcran({ version: VERSION });
  await a.cliquer('mode-manuel');
  for (const p of decouper(texte, JSON.parse(texte).chantier)) { a.saisir('partie-restauration', p); await a.cliquer('ajouter-partie'); }
  await a.cliquer('confirmer-restauration');
  return a;
}
// Rejeu D12 : état e7ee7e87 restauré, sauvegarde confirmée (celle que le run a lue), mode AUTO.
async function pret({ texte = E7, commit = COMMIT_E7 } = {}) {
  const a = await restaurer(texte);
  await a.cliquer('mode-auto');
  a.saisir('confirmation-sauvegarde', texteConfirmation({ chantier: CH, empreinte: h(texte), commit }));
  await a.cliquer('enregistrer-confirmation');
  return a;
}
async function lire(a, j2 = J2, j4 = J4) {
  a.saisir('faits-auto', j2);
  a.saisir('faits-candidat', j4);
  await a.cliquer('lire-faits-auto');
}
async function enregistrer(a, j2, j4) { await lire(a, j2, j4); await a.cliquer('enregistrer-auto'); }
const etape = (c) => etapeDe({ etat: etatDe(c.journal), pieces: lirePieces(c.pieces, c.piecesDepuis), journal: c.journal, verdict: null }).etape;

// ------------------------------------------------------------------------------------------------ 1. atomique, idempotent, coût une fois
test('T1.1 rejeu réel : J2 4c383d8b + J4 27185b94 sur e7ee7e87 => tentative rendue, coût 98 500 inscrit, demande = J4, UNE écriture', async () => {
  const a = await pret();
  assert.equal(a.etape(), `Prochaine étape : ${CONSIGNE_DEV}`);
  await lire(a);
  assert.match(a.un('auto-retour').textContent, new RegExp(`^CANDIDAT AUTO LISIBLE — atelier/${CH}/${JALON}/1@${SHA_CANDIDAT}`));
  assert.equal(a.un('enregistrer-auto').textContent, 'Enregistrer le candidat AUTO (coût réel 0,0985 USD)');
  assert.equal(a.un('clore-temoin').className, 'bouton-secondaire'); // D11 : l'abandon explicite reste possible, en second
  const avant = a.stockage.ecritures;
  await a.cliquer('enregistrer-auto');
  assert.equal(a.stockage.ecritures, avant + 1);
  const c = a.copie();
  const ev = c.journal.at(-1);
  assert.deepEqual(ev.donnees, { jalon: JALON, numero: 1, reference: `atelier/${T}@${SHA_CANDIDAT}`, mode: 'AUTO', faits_auto: J2, faits_auto_empreinte: JSON.parse(J2).empreinte, faits_candidat: J4, faits_candidat_empreinte: JSON.parse(J4).empreinte });
  assert.equal(ev.type, 'tentative-rendue');
  assert.deepEqual(c.registre.at(-1).donnees, { execution: T, montant: 98500, issue: 'reponse-connue' });
  assert.deepEqual(etatBudget(c.registre).executions[T].statut, 'payee');
  assert.deepEqual(c.pieces[CLE].demande, JSON.parse(J4).demande_at5);
  assert.equal(c.pieces[CLE].rapport, null);
  assert.equal(etape(c), 'faits-attendus');
  assert.equal(a.un('candidat-recu').textContent, `Candidat AUTO (branche créée par le run, non vérifiée) : atelier/${T}@${SHA_CANDIDAT}`);
  assert.equal(a.un('auto-rapport').textContent, `Candidat AUTO enregistré : atelier/${T}@${SHA_CANDIDAT} — faits J2 4c383d8b / J4 27185b94`);
  const lu = lireEtatDurable(durable(c));
  assert.equal(lu.raison, undefined);
  assert.equal(lu.etape.etape, 'faits-attendus');
});
test('T1.2 idempotence : plus de geste « Enregistrer » ; AT-1 refuse une 2e « tentative-rendue », AT-2 un 2e coût pour T', async () => {
  const a = await pret();
  await enregistrer(a);
  const s = a.stockage.getItem(CLE_ATELIER);
  assert.equal(a.trouver('enregistrer-auto').length, 0);
  assert.equal(a.trouver('lire-faits-auto').length, 0);
  assert.equal(a.stockage.getItem(CLE_ATELIER), s);
  const c = a.copie();
  assert.match(appliquer(c.journal, { type: 'tentative-rendue', quand: 'x', donnees: { ...c.journal.at(-1).donnees } }).raison, /tentative déjà rendue/);
  assert.equal(appliquerBudget(c.registre, { type: 'cout', quand: 'x', donnees: { execution: T, montant: 98500 } }).limite, 'doublon');
});
test('T1.3 refus AT-2 pendant l\'écriture (coût déjà inscrit pour T) : rien n\'est écrit, ni journal, ni pièce, ni registre', async () => {
  // État fabriqué : e7ee7e87 + coût déjà inscrit pour T ; J2 et J4 rescellés sur CET état (le run l'aurait lu).
  const e = JSON.parse(E7);
  e.registre = appliquerBudget(e.registre, { type: 'cout', quand: '2026-10-20T17:00:00.000Z', donnees: { execution: T, montant: 0 } });
  const texte = canonique(e);
  const etat = { commit: 'a'.repeat(40), empreinte: h(texte) };
  const a = await pret({ texte, commit: etat.commit });
  const s = a.stockage.getItem(CLE_ATELIER);
  await enregistrer(a, modifier(J2, (o) => { o.etat = etat; }), modifier(J4, (o) => { o.etat = etat; }));
  assert.match(a.un('message').textContent, /^Enregistrement du candidat AUTO impossible : coût réel refusé \(doublon\).*Rien n'est enregistré\.$/);
  assert.equal(a.stockage.getItem(CLE_ATELIER), s);
});
test('T1.4 stockage en panne : rien n\'est retenu, l\'étape reste « auto-lancee »', async () => {
  const a = await pret();
  const s = a.stockage.getItem(CLE_ATELIER);
  await lire(a);
  a.stockage.panne = true;
  await a.cliquer('enregistrer-auto');
  assert.match(a.un('message').textContent, /Copie locale non enregistrée sur cet appareil/);
  a.stockage.panne = false;
  assert.equal(a.stockage.getItem(CLE_ATELIER), s);
  assert.equal(a.trouver('enregistrer-auto').length, 1);
});
test('T1.5 + T1.6 coût compté une fois ; relecture durable sans coût, ou avec un autre montant : refusée', async () => {
  const a = await pret();
  await enregistrer(a);
  a.saisir('faits-colles', AT5);
  await a.cliquer('confronter');
  a.saisir('motif-decision', 'Rejeu D12.');
  await a.cliquer('refuser');
  const c = a.copie();
  assert.equal(c.registre.filter((x) => x.type === 'cout' && x.donnees.execution === T).length, 1);
  const d = JSON.parse(durable(c));
  assert.equal(lireEtatDurable(canonique(d)).raison, undefined);
  const sansCout = { ...d, registre: d.registre.filter((x) => !(x.type === 'cout' && x.donnees.execution === T)) };
  assert.match(lireEtatDurable(canonique(sansCout)).raison, /coût AUTO absent ou différent/);
  const autre = structuredClone(d);
  autre.registre.find((x) => x.type === 'cout' && x.donnees.execution === T).donnees.montant = 98501;
  assert.match(lireEtatDurable(canonique(autre)).raison, /coût AUTO absent ou différent/);
  assert.match(lireEtatDurable(canonique({ ...d, registre: null })).raison, /coût AUTO absent ou différent/);
});

test('T1.7 lecture exigée sur les textes actuels ; D11 : « Clore : RÉPONSE CONNUE » reste l\'abandon explicite (coût inscrit, aucun candidat)', async () => {
  const a = await pret();
  const s = a.stockage.getItem(CLE_ATELIER);
  await lire(a);
  a.saisir('faits-candidat', modifier(J4, (o) => { o.fichiers[1].octets = 1; })); // texte changé APRÈS la lecture
  await a.cliquer('enregistrer-auto');
  assert.match(a.un('message').textContent, /lis d'abord ces faits J2 et J4 \(« Lire le retour »\)\. Rien n'est enregistré\.$/);
  assert.equal(a.trouver('enregistrer-auto').length, 0); // redessiné : la lecture ne vaut plus pour ces textes
  assert.equal(a.stockage.getItem(CLE_ATELIER), s);
  await lire(a);
  a.saisir('motif-auto', 'Candidat abandonné sans examen (D11).');
  await a.cliquer('clore-temoin');
  const c = a.copie();
  assert.equal(c.journal.at(-1).type, 'tentative-annulee');
  assert.deepEqual(c.registre.at(-1).donnees, { execution: T, montant: 98500, issue: 'reponse-connue' });
  assert.equal(lireEtatDurable(durable(c)).raison, undefined);
});

// ------------------------------------------------------------------------------------------------ 2. R1 à R14 (faits réels altérés)
test('T2 lireRetourAuto : faits réels lus ; chaque contrôle R1 à R14 refuse un champ altéré, dans l\'ordre', () => {
  const mission = missionE7();
  const lireR = (p = {}) => lireRetourAuto({ j2Texte: J2, j4Texte: J4, t: T, mission, ...p });
  const ok = lireR();
  assert.equal(ok.raison, undefined);
  assert.equal(ok.retour.montant, 98500);
  assert.equal(ok.retour.reference, `atelier/${T}@${SHA_CANDIDAT}`);
  assert.deepEqual(ok.retour.demande, JSON.parse(J4).demande_at5);
  assert.ok(Object.isFrozen(ok.retour));
  const frontiere = sceller({ appel: null, appel_emis: false, etape: 'frontiere', etat: JSON.parse(J2).etat, frontiere: null, protocole: 'atelier-auto-faits-1', provenance: JSON.parse(J2).provenance, raison: null, resultat: 'pret-a-appeler', tentative: T });
  const cas = [
    ['R1 J2 tronqué', { j2Texte: J2.slice(0, 500) }, 'j2-illisible:JSON illisible (tronqué ?)'],
    ['R1 J2 recompacté sur une ligne (incident AT-9)', { j2Texte: JSON.stringify(JSON.parse(J2)) }, 'j2-illisible:forme non canonique (copie altérée ?)'],
    ['R1 J2 et J4 inversés', { j2Texte: J4, j4Texte: J2 }, 'j2-illisible:clés des faits inattendues'],
    ['R1 J2 retouché sans rescellement', { j2Texte: J2.replace('"montant": 98500', '"montant": 98400') }, 'j2-illisible:empreinte : ne correspond pas au contenu'],
    ['R2 J2 de la frontière (PRET_A_APPELER)', { j2Texte: frontiere }, 'j2-pas-un-appel'],
    ['R3 J2 d\'une autre tentative', { j2Texte: modifier(J2, (o) => { o.tentative = `${CH}/${JALON}/2`; }) }, 'j2-autre-tentative'],
    ['R3 T différent', { t: `${CH}/${JALON}/2` }, 'j2-autre-tentative'],
    ['R4 second essai', { j2Texte: modifier(J2, (o) => { o.provenance.run_attempt = '2'; }) }, 'j2-hors-premier-essai'],
    ['R4 hors de main', { j2Texte: modifier(J2, (o) => { o.provenance.ref = 'refs/heads/autre'; }) }, 'j2-hors-premier-essai'],
    ['R4 issue inconnue', { j2Texte: modifier(J2, (o) => { o.issue = 'issue-inconnue'; o.raison = 'delai-depasse'; o.cout = null; }) }, 'j2-sans-reponse-connue'],
    ['R5 proposition bloquée', { j2Texte: modifier(J2, (o) => { o.raison = 'proposition-bloque'; o.reponse.proposition = { empreinte: null, fichiers: [], motif: null, question: 'Quoi ?', statut: 'bloque' }; }) }, 'j2-sans-proposition'],
    ['R5 raison de refus', { j2Texte: modifier(J2, (o) => { o.raison = 'proposition-identite'; }) }, 'j2-sans-proposition'],
    ['R5 chemins en double', { j2Texte: modifier(J2, (o) => { o.reponse.proposition.fichiers[1].chemin = o.reponse.proposition.fichiers[0].chemin; }) }, 'j2-sans-proposition'],
    ['R6 J4 tronqué', { j4Texte: J4.slice(0, 300) }, 'j4-illisible:JSON illisible (tronqué ?)'],
    ['R7 J4 d\'une autre tentative', { j4Texte: modifier(J4, (o) => { o.tentative = `${CH}/${JALON}/2`; }) }, 'j4-autre-tentative'],
    ['R8 J4 branche existante', { j4Texte: modifier(J4, (o) => { o.statut = 'branche-existante'; o.raison = 'branche-existante'; o.candidat.distant = 'd'.repeat(40); o.demande_at5 = null; }) }, 'j4-sans-candidat'],
    ['R8 J4 non relu à distance', { j4Texte: modifier(J4, (o) => { o.candidat.distant = 'd'.repeat(40); }) }, 'j4-sans-candidat'],
    ['R9 run différent', { j4Texte: modifier(J4, (o) => { o.provenance.run_id = '39470202560'; }) }, 'run-different'],
    ['R9 workflow différent', { j4Texte: modifier(J4, (o) => { o.provenance.workflow_sha = 'f'.repeat(40); }) }, 'run-different'],
    ['R10 état D3 différent', { j4Texte: modifier(J4, (o) => { o.etat.empreinte = 'f'.repeat(64); }) }, 'etat-different'],
    ['R11 autre branche', { j4Texte: modifier(J4, (o) => { o.candidat.branche = `atelier/${CH}/autre/1`; }) }, 'candidat-etranger'],
    ['R11 autre base', { mission: { ...mission, base: { ...mission.base, sha: 'f'.repeat(40) } } }, 'candidat-etranger'],
    ['R12 octets différents', { j4Texte: modifier(J4, (o) => { o.fichiers[1].octets = 1600; }) }, 'fichiers-differents'],
    ['R12 fichier en moins', { j4Texte: modifier(J4, (o) => { o.fichiers.pop(); }) }, 'fichiers-differents'],
    ['R12 état différent', { j4Texte: modifier(J4, (o) => { o.fichiers[1].etat = 'modifie'; }) }, 'fichiers-differents'],
    ['R13 version_candidat', { j4Texte: modifier(J4, (o) => { o.demande_at5.version_candidat = '0.65.16'; }) }, 'demande-at5-incoherente'],
    ['R13 candidat de la demande', { j4Texte: modifier(J4, (o) => { o.demande_at5.candidat = 'd'.repeat(40); }) }, 'demande-at5-incoherente'],
    ['R13 version de base', { mission: { ...mission, base: { ...mission.base, version: '0.65.13' } } }, 'demande-at5-incoherente'],
    ['R14 mission d\'un autre jalon', { mission: { ...mission, jalon: { ...mission.jalon, id: 'autre' } } }, 'mission-etrangere'],
    ['R14 mission d\'une autre tentative', { mission: { ...mission, tentative: 2 } }, 'mission-etrangere'],
  ];
  for (const [nom, p, raison] of cas) assert.deepEqual(lireR(p), { raison }, nom);
  // Ordre : un J2 et un J4 tous deux faux rendent la raison de J2.
  assert.deepEqual(lireR({ j2Texte: modifier(J2, (o) => { o.tentative = `${CH}/${JALON}/2`; }), j4Texte: J4.slice(0, 10) }), { raison: 'j2-autre-tentative' });
});
test('T2.15-T2.17 écran : J2 et J4 inversés, J2 recompacté, état confirmé différent ou modifié depuis : refus en clair, rien n\'est écrit', async () => {
  const a = await pret();
  const s = a.stockage.getItem(CLE_ATELIER);
  await lire(a, J4, J2);
  assert.match(a.un('message').textContent, /^Lecture des faits impossible : faits AUTO illisibles : clés des faits inattendues/);
  await lire(a, J2, modifier(J4, (o) => { o.provenance.run_id = '1'; }));
  assert.equal(a.un('auto-retour').textContent, 'Retour refusé : J2 et J4 viennent d\'un run différent. Aucun candidat ne peut être enregistré.');
  assert.equal(a.trouver('enregistrer-auto').length, 0);
  await lire(a, JSON.stringify(JSON.parse(J2)));
  assert.match(a.un('message').textContent, /forme non canonique/);
  assert.equal(a.stockage.getItem(CLE_ATELIER), s);
  // Sauvegarde confirmée d'un autre commit que celui lu par le run.
  const b = await pret({ commit: 'f'.repeat(40) });
  const sb = b.stockage.getItem(CLE_ATELIER);
  await enregistrer(b);
  assert.match(b.un('message').textContent, /le run n'a pas lu l'état de cet appareil \(sauvegarde confirmée différente/);
  assert.equal(b.stockage.getItem(CLE_ATELIER), sb);
  // État modifié après la sauvegarde confirmée (un autre plafond de chantier au registre) : la demande AUTO et l'enregistrement sont refusés.
  const c = a.copie();
  c.registre = appliquerBudget(c.registre, { type: 'chantier-plafonne', quand: '2026-10-20T17:00:00.000Z', donnees: { chantier: 'autre', plafond: 1 } });
  const st = stockageMemoire(JSON.stringify({ ...c, mode: 'AUTO' }));
  const d = monterEcran({ version: VERSION, stockage: st });
  const sd = st.getItem(CLE_ATELIER);
  await enregistrer(d);
  assert.match(d.un('message').textContent, /le run n'a pas lu l'état de cet appareil \(état modifié depuis/);
  assert.equal(st.getItem(CLE_ATELIER), sd);
});
test('T2 pièces : rendue AUTO altérée, MANUEL rendue avec un mode, ou relue sans le lecteur du retour : refusée', async () => {
  const a = await pret();
  await enregistrer(a);
  const c = a.copie();
  const lues = lirePieces(c.pieces, c.piecesDepuis);
  const r = (journal, p = {}) => raisonPieces({ etat: etatDe(journal), journal, pieces: lues, piecesDepuis: c.piecesDepuis, lireRetour: lireRetourAuto, ...p });
  assert.equal(r(c.journal), null);
  assert.match(r(c.journal, { lireRetour: null }), /sans le lecteur du retour AUTO/);
  const avec = (f) => { const j = structuredClone(c.journal); f(j.at(-1).donnees); return j; };
  assert.match(r(avec((d) => { d.reference = `atelier/${T}@${'d'.repeat(40)}`; })), /référence rendue différente du candidat J4/);
  assert.match(r(avec((d) => { d.faits_candidat_empreinte = 'f'.repeat(64); })), /empreinte citée différente/);
  assert.match(r(avec((d) => { d.faits_auto = d.faits_auto.slice(0, -1); })), /hors de leur texte exact/);
  assert.match(r(avec((d) => { delete d.mode; })), /tentative AUTO rendue sans mode AUTO/);
  assert.match(r(avec((d) => { d.faits_candidat = modifier(J4, (o) => { o.fichiers[1].octets = 1; }); d.faits_candidat_empreinte = JSON.parse(d.faits_candidat).empreinte; })), /retour refusé \(fichiers-differents\)/);
  assert.match(r(c.journal, { pieces: { [CLE]: { ...lues[CLE], demande: { ...lues[CLE].demande, version_candidat: '0.65.99' } } } }), /demande différente de celle des faits J4/);
  // MANUEL : une « tentative-rendue » portant un mode est refusée.
  const m = await conduire('rendue');
  const cm = m.copie();
  cm.journal.at(-1).donnees.mode = 'AUTO';
  assert.match(raisonPieces({ etat: etatDe(cm.journal), journal: cm.journal, pieces: lirePieces(cm.pieces, cm.piecesDepuis), piecesDepuis: cm.piecesDepuis, lireRetour: lireRetourAuto }), /tentative MANUEL rendue avec un mode \(mode incohérent\)/);
});

// ------------------------------------------------------------------------------------------------ 3. pas d'Accepter sans AT-5 conforme du candidat exact
test('T3.1 + T5.1 rejeu complet du jalon 2 : faits AT-5 réels => conforme ; Accepter => chantier terminé, « passage AT-5 39478653058 »', async () => {
  const a = await pret();
  const etats = [JSON.parse(E7)];
  await enregistrer(a);
  etats.push(JSON.parse(durable(a.copie())));
  assert.equal(a.trouver('accepter').length, 0); // T3.6 : aucun Accepter avant les faits AT-5
  await a.cliquer('copier-demande');
  assert.equal(a.copies.at(-1), texteDemande(JSON.parse(J4).demande_at5));
  a.saisir('faits-colles', AT5);
  await a.cliquer('confronter');
  etats.push(JSON.parse(durable(a.copie())));
  assert.equal(a.un('verdict-technique').textContent, 'Verdict : verification-technique-conforme');
  assert.equal(a.un('verdict-run').textContent, `Passage AT-5 : ${RUN_AT5}`);
  a.saisir('motif-decision', 'Rejeu D12 du jalon 2.');
  await a.cliquer('accepter');
  const c = a.copie();
  etats.push(JSON.parse(durable(c)));
  assert.equal(etatDe(c.journal).statut, 'termine');
  assert.deepEqual(c.journal.at(-1).donnees, { jalon: JALON, numero: 1, motif: 'Rejeu D12 du jalon 2.', candidat: SHA_CANDIDAT, faits: JSON.parse(AT5).empreinte, verdict: 'verification-technique-conforme', run_id: RUN_AT5 });
  assert.equal(a.un(`accepte-${JALON}`).textContent, `Jalon ${JALON}, tentative 1 — candidat accepté : atelier/${T}@${SHA_CANDIDAT} — passage AT-5 ${RUN_AT5}`);
  assert.equal(c.registre.filter((x) => x.type === 'cout').length, JSON.parse(E7).registre.filter((x) => x.type === 'cout').length + 1);
  // T5.4 : chaque geste prolonge l'état durable ; l'état final se relit et s'écrit (lecture complète, coût et verdict recalculés).
  for (let i = 1; i < etats.length; i += 1) assert.deepEqual(comparerEtats(etats[i - 1], etats[i]), { statut: 'extension' });
  const lu = lireEtatDurable(canonique(etats.at(-1)));
  assert.equal(lu.etape.etape, 'chantier-termine');
  assert.deepEqual(lu.verdicts, { [CLE]: 'verification-technique-conforme' });
  assert.ok(decouper(canonique(etats.at(-1)), CH).length >= 1);
});
test('T3.2 faits AT-5 non conformes (tests en échec) : Refuser seulement ; un Accepter écrit à la main est refusé à la relecture', async () => {
  const a = await pret();
  await enregistrer(a);
  a.saisir('faits-colles', at5({ tests: { annules: 0, echecs: 1, ignores: 0, reussis: 5559, statut: 'echec', total: 5560 } }));
  await a.cliquer('confronter');
  assert.equal(a.un('verdict-technique').textContent, 'Verdict : verification-technique-non-conforme');
  assert.equal(a.trouver('accepter').length, 0);
  assert.equal(a.trouver('refuser').length, 1);
  const c = a.copie();
  const f = lireFaits(c.pieces[CLE].faits[0], hacherSha256).faits;
  for (const verdict of ['verification-technique-conforme', 'verification-technique-non-conforme']) {
    const j = appliquer(c.journal, { type: 'tentative-acceptee', quand: '2026-10-20T18:00:00.000Z', donnees: { jalon: JALON, numero: 1, motif: 'forcé', candidat: SHA_CANDIDAT, faits: f.empreinte, verdict, run_id: f.provenance.run_id } });
    assert.ok(Array.isArray(j));
    assert.match(lireEtatDurable(durable({ ...c, journal: j })).raison, verdict === 'verification-technique-conforme' ? /verdict recalculé différent/ : /acceptation citant un verdict non conforme/);
  }
});
test('T3.3 faits AT-5 sans comptes (suite interrompue) : vérification impossible, ni Accepter ni Refuser, seulement recoller ou annuler', async () => {
  const a = await pret();
  await enregistrer(a);
  a.saisir('faits-colles', at5({ tests: { annules: null, echecs: null, ignores: null, reussis: null, statut: 'crash', total: null } }));
  await a.cliquer('confronter');
  assert.equal(a.un('verdict-technique').textContent, 'Verdict : verification-impossible');
  assert.match(a.un('raisons-impossibilite').children[0].textContent, /^tests « crash » : comptes réels absents/);
  assert.equal(a.trouver('accepter').length + a.trouver('refuser').length, 0);
  assert.equal(a.un('annuler').disabled, false);
  assert.equal(a.un('confronter').disabled, false);
  assert.equal(etapeDe({ etat: etatDe(a.copie().journal), pieces: lirePieces(a.copie().pieces, 1), verdict: 'verification-impossible' }).etape, 'verification-a-refaire');
});
test('T3.4 faits AT-5 d\'un autre candidat : refusés à la confrontation, rien n\'est conservé', async () => {
  const a = await pret();
  await enregistrer(a);
  const s = a.stockage.getItem(CLE_ATELIER);
  const autre = 'd'.repeat(40);
  a.saisir('faits-colles', at5({ demande: { ...JSON.parse(J4).demande_at5, candidat: autre }, identite: { ...JSON.parse(AT5).identite, branche_pointe: autre, branche_pointe_fin: autre } }));
  await a.cliquer('confronter');
  assert.match(a.un('message').textContent, /faits d'une autre demande/);
  assert.equal(a.stockage.getItem(CLE_ATELIER), s);
});
test('T3.5 décision AUTO relue : autre candidat, autre verdict cité ou autre run : refusée', async () => {
  const a = await pret();
  await enregistrer(a);
  a.saisir('faits-colles', AT5);
  await a.cliquer('confronter');
  a.saisir('motif-decision', 'Rejeu.');
  await a.cliquer('accepter');
  const d = JSON.parse(durable(a.copie()));
  assert.equal(lireEtatDurable(canonique(d)).raison, undefined);
  for (const [patch, motif] of [[{ candidat: 'd'.repeat(40) }, /candidat cité par la décision différent/], [{ verdict: 'verification-technique-non-conforme' }, /acceptation citant un verdict non conforme/], [{ run_id: '1' }, /run cité par la décision différent/]]) {
    const x = structuredClone(d);
    Object.assign(x.journal.at(-1).donnees, patch);
    assert.match(lireEtatDurable(canonique(x)).raison, motif);
  }
});

// ------------------------------------------------------------------------------------------------ 4. OFF et MANUEL conservés
test('T4.2 + T4.3 OFF : consultation seule ; MANUEL : aucun geste sur une tentative AUTO rendue', async () => {
  const a = await pret();
  await enregistrer(a);
  for (const mode of ['off', 'manuel']) {
    await a.cliquer(`mode-${mode}`);
    const s = a.stockage.getItem(CLE_ATELIER);
    for (const nom of ['copier-demande', 'confronter', 'annuler']) { assert.equal(a.un(nom).disabled, true, `${mode} ${nom}`); await a.cliquer(nom); }
    assert.equal(a.un('faits-colles').disabled, true);
    assert.equal(a.stockage.getItem(CLE_ATELIER), s);
  }
  await a.cliquer('mode-auto');
  a.saisir('faits-colles', AT5);
  await a.cliquer('confronter');
  await a.cliquer('mode-manuel');
  const s = a.stockage.getItem(CLE_ATELIER);
  a.saisir('motif-decision', 'Essai.');
  for (const nom of ['accepter', 'refuser']) { assert.equal(a.un(nom).disabled, true); await a.cliquer(nom); }
  assert.equal(a.stockage.getItem(CLE_ATELIER), s);
  // Une tentative MANUEL rendue, en AUTO : aucun geste du parcours (comme en v0.65.15).
  const m = await conduire('rendue');
  await m.cliquer('mode-auto');
  assert.equal(m.un('copier-demande').disabled, true);
});
test('T4.6 bouton périmé : un geste dessiné en AUTO puis déclenché après le passage en MANUEL ne fait rien (garde de la fonction)', async () => {
  const a = await pret();
  await enregistrer(a);
  const annulerPerime = a.un('annuler');
  await a.cliquer('mode-manuel');
  a.saisir('motif-decision', 'Essai.');
  let s = a.stockage.getItem(CLE_ATELIER);
  for (const f of annulerPerime.listeners.click) await f();
  assert.equal(a.stockage.getItem(CLE_ATELIER), s);
  await a.cliquer('mode-auto');
  a.saisir('faits-colles', AT5);
  await a.cliquer('confronter');
  const accepterPerime = a.un('accepter');
  await a.cliquer('mode-manuel');
  a.saisir('motif-decision', 'Essai.');
  s = a.stockage.getItem(CLE_ATELIER);
  for (const f of accepterPerime.listeners.click) await f();
  assert.equal(a.stockage.getItem(CLE_ATELIER), s);
  assert.equal(etatDe(a.copie().journal).statut, 'en-cours');
});
test('T4.5 parcours MANUEL complet (conforme, non conforme, impossible) : texte de l\'écran identique à v0.65.15 à chaque étape', async () => {
  for (const [issue, attendu] of Object.entries(MANUEL_AVANT)) {
    const pas = [];
    await conduire('decide', { issue, budget: true, observer: (e, a) => pas.push([e, h(horsCarnet(a))]) });
    for (const mode of ['off', 'auto']) {
      const a = await conduire('faits', { issue, budget: true });
      await a.cliquer(`mode-${mode}`);
      pas.push([`faits-${mode}`, h(horsCarnet(a))]);
    }
    assert.deepEqual(pas, attendu, issue);
  }
});

// ------------------------------------------------------------------------------------------------ 5. non-régression des D3 réelles, garde J1
test('T5.2 les 5 D3 réelles (et e7ee7e87) : même lecture durable et même écran restauré qu\'en v0.65.15', async () => {
  for (const [commit, attendu] of Object.entries(RELEVE_AVANT)) {
    const texte = fx(`d3-${commit}`);
    const lu = lireEtatDurable(texte);
    assert.equal(lu.raison, undefined, commit);
    assert.deepEqual([lu.etape.etape, lu.verdicts, lu.empreinte, lu.octets], [attendu.etape, attendu.verdicts, attendu.empreinte, attendu.octets], commit);
    const a = await restaurer(texte);
    for (const [mode, empreinte] of Object.entries(attendu.ecran)) { await a.cliquer(`mode-${mode.toLowerCase()}`); assert.equal(h(horsCarnet(a)), empreinte, `${commit} ${mode}`); }
  }
});
test('T5.3 garde J1 : après l\'enregistrement puis après l\'acceptation, aucun second appel (tentative-close)', async () => {
  const a = await pret();
  const garde = (c) => {
    const texte = durable(c);
    return garder({ entrees: { chantier: CH, jalon: JALON, numero: '1', commit: 'a'.repeat(40), empreinte: hacherSha256(texte) }, contexte: { run_id: '1', run_attempt: '1', workflow_sha: 'f'.repeat(40), ref: 'refs/heads/main' },
      historique: { total: 1, runs: [{ id: 1, display_title: nomRun(T), run_attempt: 1, created_at: '2026-10-20T16:00:00Z' }] }, journal: { tete: 'a'.repeat(40), texte } });
  };
  assert.notEqual(garde(a.copie()).raison, 'tentative-close'); // avant : la tentative est vivante
  await enregistrer(a);
  assert.deepEqual([garde(a.copie()).autorise, garde(a.copie()).raison], [false, 'tentative-close']);
  a.saisir('faits-colles', AT5);
  await a.cliquer('confronter');
  a.saisir('motif-decision', 'Rejeu.');
  await a.cliquer('accepter');
  assert.deepEqual([garde(a.copie()).autorise, garde(a.copie()).raison], [false, 'tentative-close']);
});
test('T5 confrontationDe : MANUEL identique à confronter ; AUTO rendue = rapport dérivé des faits J4 et des comptes AT-5', async () => {
  const a = await pret();
  await enregistrer(a);
  a.saisir('faits-colles', AT5);
  await a.cliquer('confronter');
  const c = a.copie();
  const p = lirePieces(c.pieces, c.piecesDepuis)[CLE];
  const rendue = tentativesDuJournal(c.journal).at(-1).rendue;
  const r = confrontationDe(p, p.faits[0], rendue);
  assert.equal(r.verdict_technique, 'verification-technique-conforme');
  assert.equal(r.rapport, 'concordant');
  assert.throws(() => confrontationDe(p, p.faits[0], null)); // sans la tentative rendue : aucun rapport enregistré à confronter
});

test('T4.7 ecran.js v0.65.16 : forme exacte des écritures AUTO (complète atelier-ecran.test.mjs, qui accepte aussi ecran.js v0.65.15)', () => {
  const src = readFileSync(new URL('../app/atelier/ecran.js', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const appels = [...code.matchAll(/avecEvenement\((?:type|'([a-z-]+)')/g)].map((m) => m[1] || 'type').sort();
  // MISE À JOUR DÉLIBÉRÉE v0.65.23 (R1, conception B) : + regulariserPreuve (tentative-annulee + coût 0 « preuve-finale », une écriture).
  assert.deepEqual(appels, ['tentative-annulee', 'tentative-annulee', 'tentative-annulee', 'tentative-annulee', 'tentative-lancee', 'tentative-lancee', 'tentative-rendue', 'tentative-rendue', 'type', 'type']);
  assert.equal((code.match(/'cout'/g) || []).length, 5);
  assert.match(code, /type: 'cout', quand: maintenant\(\), donnees: \{ execution: l\.id\.t, montant: retour\.montant, issue: 'reponse-connue' \}/);
});
