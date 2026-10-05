// === DEBUT_LANGAGE_DESCRIPTIONS_OPERATIONS ===
// v0.63.4 — ÉTAPE 6 : « PREMIER ENSEMBLE RÉEL DE DESCRIPTIONS D'OPÉRATIONS » (décision ChatGPT, 04/10/2026, suite aux
// diagnostics « FAIRE EXISTER UNE OPÉRATION COMME DONNÉE » et « PREMIER ENSEMBLE CONSULTABLE D'OPÉRATIONS »).
// DONNÉE PURE ET DORMANTE. Ce n'est NI un registre d'exécution, NI un catalogue de capacités, NI un orchestrateur, NI un
// mécanisme de découverte ou de choix : c'est un tableau de descriptions, rien de plus.
//
// CONTRAT DU TABLEAU : un seul export, DESCRIPTIONS_OPERATIONS, un tableau dont chaque élément est directement un
// descripteur { nom, entrees, sortie } au format du langage de formes (aucune enveloppe).
//   - noms uniques, non vides ;
//   - ordre déterministe par nom (unités de code), SANS AUCUNE SIGNIFICATION : ni préférence, ni priorité, ni
//     fréquence, ni qualité, ni ordre d'exécution ;
//   - ni catégorie, ni identifiant distinct du nom, ni version, ni poids ;
//   - gelé en profondeur (le tableau ET tous ses descendants) ; le gel ne donne aucune signification supplémentaire ;
//   - aucune fonction, aucun chemin de module, aucun rappel : ce qui est décrit ici n'est PAS appelable à partir d'ici.
//
// INDÉPENDANCE : ce fichier n'importe RIEN (ni les opérations décrites, ni le langage de formes, ni sa garantie, ni
// le registre des capacités). Il est le SEUL fichier de production autorisé à NOMMER ces opérations ; aucun autre ne le
// référence. Le lien entre un nom et la vraie fonction n'existe qu'en TEST (nom = nom de la fonction, sorties et entrées
// réelles confrontées à la description). Aucune validation à l'exécution : la validité est un invariant de
// développement, prouvé par les tests, pas une opération au chargement.
//
// LES NOMS DES ENTRÉES reprennent le nom du paramètre dans le code de la fonction (ainsi normaliserCouverture(chemins) : l'entrée
// s'appelle `chemins`, même si sa FORME est celle d'une couverture). Cela ne dit PAS comment appeler la
// fonction : `entrees` décrit des formes, jamais un protocole d'appel.
//
// LIMITES CONNUES (testées, mais NON portées par les descripteurs) : le langage de formes décrit la compatibilité
// STRUCTURELLE, pas le domaine exact des valeurs. Ainsi ne sont pas exprimés :
//   - « undefined présent » (decrireValeursObservees l'accepte et le produit ; le descripteur de sortie le rapproche de
//     `peutManquer`, qui est ce qu'il devient après toute sérialisation JSON) ;
//   - « chaîne non vide » (id vide refusé), « nombre fini » (NaN et infinis refusés) ;
//   - l'unicité des identités (les doublons sont rapportés dans `ambigus`, ce n'est pas une erreur) ;
//   - propriété propre contre propriété héritée (une propriété héritée compte comme absente).
//
// PÉRIMÈTRE : couvrirSequence, decrireStructureIdentifiee, decrireValeursObservees (v0.63.4) puis, en v0.63.10, memesCouvertures,
// normaliserCouverture, parcourirStructure, partagerCouvertures, produireConstatsStructurels, resoudreCouverture -- des
// primitives descriptives, hors registre des capacités, représentables avec le langage de formes tel quel. NEUF opérations.
// v0.63.10 : franchit UNIQUEMENT le niveau « opération décrite comme donnée » ; le catalogue n'est toujours lu par aucune primitive,
// atteint par aucune application, et aucune opération n'est exécutable à partir de lui.
// DUPLICATION LITTÉRALE ASSUMÉE : les sous-formes « chemin » (collection de scalaire sans genre), « couverture » (collection de
// chemins) et « occurrence » sont RÉPÉTÉES telles quelles dans chaque descripteur : le langage n'a ni alias ni référence, et
// aucun nom de concept n'entre dans le langage de formes. Une identité structurelle n'est PAS une identité de concept.
// APPROXIMATIONS ACCEPTÉES (non corrigées ici) : le segment `scalaire` sans genre sur-accepte booléen, négatif, non-entier,
// NaN/Infinity ; le contenu `quelconque + peutEtreNull` sur-accepte des valeurs que parcourirStructure refuse ; l'unicité des
// chemins, les propriétés propres/accesseurs/cycles et « valeur conditionnelle au type » ne sont pas exprimés ; « undefined
// présent » reste une dette connue.
// v0.63.38 : DIXIÈME description, symbolesDeChaine (entrée « chaine » : chaîne ; sortie : collection de chaînes). Rien d'autre n'est ajouté :
// le catalogue reste une donnée pure, lue par aucun choix, sans aucune connaissance de la langue. Les capacités du registre et les fonctions
// dont le contrat exige une décision de conception supplémentaire restent décrites dans les tests seulement.

function geler(valeur) {
  if (valeur !== null && typeof valeur === 'object' && !Object.isFrozen(valeur)) {
    for (const cle of Object.keys(valeur)) geler(valeur[cle]);
    Object.freeze(valeur);
  }
  return valeur;
}

export const DESCRIPTIONS_OPERATIONS = geler([
  {
    nom: 'couvrirSequence',
    entrees: {
      elements: { forme: 'collection' },
      plages: {
        forme: 'collection',
        elements: {
          forme: 'objet',
          champs: {
            debut: { forme: 'scalaire', genre: 'nombre' },
            longueur: { forme: 'scalaire', genre: 'nombre' },
            etiquette: { forme: 'quelconque', peutEtreNull: true },
          },
        },
      },
    },
    sortie: {
      forme: 'collection',
      elements: {
        forme: 'objet',
        champs: {
          position: { forme: 'scalaire', genre: 'nombre' },
          element: { forme: 'quelconque', peutEtreNull: true },
          couvertures: {
            forme: 'collection',
            elements: {
              forme: 'objet',
              champs: {
                etiquette: { forme: 'quelconque', peutEtreNull: true },
                debut: { forme: 'scalaire', genre: 'nombre' },
                longueur: { forme: 'scalaire', genre: 'nombre' },
              },
            },
          },
        },
      },
    },
  },
  {
    nom: 'decrireStructureIdentifiee',
    entrees: {
      elements: {
        forme: 'collection',
        elements: {
          forme: 'objet',
          champs: {
            id: { forme: 'scalaire', genre: 'chaine' },
            texte: { forme: 'scalaire', genre: 'chaine' },
          },
        },
      },
    },
    sortie: {
      forme: 'objet',
      champs: {
        couverture: { forme: 'collection', elements: { forme: 'scalaire', genre: 'chaine' } },
        rapport: { forme: 'objet' },
      },
    },
  },
  {
    nom: 'decrireValeursObservees',
    entrees: {
      paires: {
        forme: 'collection',
        elements: {
          forme: 'objet',
          champs: {
            id: { forme: 'scalaire', genre: 'chaine' },
            valeur: { forme: 'scalaire', omissible: true, peutEtreNull: true },
          },
        },
      },
    },
    sortie: {
      forme: 'objet',
      champs: {
        valeurs: {
          forme: 'collection',
          elements: {
            forme: 'objet',
            champs: {
              valeur: { forme: 'scalaire', peutManquer: true, peutEtreNull: true },
              ids: { forme: 'collection', elements: { forme: 'scalaire', genre: 'chaine' } },
            },
          },
        },
        nombreValeurs: { forme: 'scalaire', genre: 'nombre' },
        nonResolus: { forme: 'collection', elements: { forme: 'scalaire', genre: 'chaine' } },
        ambigus: { forme: 'collection', elements: { forme: 'scalaire', genre: 'chaine' } },
      },
    },
  },
  {
    nom: 'memesCouvertures',
    entrees: {
      a: {
        forme: 'collection',
        elements: { forme: 'collection', elements: { forme: 'scalaire' } },
      },
      b: {
        forme: 'collection',
        elements: { forme: 'collection', elements: { forme: 'scalaire' } },
      },
    },
    sortie: { forme: 'scalaire', genre: 'booleen' },
  },
  {
    nom: 'normaliserCouverture',
    entrees: {
      chemins: {
        forme: 'collection',
        elements: { forme: 'collection', elements: { forme: 'scalaire' } },
      },
    },
    sortie: {
      forme: 'collection',
      elements: { forme: 'collection', elements: { forme: 'scalaire' } },
    },
  },
  {
    nom: 'parcourirStructure',
    entrees: {
      valeur: { forme: 'quelconque', peutEtreNull: true },
    },
    sortie: {
      forme: 'collection',
      elements: {
        forme: 'objet',
        champs: {
          chemin: { forme: 'collection', elements: { forme: 'scalaire' } },
          type: { forme: 'scalaire', genre: 'chaine' },
          valeur: { forme: 'scalaire', peutManquer: true },
        },
      },
    },
  },
  {
    nom: 'partagerCouvertures',
    entrees: {
      a: {
        forme: 'collection',
        elements: { forme: 'collection', elements: { forme: 'scalaire' } },
      },
      b: {
        forme: 'collection',
        elements: { forme: 'collection', elements: { forme: 'scalaire' } },
      },
    },
    sortie: {
      forme: 'objet',
      champs: {
        communs: {
          forme: 'collection',
          elements: { forme: 'collection', elements: { forme: 'scalaire' } },
        },
        seulementA: {
          forme: 'collection',
          elements: { forme: 'collection', elements: { forme: 'scalaire' } },
        },
        seulementB: {
          forme: 'collection',
          elements: { forme: 'collection', elements: { forme: 'scalaire' } },
        },
      },
    },
  },
  {
    nom: 'produireConstatsStructurels',
    entrees: {
      elements: {
        forme: 'collection',
        elements: {
          forme: 'objet',
          champs: {
            chemin: { forme: 'collection', elements: { forme: 'scalaire' } },
            contenu: { forme: 'quelconque', peutEtreNull: true },
          },
        },
      },
    },
    sortie: {
      forme: 'collection',
      elements: {
        forme: 'objet',
        champs: {
          constat: {
            forme: 'objet',
            champs: {
              chemin: { forme: 'collection', elements: { forme: 'scalaire' } },
              type: { forme: 'scalaire', genre: 'chaine' },
              valeur: { forme: 'scalaire', peutManquer: true },
            },
          },
          couverture: {
            forme: 'collection',
            elements: { forme: 'collection', elements: { forme: 'scalaire' } },
          },
        },
      },
    },
  },
  {
    nom: 'resoudreCouverture',
    entrees: {
      univers: {
        forme: 'collection',
        elements: {
          forme: 'objet',
          champs: { chemin: { forme: 'collection', elements: { forme: 'scalaire' } } },
        },
      },
      couverture: {
        forme: 'collection',
        elements: { forme: 'collection', elements: { forme: 'scalaire' } },
      },
    },
    sortie: {
      forme: 'collection',
      elements: {
        forme: 'objet',
        champs: { chemin: { forme: 'collection', elements: { forme: 'scalaire' } } },
      },
    },
  },
  {
    nom: 'symbolesDeChaine',
    entrees: {
      chaine: { forme: 'scalaire', genre: 'chaine' },
    },
    sortie: {
      forme: 'collection',
      elements: { forme: 'scalaire', genre: 'chaine' },
    },
  },
]);
// === FIN_LANGAGE_DESCRIPTIONS_OPERATIONS ===
