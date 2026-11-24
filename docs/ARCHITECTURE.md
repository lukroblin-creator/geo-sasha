# Architecture de World Atlas

**Dernière révision : 24 novembre 2026**

## Vue d’ensemble

World Atlas est une application Electron. Le processus principal est dans `src/main`, le pont sécurisé vers l’interface dans `src/preload`, et l’application React dans `src/renderer/src`.

Le point d’entrée du renderer installe quatre contextes globaux : langue, skin, raccourcis clavier et couche d’ambiance Matrix. `App.tsx` reste ensuite responsable de la composition des modes, mais ces contextes sont les sources de vérité de leurs préférences respectives.

Le renderer est organisé par domaine :

- `components/` contient les vues et les contrôles visibles : exploration, quiz, statistiques, comparateur et gestion des calques.
- `AppModeSwitcher.tsx` porte la navigation compacte commune, les commandes système et le titre de page ; certaines vues cartographiques la révèlent à partir du bord haut de fenêtre.
- `WorldMapLoader.tsx` charge le moteur cartographique uniquement lorsqu'une vue qui contient une carte est affichée. Les contrôles de caméra et ses calculs d'orientation sont isolés dans `WorldMapCameraControls.tsx` et `worldMapCamera.ts`.
- La sélection cartographique est répartie entre `worldMapCountrySelection.ts`, `useWorldMapCountrySelection.ts` et `data/geography/countryHitTesting.ts`.
- Les masques utilisent `worldMapOpacityMasks.ts`, `worldMapMaskGeometry.ts` et `data/geography/opacityMaskLogic.ts`, tandis que `MapLayerManager.tsx` porte leur interface de pile.
- Le rendu polaire du globe est isolé dans `worldMapPolarTexture.ts`, `polarTextureBlend.ts` et `useWorldMapGlobeTexture.ts`.
- Le système de raccourcis est centralisé dans `data/keyboardShortcuts.tsx` et `data/shortcutKeys.ts`. `SettingsMenu.tsx` et `ShortcutKeyboardDialog.tsx` éditent les associations via le même fournisseur ; `shortcutKeyboardLayout.ts` décrit le clavier visuel.
- `data/geography/` regroupe les entités, géométries, données physiques et règles de calques.
- `data/geography/explorationViews.ts` place la vue système « Global » devant les vues personnelles sans modifier leur stockage.
- `data/geography/countryComparatorTextQuery.ts` analyse et complète les requêtes textuelles du comparateur ; `CountryComparatorView.tsx` traduit ces expressions en critères du comparateur existant.
- `data/quiz/` regroupe les questions, les réponses, les presets, les sessions et les statistiques de quiz.
- `data/quiz/quizRewards.ts` calcule les accomplissements de manière déterministe depuis l’historique ; `QuizRewardsPanel.tsx` les présente dans les statistiques sans stockage distinct.
- `data/quiz/quizTiming.ts` porte les réglages, calculs de durée et clés stables de comparaison ; `quizPresetValidation.ts` valide les presets sans dépendre de leur interface de stockage.
- `workers/` contient le travail déporté, notamment celui des étiquettes cartographiques.
- `assets/map-layers/` contient les textures hors ligne de la carte.

## Sécurité et distribution

La fenêtre Electron active explicitement l'isolation de contexte et le bac à sable, et désactive l'intégration Node dans le renderer. Le preload n'expose que la lecture des versions utilisées dans l'écran de diagnostic et l'IPC nécessaire aux textures locales. Les liens externes sont limités à HTTPS.

La compilation de l'application ne constitue pas encore une préparation complète à la distribution macOS : la notarisation est désactivée dans `electron-builder.yml` et dépendra des certificats et identifiants de signature du propriétaire du projet.

## Circulation de l’état

`App.tsx` orchestre les modes de l’application et conserve encore une grande partie de l’état partagé : quiz actif, sélection cartographique, presets, progression, historique et affichage des vues. Il transmet cet état aux composants par propriétés et reçoit les actions par callbacks.

`KeyboardShortcutProvider` conserve les associations clavier, résout les conflits par contexte et distribue les gestionnaires enregistrés par identifiant d’action. Les composants ne doivent pas écouter globalement les mêmes touches en parallèle, sauf pour un comportement volontairement standard et protégé, comme l’avancement par Entrée lorsqu’aucun champ ni raccourci actif ne la consomme.

`WorldMap.tsx` est encore le moteur d'interaction cartographique côté interface. Il relie MapLibre aux données géographiques, aux calques visuels, aux masques, à la caméra, à la sélection de territoires et aux interactions propres aux quiz. Les règles de sélection et de hitzone, de masques, et les calculs mathématiques de caméra sont extraits dans des modules dédiés et testables. Les composants de vue consomment ces fonctions et affichent les contrôles associés.

Le modèle d’ordre et d’opacité des calques est défini dans `data/geography/mapLayerManager.ts`. Le panneau de gestion se trouve dans `components/MapLayerManager.tsx`, tandis que leur rendu effectif est coordonné par `WorldMap.tsx`. Ces trois endroits doivent rester cohérents.

`ExplorationView.tsx` orchestre les calques, masques et vues enregistrées. Une vue sérialise également la caméra, la projection, les comparaisons et la sélection courante. `WorldMap.tsx` fournit l’état de caméra et reçoit une demande de restauration ; le stockage ne doit donc pas être déplacé dans la carte sans redéfinir cette interface.

La vue système « Global » est construite dans `ExplorationView.tsx` à partir des réglages cartographiques par défaut et reste séparée des vues personnelles persistées. Les notifications de chargement d’images de drapeaux sont regroupées dans `MapFlagOverlay.tsx` pour éviter de recalculer l’ensemble des couches SVG à chaque événement rapproché.

Pour les quiz, `data/quiz/` fournit les données et la logique de session. `QuizPanels.tsx` gère la saisie et le retour des réponses. `App.tsx` relie ces réponses à la carte, aux scores, aux statistiques et à l’historique.

`App.tsx` démarre et arrête les horloges des parties, transmet le temps aux modes spéciaux, et associe chaque résultat à un instantané de configuration. `useQuizSession.ts` applique les expirations au quiz classique ; les vues Estimation et Dessine les frontières traitent leurs propres résultats d’expiration. `StatisticsView.tsx` compare les durées par clé stable de configuration et exclut les parties expirées ou incomplètes du classement.

`StatisticsView.tsx` transmet l’historique conservé au calcul pur de `quizRewards.ts`. `QuizRewardsPanel.tsx` affiche les accomplissements obtenus et leur progression ; aucun résultat ni déblocage n’est stocké en parallèle de l’historique.

## Persistance locale

La persistance passe actuellement par `localStorage`, avec des clés versionnées :

- langue et skin dans leurs providers ;
- raccourcis dans `data/keyboardShortcuts.tsx` ;
- presets et preset par défaut dans `data/quiz/presets.ts` ;
- progression dans `data/quiz/progress.ts`, avec migration des anciennes versions ;
- historique dans `data/quiz/quizHistory.ts` ;
- copie en mémoire de l’historique de quiz de la session courante, utilisée si `localStorage` est indisponible ;
- accomplissements calculés à la demande depuis les 500 entrées d’historique conservées ;
- réglages temporels optionnels dans les presets et durée/configuration temporelles optionnelles dans l’historique de partie ; les enregistrements antérieurs restent valides sans migration destructive ;
- statistiques de quiz pays dans `data/quiz/countryQuizStats.ts` ;
- vues enregistrées dans `ExplorationView.tsx` ;
- préférence de disposition du clavier visuel dans `ShortcutKeyboardDialog.tsx`.

Une évolution de schéma doit conserver la lecture des données antérieures lorsque cela est pertinent. L’échec du stockage reste non bloquant : la session courante continue à fonctionner.

## Zones sensibles

- `App.tsx` concentre l’orchestration de plusieurs modes et domaines.
- `WorldMap.tsx` concentre beaucoup de comportements cartographiques indépendants.
- `MapLayerManager.tsx` porte à la fois l’interface de piles et les interactions de déplacement des calques et masques.
- `QuizPanels.tsx` rassemble plusieurs formats de quiz et les réponses simples ou multiples.
- `ExplorationView.tsx` concentre l’état des calques, des masques, des vues enregistrées et de la fiche ; toute extraction doit préserver la restauration d’une vue complète.
- `SettingsMenu.tsx` combine préférences générales, capture de raccourcis, conflits et ouverture du clavier visuel.
- Les textures de globe peuvent être recréées lors d’un changement de masque ou de projection. L’ordre d’ajout des sources et couches MapLibre est sensible et doit être vérifié en plan comme en globe.
- La distribution macOS doit encore être configurée et vérifiée avec la signature et la notarisation avant publication.
- `assets/map-layers/` contient des images volumineuses nécessaires au fonctionnement cartographique hors ligne. Leur taille disque ne mesure pas, à elle seule, la vitesse de rendu.

## Découpage progressif conseillé

1. Garder dans `App.tsx` la composition des vues et déplacer les règles métier dans des modules dédiés.
2. Continuer à extraire de `WorldMap.tsx` les comportements par responsabilité. Les hitzones, la sélection et les masques sont déjà isolés ; poursuivre ensuite avec les effets et commandes de caméra, puis les interactions de quiz. Conserver une interface explicite entre ces modules et MapLibre.
3. Séparer dans `QuizPanels.tsx` les réponses simples, les groupes de réponses et les filtres de drapeaux, sans modifier leurs règles fonctionnelles.
4. Extraire de `ExplorationView.tsx` la sérialisation des vues et la coordination des calques lorsque cette logique dispose de tests dédiés.
5. Ajouter des contrôles automatisés pour les transitions d’état sensibles, puis mesurer les performances réelles de la carte avant d’optimiser son rendu.

Chaque extraction doit rester petite et préserver les interfaces existantes tant que le comportement n’est pas couvert par des vérifications ciblées.

## Vérification locale

Lancer `npm run verify` avant de valider une modification. Cette commande vérifie les types des processus Node et de l'interface, vérifie les types des tests, exécute les tests, contrôle le format des fichiers maintenus, puis applique ESLint à tout le dépôt. Le workflow GitHub Actions exécute aussi `verify` et une compilation de production sur les changements poussés et les demandes de fusion.

`npm run coverage` mesure séparément la couverture globale avec `c8`. Contrairement au rapport natif de Node limité aux modules chargés, cette commande inclut tous les fichiers TypeScript et React du renderer et compte les fichiers non exécutés à zéro. Elle produit un résumé dans le terminal ainsi qu’un rapport HTML local dans `coverage/index.html`. Le workflow GitHub l’exécute pour rendre l’évolution visible, sans seuil bloquant tant que la base globale reste faible.

`npm run lint:map` reste disponible pour vérifier rapidement les règles de hitzone, les masques et leur hook sans lancer toute la suite.

- `tests/quiz.test.mts` couvre les règles de quiz, la progression, les expirations de session, les clés de configuration, les réglages temporels des presets et la lecture des historiques anciens.
- `tests/quiz-rewards.test.mts` couvre les seuils d’accomplissement, les points partiels, les séries, les entrées historiques incomplètes, les expirations, les records par configuration et les récompenses chronométrées.
- `tests/data-integrity.test.mts` vérifie les liens entre catalogues, profils, territoires et les principales contraintes structurelles des données. Il ne remplace pas une vérification documentaire des faits.
- `tests/map-interaction.test.mts` couvre les règles déterministes de hitzone, de présélection clavier et de transparence des masques.
- `tests/map-camera.test.mts` couvre les conversions d'orientation et les rotations composées de la caméra.
- `tests/keyboard-shortcuts.test.mts` couvre les dispositions de clavier, notamment Option sur les claviers Mac français et américains, ainsi que les modificateurs utilisés seuls.

Quand un comportement cartographique change, ajouter ou ajuster d’abord un cas déterministe dans la suite de carte. La validation visuelle dans l’application reste nécessaire pour les gestes et le rendu MapLibre.

## État du travail en cours

Le dépôt peut contenir un lot important de fichiers modifiés et non suivis entre deux commits. Cet état n’est pas un défaut à corriger automatiquement. Au début de chaque discussion, utiliser `git status --short`, `git diff --stat` et les différences ciblées pour distinguer le dernier commit du travail courant. Ne jamais retirer un nouveau module simplement parce qu’il n’apparaît pas encore dans l’historique Git.
