# Entités géographiques et territoires

Les territoires sont des objets `GeographicEntity` distincts, avec
`kind: 'territory'` et un `sovereignEntityId` qui pointe vers leur pays
souverain. La carte affiche leurs étiquettes au format `Territoire (Pays)` à
partir de cette relation, sans règle liée à un pays particulier.

Pour ajouter un territoire rattaché à un autre pays :

1. Ajouter l'entité du pays souverain si elle n'existe pas encore.
2. Enregistrer le territoire avec son propre identifiant stable et son
   `sovereignEntityId`.
3. Ajouter un lien géométrique pour chaque résolution Natural Earth où le
   territoire possède un polygone source distinct. Définir `sourcePolygonIndex`
   avec l'index du polygone dans le `MultiPolygon` d'origine de cette résolution.

Conserver indépendamment les jeux de données 110m, 50m et 10m. Un polygone sans
lien détaillé garde le nom du pays entier, comme pour les géométries nationales
ordinaires.

Les collections `world110m`, `world50m` et `world10m` conservent la géométrie
Natural Earth d'origine et ses index. Les collections `world110mMap`,
`world50mMap` et `world10mMap` regroupent ensuite les polygones liés par entité
pour que la carte puisse sélectionner et colorer un territoire séparément. Les
points d'étiquette continuent d'être calculés depuis les collections d'origine.
Les index de `sourcePolygonIndex` doivent être vérifiés dans chaque résolution :
leur ordre peut différer d'un fichier Natural Earth à l'autre.

Les principales îles ultramarines ont aussi des points d'étiquette indépendants
des polygones administratifs. Ils viennent d'un extrait statique de GeoNames,
embarqué dans l'application et filtré par territoire. Les données GeoNames sont
sous licence CC BY 4.0 ; World Atlas conserve cette attribution dans son registre
des sources et dans l'application. Les étiquettes détaillées apparaissent
seulement à partir du niveau de zoom défini pour chaque île. Cette sélection vise
les îles principales et archipels nommés, pas chaque rocher ou îlet.
