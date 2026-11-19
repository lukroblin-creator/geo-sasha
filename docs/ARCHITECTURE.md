# Architecture de World Atlas

## Vue d’ensemble

World Atlas est une application Electron. Le processus principal est dans `src/main`, le pont sécurisé vers l’interface dans `src/preload`, et l’application React dans `src/renderer/src`.

Le renderer est organisé par domaine :

- `components/` contient les vues et les contrôles visibles : exploration, quiz, statistiques, comparateur et gestion des calques.
- `WorldMapLoader.tsx` charge le moteur cartographique uniquement lorsqu'une vue qui contient une carte est affichée. Les contrôles de caméra et ses calculs d'orientation sont isolés dans `WorldMapCameraControls.tsx` et `worldMapCamera.ts`.
- `data/geography/` regroupe les entités, géométries, données physiques et règles de calques.
- `data/quiz/` regroupe les questions, les réponses, les presets, les sessions et les statistiques de quiz.
- `workers/` contient le travail déporté, notamment celui des étiquettes cartographiques.
- `assets/map-layers/` contient les textures hors ligne de la carte.

## Sécurité et distribution

La fenêtre Electron active explicitement l'isolation de contexte et le bac à sable, et désactive l'intégration Node dans le renderer. Le preload n'expose que la lecture des versions utilisées dans l'écran de diagnostic et l'IPC nécessaire aux textures locales. Les liens externes sont limités à HTTPS.

La compilation de l'application ne constitue pas encore une préparation complète à la distribution macOS : la notarisation est désactivée dans `electron-builder.yml` et dépendra des certificats et identifiants de signature du propriétaire du projet.

## Circulation de l’état

`App.tsx` orchestre les modes de l’application et conserve encore une grande partie de l’état partagé : quiz actif, sélection cartographique, presets, progression, historique et affichage des vues. Il transmet cet état aux composants par propriétés et reçoit les actions par callbacks.

`WorldMap.tsx` est encore le moteur d'interaction cartographique côté interface. Il relie MapLibre aux données géographiques, aux calques visuels, aux masques, à la caméra, à la sélection de territoires et aux interactions propres aux quiz. Les règles de sélection et de hitzone, de masques, et les calculs mathématiques de caméra sont extraits dans des modules dédiés et testables. Les composants de vue consomment ces fonctions et affichent les contrôles associés.

Le modèle d’ordre et d’opacité des calques est défini dans `data/geography/mapLayerManager.ts`. Le panneau de gestion se trouve dans `components/MapLayerManager.tsx`, tandis que leur rendu effectif est coordonné par `WorldMap.tsx`. Ces trois endroits doivent rester cohérents.

Pour les quiz, `data/quiz/` fournit les données et la logique de session. `QuizPanels.tsx` gère la saisie et le retour des réponses. `App.tsx` relie ces réponses à la carte, aux scores, aux statistiques et à l’historique.

## Zones sensibles

- `App.tsx` concentre l’orchestration de plusieurs modes et domaines.
- `WorldMap.tsx` concentre beaucoup de comportements cartographiques indépendants.
- `MapLayerManager.tsx` porte à la fois l’interface de piles et les interactions de déplacement des calques et masques.
- `QuizPanels.tsx` rassemble plusieurs formats de quiz et les réponses simples ou multiples.
- La distribution macOS doit encore être configurée et vérifiée avec la signature et la notarisation avant publication.
- `assets/map-layers/` contient des images volumineuses nécessaires au fonctionnement cartographique hors ligne. Leur taille disque ne mesure pas, à elle seule, la vitesse de rendu.

## Découpage progressif conseillé

1. Garder dans `App.tsx` la composition des vues et déplacer les règles métier dans des modules dédiés.
2. Continuer à extraire de `WorldMap.tsx` les comportements par responsabilité. Les hitzones, la sélection et les masques sont déjà isolés ; poursuivre ensuite avec les effets et commandes de caméra, puis les interactions de quiz. Conserver une interface explicite entre ces modules et MapLibre.
3. Séparer dans `QuizPanels.tsx` les réponses simples, les groupes de réponses et les filtres de drapeaux, sans modifier leurs règles fonctionnelles.
4. Ajouter des contrôles automatisés pour les transitions d’état sensibles, puis mesurer les performances réelles de la carte avant d’optimiser son rendu.

Chaque extraction doit rester petite et préserver les interfaces existantes tant que le comportement n’est pas couvert par des vérifications ciblées.

## Vérification locale

Lancer `npm run verify` avant de valider une modification. Cette commande vérifie les types des processus Node et de l'interface, vérifie les types des tests, exécute les tests, contrôle le format des fichiers maintenus, puis applique ESLint à tout le dépôt. Le workflow GitHub Actions exécute aussi `verify` et une compilation de production sur les changements poussés et les demandes de fusion.

`npm run lint:map` reste disponible pour vérifier rapidement les règles de hitzone, les masques et leur hook sans lancer toute la suite.

- `tests/quiz.test.mts` couvre les règles de quiz et la progression.
- `tests/data-integrity.test.mts` vérifie les liens entre catalogues, profils, territoires et les principales contraintes structurelles des données. Il ne remplace pas une vérification documentaire des faits.
- `tests/map-interaction.test.mts` couvre les règles déterministes de hitzone, de présélection clavier et de transparence des masques.
- `tests/map-camera.test.mts` couvre les conversions d'orientation et les rotations composées de la caméra.

Quand un comportement cartographique change, ajouter ou ajuster d’abord un cas déterministe dans la suite de carte. La validation visuelle dans l’application reste nécessaire pour les gestes et le rendu MapLibre.
