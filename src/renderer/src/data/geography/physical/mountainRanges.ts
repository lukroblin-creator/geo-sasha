export type LocalizedMountainText = {
  fr: string
  en: string
  es?: string
}

export type MountainRangeRecord = {
  id: string
  name: LocalizedMountainText
  center: [number, number]
  /** Approximate bounds used to count summit points in the local Natural Earth catalogue. */
  catalogueBounds: [west: number, south: number, east: number, north: number]
  lengthKm: number | null
  landscape: LocalizedMountainText
  attendance: LocalizedMountainText
  hiking: LocalizedMountainText
  mountaineering: LocalizedMountainText
}

// Curated offline guide. Summit counts and highest points are derived from the
// bundled Natural Earth elevation-point catalogue inside these approximate bounds.
export const mountainRanges: MountainRangeRecord[] = [
  {
    id: 'andes', name: { fr: 'Andes', en: 'Andes', es: 'Andes' }, center: [-71.5, -15], catalogueBounds: [-82, -56, -66, 13], lengthKm: 7564,
    landscape: { fr: 'Très longue cordillère volcanique : hauts plateaux, volcans, glaciers et vallées profondes.', en: 'A vast volcanic cordillera of high plateaus, volcanoes, glaciers and deep valleys.' },
    attendance: { fr: 'Très fréquentée autour des grands parcs et itinéraires connus ; de vastes secteurs restent isolés.', en: 'Busy around major parks and classic routes; large areas remain remote.' },
    hiking: { fr: 'Très fort potentiel, du trek de haute altitude aux sentiers de parc.', en: 'Excellent range of options, from high-altitude trekking to park trails.' },
    mountaineering: { fr: 'Très fort potentiel, avec altitude, froid et météo exigeant une bonne préparation.', en: 'Excellent potential; altitude, cold and weather demand careful preparation.' }
  },
  {
    id: 'rockies', name: { fr: 'Montagnes Rocheuses', en: 'Rocky Mountains', es: 'Montañas Rocosas' }, center: [-112, 44], catalogueBounds: [-117, 30, -103, 61], lengthKm: 5000,
    landscape: { fr: 'Chaîne composite de hauts sommets, forêts de conifères, vallées et glaciers.', en: 'A broad mountain belt of high peaks, conifer forests, valleys and glaciers.' },
    attendance: { fr: 'Forte autour des parcs et stations ; plus faible dans les secteurs éloignés.', en: 'High around parks and resorts, lower in remote sections.' },
    hiking: { fr: 'Très fort potentiel, avec un vaste réseau de sentiers.', en: 'Excellent potential with an extensive trail network.' },
    mountaineering: { fr: 'Fort potentiel dans les hauts massifs ; conditions alpines en altitude.', en: 'Strong potential in the high ranges, with alpine conditions at elevation.' }
  },
  {
    id: 'appalachians', name: { fr: 'Appalaches', en: 'Appalachian Mountains', es: 'Montes Apalaches' }, center: [-75, 39], catalogueBounds: [-83, 33, -67, 48], lengthKm: 2400,
    landscape: { fr: 'Longs reliefs anciens, arrondis et boisés, séparés par des vallées.', en: 'A long belt of old, rounded, forested ridges separated by valleys.' },
    attendance: { fr: 'Forte sur les grands sentiers et près des parcs ; variable ailleurs.', en: 'High on major trails and near parks; variable elsewhere.' },
    hiking: { fr: 'Très fort potentiel ; itinéraires de longue distance renommés.', en: 'Excellent hiking, including renowned long-distance trails.' },
    mountaineering: { fr: 'Potentiel limité à modéré ; escalade surtout sur des falaises locales.', en: 'Limited to moderate; climbing is concentrated on local cliffs.' }
  },
  {
    id: 'sierra-nevada', name: { fr: 'Sierra Nevada', en: 'Sierra Nevada', es: 'Sierra Nevada' }, center: [-119.5, 37.5], catalogueBounds: [-121.5, 35, -118, 41], lengthKm: 640,
    landscape: { fr: 'Crêtes granitiques, cirques glaciaires, lacs d’altitude et forêts de montagne.', en: 'Granite crests, glacial cirques, alpine lakes and mountain forests.' },
    attendance: { fr: 'Forte dans les parcs nationaux et autour des itinéraires classiques.', en: 'High in national parks and around classic routes.' },
    hiking: { fr: 'Très fort potentiel, du sentier accessible à la traversée de haute montagne.', en: 'Excellent, from accessible trails to high-mountain traverses.' },
    mountaineering: { fr: 'Fort potentiel sur les sommets et parois granitiques.', en: 'Strong potential on its peaks and granite walls.' }
  },
  {
    id: 'cascades', name: { fr: 'Chaîne des Cascades', en: 'Cascade Range', es: 'Cordillera de las Cascadas' }, center: [-121.5, 45.5], catalogueBounds: [-124, 41, -119, 50], lengthKm: 1100,
    landscape: { fr: 'Alignement de volcans, forêts humides, champs de lave et glaciers.', en: 'A volcanic arc of wet forests, lava fields and glaciers.' },
    attendance: { fr: 'Forte autour des parcs et des volcans emblématiques.', en: 'High around national parks and iconic volcanoes.' },
    hiking: { fr: 'Fort potentiel, avec de nombreux sentiers et traversées.', en: 'Strong potential, with many trails and long traverses.' },
    mountaineering: { fr: 'Fort à très fort sur les volcans glaciaires ; conditions changeantes.', en: 'Strong to excellent on glaciated volcanoes; conditions change quickly.' }
  },
  {
    id: 'alaska-range', name: { fr: 'Chaîne d’Alaska', en: 'Alaska Range', es: 'Cordillera de Alaska' }, center: [-151, 63], catalogueBounds: [-154, 60, -145, 65], lengthKm: 650,
    landscape: { fr: 'Hauts sommets glaciaires, grands champs de glace et vallées sauvages.', en: 'High glaciated peaks, vast icefields and wild valleys.' },
    attendance: { fr: 'Faible hors des sites accessibles ; accès et météo contraignants.', en: 'Low outside accessible sites; access and weather are demanding.' },
    hiking: { fr: 'Potentiel réel mais logistique difficile et itinéraires souvent isolés.', en: 'Good potential, but logistics are difficult and routes often remote.' },
    mountaineering: { fr: 'Exceptionnel pour l’alpinisme engagé et les expéditions.', en: 'Exceptional for committed mountaineering and expeditions.' }
  },
  {
    id: 'himalaya', name: { fr: 'Himalaya', en: 'Himalaya', es: 'Himalaya' }, center: [85, 29], catalogueBounds: [78, 26, 96, 36], lengthKm: 2400,
    landscape: { fr: 'Très hauts sommets, glaciers, vallées encaissées et étages de végétation contrastés.', en: 'Very high peaks, glaciers, deep valleys and sharply changing vegetation zones.' },
    attendance: { fr: 'Forte sur quelques itinéraires de trek et camps de base ; faible dans les zones reculées.', en: 'High on a few trekking and base-camp routes; low in remote areas.' },
    hiking: { fr: 'Exceptionnel pour le trek, avec permis, acclimatation et saison à prévoir.', en: 'Exceptional trekking; permits, acclimatization and season matter.' },
    mountaineering: { fr: 'Exceptionnel, mais altitude extrême et expéditions très exigeantes.', en: 'Exceptional, but extreme altitude makes expeditions highly demanding.' }
  },
  {
    id: 'karakoram', name: { fr: 'Karakoram', en: 'Karakoram', es: 'Karakórum' }, center: [76.5, 35.5], catalogueBounds: [73, 34, 80, 38], lengthKm: 500,
    landscape: { fr: 'Massifs très abrupts, glaciers étendus et sommets parmi les plus élevés du globe.', en: 'Steep massifs, extensive glaciers and some of the world’s highest peaks.' },
    attendance: { fr: 'Faible à modérée, concentrée sur les grands itinéraires d’expédition.', en: 'Low to moderate, concentrated on major expedition routes.' },
    hiking: { fr: 'Fort potentiel de trek, mais longues approches et autonomie nécessaires.', en: 'Strong trekking potential, with long approaches and a need for self-sufficiency.' },
    mountaineering: { fr: 'Exceptionnel et très engagé ; terrain glaciaire et altitude extrême.', en: 'Exceptional and highly committing, with glaciers and extreme altitude.' }
  },
  {
    id: 'hindu-kush', name: { fr: 'Hindou Kouch', en: 'Hindu Kush', es: 'Hindu Kush' }, center: [70, 36], catalogueBounds: [65, 33, 73.5, 38], lengthKm: 800,
    landscape: { fr: 'Crêtes arides et glaciaires, hautes vallées et transitions vers les plateaux d’Asie centrale.', en: 'Dry and glaciated ridges, high valleys and transitions to Central Asian plateaus.' },
    attendance: { fr: 'Faible ; accès, infrastructures et conditions régionales varient fortement.', en: 'Low; access, infrastructure and regional conditions vary widely.' },
    hiking: { fr: 'Potentiel d’itinéraires de montagne, souvent isolés et peu aménagés.', en: 'Potential for mountain routes, often remote and minimally developed.' },
    mountaineering: { fr: 'Fort potentiel technique, avec préparation et information locale indispensables.', en: 'Strong technical potential; careful preparation and local information are essential.' }
  },
  {
    id: 'pamir', name: { fr: 'Pamir', en: 'Pamir Mountains', es: 'Montes Pamir' }, center: [72.5, 38.5], catalogueBounds: [70, 37, 74, 40], lengthKm: 600,
    landscape: { fr: 'Hauts plateaux froids, vallées larges, glaciers et sommets isolés.', en: 'Cold high plateaus, broad valleys, glaciers and isolated peaks.' },
    attendance: { fr: 'Faible ; tourisme d’aventure concentré sur quelques corridors.', en: 'Low; adventure travel is concentrated along a few corridors.' },
    hiking: { fr: 'Fort potentiel de trek d’altitude ; longues distances et acclimatation.', en: 'Strong high-altitude trekking potential; long distances and acclimatization.' },
    mountaineering: { fr: 'Fort potentiel d’expédition dans les secteurs élevés et glaciaires.', en: 'Strong expedition potential in high, glaciated areas.' }
  },
  {
    id: 'tien-shan', name: { fr: 'Monts Tian Shan', en: 'Tian Shan', es: 'Montes Tian Shan' }, center: [78, 42], catalogueBounds: [69, 39, 87, 46], lengthKm: 2500,
    landscape: { fr: 'Sommets glaciaires, alpages, vallées sèches et grands lacs de montagne.', en: 'Glaciated peaks, alpine meadows, dry valleys and large mountain lakes.' },
    attendance: { fr: 'Modérée, avec des pôles de randonnée et d’alpinisme régionaux.', en: 'Moderate, with regional hiking and mountaineering hubs.' },
    hiking: { fr: 'Fort potentiel, du trek de vallée aux traversées d’altitude.', en: 'Strong potential, from valley treks to high passes.' },
    mountaineering: { fr: 'Fort potentiel dans les secteurs glaciaires ; conditions de haute altitude.', en: 'Strong potential in glaciated areas, with high-altitude conditions.' }
  },
  {
    id: 'kunlun', name: { fr: 'Monts Kunlun', en: 'Kunlun Mountains', es: 'Montes Kunlun' }, center: [88, 36], catalogueBounds: [78, 34, 101, 40], lengthKm: 3000,
    landscape: { fr: 'Long système de hauts reliefs arides, glaciers et plateaux du Tibet.', en: 'A long system of dry high ranges, glaciers and Tibetan plateaus.' },
    attendance: { fr: 'Très faible dans une grande partie du massif, qui reste isolé.', en: 'Very low across much of this remote mountain system.' },
    hiking: { fr: 'Potentiel limité par l’isolement, l’altitude et les accès.', en: 'Limited by remoteness, altitude and access.' },
    mountaineering: { fr: 'Potentiel d’expédition élevé, mais très peu d’itinéraires aménagés.', en: 'High expedition potential, with very few developed routes.' }
  },
  {
    id: 'altai', name: { fr: 'Monts Altaï', en: 'Altai Mountains', es: 'Montes Altái' }, center: [88, 49], catalogueBounds: [84, 46, 101, 53], lengthKm: 2000,
    landscape: { fr: 'Taïga, steppes, toundra alpine, lacs et glaciers.', en: 'Taiga, steppe, alpine tundra, lakes and glaciers.' },
    attendance: { fr: 'Modérée près des vallées accessibles, faible dans les secteurs éloignés.', en: 'Moderate in accessible valleys, low in remote areas.' },
    hiking: { fr: 'Fort potentiel de randonnée et de trek dans des paysages variés.', en: 'Strong hiking and trekking potential across varied landscapes.' },
    mountaineering: { fr: 'Potentiel modéré à fort sur les hauts sommets glaciaires.', en: 'Moderate to strong potential on high glaciated peaks.' }
  },
  {
    id: 'alps', name: { fr: 'Alpes', en: 'Alps', es: 'Alpes' }, center: [10, 46.5], catalogueBounds: [5, 43, 17, 48.5], lengthKm: 1200,
    landscape: { fr: 'Crêtes aiguës, glaciers, vallées profondes, lacs et alpages.', en: 'Sharp ridges, glaciers, deep valleys, lakes and alpine pastures.' },
    attendance: { fr: 'Très forte sur les grands itinéraires, refuges et stations ; plus faible en zones sauvages.', en: 'Very high on classic routes, hut networks and resorts; lower in remote areas.' },
    hiking: { fr: 'Exceptionnel, avec sentiers, refuges et grandes traversées balisées.', en: 'Exceptional, with trails, huts and marked long-distance traverses.' },
    mountaineering: { fr: 'Exceptionnel, du rocher à la haute montagne glaciaire.', en: 'Exceptional, from rock climbing to glaciated high alpine routes.' }
  },
  {
    id: 'pyrenees', name: { fr: 'Pyrénées', en: 'Pyrenees', es: 'Pirineos' }, center: [0.5, 42.7], catalogueBounds: [-2, 42, 3.5, 43.5], lengthKm: 430,
    landscape: { fr: 'Crêtes rocheuses, cirques, forêts, lacs et pâturages d’altitude.', en: 'Rocky ridges, glacial cirques, forests, lakes and high pastures.' },
    attendance: { fr: 'Forte sur les sites et sentiers connus, particulièrement en saison.', en: 'High on popular sites and trails, especially in season.' },
    hiking: { fr: 'Très fort potentiel, avec sentiers balisés et refuges.', en: 'Very strong potential, with marked trails and mountain huts.' },
    mountaineering: { fr: 'Potentiel modéré à fort sur les sommets, couloirs et faces rocheuses.', en: 'Moderate to strong on peaks, couloirs and rock faces.' }
  },
  {
    id: 'carpathians', name: { fr: 'Carpates', en: 'Carpathian Mountains', es: 'Cárpatos' }, center: [21, 48], catalogueBounds: [17, 44, 27, 50], lengthKm: 1500,
    landscape: { fr: 'Montagnes souvent boisées, prairies d’altitude et crêtes plus élevées des Tatras.', en: 'Mostly forested mountains, alpine meadows and higher Tatra ridges.' },
    attendance: { fr: 'Modérée à forte sur les secteurs protégés et les sentiers populaires.', en: 'Moderate to high in protected areas and popular hiking zones.' },
    hiking: { fr: 'Fort potentiel de randonnée, souvent accessible sur plusieurs saisons.', en: 'Strong hiking potential, often accessible across several seasons.' },
    mountaineering: { fr: 'Potentiel modéré, surtout concentré dans les Tatras.', en: 'Moderate potential, concentrated mainly in the Tatras.' }
  },
  {
    id: 'scandinavian-mountains', name: { fr: 'Montagnes scandinaves', en: 'Scandinavian Mountains', es: 'Montes Escandinavos' }, center: [14, 64], catalogueBounds: [5, 58, 21, 71], lengthKm: 1700,
    landscape: { fr: 'Plateaux, vallées glaciaires, fjords, toundra et glaciers.', en: 'Plateaus, glacial valleys, fjords, tundra and glaciers.' },
    attendance: { fr: 'Modérée ; fréquentation localement forte près des accès et refuges.', en: 'Moderate overall; locally high near access points and huts.' },
    hiking: { fr: 'Très fort potentiel de randonnée et de trek en milieu nordique.', en: 'Very strong potential for hiking and Nordic trekking.' },
    mountaineering: { fr: 'Potentiel modéré à fort, avec météo et saison déterminantes.', en: 'Moderate to strong; weather and season are key factors.' }
  },
  {
    id: 'caucasus', name: { fr: 'Caucase', en: 'Caucasus Mountains', es: 'Montes del Cáucaso' }, center: [44.5, 42.5], catalogueBounds: [40, 41, 47.5, 44.5], lengthKm: 1200,
    landscape: { fr: 'Très hauts sommets glaciaires, vallées profondes et forts contrastes de versants.', en: 'High glaciated peaks, deep valleys and sharply contrasting slopes.' },
    attendance: { fr: 'Modérée et concentrée autour de quelques vallées et sommets connus.', en: 'Moderate and concentrated around a few well-known valleys and peaks.' },
    hiking: { fr: 'Fort potentiel de trek et de randonnée en haute montagne.', en: 'Strong potential for trekking and high-mountain hiking.' },
    mountaineering: { fr: 'Très fort potentiel technique sur les sommets glaciaires.', en: 'Very strong technical potential on glaciated peaks.' }
  },
  {
    id: 'atlas', name: { fr: 'Atlas', en: 'Atlas Mountains', es: 'Montes Atlas' }, center: [-5, 31.5], catalogueBounds: [-10, 28, 10, 37], lengthKm: 2500,
    landscape: { fr: 'Crêtes arides, plateaux, vallées cultivées et hauts sommets du Haut Atlas.', en: 'Dry ridges, plateaus, cultivated valleys and the high peaks of the High Atlas.' },
    attendance: { fr: 'Forte près des villages de départ et des itinéraires du Haut Atlas.', en: 'High near trailhead villages and High Atlas routes.' },
    hiking: { fr: 'Fort potentiel de trek et d’ascension de sommets.', en: 'Strong trekking and peak-hiking potential.' },
    mountaineering: { fr: 'Potentiel modéré à fort selon altitude, neige et saison.', en: 'Moderate to strong depending on altitude, snow and season.' }
  },
  {
    id: 'zagros', name: { fr: 'Zagros', en: 'Zagros Mountains', es: 'Montes Zagros' }, center: [49, 32], catalogueBounds: [44, 27, 52, 34.5], lengthKm: 1600,
    landscape: { fr: 'Longues crêtes parallèles, vallées plissées et versants semi-arides.', en: 'Long parallel ridges, folded valleys and semi-arid slopes.' },
    attendance: { fr: 'Surtout locale et variable selon les secteurs.', en: 'Mostly local and variable by area.' },
    hiking: { fr: 'Potentiel de randonnée dans les vallées et les hauts reliefs.', en: 'Hiking potential in its valleys and higher ranges.' },
    mountaineering: { fr: 'Potentiel modéré ; informations et accès locaux sont importants.', en: 'Moderate potential; local access information is important.' }
  },
  {
    id: 'urals', name: { fr: 'Oural', en: 'Ural Mountains', es: 'Montes Urales' }, center: [59, 59], catalogueBounds: [51, 50, 67, 70], lengthKm: 2500,
    landscape: { fr: 'Reliefs anciens, forêts boréales, grands plateaux et sommets arrondis.', en: 'Old mountain terrain, boreal forests, broad plateaus and rounded summits.' },
    attendance: { fr: 'Modérée près des parcs et des zones accessibles ; faible au nord.', en: 'Moderate near parks and accessible areas; low in the north.' },
    hiking: { fr: 'Bon potentiel de randonnée, avec des conditions plus rudes au nord.', en: 'Good hiking potential, with harsher conditions in the north.' },
    mountaineering: { fr: 'Potentiel limité à modéré ; davantage axé sur l’exploration et le ski.', en: 'Limited to moderate; more focused on exploration and ski touring.' }
  },
  {
    id: 'great-dividing-range', name: { fr: 'Grande Cordillère australienne', en: 'Great Dividing Range', es: 'Gran Cordillera Divisoria' }, center: [149, -28], catalogueBounds: [145, -38, 153, -16], lengthKm: 3500,
    landscape: { fr: 'Plateaux boisés, escarpements, forêts humides et hauts pays tempérés.', en: 'Forested plateaus, escarpments, rainforest and temperate high country.' },
    attendance: { fr: 'Forte autour des parcs et centres de plein air de la côte est.', en: 'High around parks and outdoor hubs along the east coast.' },
    hiking: { fr: 'Fort potentiel, avec de nombreux sentiers et parcs nationaux.', en: 'Strong potential, with many trails and national parks.' },
    mountaineering: { fr: 'Faible à modéré ; randonnée et escalade locale dominent.', en: 'Low to moderate; hiking and local climbing are more common.' }
  },
  {
    id: 'southern-alps', name: { fr: 'Alpes du Sud', en: 'Southern Alps / Kā Tiritiri o te Moana', es: 'Alpes del Sur' }, center: [170, -43.5], catalogueBounds: [167, -46, 173, -42], lengthKm: 500,
    landscape: { fr: 'Arêtes acérées, glaciers, forêts tempérées et fjords proches.', en: 'Sharp ridges, glaciers, temperate forests and nearby fjords.' },
    attendance: { fr: 'Forte près des sites accessibles ; la météo limite souvent les sorties.', en: 'High near accessible sites; weather often limits outings.' },
    hiking: { fr: 'Très fort potentiel, du sentier côtier aux traversées alpines.', en: 'Very strong, from lowland tracks to alpine traverses.' },
    mountaineering: { fr: 'Exceptionnel, avec météo rapide et terrain glaciaire exigeant.', en: 'Exceptional, with fast-changing weather and demanding glacier terrain.' }
  },
  {
    id: 'japanese-alps', name: { fr: 'Alpes japonaises', en: 'Japanese Alps', es: 'Alpes Japoneses' }, center: [137.7, 36], catalogueBounds: [136, 35, 138.5, 37], lengthKm: 300,
    landscape: { fr: 'Crêtes abruptes, forêts, neige abondante et vallées encaissées.', en: 'Steep ridges, forests, heavy snow and narrow valleys.' },
    attendance: { fr: 'Forte pendant les saisons de randonnée et près des refuges.', en: 'High during hiking seasons and around mountain huts.' },
    hiking: { fr: 'Très fort potentiel, avec sentiers et refuges bien établis.', en: 'Very strong, with established trails and mountain huts.' },
    mountaineering: { fr: 'Potentiel modéré à fort selon saison et enneigement.', en: 'Moderate to strong depending on season and snow conditions.' }
  },
  {
    id: 'drakensberg', name: { fr: 'Drakensberg', en: 'Drakensberg', es: 'Drakensberg' }, center: [29.3, -29], catalogueBounds: [26, -31, 31.5, -27], lengthKm: 1000,
    landscape: { fr: 'Escarpements basaltiques, falaises, hauts plateaux herbeux et vallées.', en: 'Basalt escarpments, cliffs, grassy high plateaus and valleys.' },
    attendance: { fr: 'Forte autour des parcs et des itinéraires populaires.', en: 'High around parks and popular routes.' },
    hiking: { fr: 'Très fort potentiel, de la randonnée à plusieurs jours aux sommets.', en: 'Very strong, from day hikes to multi-day mountain routes.' },
    mountaineering: { fr: 'Potentiel modéré, notamment sur les falaises et parois locales.', en: 'Moderate potential, especially on local cliffs and faces.' }
  },
  {
    id: 'ethiopian-highlands', name: { fr: 'Hautes terres éthiopiennes', en: 'Ethiopian Highlands', es: 'Tierras Altas de Etiopía' }, center: [38, 11.5], catalogueBounds: [35, 7, 40.5, 15], lengthKm: 1000,
    landscape: { fr: 'Hauts plateaux, escarpements volcaniques, canyons et vallées cultivées.', en: 'High plateaus, volcanic escarpments, canyons and cultivated valleys.' },
    attendance: { fr: 'Modérée sur les sites connus ; plus faible dans les zones isolées.', en: 'Moderate at known sites; lower in remote areas.' },
    hiking: { fr: 'Fort potentiel de marche et de trek dans les parcs et hauts plateaux.', en: 'Strong walking and trekking potential in parks and highlands.' },
    mountaineering: { fr: 'Potentiel limité à modéré ; la randonnée domine.', en: 'Limited to moderate; hiking is the main activity.' }
  },
  {
    id: 'rwenzori', name: { fr: 'Monts Rwenzori', en: 'Rwenzori Mountains', es: 'Montes Ruwenzori' }, center: [29.9, 0.4], catalogueBounds: [29.5, -0.5, 30.5, 1.5], lengthKm: 120,
    landscape: { fr: 'Forêt tropicale, landes d’altitude, glaciers et reliefs très humides.', en: 'Tropical forest, high-altitude moorland, glaciers and very wet terrain.' },
    attendance: { fr: 'Faible à modérée, avec accès généralement encadré et saisonnier.', en: 'Low to moderate, with access generally guided and seasonal.' },
    hiking: { fr: 'Fort potentiel de trek exigeant, souvent sur plusieurs jours.', en: 'Strong potential for demanding, often multi-day trekking.' },
    mountaineering: { fr: 'Fort potentiel technique ; humidité, terrain et glaciers compliquent les ascensions.', en: 'Strong technical potential; wet terrain and glaciers make climbs demanding.' }
  }
]

export const mountainRangeHighPoints: Record<string, {
  name: LocalizedMountainText
  elevationMeters: number
}> = {
  andes: { name: { fr: 'Aconcagua', en: 'Aconcagua' }, elevationMeters: 6961 },
  rockies: { name: { fr: 'Mont Elbert', en: 'Mount Elbert' }, elevationMeters: 4401 },
  appalachians: { name: { fr: 'Mont Mitchell', en: 'Mount Mitchell' }, elevationMeters: 2037 },
  'sierra-nevada': { name: { fr: 'Mont Whitney', en: 'Mount Whitney' }, elevationMeters: 4421 },
  cascades: { name: { fr: 'Mont Rainier', en: 'Mount Rainier' }, elevationMeters: 4392 },
  'alaska-range': { name: { fr: 'Denali', en: 'Denali' }, elevationMeters: 6190 },
  himalaya: { name: { fr: 'Everest', en: 'Everest' }, elevationMeters: 8849 },
  karakoram: { name: { fr: 'K2' , en: 'K2' }, elevationMeters: 8611 },
  'hindu-kush': { name: { fr: 'Tirich Mir', en: 'Tirich Mir' }, elevationMeters: 7708 },
  pamir: { name: { fr: 'Pic Ismail Samani', en: 'Ismoil Somoni Peak' }, elevationMeters: 7495 },
  'tien-shan': { name: { fr: 'Jengish Chokusu', en: 'Jengish Chokusu' }, elevationMeters: 7439 },
  kunlun: { name: { fr: 'Liushi Shan', en: 'Liushi Shan' }, elevationMeters: 7167 },
  altai: { name: { fr: 'Mont Béloukha', en: 'Mount Belukha' }, elevationMeters: 4506 },
  alps: { name: { fr: 'Mont Blanc', en: 'Mont Blanc' }, elevationMeters: 4808 },
  pyrenees: { name: { fr: 'Aneto', en: 'Aneto' }, elevationMeters: 3404 },
  carpathians: { name: { fr: 'Gerlachovský štít', en: 'Gerlachovský štít' }, elevationMeters: 2655 },
  'scandinavian-mountains': { name: { fr: 'Galdhøpiggen', en: 'Galdhøpiggen' }, elevationMeters: 2469 },
  caucasus: { name: { fr: 'Elbrouz', en: 'Mount Elbrus' }, elevationMeters: 5642 },
  atlas: { name: { fr: 'Jbel Toubkal', en: 'Jebel Toubkal' }, elevationMeters: 4167 },
  zagros: { name: { fr: 'Qash-Mastan (Dena)', en: 'Qash-Mastan (Dena)' }, elevationMeters: 4409 },
  urals: { name: { fr: 'Mont Narodnaïa', en: 'Mount Narodnaya' }, elevationMeters: 1895 },
  'great-dividing-range': { name: { fr: 'Mont Kosciuszko', en: 'Mount Kosciuszko' }, elevationMeters: 2228 },
  'southern-alps': { name: { fr: 'Aoraki / mont Cook', en: 'Aoraki / Mount Cook' }, elevationMeters: 3724 },
  'japanese-alps': { name: { fr: 'Mont Kita', en: 'Mount Kita' }, elevationMeters: 3193 },
  drakensberg: { name: { fr: 'Thabana Ntlenyana', en: 'Thabana Ntlenyana' }, elevationMeters: 3482 },
  'ethiopian-highlands': { name: { fr: 'Ras Dashan', en: 'Ras Dashen' }, elevationMeters: 4550 },
  rwenzori: { name: { fr: 'Pic Margherita (mont Stanley)', en: 'Margherita Peak (Mount Stanley)' }, elevationMeters: 5109 }
}
