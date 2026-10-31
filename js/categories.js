// Exhaustive categories list including baby food
export const CATEGORIES = [
  { id: 'all', label: 'Toutes', icon: 'fa-border-all' },
  { id: 'bebe', label: 'Bébé & Éveil', icon: 'fa-baby' },
  { id: 'aperitifs', label: 'Apéritifs & Tapas', icon: 'fa-martini-glass-citrus' },
  { id: 'entrees', label: 'Entrées', icon: 'fa-bowl-rice' },
  { id: 'plats', label: 'Plats Principaux', icon: 'fa-utensils' },
  { id: 'desserts', label: 'Desserts', icon: 'fa-cake-candles' },
  { id: 'boissons', label: 'Boissons & Smoothies', icon: 'fa-glass-water' },
  { id: 'sauces', label: 'Sauces & Condiments', icon: 'fa-jar' },
  { id: 'pain', label: 'Pains & Boulangerie', icon: 'fa-bread-slice' },
  { id: 'vege', label: 'Végétarien & Végan', icon: 'fa-leaf' }
];

export const INITIAL_RECIPES = [
  {
    title: "Purée fondante Courge & Carotte (Dès 6 mois)",
    category: "bebe",
    prepTime: "10 min",
    cookTime: "15 min",
    servings: "2 portions",
    imageUrl: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&q=80&w=800",
    ingredients: [
      "200g de butternut ou potimarron",
      "1 belle carotte",
      "1 noisette de beurre doux (ou huile d'olive)",
      "Un brin de cerfeuil frais"
    ],
    steps: [
      "Éplucher et couper les légumes en petits dés.",
      "Cuire à la vapeur pendant 15 minutes jusqu'à ce qu'ils soient bien tendres.",
      "Mixer finement avec un peu d'eau de cuisson.",
      "Ajouter la noisette de beurre avant de servir tiède."
    ],
    createdAt: new Date()
  },
  {
    title: "Tarte Rustique aux Tomates & Ricotta",
    category: "plats",
    prepTime: "20 min",
    cookTime: "35 min",
    servings: "4 pers.",
    imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=800",
    ingredients: [
      "1 pâte brisée pur beurre",
      "400g de tomates de couleurs variées",
      "150g de ricotta",
      "2 c.à.s de moutarde à l'ancienne",
      "Basilic frais, huile d'olive, sel, poivre"
    ],
    steps: [
      "Préchauffer le four à 190°C.",
      "Étaler la pâte sur une plaque. Tartiner le fond avec la moutarde puis la ricotta.",
      "Disposer les rondelles de tomates en laissant 3 cm de bord.",
      "Rabattre les bords de la pâte sur les tomates.",
      "Napper d'un filet d'huile d'olive et cuire 35 minutes.",
      "Ajouter le basilic frais au moment de servir."
    ],
    createdAt: new Date()
  },
  {
    title: "Fondant au Chocolat Coeur Coulant",
    category: "desserts",
    prepTime: "15 min",
    cookTime: "10 min",
    servings: "4 ramequins",
    imageUrl: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=800",
    ingredients: [
      "200g de chocolat noir pâtissier",
      "100g de beurre",
      "3 œufs",
      "50g de sucre",
      "40g de farine"
    ],
    steps: [
      "Faire fondre le chocolat et le beurre au bain-marie.",
      "Fouetter les œufs avec le sucre jusqu'à ce que le mélange blanchisse.",
      "Incorporer la farine puis le chocolat fondu.",
      "Verser dans des ramequins beurrés et enfourner 10-12 min à 200°C."
    ],
    createdAt: new Date()
  }
];
