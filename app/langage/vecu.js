// === DEBUT_LANGAGE_VECU ===
// POINT D'ORCHESTRATION COMMUN MINIMAL — décision ChatGPT « CONTRAT MINIMAL DU VÉCU COMMUN » puis
// « POINT D'ORCHESTRATION COMMUN DU VÉCU » (03/10/2026), après la série de diagnostics ayant établi
// que `experience` et `trace` (connaissances.js) RESTENT deux représentations distinctes, mais
// peuvent toutes deux traverser un même point générique sans que celui-ci connaisse leur sémantique
// interne. Contrat validé, STRICT : { type, id } et RIEN d'autre — jamais de texte, contexte,
// capacité, résultat, jugement, corpus, score ou régularité. Les consommateurs concernés relisent
// eux-mêmes leur objet persistant depuis le magasin (même motif déjà universel dans tout le dépôt :
// `(await magasin.lireTout(table)).find((x) => x.id === id)`), jamais une donnée dupliquée ici.
//
// AUCUNE FACULTÉ COGNITIVE NOUVELLE : ce fichier ne lit, n'écrit, n'interprète et ne sélectionne
// rien. Il n'appelle JAMAIS lui-même repererMotifs()/induire()/decrireStructure(), ni aucun
// traitement existant propre à une famille de vécu — ceux-ci restent exactement où ils étaient
// (apresNouvelleExperience() reste défini et appelé depuis main.js, exactement comme avant ce
// chantier ; ce fichier ne le connaît pas et ne l'importe pas).
//
// AUCUNE SUR-ARCHITECTURE : pas d'event bus, pas de registry dynamique, pas de publish/subscribe,
// pas de classe générique « Vecu ». Un aiguillage plat et minimal sur `type`, cohérent avec le style
// déjà omniprésent du dépôt (la chaîne de `if (MARQUEUR_X.test(texte)) ...` de main.js).
//
// TYPE INCONNU : REJETÉ EXPLICITEMENT (Error), jamais absorbé silencieusement. `type` est un littéral
// choisi par le code appelant lui-même (jamais une donnée utilisateur à interpréter avec indulgence,
// à la différence d'une reconnaissance de langage naturel) : une valeur incorrecte est une erreur de
// programmation, à signaler tout de suite — même principe que enregistrerJugement() (connaissances.js)
// qui rejette de la même façon un jugement hors de {correct, incorrect}.
export const TYPES_VECU = Object.freeze(['experience', 'trace']);

export async function apresNouveauVecu({ type, id }) {
  if (!TYPES_VECU.includes(type)) {
    throw new Error(`« ${type} » n'est pas un type de vécu connu (attendu : ${TYPES_VECU.join(', ')}).`);
  }
  return { type, id };
}

// COMPOSITION AVEC UN TRAITEMENT EXISTANT, SANS LE MODIFIER — permet d'insérer apresNouveauVecu()
// AVANT un traitement déjà câblé ailleurs (ex. apresNouvelleExperience(), main.js) sans toucher au
// fichier qui définit ce traitement ni à son propre contrat (même id reçu, même valeur de retour,
// mêmes erreurs propagées telles quelles, un seul appel). Pure et générique : ignore totalement ce
// que `traitement` fait réellement, exactement comme apresNouveauVecu() ci-dessus ignore ce qu'une
// « experience » ou une « trace » signifient.
export function composerApresVecu(type, traitement) {
  return async (id) => {
    await apresNouveauVecu({ type, id });
    return traitement(id);
  };
}
// === FIN_LANGAGE_VECU ===
