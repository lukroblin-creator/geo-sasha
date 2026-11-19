# Règles fonctionnelles à préserver

Ce document rassemble les comportements explicitement demandés pendant la conception. Il sert de référence lors des corrections et refactorisations.

## Carte et calques

- L’ordre montré dans le gestionnaire doit être le même que l’ordre réellement rendu sur la carte.
- Désactiver un calque doit le retirer visuellement, sans délai perceptible ni résidu de rendu.
- Un masque activé agit uniquement sur son calque cible. Il rend cette zone transparente pour laisser apparaître le calque situé dessous.
- Un masque non attribué reste indépendant. Il peut être lié au calque cible par son menu ou en le déposant à droite de ce calque.
- « Placer sur la carte » ferme le panneau pour laisser voir toute la carte. La forme du masque reste visible comme curseur pendant le placement, puis le panneau se rouvre.
- Les calques classiques et les masques doivent rester déplaçables. Le panneau doit garder l’accès aux réglages habituels après réorganisation.

## Sélection des territoires

- Une grande zone de clic ne doit pas empêcher la sélection d’un petit territoire voisin.
- Le survol préselectionne le territoire sous le pointeur. Les flèches déplacent la présélection vers les voisins ; Maj parcourt les petits territoires proches du pointeur ; Entrée valide la présélection courante.
- Si le pointeur se déplace, la sélection reprend normalement sous le pointeur. S’il reste immobile, Maj peut déplacer la présélection sans déplacer le pointeur.
- Les contrôles clavier doivent fonctionner quand le focus est sur la carte et ne pas intercepter la saisie dans un champ texte.

## Quiz

- Les cases de réponse de base conservent leur fonctionnement existant.
- Les réponses multiples acceptent plusieurs lignes ou plusieurs territoires. Une réponse correcte rapporte une fraction du point ; une réponse erronée dans un groupe invalide ce groupe et rapporte zéro.
- Pour une même question, une réponse ne doit pas révéler directement une autre réponse encore attendue. En particulier, le retour vert d’une sélection cartographique peut rester visible, mais le nom du territoire doit attendre la vérification de la réponse « Nom du pays ».
- Quand les deux réponses liées ont été vérifiées, les valeurs masquées peuvent réapparaître, même si l’une des réponses est incorrecte.
- La révélation volontaire de la solution affiche toutes les réponses attendues.
- Les réponses partielles, leurs points et les réponses manquantes doivent rester cohérents entre le panneau, la carte, le score et l’historique.

## Exploration et caméra

- En rotation orbitale, le point d’ancrage reste au centre de la Terre ; la rotation continue au-delà des pôles sans blocage ni saut d’angle.
- Le mode de déplacement et ses raccourcis doivent rester distincts des commandes de rotation et de zoom.

## Performance et données

- Les ajustements de calques et de masques doivent modifier le rendu concerné sans reconstruire inutilement toute la carte.
- Les faits utilisés par les quiz et les fiches pays doivent venir des mêmes données de référence afin d’éviter des réponses divergentes.
- Toute optimisation doit préserver les interactions cartographiques, les réponses partielles et le fonctionnement hors ligne.
