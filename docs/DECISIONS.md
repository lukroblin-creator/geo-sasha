# Règles fonctionnelles à préserver

**Dernière révision : 24 novembre 2026**

Ce document rassemble les comportements explicitement demandés pendant la conception. Il sert de référence lors des corrections et refactorisations. Une demande explicite plus récente de Lucas peut modifier une règle ; le document doit alors être corrigé dans la même tâche.

Le fichier `IDEES-POUR-PLUS-TARD.txt` ne crée aucune règle fonctionnelle. Une idée ne rejoint ce document qu’après décision de l’implémenter.

## Navigation, clavier et panneaux

- Le logiciel vise une utilisation complète sans souris. Tabulation déplace le focus, les flèches parcourent les listes et menus, Entrée ou Espace active l’élément ciblé, et Échap ferme ou annule lorsque le contexte le permet.
- Les raccourcis configurables sont définis dans un registre central. Une action ne doit pas conserver en parallèle un gestionnaire de touches codé en dur qui ignore les préférences du joueur.
- Tous les modificateurs, y compris une touche de modification seule, peuvent être assignés. Une nouvelle attribution déplace proprement un conflit dans le même contexte au lieu d’exécuter deux commandes.
- Les raccourcis ordinaires ne doivent pas intercepter la saisie dans `input`, `textarea`, `select` ou un élément éditable. Les actions explicitement liées au champ actif constituent l’exception.
- Un bouton qui possède un raccourci affiche dans son infobulle la combinaison actuellement configurée, pas une ancienne combinaison écrite dans son libellé.
- Les panneaux contextuels se ferment lors d’un clic extérieur lorsque cette fermeture ne détruit pas un travail en cours. Les boîtes de dialogue rendent ensuite le focus au contrôle qui les a ouvertes.

## Carte et calques

- L’ordre montré dans le gestionnaire doit être le même que l’ordre réellement rendu sur la carte.
- Désactiver un calque doit le retirer visuellement, sans délai perceptible ni résidu de rendu.
- La surbrillance de présélection et de sélection se dessine au-dessus de la couche visible la plus haute.
- Les réglages de densité, d’opacité et de visibilité modifient uniquement les sources ou couches concernées ; ils ne doivent pas reconstruire toute la carte.
- Les menus de densité et autres panneaux similaires se ferment lorsqu’un clic est effectué ailleurs.
- Un masque activé agit uniquement sur son calque cible. Il rend cette zone transparente pour laisser apparaître le calque situé dessous.
- Un masque non attribué reste indépendant. Il peut être lié au calque cible par son menu ou en le déposant à droite de ce calque.
- « Placer sur la carte » ferme le panneau pour laisser voir toute la carte. La forme du masque reste visible comme curseur pendant le placement, puis le panneau se rouvre.
- Les calques classiques et les masques doivent rester déplaçables. Le panneau doit garder l’accès aux réglages habituels après réorganisation.
- Un masque assigné partage la ligne de sa couche cible et se réorganise pour conserver l’accès aux paramètres ; il n’existe pas de colonne réservée en permanence aux masques.
- Déposer un masque à droite d’un calque l’assigne ; le déposer au-dessus de la pile ou à gauche le désassigne et le replace parmi les masques indépendants.
- Le type d’un masque peut être changé depuis sa propre ligne. Les masques pays et continent acceptent plusieurs sélections depuis la liste ou la carte.
- Le bouton activé/désactivé d’un masque contrôle son effet sans supprimer sa forme ni ses réglages.
- Les cercles et rectangles utilisent une géométrie géographique stable : leur forme et leurs poignées ne se déforment pas lorsqu’on les déplace en latitude.
- Maintenir Option au-dessus d’un masque dont les poignées sont cachées les affiche temporairement et permet réellement de déplacer ou redimensionner la forme.

## Sélection des territoires

- Une grande zone de clic ne doit pas empêcher la sélection d’un petit territoire voisin. À l’intérieur du polygone réel d’un grand pays, le clic sur ce pays garde la priorité sur toute hitzone voisine ; au moins 80 % de sa surface doit rester cliquable.
- Les très petits territoires gardent une cible fantôme de même forme et orientation, agrandie de 1,5 fois. Lorsqu’ils sont entourés par la mer, leur hitzone peut s’étendre davantage dans l’eau, comme une marge autour de leur contour. Les hitzones élargies ne doivent pas détourner un clic situé dans le polygone réel d’un grand pays voisin.
- Un micro-État entouré uniquement de grands pays peut bénéficier d’une aide plus généreuse, car elle ne rend pas un autre petit voisin inaccessible.
- Le survol préselectionne le territoire sous le pointeur. Les flèches déplacent la présélection vers les voisins ; Maj parcourt les petits territoires proches du pointeur ; Entrée valide la présélection courante.
- Si le pointeur se déplace, la sélection reprend normalement sous le pointeur. S’il reste immobile, Maj peut déplacer la présélection sans déplacer le pointeur.
- Les contrôles clavier doivent fonctionner quand le focus est sur la carte et ne pas intercepter la saisie dans un champ texte.
- Tant que le pointeur reste immobile après un déplacement de présélection au clavier, un clic agit sur l’entité présélectionnée. Dès que le pointeur recommence à bouger, le ciblage normal reprend.
- Les repères d’aide bleus ne concernent que les entités trop petites pour être identifiables. Ils restent visibles jusqu’à un zoom utile puis disparaissent ; un territoire de taille courante ne doit jamais en recevoir.
- Lorsqu’un quiz montre un microterritoire comme indice ou comme solution, le cadrage doit le rendre visible tout en conservant des pays voisins pour l’orientation.
- Le Vatican et les autres micro-États présents dans les données doivent être visibles ou ciblables même lorsque leur géométrie source est trop petite pour produire un polygone exploitable au niveau de zoom courant.

## Quiz

- Les cases de réponse de base conservent leur fonctionnement existant.
- Une réponse textuelle ou choisie dans une autocomplétion n’est pas déclarée correcte dès la saisie. Le joueur doit déclencher une vérification afin qu’un mauvais essai puisse être compté et qu’il ne soit pas possible de tester gratuitement une suite de pays.
- Lorsque plusieurs champs sont présents, la vérification valide les champs renseignés sans forcer les champs encore vides. Le joueur peut donc répondre progressivement ou tout vérifier en une fois.
- Une réponse territoriale sur la carte se valide directement au clic lorsqu’il n’existe pas de moyen de tester sans conséquence : un mauvais territoire constitue immédiatement un mauvais essai.
- Dans une autocomplétion, Entrée sélectionne la première proposition active. Après validation ou passage à la question suivante, le premier champ encore attendu reprend le focus.
- Lorsque l’action « Question suivante » est disponible, son raccourci doit fonctionner ; l’Entrée simple peut également avancer si elle n’est pas utilisée par un champ, une boîte de dialogue ou une autre commande active.
- Les réponses multiples acceptent plusieurs lignes ou plusieurs territoires. Une réponse correcte rapporte une fraction du point ; une réponse erronée dans un groupe invalide ce groupe et rapporte zéro.
- Pour une même question, une réponse ne doit pas révéler directement une autre réponse encore attendue. En particulier, le retour vert d’une sélection cartographique peut rester visible, mais le nom du territoire doit attendre la vérification de la réponse « Nom du pays ».
- Quand les deux réponses liées ont été vérifiées, les valeurs masquées peuvent réapparaître, même si l’une des réponses est incorrecte.
- La révélation volontaire de la solution affiche toutes les réponses attendues.
- Une première bonne réponse d’un groupe multiple ne doit pas afficher les réponses manquantes avant la vérification finale du groupe. Après vérification, le panneau peut présenter la fraction gagnée, les réponses trouvées et celles qui manquent.
- « Voir la réponse » cadre toutes les entités attendues et les sélectionne ensemble lorsqu’une solution contient plusieurs pays.
- Les réponses partielles, leurs points et les réponses manquantes doivent rester cohérents entre le panneau, la carte, le score et l’historique.
- Le bilan de partie colore une ligne selon le nombre d’essais, avec une dégradation nette de la réussite parfaite vers l’erreur ; à partir de trois essais, la ligne est rouge.
- Une ligne du bilan peut ouvrir un cadrage moyen du pays et une fiche géographique flottante et rétractable.

## Chrono et minuteur

- Le paramétrage d’une partie propose un seul mode temporel à la fois : aucun, Chrono ou Minuteur. Les choix et la durée sont enregistrés dans le preset.
- Le Chrono mesure la durée totale depuis le lancement jusqu’à la fin de la partie. Quitter volontairement une partie l’arrête sans créer de résultat chronométré.
- Le Minuteur peut s’appliquer à chaque question ou à toute la partie. Un minuteur par question démarre avec la question et s’arrête quand elle est résolue ou que sa réponse est révélée ; il repart au passage à la question suivante.
- À l’expiration d’un minuteur par question, la réponse est révélée, la question est verrouillée et le joueur peut ensuite passer à la suivante. Une réponse tardive ne peut pas être validée.
- À l’expiration du minuteur global, la partie se termine. Le bilan conserve les réponses déjà obtenues et distingue la question expirée des questions qui n’ont pas été atteintes.
- Le mode Estimation accepte le minuteur par question ou global ; le mode Dessine les frontières accepte le Chrono ou le minuteur global, car il ne comporte pas de questions séparées.
- Les statistiques conservent une clé stable de configuration. Les temps ne sont comparés qu’à configuration de quiz et réglages temporels identiques. Les parties expirées, incomplètes ou abandonnées ne sont pas classées parmi les meilleurs temps ; l’historique conserve toutefois leurs résultats lorsqu’ils ont atteint une fin par expiration.
- Dans l’évolution d’un preset, la courbe du temps peut être affichée ou masquée. Une page « Meilleurs temps » permet de retrouver les résultats par preset, type de chronométrage et configuration exacte ; chaque temps reste accompagné du score.
- Les presets et historiques antérieurs, sans réglage ni résultat temporel, restent lisibles et ne reçoivent aucune durée inventée.

## Récompenses et accomplissements

- Les accomplissements sont calculés à partir de l’historique des quiz existant. Ils ne créent pas de monnaie, de score secondaire ni de progression indépendante.
- Les parties expirées, les questions expirées ou non atteintes, et les historiques de quiz classique dont le nombre de lignes ne correspond pas au nombre de questions ne comptent pas comme performances valides. Estimation et Dessine les frontières enregistrent volontairement un bilan sans lignes par question ; seule leur entrée de fin de partie sert aux récompenses de score.
- Le premier accomplissement est obtenu après une partie valide ; la polyvalence demande trois modes distincts ; la précision demande au moins 90 % des points d’une partie valide.
- Un quiz long demande au moins 25 questions dans un mode où `total` désigne bien le nombre de questions. Estimation et Dessine les frontières sont exclus de ce calcul, car leur total représente des points.
- Une série demande cinq réponses consécutives correctes du premier coup, sans révéler la réponse. Une erreur, une réponse aidée, une session invalide, une question expirée/non atteinte ou une session sans détail des réponses rompt la série.
- Un nouveau record compare les pourcentages de score uniquement avec une entrée précédente portant la même `comparisonKey`. Les anciens résultats sans cette clé ne sont pas comparés.
- Le défi de rapidité demande une partie chronométrée valide, au moins 85 % des points et une moyenne maximale de 15 secondes par ligne-question enregistrée. Les anciens résultats sans durée et les modes qui ne conservent pas de lignes-question ne reçoivent pas ce badge. Aucun badge de difficulté n’est attribué tant qu’aucun réglage de difficulté fiable n’existe dans le modèle.
- La progression des accomplissements est dérivée des entrées d’historique actuellement conservées ; elle n’est pas stockée séparément. L’historique est limité à 500 parties, donc les accomplissements à vie devront être réévalués si cette limite est modifiée ou si une conservation à long terme est souhaitée.
- Les seuils évaluent des performances dans World Atlas ; ils ne constituent pas une mesure complète du niveau géographique.

## Statistiques par continent

- Le filtre Continent de la page Progression par pays applique la même portée au résumé, aux modes détaillés, aux classements, au tableau et aux données colorées sur la carte. La carte cadre le continent choisi ; Monde entier restaure la vue mondiale.
- Les statistiques par pays agrègent uniquement les données de quiz des pays attribués au continent sélectionné. Les sessions ne sont comptées régionalement que si les réponses ou la configuration historique permettent de les attribuer ; une session multirégionale peut apparaître dans chaque continent effectivement représenté.
- Les modes Estimation et Dessine les frontières ne sont ventilés que si la configuration enregistrée identifie un seul continent ou un ensemble de pays entièrement dans ce continent. Une configuration mixte ou insuffisante n’est pas présentée comme un résultat régional.

## Exploration et caméra

- Les pages partagent une navigation compacte qui porte le titre courant, l’accès aux statistiques et aux réglages. Sur Exploration, Quiz pays et Comparateur, la barre reste visible et peut être repliée avec une flèche ; en mode replié, le bouton Navigation se place à l’autre extrémité de la barre.
- Le menu Navigation reste ouvert au survol tant que le pointeur est sur le bouton ou ses choix. Un clic sur Navigation l’épingle ouvert jusqu’à un clic extérieur ou la touche Échap.
- La vue mondiale de base apparaît dans les vues enregistrées sous le nom « Global ». C’est une vue système non supprimable ; les vues personnelles antérieures restent conservées.
- Le contrôle de mode caméra reste compact. Lorsqu’il est activé, une notice lisible apparaît en haut de la carte et reste visible tant que le mode est actif.

- En rotation orbitale, le point d’ancrage reste au centre de la Terre ; la rotation continue au-delà des pôles sans blocage ni saut d’angle.
- Les gestes diagonaux ou circulaires du trackpad composent naturellement les deux axes ; ils ne sont pas réduits à quatre directions.
- La sensibilité reste stable après l’utilisation d’un slider de pitch, yaw ou roll. Aucun changement de réglage ne doit multiplier brutalement la rotation suivante.
- Le mode de déplacement et ses raccourcis restent distincts des commandes de rotation et de zoom.
- Pitch, yaw et roll appliqués en caméra libre font tourner la caméra autour de ses propres axes ; la Terre peut alors quitter le centre de l’écran. Cette liberté est volontaire et distincte du mode orbital.
- Une commande dédiée recentre toujours le point d’ancrage au centre de la Terre.
- Les textures du globe ne doivent pas créer de disque ou de trou uniforme visible au pôle Nord ou au pôle Sud.
- Les vues enregistrées restaurent l’état cartographique et la caméra comme un ensemble cohérent. Le champ de nom sert aussi à rechercher et charger les vues existantes sans ajouter une rangée permanente de boutons.

## Comparateur

- Les filtres du comparateur sont éditables en mode « Bloc » ou en mode « Texte » ; les deux modes utilisent les mêmes critères actifs.
- Le mode texte propose d’abord les champs, puis leurs opérateurs et valeurs. Il accepte les comparaisons positives et négatives (`est`, `n’est pas`, `contient`, `ne contient pas`), les filtres numériques et de drapeau, les relations `et` / `ou`, la négation (`non (...)`), les résultats constants (`tous les pays`, `aucun pays`) et les parenthèses saisies directement ou proposées par l’autocomplétion. Les critères négatifs ne doivent pas inclure les fiches sans donnée comparable.
- Une requête incomplète ou inconnue affiche une erreur et conserve les derniers critères valides jusqu’à la saisie d’une expression complète. Les critères visuels ou relations avancées impossibles à sérialiser sont signalés lors du passage au mode texte.

## Performance et données

- Les ajustements de calques et de masques doivent modifier le rendu concerné sans reconstruire inutilement toute la carte.
- Les faits utilisés par les quiz et les fiches pays doivent venir des mêmes données de référence afin d’éviter des réponses divergentes.
- Toute optimisation doit préserver les interactions cartographiques, les réponses partielles et le fonctionnement hors ligne.
- Un drapeau local documenté est utilisé pour un territoire lorsque celui-ci en possède un ; le drapeau de la métropole n’est qu’un repli explicite, pas la valeur par défaut silencieuse.
- Les descriptions de ressources ou d’industries sont rédigées à partir de sources fiables dans un texte court et spécifique au territoire. Elles ne doivent pas être un copier-coller imposé ni se réduire à une catégorie vague.
- Une valeur `ND` signifie qu’aucune donnée comparable et suffisamment fiable n’a été intégrée. Elle ne doit pas être remplacée par une estimation inventée.
- Les faits géographiques, économiques ou politiques conservent leur source, leur date et leur portée lorsque ces éléments influencent leur interprétation.
- Les données sauvegardées localement doivent rester lisibles après évolution du schéma lorsque des migrations existent déjà. Une préférence illisible revient à une valeur sûre sans bloquer l’application.

## État persistant et historique

- Les presets, raccourcis, skins, langue, progression, statistiques, historique et vues enregistrées utilisent un stockage local versionné.
- Une nouvelle version ne doit pas écraser silencieusement les raccourcis personnalisés ni fabriquer des résultats inexistants lors d’une migration.
- L’historique conserve les paramètres, le score, les réponses, les essais et les points utiles à la révision.
- Les récompenses et le chronomètre enrichissent les événements et sessions existants ; ils ne créent pas une seconde source de scores ou de progression.
