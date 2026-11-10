// Principales îles nommées des territoires français d'outre-mer.
// Les noms et coordonnées sont issus de GeoNames; cet extrait est embarqué
// afin que les étiquettes restent disponibles sans connexion Internet.
export type OverseasIslandLabel = {
  id: string
  name: string
  territoryEntityId: string
  longitude: number
  latitude: number
  minZoom: number
}

export const overseasIslandLabels: OverseasIslandLabel[] = [
  {
    id: 'guadeloupe:basse-terre',
    name: 'Basse-Terre',
    territoryEntityId: 'territory:guadeloupe',
    longitude: -61.67806,
    latitude: 16.14943,
    minZoom: 4.5
  },
  {
    id: 'guadeloupe:grande-terre',
    name: 'Grande-Terre',
    territoryEntityId: 'territory:guadeloupe',
    longitude: -61.42873,
    latitude: 16.31754,
    minZoom: 4.5
  },
  {
    id: 'guadeloupe:marie-galante',
    name: 'Marie-Galante',
    territoryEntityId: 'territory:guadeloupe',
    longitude: -61.2705,
    latitude: 15.9359,
    minZoom: 4.5
  },
  {
    id: 'guadeloupe:desirade',
    name: 'La Désirade',
    territoryEntityId: 'territory:guadeloupe',
    longitude: -61.05194,
    latitude: 16.31838,
    minZoom: 5
  },
  {
    id: 'guadeloupe:petite-terre',
    name: 'Petite Terre',
    territoryEntityId: 'territory:guadeloupe',
    longitude: -61.11165,
    latitude: 16.17192,
    minZoom: 5.5
  },
  {
    id: 'guadeloupe:terre-de-haut',
    name: 'Terre-de-Haut',
    territoryEntityId: 'territory:guadeloupe',
    longitude: -61.58333,
    latitude: 15.86667,
    minZoom: 8.5
  },
  {
    id: 'guadeloupe:terre-de-bas',
    name: 'Terre-de-Bas',
    territoryEntityId: 'territory:guadeloupe',
    longitude: -61.63476,
    latitude: 15.85613,
    minZoom: 8.5
  },
  {
    id: 'guadeloupe:les-saintes',
    name: 'Les Saintes',
    territoryEntityId: 'territory:guadeloupe',
    longitude: -61.61045,
    latitude: 15.85616,
    minZoom: 5.5
  },
  {
    id: 'martinique:diamant',
    name: 'Rocher du Diamant',
    territoryEntityId: 'territory:martinique',
    longitude: -61.03905,
    latitude: 14.4433,
    minZoom: 6
  },
  {
    id: 'guyane:iles-du-salut',
    name: 'Îles du Salut',
    territoryEntityId: 'territory:guyane',
    longitude: -52.58348,
    latitude: 5.28752,
    minZoom: 5
  },
  {
    id: 'guyane:ile-royale',
    name: 'Île Royale',
    territoryEntityId: 'territory:guyane',
    longitude: -52.58864,
    latitude: 5.28715,
    minZoom: 7.5
  },
  {
    id: 'guyane:ile-saint-joseph',
    name: 'Île Saint-Joseph',
    territoryEntityId: 'territory:guyane',
    longitude: -52.58231,
    latitude: 5.28132,
    minZoom: 7.5
  },
  {
    id: 'mayotte:grande-terre',
    name: 'Grande-Terre',
    territoryEntityId: 'territory:mayotte',
    longitude: 45.15776,
    latitude: -12.82519,
    minZoom: 4.5
  },
  {
    id: 'mayotte:petite-terre',
    name: 'Petite-Terre',
    territoryEntityId: 'territory:mayotte',
    longitude: 45.28531,
    latitude: -12.78004,
    minZoom: 5
  },
  {
    id: 'saint-pierre:saint-pierre',
    name: 'Saint-Pierre',
    territoryEntityId: 'territory:saint-pierre-et-miquelon',
    longitude: -56.19447,
    latitude: 46.78125,
    minZoom: 4.5
  },
  {
    id: 'saint-pierre:miquelon',
    name: 'Miquelon',
    territoryEntityId: 'territory:saint-pierre-et-miquelon',
    longitude: -56.32778,
    latitude: 46.96639,
    minZoom: 4.5
  },
  {
    id: 'saint-barthelemy:ile-principale',
    name: 'Saint-Barthélemy',
    territoryEntityId: 'territory:saint-barthelemy',
    longitude: -62.83065,
    latitude: 17.89697,
    minZoom: 4.5
  },
  {
    id: 'saint-barthelemy:ile-fourchue',
    name: 'Île Fourchue',
    territoryEntityId: 'territory:saint-barthelemy',
    longitude: -62.90362,
    latitude: 17.95836,
    minZoom: 6
  },
  {
    id: 'saint-barthelemy:ile-chevreau',
    name: 'Île Chevreau',
    territoryEntityId: 'territory:saint-barthelemy',
    longitude: -62.85092,
    latitude: 17.93349,
    minZoom: 6
  },
  {
    id: 'saint-martin:ile-principale',
    name: 'Saint-Martin',
    territoryEntityId: 'territory:saint-martin',
    longitude: -63.04916,
    latitude: 18.06688,
    minZoom: 4.5
  },
  {
    id: 'saint-martin:ile-tintamarre',
    name: 'Île Tintamarre',
    territoryEntityId: 'territory:saint-martin',
    longitude: -62.97923,
    latitude: 18.11936,
    minZoom: 6
  },
  {
    id: 'saint-martin:ilet-pinel',
    name: 'Îlet Pinel',
    territoryEntityId: 'territory:saint-martin',
    longitude: -63.01483,
    latitude: 18.10641,
    minZoom: 6
  },
  {
    id: 'polynesie:tahiti',
    name: 'Tahiti',
    territoryEntityId: 'territory:polynesie-francaise',
    longitude: -149.41916,
    latitude: -17.65601,
    minZoom: 4.5
  },
  {
    id: 'polynesie:moorea',
    name: 'Moorea',
    territoryEntityId: 'territory:polynesie-francaise',
    longitude: -149.82795,
    latitude: -17.53277,
    minZoom: 5
  },
  {
    id: 'polynesie:bora-bora',
    name: 'Bora Bora',
    territoryEntityId: 'territory:polynesie-francaise',
    longitude: -151.73714,
    latitude: -16.49956,
    minZoom: 5
  },
  {
    id: 'polynesie:huahine',
    name: 'Huahine',
    territoryEntityId: 'territory:polynesie-francaise',
    longitude: -151.02271,
    latitude: -16.73979,
    minZoom: 5
  },
  {
    id: 'polynesie:raiatea',
    name: 'Raiatea',
    territoryEntityId: 'territory:polynesie-francaise',
    longitude: -151.43814,
    latitude: -16.82566,
    minZoom: 5
  },
  {
    id: 'polynesie:tahaa',
    name: 'Taha’a',
    territoryEntityId: 'territory:polynesie-francaise',
    longitude: -151.49759,
    latitude: -16.62311,
    minZoom: 6
  },
  {
    id: 'polynesie:maupiti',
    name: 'Maupiti',
    territoryEntityId: 'territory:polynesie-francaise',
    longitude: -152.25899,
    latitude: -16.44429,
    minZoom: 5
  },
  {
    id: 'polynesie:nuku-hiva',
    name: 'Nuku Hiva',
    territoryEntityId: 'territory:polynesie-francaise',
    longitude: -140.13221,
    latitude: -8.86215,
    minZoom: 5
  },
  {
    id: 'polynesie:ua-huka',
    name: 'Ua Huka',
    territoryEntityId: 'territory:polynesie-francaise',
    longitude: -139.55187,
    latitude: -8.90399,
    minZoom: 5
  },
  {
    id: 'polynesie:ua-pou',
    name: 'Ua Pou',
    territoryEntityId: 'territory:polynesie-francaise',
    longitude: -140.07328,
    latitude: -9.3986,
    minZoom: 5
  },
  {
    id: 'polynesie:hiva-oa',
    name: 'Hiva Oa',
    territoryEntityId: 'territory:polynesie-francaise',
    longitude: -138.99941,
    latitude: -9.76529,
    minZoom: 5
  },
  {
    id: 'polynesie:tahuata',
    name: 'Tahuata',
    territoryEntityId: 'territory:polynesie-francaise',
    longitude: -139.08743,
    latitude: -9.94319,
    minZoom: 5
  },
  {
    id: 'polynesie:fatu-hiva',
    name: 'Fatu Hiva',
    territoryEntityId: 'territory:polynesie-francaise',
    longitude: -138.64265,
    latitude: -10.47971,
    minZoom: 5
  },
  {
    id: 'polynesie:rangiroa',
    name: 'Rangiroa',
    territoryEntityId: 'territory:polynesie-francaise',
    longitude: -147.65115,
    latitude: -15.11648,
    minZoom: 5
  },
  {
    id: 'polynesie:fakarava',
    name: 'Fakarava',
    territoryEntityId: 'territory:polynesie-francaise',
    longitude: -145.61966,
    latitude: -16.2951,
    minZoom: 5
  },
  {
    id: 'polynesie:mangareva',
    name: 'Mangareva',
    territoryEntityId: 'territory:polynesie-francaise',
    longitude: -134.96703,
    latitude: -23.10224,
    minZoom: 5
  },
  {
    id: 'polynesie:tubuai',
    name: 'Tubuai',
    territoryEntityId: 'territory:polynesie-francaise',
    longitude: -149.48316,
    latitude: -23.36492,
    minZoom: 5
  },
  {
    id: 'polynesie:rurutu',
    name: 'Rurutu',
    territoryEntityId: 'territory:polynesie-francaise',
    longitude: -151.35542,
    latitude: -22.45704,
    minZoom: 5
  },
  {
    id: 'nouvelle-caledonie:grande-terre',
    name: 'Grande Terre',
    territoryEntityId: 'territory:nouvelle-caledonie',
    longitude: 165.5,
    latitude: -21.3,
    minZoom: 4.5
  },
  {
    id: 'nouvelle-caledonie:lifou',
    name: 'Lifou',
    territoryEntityId: 'territory:nouvelle-caledonie',
    longitude: 167.21667,
    latitude: -20.88333,
    minZoom: 5
  },
  {
    id: 'nouvelle-caledonie:mare',
    name: 'Maré',
    territoryEntityId: 'territory:nouvelle-caledonie',
    longitude: 167.98997,
    latitude: -21.52904,
    minZoom: 5
  },
  {
    id: 'nouvelle-caledonie:ouvea',
    name: 'Ouvéa',
    territoryEntityId: 'territory:nouvelle-caledonie',
    longitude: 166.56166,
    latitude: -20.6225,
    minZoom: 5
  },
  {
    id: 'nouvelle-caledonie:ile-des-pins',
    name: 'Île des Pins',
    territoryEntityId: 'territory:nouvelle-caledonie',
    longitude: 167.47765,
    latitude: -22.60636,
    minZoom: 5
  },
  {
    id: 'nouvelle-caledonie:belep',
    name: 'Îles Bélep',
    territoryEntityId: 'territory:nouvelle-caledonie',
    longitude: 163.66667,
    latitude: -19.75,
    minZoom: 5
  },
  {
    id: 'wallis:wallis',
    name: 'Wallis',
    territoryEntityId: 'territory:wallis-et-futuna',
    longitude: -176.20663,
    latitude: -13.28188,
    minZoom: 5
  },
  {
    id: 'wallis:futuna',
    name: 'Futuna',
    territoryEntityId: 'territory:wallis-et-futuna',
    longitude: -178.12511,
    latitude: -14.28801,
    minZoom: 5
  },
  {
    id: 'wallis:alofi',
    name: 'Alofi',
    territoryEntityId: 'territory:wallis-et-futuna',
    longitude: -178.04117,
    latitude: -14.33857,
    minZoom: 6
  },
  {
    id: 'taaf:crozet',
    name: 'Archipel de Crozet',
    territoryEntityId: 'territory:taaf',
    longitude: 51,
    latitude: -46.41667,
    minZoom: 4.5
  },
  {
    id: 'taaf:kerguelen',
    name: 'Archipel des Kerguelen',
    territoryEntityId: 'territory:taaf',
    longitude: 69.16667,
    latitude: -49.25,
    minZoom: 4.5
  },
  {
    id: 'taaf:amsterdam',
    name: 'Amsterdam',
    territoryEntityId: 'territory:taaf',
    longitude: 77.51667,
    latitude: -37.83333,
    minZoom: 5
  },
  {
    id: 'taaf:saint-paul',
    name: 'Saint-Paul',
    territoryEntityId: 'territory:taaf',
    longitude: 77.51667,
    latitude: -38.71667,
    minZoom: 5
  },
  {
    id: 'taaf:tromelin',
    name: 'Tromelin',
    territoryEntityId: 'territory:taaf',
    longitude: 54.52324,
    latitude: -15.892,
    minZoom: 5
  },
  {
    id: 'taaf:europa',
    name: 'Europa',
    territoryEntityId: 'territory:taaf',
    longitude: 40.35953,
    latitude: -22.35037,
    minZoom: 5
  },
  {
    id: 'taaf:juan-de-nova',
    name: 'Juan de Nova',
    territoryEntityId: 'territory:taaf',
    longitude: 42.7248,
    latitude: -17.05449,
    minZoom: 5
  },
  {
    id: 'taaf:glorieuses',
    name: 'Îles Glorieuses',
    territoryEntityId: 'territory:taaf',
    longitude: 47.33943,
    latitude: -11.54822,
    minZoom: 5
  },
  {
    id: 'clipperton:ile',
    name: 'Île Clipperton',
    territoryEntityId: 'territory:clipperton',
    longitude: -109.2167,
    latitude: 10.3,
    minZoom: 5
  }
]
