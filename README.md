# Aux fourneaux — Carnet de recettes

Un carnet de recettes personnel pour retrouver, consulter et organiser ses recettes de cuisine.

## Parcourir les recettes

- Les recettes sont présentées sous forme de cartes, regroupées par catégorie et classées par ordre alphabétique.
- Une barre de catégories permet de n'afficher qu'un type de recette (Entrées, Plats principaux, Desserts, Soupes, Boissons, Pains, etc.). Seules les catégories contenant au moins une recette apparaissent.
- Un clic sur le logo ou le titre ramène à la vue complète, en réinitialisant filtres et recherche.

## Rechercher

- La barre de recherche filtre en direct par titre, ingrédient, matériel ou tag.
- La recherche ignore les accents et les majuscules.
- Un tag peut être saisi avec ou sans le symbole `#` (ex. `#rapide`).

## Les cartes de recette

Chaque carte affiche :
- la photo de la recette et sa catégorie ;
- un badge « Vidéo » ou « Lien » si un lien externe est associé ;
- le titre ;
- le temps de préparation et le temps de cuisson, côte à côte ;
- une barre de visualisation montrant la répartition entre préparation et cuisson, avec le temps total ;
- le nombre de personnes ;
- les tags ;
- un bouton cœur pour mettre en favori.

Les temps de préparation et de cuisson sont facultatifs : lorsqu'ils ne sont pas renseignés, la case indique **N/A**.

## Consulter une recette

La fiche détaillée présente :
- la photo, la catégorie, le titre et les tags ;
- les temps de préparation et de cuisson (N/A si non renseignés) ;
- le matériel nécessaire ;
- la liste des ingrédients ;
- les étapes de préparation, numérotées ;
- le lien externe (vidéo, article, source) avec un bouton « Ouvrir ».

### Ajuster les quantités
Un sélecteur permet de modifier le nombre de personnes (de 1 à 50). Les quantités d'ingrédients se recalculent automatiquement.

### Ingrédients par élément ou en vue globale
Quand une recette comporte plusieurs éléments (ex. un insert, une dacquoise, un glaçage), les ingrédients sont d'abord affichés élément par élément. Le bouton « Vue globale » regroupe tous les ingrédients en une seule liste, avec les quantités identiques additionnées. Le bouton « Vue par élément » permet de revenir à la présentation initiale.

### Partager
Le bouton « Partager » copie le lien direct vers la recette, qui s'ouvre directement sur sa fiche.

## Favoris

- Le cœur ajoute ou retire une recette des favoris, depuis la carte ou depuis la fiche.
- Le bouton « Favoris » du haut de page n'affiche que les recettes favorites.
- Les favoris fonctionnent aussi sans compte. Une fois connecté, ils sont rattachés au compte.

## Gérer ses recettes (compte requis)

Il faut être connecté pour ajouter, modifier ou supprimer des recettes. La consultation reste libre pour tout le monde.

### Compte
- Création de compte et connexion avec une adresse e-mail et un mot de passe.
- Déconnexion en un clic.

### Ajouter ou modifier une recette
Le formulaire permet de renseigner :
- le titre (obligatoire) et la catégorie (obligatoire) ;
- le temps de préparation et le temps de cuisson (facultatifs, ex. « 20 min », « 1h30 ») ;
- le nombre de personnes ;
- des tags séparés par des virgules ;
- l'adresse d'une image ;
- un lien externe (vidéo, article) ;
- le matériel nécessaire, un élément par ligne ;
- les ingrédients (obligatoire) ;
- les étapes de préparation (obligatoire).

Pour les ingrédients et les étapes, on peut découper la recette en sous-éléments en ajoutant une ligne de titre au format `=== Nom de l'élément ===`. Chaque élément s'affiche ensuite sous son propre titre.

Exemple :

```
=== Insert chocolat blanc ===
200g de chocolat blanc
230g de crème liquide

=== Dacquoise pistache ===
2 blancs d'œufs
80g de sucre glace
```

### Supprimer une recette
Un bouton corbeille sur chaque carte permet de supprimer une recette, après confirmation.

## Confort d'utilisation

- Les fenêtres se ferment avec la touche Échap ou en cliquant en dehors.
- Si un formulaire contient des modifications non enregistrées, une confirmation est demandée avant de quitter.
- Le site s'adapte aux écrans d'ordinateur, de tablette et de téléphone.
