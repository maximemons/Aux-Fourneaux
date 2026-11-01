import { auth, db } from './firebase-config.js';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut 
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  doc, 
  getDoc,
  setDoc,
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

let currentUser = null;
let recipes = [];
let categoriesList = [];
let activeCategory = 'all';
let favoritesFilterActive = false;
let searchQuery = '';
let isSignUpMode = false;
let favoriteIds = [];
let currentRecipeDetail = null;
let showTotalsMode = false;

let categoriesBar, recipesGrid, emptyState, currentCategoryTitle, recipeCount, searchInput, btnFilterFavorites;
let btnAddRecipe, btnLogin, btnLogout, userProfile, userAvatar, userEmail;
let modalAuth, modalRecipeForm, modalRecipeDetail;

const DEFAULT_CATEGORIES = [
  { id: 'bebe', name: 'Bébé & Éveil', icon: 'fa-baby' },
  { id: 'aperitifs', name: 'Apéritifs & Tapas', icon: 'fa-martini-glass-citrus' },
  { id: 'entrees', name: 'Entrées', icon: 'fa-bowl-rice' },
  { id: 'plats', name: 'Plats Principaux', icon: 'fa-utensils' },
  { id: 'desserts', name: 'Desserts', icon: 'fa-cake-candles' },
  { id: 'boissons', name: 'Boissons & Smoothies', icon: 'fa-glass-water' },
  { id: 'sauces', name: 'Sauces & Condiments', icon: 'fa-jar' },
  { id: 'pain', name: 'Pains & Boulangerie', icon: 'fa-bread-slice' },
  { id: 'vege', name: 'Végétarien & Végan', icon: 'fa-leaf' },
  { id: 'soupes', name: 'Soupes & Potages', icon: 'fa-bowl-food' }
];

function normalizeText(text) {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function initDOM() {
  categoriesBar = document.getElementById('categories-bar');
  recipesGrid = document.getElementById('recipes-grid');
  emptyState = document.getElementById('empty-state');
  currentCategoryTitle = document.getElementById('current-category-title');
  recipeCount = document.getElementById('recipe-count');
  searchInput = document.getElementById('search-input');
  btnFilterFavorites = document.getElementById('btn-filter-favorites');

  btnAddRecipe = document.getElementById('btn-add-recipe');
  btnLogin = document.getElementById('btn-login');
  btnLogout = document.getElementById('btn-logout');
  userProfile = document.getElementById('user-profile');
  userAvatar = document.getElementById('user-avatar');
  userEmail = document.getElementById('user-email');

  modalAuth = document.getElementById('modal-auth');
  modalRecipeForm = document.getElementById('modal-recipe-form');
  modalRecipeDetail = document.getElementById('modal-recipe-detail');

  setupEventListeners();
  initAuthObserver();
  initCategoriesListener();
  initFirestore();

  // Gestion des liens de partage d'URL deep-link (#recipe-ID) et bouton retour navigateur
  window.addEventListener('popstate', checkUrlHash);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDOM);
} else {
  initDOM();
}

function checkUrlHash() {
  const hash = window.location.hash;
  if (hash.startsWith('#recipe-')) {
    const recipeId = hash.replace('#recipe-', '');
    if (recipes.length > 0) {
      openRecipeDetail(recipeId, false);
    }
  } else {
    closeRecipeDetailModal(false);
  }
}

function initCategoriesListener() {
  try {
    const catCol = collection(db, "categories");
    onSnapshot(catCol, async (snapshot) => {
      if (!snapshot.empty) {
        categoriesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else {
        categoriesList = DEFAULT_CATEGORIES;
      }
      renderCategories();
      populateCategorySelect();
    });
  } catch (err) {
    categoriesList = DEFAULT_CATEGORIES;
    renderCategories();
    populateCategorySelect();
  }
}

function populateCategorySelect() {
  const selectCategory = document.getElementById('recipe-category');
  if (selectCategory) {
    selectCategory.innerHTML = categoriesList.map(c => `
      <option value="${c.name}">${c.name}</option>
    `).join('');
  }
}

async function loadFavorites() {
  if (currentUser) {
    try {
      const userFavRef = doc(db, "favorites", currentUser.uid);
      const snap = await getDoc(userFavRef);
      favoriteIds = snap.exists() ? (snap.data().recipeIds || []) : [];
    } catch (err) {
      favoriteIds = [];
    }
  } else {
    try {
      const stored = localStorage.getItem('aux_fourneaux_favorites');
      favoriteIds = stored ? JSON.parse(stored) : [];
    } catch (err) {
      favoriteIds = [];
    }
  }
  updateFavoritesUI();
  renderRecipes();
}

async function saveFavorites() {
  if (currentUser) {
    try {
      const userFavRef = doc(db, "favorites", currentUser.uid);
      await setDoc(userFavRef, { recipeIds: favoriteIds }, { merge: true });
    } catch (err) {
      console.error("Erreur sauvegarde favoris", err);
    }
  } else {
    try {
      localStorage.setItem('aux_fourneaux_favorites', JSON.stringify(favoriteIds));
    } catch (err) {
      console.error("Erreur localStorage", err);
    }
  }
}

window.toggleFavorite = async (id, event) => {
  if (event) event.stopPropagation();
  if (favoriteIds.includes(id)) {
    favoriteIds = favoriteIds.filter(favId => favId !== id);
  } else {
    favoriteIds.push(id);
  }
  await saveFavorites();
  updateFavoritesUI();
  renderRecipes();

  const detailHeart = document.getElementById('detail-heart-icon');
  if (detailHeart) {
    detailHeart.className = favoriteIds.includes(id) 
      ? "fa-solid fa-heart text-rose-500 text-xl" 
      : "fa-regular fa-heart text-slate-500 hover:text-rose-500 text-xl";
  }
};

function updateFavoritesUI() {
  if (!btnFilterFavorites) return;
  if (favoritesFilterActive) {
    btnFilterFavorites.classList.remove('bg-rose-50', 'text-rose-600', 'border-rose-100');
    btnFilterFavorites.classList.add('bg-rose-600', 'text-white', 'border-rose-600');
  } else {
    btnFilterFavorites.classList.add('bg-rose-50', 'text-rose-600', 'border-rose-100');
    btnFilterFavorites.classList.remove('bg-rose-600', 'text-white', 'border-rose-600');
  }
}

function renderCategories() {
  if (!categoriesBar) return;

  const usedCategoryNames = Array.from(new Set(
    recipes.map(r => r.category ? r.category.trim() : '').filter(c => c.length > 0)
  ));

  const activeCategories = categoriesList.filter(c => usedCategoryNames.some(u => normalizeText(u) === normalizeText(c.name)));

  if (activeCategories.length === 0) {
    categoriesBar.innerHTML = '';
    return;
  }

  const catList = [
    { id: 'all', name: 'Toutes', icon: 'fa-border-all' },
    ...activeCategories
  ];

  categoriesBar.innerHTML = catList.map(cat => `
    <button data-id="${cat.id}" class="category-btn flex items-center space-x-2 px-4 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${!favoritesFilterActive && cat.id === activeCategory ? 'bg-orange-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}">
      <i class="fa-solid ${cat.icon}"></i>
      <span>${cat.name}</span>
    </button>
  `).join('');
}

function initAuthObserver() {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      if (btnLogin) btnLogin.classList.add('hidden');
      if (userProfile) userProfile.classList.remove('hidden');
      if (userEmail) userEmail.textContent = user.email;
      if (userAvatar) userAvatar.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=ea580c&color=fff`;
      if (btnAddRecipe) {
        btnAddRecipe.classList.remove('hidden');
        btnAddRecipe.classList.add('flex');
      }
    } else {
      if (btnLogin) btnLogin.classList.remove('hidden');
      if (userProfile) userProfile.classList.add('hidden');
      if (btnAddRecipe) {
        btnAddRecipe.classList.add('hidden');
        btnAddRecipe.classList.remove('flex');
      }
    }
    await loadFavorites();
  });
}

function initFirestore() {
  try {
    const colRef = collection(db, "recipes");
    onSnapshot(colRef, async (snapshot) => {
      recipes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderCategories();
      renderRecipes();
      checkUrlHash(); // Vérifier si l'URL contient un lien de partage de recette #recipe-ID
    });
  } catch (err) {
    recipes = [];
    renderCategories();
    renderRecipes();
  }
}

function parseSectionedText(rawText) {
  if (!rawText) return [];
  const lines = rawText.split('\n');
  const sections = [];
  let currentSection = { title: null, items: [] };

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    
    const headerMatch = trimmed.match(/^===\s*(.*?)\s*===$/);
    if (headerMatch) {
      if (currentSection.items.length > 0 || currentSection.title) {
        sections.push(currentSection);
      }
      currentSection = { title: headerMatch[1], items: [] };
    } else {
      currentSection.items.push(trimmed);
    }
  });

  if (currentSection.items.length > 0 || currentSection.title) {
    sections.push(currentSection);
  }

  return sections;
}

function formatSectionedTextForForm(sections, fallbackFlatArray) {
  if (sections && sections.length > 0) {
    return sections.map(sec => {
      let str = '';
      if (sec.title) str += `=== ${sec.title} ===\n`;
      str += (sec.items || []).join('\n');
      return str;
    }).join('\n\n');
  }
  return (fallbackFlatArray || []).join('\n');
}

function renderRecipes() {
  if (!recipesGrid) return;

  let filtered = recipes.filter(r => {
    const matchesCat = favoritesFilterActive 
      ? favoriteIds.includes(r.id) 
      : (activeCategory === 'all' || (r.category && normalizeText(categoriesList.find(c => c.id === activeCategory)?.name) === normalizeText(r.category)));
    
    const cleanSearch = normalizeText(searchQuery.trim().replace(/^#/, ''));
    const matchesSearch = !cleanSearch || 
      normalizeText(r.title).includes(cleanSearch) ||
      (r.ingredients && r.ingredients.some(i => normalizeText(i).includes(cleanSearch))) ||
      (r.tags && r.tags.some(t => normalizeText(t).includes(cleanSearch)));

    return matchesCat && matchesSearch;
  });

  if (recipeCount) recipeCount.textContent = filtered.length;

  if (currentCategoryTitle) {
    if (favoritesFilterActive) {
      currentCategoryTitle.querySelector('span').textContent = 'Recettes favorites';
    } else {
      const activeObj = categoriesList.find(c => c.id === activeCategory);
      currentCategoryTitle.querySelector('span').textContent = activeCategory === 'all' ? 'Toutes les recettes' : (activeObj ? activeObj.name : 'Recettes');
    }
  }

  if (filtered.length === 0) {
    recipesGrid.innerHTML = '';
    if (emptyState) {
      emptyState.classList.remove('hidden');
      emptyState.classList.add('flex');
    }
    return;
  }

  if (emptyState) {
    emptyState.classList.add('hidden');
    emptyState.classList.remove('flex');
  }

  recipesGrid.innerHTML = filtered.map(r => {
    const isFav = favoriteIds.includes(r.id);
    const isVideo = r.externalLink && (r.externalLink.includes('youtube.com') || r.externalLink.includes('youtu.be') || r.externalLink.includes('vimeo') || r.externalLink.includes('tiktok.com'));

    return `
      <div class="bg-white rounded-3xl border border-slate-200/85 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col group cursor-pointer relative" onclick="openRecipeDetail('${r.id}')">
        <button onclick="toggleFavorite('${r.id}', event)" class="absolute top-3 right-3 z-10 w-9 h-9 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm transition-transform hover:scale-110 cursor-pointer">
          <i class="${isFav ? 'fa-solid fa-heart text-rose-500' : 'fa-regular fa-heart text-slate-500 hover:text-rose-500'} text-sm"></i>
        </button>

        <div class="relative h-48 overflow-hidden bg-slate-100">
          <img src="${r.imageUrl || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&q=80&w=800'}" alt="${r.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
          <span class="absolute top-3 left-3 bg-white/90 backdrop-blur-md text-slate-800 text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
            ${r.category || 'Général'}
          </span>
          ${r.externalLink ? `
            <span class="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center space-x-1 shadow-sm">
              <i class="fa-solid ${isVideo ? 'fa-video text-red-400' : 'fa-link text-orange-400'} text-[10px]"></i>
              <span>${isVideo ? 'Vidéo' : 'Lien'}</span>
            </span>
          ` : ''}
        </div>

        <div class="p-5 flex-grow flex flex-col justify-between space-y-4">
          <div>
            <h4 class="font-serif font-bold text-lg text-slate-900 group-hover:text-orange-600 transition-colors line-clamp-2">${r.title}</h4>
            <div class="flex items-center space-x-4 mt-2 text-xs text-slate-500 font-medium">
              <span class="flex items-center space-x-1"><i class="fa-regular fa-clock text-orange-500"></i><span>${r.prepTime || '15 min'}</span></span>
              ${r.servings ? `<span class="flex items-center space-x-1"><i class="fa-solid fa-user-group text-orange-500"></i><span>${r.servings}</span></span>` : ''}
            </div>

            ${r.tags && r.tags.length > 0 ? `
              <div class="flex flex-wrap gap-1 mt-3">
                ${r.tags.map(t => `<span class="bg-orange-50 text-orange-700 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-orange-100">#${t}</span>`).join('')}
              </div>
            ` : ''}
          </div>

          ${currentUser ? `
            <div class="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100" onclick="event.stopPropagation()">
              <button onclick="openEditForm('${r.id}')" class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-orange-100 text-slate-600 hover:text-orange-600 flex items-center justify-center transition-colors cursor-pointer">
                <i class="fa-solid fa-pen text-xs"></i>
              </button>
              <button onclick="deleteRecipe('${r.id}')" class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-600 flex items-center justify-center transition-colors cursor-pointer">
                <i class="fa-solid fa-trash text-xs"></i>
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

window.copyRecipeShareLink = (id) => {
  const shareUrl = `${window.location.origin}${window.location.pathname}#recipe-${id}`;
  navigator.clipboard.writeText(shareUrl).then(() => {
    const btnText = document.getElementById('share-btn-text');
    if (btnText) {
      btnText.textContent = "Lien copié !";
      setTimeout(() => { btnText.textContent = "Partager"; }, 2500);
    }
  }).catch(err => {
    prompt("Copiez ce lien de partage :", shareUrl);
  });
};

window.openRecipeDetail = (id, updateHistory = true) => {
  const r = recipes.find(item => item.id === id);
  if (!r) return;
  currentRecipeDetail = r;
  showTotalsMode = false;

  if (updateHistory) {
    history.pushState(null, '', `#recipe-${id}`);
  }

  const defaultServingsMatch = r.servings ? r.servings.match(/\d+/) : null;
  const baseServings = defaultServingsMatch ? parseInt(defaultServingsMatch[0], 10) : 4;
  window._activeServings = baseServings;

  const isFav = favoriteIds.includes(r.id);
  const isVideo = r.externalLink && (r.externalLink.includes('youtube.com') || r.externalLink.includes('youtu.be') || r.externalLink.includes('vimeo') || r.externalLink.includes('tiktok.com'));

  const content = document.getElementById('detail-content');
  content.innerHTML = `
    <div class="relative h-64 sm:h-80 w-full">
      <img src="${r.imageUrl || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&q=80&w=800'}" class="w-full h-full object-cover">
      <div class="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent flex items-end p-6 sm:p-8 justify-between">
        <div>
          <span class="bg-orange-600 text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">${r.category || 'Général'}</span>
          <h2 class="text-2xl sm:text-3xl font-serif font-bold text-white mt-2">${r.title}</h2>
          ${r.tags && r.tags.length > 0 ? `
            <div class="flex flex-wrap gap-1.5 mt-2">
              ${r.tags.map(t => `<span class="bg-white/20 backdrop-blur-md text-white text-xs font-medium px-2.5 py-0.5 rounded-full">#${t}</span>`).join('')}
            </div>
          ` : ''}
        </div>
        <div class="flex items-center space-x-2">
          <button onclick="copyRecipeShareLink('${r.id}')" class="bg-white/90 backdrop-blur-md px-3 py-2 rounded-2xl flex items-center space-x-2 shadow-lg hover:scale-105 transition-transform cursor-pointer text-slate-700 text-xs font-bold">
            <i class="fa-solid fa-share-nodes text-orange-600 text-sm"></i>
            <span id="share-btn-text" class="hidden sm:inline">Partager</span>
          </button>
          <button onclick="toggleFavorite('${r.id}', event)" class="bg-white/90 backdrop-blur-md w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform cursor-pointer">
            <i id="detail-heart-icon" class="${isFav ? 'fa-solid fa-heart text-rose-500' : 'fa-regular fa-heart text-slate-500 hover:text-rose-500'} text-lg"></i>
          </button>
        </div>
      </div>
    </div>

    <div class="p-6 sm:p-8 space-y-6">
      ${r.externalLink ? `
        <div class="flex items-center justify-between p-4 bg-slate-900 text-white rounded-2xl shadow-sm">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-xl ${isVideo ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'} flex items-center justify-center text-lg">
              <i class="fa-solid ${isVideo ? 'fa-play' : 'fa-arrow-up-right-from-square'}"></i>
            </div>
            <div>
              <h5 class="text-sm font-bold">${isVideo ? 'Vidéo / Tutoriel disponible' : 'Source & Détails externes'}</h5>
              <p class="text-xs text-slate-400 truncate max-w-xs sm:max-w-md">${r.externalLink}</p>
            </div>
          </div>
          <a href="${r.externalLink}" target="_blank" rel="noopener noreferrer" class="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs rounded-xl transition-colors flex items-center space-x-2 flex-shrink-0">
            <span>Ouvrir</span>
            <i class="fa-solid fa-external-link text-[10px]"></i>
          </a>
        </div>
      ` : ''}

      <div class="flex flex-col sm:flex-row items-center justify-between p-4 bg-orange-50/50 rounded-2xl border border-orange-100 gap-4">
        <div class="flex items-center space-x-3 text-sm font-semibold text-slate-700">
          <i class="fa-solid fa-user-group text-orange-600 text-lg"></i>
          <span>Ajuster pour :</span>
          <div class="flex items-center space-x-2">
            <button onclick="changeServings(-1, ${baseServings})" class="w-8 h-8 rounded-xl bg-white border border-orange-200 text-orange-600 font-bold hover:bg-orange-100 transition-colors shadow-sm cursor-pointer">-</button>
            <span id="servings-display" class="w-8 text-center text-base font-bold text-orange-700">${baseServings}</span>
            <button onclick="changeServings(1, ${baseServings})" class="w-8 h-8 rounded-xl bg-white border border-orange-200 text-orange-600 font-bold hover:bg-orange-100 transition-colors shadow-sm cursor-pointer">+</button>
            <span class="text-slate-500 font-normal">pers.</span>
          </div>
        </div>

        <div class="flex items-center space-x-6 text-xs sm:text-sm font-semibold text-slate-700">
          <div><i class="fa-regular fa-clock text-orange-600 text-base block mb-1"></i>Préparation: ${r.prepTime || 'N/A'}</div>
          <div><i class="fa-solid fa-fire text-orange-600 text-base block mb-1"></i>Cuisson: ${r.cookTime || 'S.A.'}</div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div class="space-y-4">
          <div class="flex items-center justify-between border-b border-slate-200 pb-2">
            <h4 class="font-serif font-bold text-lg text-slate-900">Ingrédients</h4>
            <button id="btn-toggle-totals" onclick="toggleIngredientsTotals(${baseServings})" class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors cursor-pointer flex items-center space-x-1">
              <i class="fa-solid fa-calculator text-[10px]"></i>
              <span id="totals-btn-label">Vue globale</span>
            </button>
          </div>
          <div id="ingredients-container" class="space-y-4 text-sm text-slate-600">
          </div>
        </div>

        <div class="md:col-span-2 space-y-4">
          <h4 class="font-serif font-bold text-lg text-slate-900 border-b border-slate-200 pb-2">Préparation</h4>
          <div id="steps-container" class="space-y-4 text-sm text-slate-600">
          </div>
        </div>
      </div>
    </div>
  `;

  renderIngredientsAndSteps(baseServings, baseServings);
  
  // Réinitialiser le défilement en haut du popup à l'ouverture
  content.scrollTop = 0;
  modalRecipeDetail.classList.remove('hidden');
};

function closeRecipeDetailModal(updateHistory = true) {
  if (modalRecipeDetail) {
    modalRecipeDetail.classList.add('hidden');
    const content = document.getElementById('detail-content');
    if (content) content.scrollTop = 0;
  }
  if (updateHistory && window.location.hash.startsWith('#recipe-')) {
    history.pushState(null, '', window.location.pathname + window.location.search);
  }
}

window.toggleIngredientsTotals = (baseServings) => {
  showTotalsMode = !showTotalsMode;
  const btnLabel = document.getElementById('totals-btn-label');
  if (btnLabel) btnLabel.textContent = showTotalsMode ? "Vue par élément" : "Vue globale";
  renderIngredientsAndSteps(window._activeServings || baseServings, baseServings);
};

window.changeServings = (delta, baseServings) => {
  if (!currentRecipeDetail) return;
  
  window._activeServings = (window._activeServings || baseServings) + delta;
  if (window._activeServings < 1) window._activeServings = 1;
  if (window._activeServings > 50) window._activeServings = 50;

  const displayEl = document.getElementById('servings-display');
  if (displayEl) displayEl.textContent = window._activeServings;

  renderIngredientsAndSteps(window._activeServings, baseServings);
};

function scaleIngredientText(item, ratio) {
  return item.replace(/(\d+([.,]\d+)?)/, (match) => {
    const num = parseFloat(match.replace(',', '.'));
    const multiplied = num * ratio;
    return Number.isInteger(multiplied) ? multiplied : multiplied.toFixed(1).replace('.0', '');
  });
}

function calculateAggregatedIngredients(ingredientsList, ratio) {
  const totals = {};

  ingredientsList.forEach(rawItem => {
    const scaled = scaleIngredientText(rawItem, ratio);
    const match = scaled.match(/^(\d+([.,]\d+)?)\s*([a-zA-Zà-ÿÀ-Ÿ°c.à.s.gkgmLl]+)?\s*(?:de|d')?\s*(.*)$/i);

    if (match) {
      const val = parseFloat(match[1].replace(',', '.'));
      const unit = normalizeText(match[3] || '');
      const name = normalizeText(match[4] || match[0]);
      const key = `${name}___${unit}`;

      if (!totals[key]) {
        totals[key] = { val: 0, unit: match[3] || '', name, originalName: match[4] || match[0] };
      }
      totals[key].val += val;
    } else {
      const key = normalizeText(scaled);
      if (!totals[key]) {
        totals[key] = { val: null, unit: '', name: scaled, originalName: scaled };
      }
    }
  });

  return Object.values(totals).map(t => {
    if (t.val === null) return t.originalName;
    const cleanVal = Number.isInteger(t.val) ? t.val : t.val.toFixed(1).replace('.0', '');
    const unitStr = t.unit ? ` ${t.unit}` : '';
    return `${cleanVal}${unitStr} ${t.originalName}`;
  });
}

function renderIngredientsAndSteps(targetServings, baseServings) {
  const ingContainer = document.getElementById('ingredients-container');
  const stepsContainer = document.getElementById('steps-container');
  if (!ingContainer || !stepsContainer || !currentRecipeDetail) return;

  const ratio = targetServings / baseServings;

  const ingSections = currentRecipeDetail.ingredientsSections && currentRecipeDetail.ingredientsSections.length > 0 
    ? currentRecipeDetail.ingredientsSections 
    : [{ title: null, items: currentRecipeDetail.ingredients || [] }];

  if (showTotalsMode) {
    const allItems = ingSections.flatMap(s => s.items || []);
    const aggregated = calculateAggregatedIngredients(allItems, ratio);

    ingContainer.innerHTML = `
      <div class="bg-orange-50/60 p-3.5 rounded-2xl border border-orange-100">
        <h5 class="font-bold text-xs text-orange-700 uppercase tracking-wider mb-2 flex items-center space-x-1">
          <i class="fa-solid fa-layer-group"></i>
          <span>Total cumulé des ingrédients</span>
        </h5>
        <ul class="space-y-2">
          ${aggregated.map(item => `
            <li class="flex items-start space-x-2">
              <i class="fa-solid fa-check text-orange-500 mt-1 text-xs"></i>
              <span class="font-medium text-slate-800">${item}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  } else {
    ingContainer.innerHTML = ingSections.map(sec => `
      <div class="space-y-2">
        ${sec.title ? `<h5 class="font-bold text-xs text-orange-600 uppercase tracking-wider bg-orange-50/80 px-2.5 py-1 rounded-lg border border-orange-100 inline-block">${sec.title}</h5>` : ''}
        <ul class="space-y-2">
          ${(sec.items || []).map(item => `
            <li class="flex items-start space-x-2">
              <i class="fa-solid fa-check text-orange-500 mt-1 text-xs"></i>
              <span>${scaleIngredientText(item, ratio)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `).join('');
  }

  const stepSections = currentRecipeDetail.stepsSections && currentRecipeDetail.stepsSections.length > 0 
    ? currentRecipeDetail.stepsSections 
    : [{ title: null, items: currentRecipeDetail.steps || [] }];

  stepsContainer.innerHTML = stepSections.map(sec => `
    <div class="space-y-3">
      ${sec.title ? `<h5 class="font-bold text-sm text-slate-900 border-l-2 border-orange-500 pl-2.5">${sec.title}</h5>` : ''}
      <ol class="space-y-2.5">
        ${(sec.items || []).map((step, idx) => `
          <li class="flex items-start space-x-3">
            <span class="w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">${idx + 1}</span>
            <span>${step}</span>
          </li>
        `).join('')}
      </ol>
    </div>
  `).join('');
}

window.openEditForm = (id) => {
  const r = recipes.find(item => item.id === id);
  if (!r) return;

  document.getElementById('form-title').textContent = "Modifier la recette";
  document.getElementById('recipe-id').value = r.id;
  document.getElementById('recipe-title').value = r.title;
  document.getElementById('recipe-category').value = r.category || '';
  document.getElementById('recipe-prep').value = r.prepTime || '';
  document.getElementById('recipe-cook').value = r.cookTime || '';
  document.getElementById('recipe-servings').value = r.servings || '';
  document.getElementById('recipe-tags').value = (r.tags || []).join(', ');
  document.getElementById('recipe-image').value = r.imageUrl || '';
  document.getElementById('recipe-external-link').value = r.externalLink || '';
  
  document.getElementById('recipe-ingredients').value = formatSectionedTextForForm(r.ingredientsSections, r.ingredients);
  document.getElementById('recipe-steps').value = formatSectionedTextForForm(r.stepsSections, r.steps);

  const formModalBody = document.getElementById('form-modal-body');
  if (formModalBody) formModalBody.scrollTop = 0;
  modalRecipeForm.classList.remove('hidden');
};

window.deleteRecipe = async (id) => {
  if (!confirm("Voulez-vous vraiment supprimer cette recette ?")) return;

  try {
    await deleteDoc(doc(db, "recipes", id));
    if (favoriteIds.includes(id)) {
      favoriteIds = favoriteIds.filter(favId => favId !== id);
      await saveFavorites();
    }
  } catch (err) {
    alert("Erreur lors de la suppression : " + err.message);
  }
};

function setupEventListeners() {
  const btnHome = document.getElementById('btn-home');
  if (btnHome) {
    btnHome.addEventListener('click', () => {
      closeRecipeDetailModal(true);
      activeCategory = 'all';
      favoritesFilterActive = false;
      searchQuery = '';
      if (searchInput) searchInput.value = '';
      updateFavoritesUI();
      renderCategories();
      renderRecipes();
    });
  }

  if (btnFilterFavorites) {
    btnFilterFavorites.addEventListener('click', () => {
      favoritesFilterActive = !favoritesFilterActive;
      updateFavoritesUI();
      renderCategories();
      renderRecipes();
    });
  }

  if (categoriesBar) {
    categoriesBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.category-btn');
      if (!btn) return;
      favoritesFilterActive = false;
      activeCategory = btn.dataset.id;
      updateFavoritesUI();
      renderCategories();
      renderRecipes();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderRecipes();
    });
  }

  if (btnLogin) {
    btnLogin.addEventListener('click', () => {
      if (modalAuth) modalAuth.classList.remove('hidden');
    });
  }
  
  if (btnAddRecipe) {
    btnAddRecipe.addEventListener('click', () => {
      document.getElementById('form-title').textContent = "Nouvelle Recette";
      document.getElementById('recipe-form').reset();
      document.getElementById('recipe-id').value = '';
      const formModalBody = document.getElementById('form-modal-body');
      if (formModalBody) formModalBody.scrollTop = 0;
      if (modalRecipeForm) modalRecipeForm.classList.remove('hidden');
    });
  }

  const closeAuthBtn = document.getElementById('btn-close-auth');
  if (closeAuthBtn) closeAuthBtn.addEventListener('click', () => modalAuth.classList.add('hidden'));

  const closeFormBtn = document.getElementById('btn-close-form');
  if (closeFormBtn) closeFormBtn.addEventListener('click', () => modalRecipeForm.classList.add('hidden'));

  const cancelFormBtn = document.getElementById('btn-cancel-form');
  if (cancelFormBtn) cancelFormBtn.addEventListener('click', () => modalRecipeForm.classList.add('hidden'));

  const closeDetailBtn = document.getElementById('btn-close-detail');
  if (closeDetailBtn) closeDetailBtn.addEventListener('click', () => closeRecipeDetailModal(true));

  const toggleAuthModeBtn = document.getElementById('toggle-auth-mode');
  if (toggleAuthModeBtn) {
    toggleAuthModeBtn.addEventListener('click', () => {
      isSignUpMode = !isSignUpMode;
      document.getElementById('auth-title').textContent = isSignUpMode ? "Inscription" : "Connexion";
      document.getElementById('auth-submit-btn').textContent = isSignUpMode ? "S'inscrire" : "Se connecter";
      toggleAuthModeBtn.textContent = isSignUpMode ? "Déjà un compte ? Se connecter" : "Pas de compte ? S'inscrire";
    });
  }

  const authForm = document.getElementById('auth-form');
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('auth-email').value;
      const password = document.getElementById('auth-password').value;
      const errDiv = document.getElementById('auth-error');
      if (errDiv) errDiv.classList.add('hidden');

      try {
        if (isSignUpMode) {
          await createUserWithEmailAndPassword(auth, email, password);
        } else {
          await signInWithEmailAndPassword(auth, email, password);
        }
        if (modalAuth) modalAuth.classList.add('hidden');
      } catch (err) {
        if (errDiv) {
          errDiv.textContent = err.message;
          errDiv.classList.remove('hidden');
        }
      }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', () => signOut(auth));
  }

  const recipeForm = document.getElementById('recipe-form');
  if (recipeForm) {
    recipeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('recipe-id').value;

      const tagsInput = document.getElementById('recipe-tags').value;
      const tagsArray = tagsInput 
        ? tagsInput.split(',').map(t => normalizeText(t.trim().replace(/^#/, ''))).filter(t => t.length > 0) 
        : [];

      const rawIng = document.getElementById('recipe-ingredients').value;
      const ingSections = parseSectionedText(rawIng);
      const flatIngredients = ingSections.flatMap(s => s.items);

      const rawSteps = document.getElementById('recipe-steps').value;
      const stepSections = parseSectionedText(rawSteps);
      const flatSteps = stepSections.flatMap(s => s.items);

      const data = {
        title: document.getElementById('recipe-title').value,
        category: document.getElementById('recipe-category').value,
        prepTime: document.getElementById('recipe-prep').value,
        cookTime: document.getElementById('recipe-cook').value,
        servings: document.getElementById('recipe-servings').value,
        tags: tagsArray,
        imageUrl: document.getElementById('recipe-image').value,
        externalLink: document.getElementById('recipe-external-link').value,
        ingredientsSections: ingSections,
        ingredients: flatIngredients,
        stepsSections: stepSections,
        steps: flatSteps,
        updatedAt: serverTimestamp()
      };

      try {
        if (id) {
          await updateDoc(doc(db, "recipes", id), data);
        } else {
          data.createdAt = serverTimestamp();
          await addDoc(collection(db, "recipes"), data);
        }
        if (modalRecipeForm) modalRecipeForm.classList.add('hidden');
      } catch (err) {
        alert("Erreur lors de l'enregistrement : " + err.message);
      }
    });
  }
}
