// === DEBUT_LANGAGE_RETOURS_PAR_CAPACITE ===
// ÉTAPE 5.8 — « JONCTION FORME + CAPACITÉ + RETOURS HUMAINS BRUTS » (décision ChatGPT, 03/10/2026,
// suite au diagnostic 5.7 « QU'EST-CE QU'UNE RÉGULARITÉ RÉPÉTABLE DANS LES RETOURS ? »). DERNIÈRE
// VUE DESCRIPTIVE PURE avant toute influence comportementale -- une JONCTION STRICTE entre deux
// primitives déjà existantes et inchangées, jamais un nouveau moteur :
//   - cooccurrencesSituationAction(traces, options) (vue-traces.js) -- fournit, pour chaque forme F
//     déjà découverte par vueDescriptive(), les capacités réellement observées dans sa couverture,
//     en compte brut ;
//   - vueRetoursParStructure(traces, experiences, options) (5.6, retours-par-structure.js) -- fournit,
//     pour la MÊME forme F, les traces/expériences/événements de jugement bruts.
// Le diagnostic 5.7 a établi qu'une régularité attachée à F SEULE mélangerait des actions
// différentes dès que F couvre plusieurs capacités (contre-exemple C) : l'unité descriptive devient
// donc F + capacité, jamais F seule -- ce fichier ne fait QUE matérialiser cette unité, sans
// introduire de score, de seuil, de majorité, d'attente ou de verdict (la qualification éventuelle
// d'une régularité reste explicitement HORS PÉRIMÈTRE de ce chantier, décision ChatGPT à venir).
//
// IDENTITÉ DE F (section 4 du cadrage) : jamais une nouvelle définition de « même forme ». Les deux
// primitives réutilisées proviennent chacune d'un appel INDÉPENDANT à vueDescriptive() (même
// traces/options, donc rigoureusement le même résultat déterministe) -- l'association entre leurs
// éléments respectifs se fait exclusivement par la CLÉ DE COUVERTURE (liste d'ids triée), jamais par
// la chaîne de forme seule, exactement comme le fait déjà possibilitesRejeu() (vue-traces.js) pour
// la même raison (deux couvertures différentes pourraient en théorie partager une signature de
// forme identique).
//
// SOUS-GROUPE DE TRACES (section 5) : pour une paire (F, capacité), les traces retenues sont
// EXACTEMENT celles de la couverture de F dont trace.capacite === capacité (égalité stricte) --
// jamais une capacité d'une autre trace, jamais un mélange.
//
// DIVERSITÉ DU SOUS-GROUPE, JAMAIS CELLE DE F (section 12/13, point CRITIQUE) : rapport.diversite de
// F décrit F DANS SON ENSEMBLE -- si F couvre les capacités A et B, cette diversité globale peut
// provenir ENTIÈREMENT de B, et ne prouve RIEN sur la diversité réelle de A. Ce fichier réutilise
// STRICTEMENT decrireStructure() (extraction.js, déjà conçue pour décrire N'IMPORTE QUEL groupe de
// textes déjà proposé, « qu'elle ne sait RIEN de la façon dont le groupe a été formé ») sur les
// SEULS textes du sous-groupe (contexte.texteBrut des traces de cette capacité dans cette
// couverture) -- jamais sur F entière. AUCUN nouveau moteur de structure : decrireStructure() est
// réutilisée exactement comme vueDescriptive() l'utilise déjà, simplement sur un sous-ensemble choisi
// par capacité plutôt que par motif.
//
// PROVENANCE (section 9) : l'univers entier de ce fichier provient de la couverture de
// vueDescriptive(), donc déjà restreint par traceExploitable() à voie==='action' -- jamais supposé
// implicitement : `provenance` expose l'ENSEMBLE RÉELLEMENT OBSERVÉ des valeurs de trace.voie dans
// le sous-groupe (toujours ['action'] en pratique aujourd'hui, mais CONSTATÉ, jamais codé en dur).
// traceExploitable() n'est ni importée ni modifiée ici. Les traces 'rejeu'/'composition' ne peuvent
// structurellement jamais apparaître dans une couverture de F (héritage non contourné) : leurs
// retours restent observables UNIQUEMENT via l'identité stricte T→E→J déjà établie plus tôt dans
// cette étape, appelée directement, jamais fusionnés ici -- ce qui protège explicitement contre la
// boucle action→apprentissage→rejeu→auto-renforcement identifiée par le diagnostic 5.7 (section 10
// du cadrage), sans pour autant
// rendre les retours de rejeu inutiles ailleurs.
//
// AUCUNE AGRÉGATION (section 6/16) : chaque événement de jugement reste individuel (repris tel quel
// de vueRetoursParStructure(), filtré au sous-groupe, jamais recalculé) ; aucun champ
// régulier/fiable/candidat/validé n'est créé -- la qualification éventuelle viendra d'un futur
// chantier, jamais de celui-ci.
import { cooccurrencesSituationAction } from './vue-traces.js';
import { vueRetoursParStructure } from './retours-par-structure.js';
import { decrireStructure } from './extraction.js';

function cleCouverture(couverture) {
  return couverture.slice().sort().join('\u0001');
}

export function vueRetoursParFormeEtCapacite(traces, experiences, options = {}) {
  const cooc = cooccurrencesSituationAction(traces, options);
  const retours = vueRetoursParStructure(traces, experiences, options);
  const retoursParCouverture = new Map(retours.map((r) => [cleCouverture(r.couverture), r]));
  const parId = new Map((traces || []).map((t) => [t.id, t]));

  const resultat = [];
  for (const element of cooc) {
    // Même vueDescriptive() sous-jacente dans les deux appels (mêmes traces/options) : un
    // correspondant exact existe TOUJOURS par construction -- vérifié défensivement, jamais supposé
    // sans contrôle (même discipline que possibilitesRejeu(), vue-traces.js).
    const retour = retoursParCouverture.get(cleCouverture(element.couverture));
    if (!retour) continue;

    for (const { capacite } of element.capacites) {
      const sousGroupe = element.couverture
        .filter((id) => {
          const t = parId.get(id);
          return t && t.capacite === capacite;
        })
        .slice()
        .sort();

      const tracesSousGroupe = sousGroupe.map((id) => parId.get(id));
      const provenance = [...new Set(tracesSousGroupe.map((t) => t.voie))].sort();
      const textesSousGroupe = tracesSousGroupe.map((t) => t.contexte.texteBrut);
      const rapportSousGroupe = decrireStructure(textesSousGroupe);

      const tracesRetours = sousGroupe.map((id) => retour.traces.find((tr) => tr.idTrace === id));
      const evenements = retour.evenements.filter((e) => sousGroupe.includes(e.idTrace));

      resultat.push({
        forme: element.forme,
        couverture: element.couverture,
        capacite,
        provenance,
        sousGroupe,
        rapportSousGroupe,
        traces: tracesRetours,
        evenements,
      });
    }
  }
  return resultat;
}
// === FIN_LANGAGE_RETOURS_PAR_CAPACITE ===
