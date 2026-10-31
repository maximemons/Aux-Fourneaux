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

// Global State
let currentUser = null;
let recipes = [];
let activeCategory = 'all';
let favoritesFilterActive = false;
let searchQuery = '';
let isSignUpMode = false;
let favoriteIds = []; // Array of recipe IDs marked as favorite

// DOM Elements
let categoriesBar, recipesGrid, emptyState, currentCategoryTitle, recipeCount, searchInput, btnFilterFavorites;
let btnAddRecipe, btnLogin, btnLogout, userProfile, userAvatar, userEmail;
let modalAuth, modalRecipeForm, modalRecipeDetail;

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
  initFirestore();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDOM);
} else {
  initDOM();
}

// --- FAVORITES MANAGEMENT (Firestore for auth, localStorage for guests) ---
async function loadFavorites() {
  if (currentUser) {
    try {
      const userFavRef = doc(db, "favorites", currentUser.uid);
      const snap = await getDoc(userFavRef);
      if (snap.exists()) {
        favoriteIds = snap.data().recipeIds || [];
      } else {
        favoriteIds = [];
      }
    } catch (err) {
      console.error("Erreur chargement favoris Firestore", err);
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
      console.error("Erreur sauvegarde favoris Firestore", err);
    }
  } else {
    try {
      localStorage.setItem('aux_fourneaux_favorites', JSON.stringify(favoriteIds));
    } catch (err) {
      console.error("Erreur sauvegarde favoris localStorage", err);
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

  // If detail modal is open, update its heart icon too
  const detailHeart = document.getElementById('detail-heart-icon');
  if (detailHeart) {
    if (favoriteIds.includes(id)) {
      detailHeart.className = "fa-solid fa-heart text-rose-500 text-xl";
    } else {
      detailHeart.className = "fa-regular fa-heart text-slate-500 hover:text-rose-500 text-xl";
    }
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

// Icons mapping for categories
function getCategoryIcon(catName) {
  const normalized = catName.toLowerCase().trim();
  if (normalized.includes('bébé') || normalized.includes('bebe')) return 'fa-baby';
  if (normalized.includes('apéritif') || normalized.includes('aperitif') || normalized.includes('tapas')) return 'fa-martini-glass-citrus';
  if (normalized.includes('entrée') || normalized.includes('entree')) return 'fa-bowl-rice';
  if (normalized.includes('plat')) return 'fa-utensils';
  if (normalized.includes('dessert')) return 'fa-cake-candles';
  if (normalized.includes('boisson') || normalized.includes('smoothie')) return 'fa-glass-water';
  if (normalized.includes('sauce')) return 'fa-jar';
  if (normalized.includes('pain') || normalized.includes('boulangerie')) return 'fa-bread-slice';
  if (normalized.includes('végé') || normalized.includes('vege') || normalized.includes('végan')) return 'fa-leaf';
  return 'fa-tag';
}

function renderCategories() {
  if (!categoriesBar) return;

  const presentCategories = Array.from(new Set(
    recipes
      .map(r => r.category ? r.category.trim() : '')
      .filter(c => c.length > 0)
  )).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

  if (presentCategories.length === 0) {
    categoriesBar.innerHTML = '';
    return;
  }

  const catList = [
    { id: 'all', label: 'Toutes', icon: 'fa-border-all' },
    ...presentCategories.map(cat => ({
      id: cat.toLowerCase(),
      label: cat,
      icon: getCategoryIcon(cat)
    }))
  ];

  if (activeCategory !== 'all' && !presentCategories.some(c => c.toLowerCase() === activeCategory)) {
    activeCategory = 'all';
  }

  categoriesBar.innerHTML = catList.map(cat => `
    <button data-id="${cat.id}" class="category-btn flex items-center space-x-2 px-4 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${!favoritesFilterActive && cat.id === activeCategory ? 'bg-orange-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}">
      <i class="fa-solid ${cat.icon}"></i>
      <span>${cat.label}</span>
    </button>
  `).join('');
}

// --- AUTH OBSERVER ---
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

// --- FIRESTORE SUBSCRIPTION ---
function initFirestore() {
  try {
    const colRef = collection(db, "recipes");
    onSnapshot(colRef, (snapshot) => {
      recipes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderCategories();
      renderRecipes();
    }, (error) => {
      console.warn("Erreur d'accès à Firestore.", error);
      recipes = [];
      renderCategories();
      renderRecipes();
    });
  } catch (err) {
    recipes = [];
    renderCategories();
    renderRecipes();
  }
}

// --- RENDER RECIPES ---
function renderRecipes() {
  if (!recipesGrid) return;

  let filtered = recipes.filter(r => {
    const catVal = r.category ? r.category.trim().toLowerCase() : '';
    const matchesCat = favoritesFilterActive ? favoriteIds.includes(r.id) : (activeCategory === 'all' || catVal === activeCategory);
    const matchesSearch = !searchQuery || 
      (r.title && r.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.ingredients && r.ingredients.some(i => i.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesCat && matchesSearch;
  });

  if (recipeCount) recipeCount.textContent = filtered.length;

  if (currentCategoryTitle) {
    if (favoritesFilterActive) {
      currentCategoryTitle.querySelector('span').textContent = 'Recettes favorites';
    } else {
      const catLabel = activeCategory === 'all' 
        ? 'Toutes les recettes' 
        : recipes.find(r => r.category && r.category.trim().toLowerCase() === activeCategory)?.category || activeCategory;
      currentCategoryTitle.querySelector('span').textContent = catLabel;
    }
  }

  if (filtered.length === 0) {
    recipesGrid.innerHTML = '';
    if (emptyState) {
      emptyState.classList.remove('hidden');
      emptyState.classList.add('flex');
      const titleEl = emptyState.querySelector('h4');
      const descEl = emptyState.querySelector('p');
      if (favoritesFilterActive) {
        if (titleEl) titleEl.textContent = "Aucun favori pour l'instant";
        if (descEl) descEl.textContent = "Cliquez sur le cœur d'une recette pour l'ajouter à vos favoris.";
      } else {
        if (titleEl) titleEl.textContent = "Aucune recette disponible";
        if (descEl) descEl.textContent = "Connectez-vous pour ajouter votre première recette au carnet.";
      }
    }
    return;
  }

  if (emptyState) {
    emptyState.classList.add('hidden');
    emptyState.classList.remove('flex');
  }

  recipesGrid.innerHTML = filtered.map(r => {
    const isFav = favoriteIds.includes(r.id);
    return `
      <div class="bg-white rounded-3xl border border-slate-200/85 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col group cursor-pointer relative" onclick="openRecipeDetail('${r.id}')">
        <!-- Bouton Favori sur la carte -->
        <button onclick="toggleFavorite('${r.id}', event)" class="absolute top-3 right-3 z-10 w-9 h-9 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm transition-transform hover:scale-110 cursor-pointer" title="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
          <i class="${isFav ? 'fa-solid fa-heart text-rose-500' : 'fa-regular fa-heart text-slate-500 hover:text-rose-500'} text-sm"></i>
        </button>

        <div class="relative h-48 overflow-hidden bg-slate-100">
          <img src="${r.imageUrl || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&q=80&w=800'}" alt="${r.title || 'Recette'}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
          <span class="absolute top-3 left-3 bg-white/90 backdrop-blur-md text-slate-800 text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
            ${r.category || 'Général'}
          </span>
        </div>

        <div class="p-5 flex-grow flex flex-col justify-between space-y-4">
          <div>
            <h4 class="font-serif font-bold text-lg text-slate-900 group-hover:text-orange-600 transition-colors line-clamp-2">${r.title}</h4>
            <div class="flex items-center space-x-4 mt-3 text-xs text-slate-500 font-medium">
              <span class="flex items-center space-x-1"><i class="fa-regular fa-clock text-orange-500"></i><span>${r.prepTime || '15 min'}</span></span>
              ${r.servings ? `<span class="flex items-center space-x-1"><i class="fa-solid fa-user-group text-orange-500"></i><span>${r.servings}</span></span>` : ''}
            </div>
          </div>

          ${currentUser ? `
            <div class="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100" onclick="event.stopPropagation()">
              <button onclick="openEditForm('${r.id}')" class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-orange-100 text-slate-600 hover:text-orange-600 flex items-center justify-center transition-colors cursor-pointer" title="Modifier">
                <i class="fa-solid fa-pen text-xs"></i>
              </button>
              <button onclick="deleteRecipe('${r.id}')" class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-600 flex items-center justify-center transition-colors cursor-pointer" title="Supprimer">
                <i class="fa-solid fa-trash text-xs"></i>
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Global functions attached to window
window.openRecipeDetail = (id) => {
  const r = recipes.find(item => item.id === id);
  if (!r) return;

  const isFav = favoriteIds.includes(r.id);
  const content = document.getElementById('detail-content');
  content.innerHTML = `
    <div class="relative h-64 sm:h-80 w-full">
      <img src="${r.imageUrl || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&q=80&w=800'}" class="w-full h-full object-cover">
      <div class="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent flex items-end p-6 sm:p-8 justify-between items-end">
        <div>
          <span class="bg-orange-600 text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">${r.category || 'Général'}</span>
          <h2 class="text-2xl sm:text-3xl font-serif font-bold text-white mt-2">${r.title}</h2>
        </div>
        <!-- Bouton favori dans la modale de détail -->
        <button onclick="toggleFavorite('${r.id}', event)" class="bg-white/90 backdrop-blur-md w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform cursor-pointer">
          <i id="detail-heart-icon" class="${isFav ? 'fa-solid fa-heart text-rose-500' : 'fa-regular fa-heart text-slate-500 hover:text-rose-500'} text-xl"></i>
        </button>
      </div>
    </div>

    <div class="p-6 sm:p-8 space-y-6">
      <div class="flex items-center justify-around p-4 bg-orange-50/50 rounded-2xl border border-orange-100 text-center text-xs sm:text-sm font-semibold text-slate-700">
        <div><i class="fa-regular fa-clock text-orange-600 text-base block mb-1"></i>Préparation: ${r.prepTime || 'N/A'}</div>
        <div><i class="fa-solid fa-fire text-orange-600 text-base block mb-1"></i>Cuisson: ${r.cookTime || 'S.A.'}</div>
        <div><i class="fa-solid fa-utensils text-orange-600 text-base block mb-1"></i>Portions: ${r.servings || 'N/A'}</div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div class="space-y-3">
          <h4 class="font-serif font-bold text-lg text-slate-900 border-b border-slate-200 pb-2">Ingrédients</h4>
          <ul class="space-y-2 text-sm text-slate-600">
            ${(r.ingredients || []).map(i => `<li class="flex items-start space-x-2"><i class="fa-solid fa-check text-orange-500 mt-1 text-xs"></i><span>${i}</span></li>`).join('')}
          </ul>
        </div>

        <div class="md:col-span-2 space-y-3">
          <h4 class="font-serif font-bold text-lg text-slate-900 border-b border-slate-200 pb-2">Préparation</h4>
          <ol class="space-y-3 text-sm text-slate-600">
            ${(r.steps || []).map((step, idx) => `
              <li class="flex items-start space-x-3">
                <span class="w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">${idx + 1}</span>
                <span>${step}</span>
              </li>
            `).join('')}
          </ol>
        </div>
      </div>
    </div>
  `;

  modalRecipeDetail.classList.remove('hidden');
};

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
  document.getElementById('recipe-image').value = r.imageUrl || '';
  document.getElementById('recipe-ingredients').value = (r.ingredients || []).join('\n');
  document.getElementById('recipe-steps').value = (r.steps || []).join('\n');

  modalRecipeForm.classList.remove('hidden');
};

window.deleteRecipe = async (id) => {
  if (!confirm("Voulez-vous vraiment supprimer cette recette ?")) return;

  try {
    await deleteDoc(doc(db, "recipes", id));
    // Also remove from favorites if present
    if (favoriteIds.includes(id)) {
      favoriteIds = favoriteIds.filter(favId => favId !== id);
      await saveFavorites();
    }
  } catch (err) {
    alert("Erreur lors de la suppression : " + err.message);
  }
};

// Event Listeners setup
function setupEventListeners() {
  // Favorites Filter Button
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
      favoritesFilterActive = false; // Reset favorites filter when clicking a category
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
  if (closeDetailBtn) closeDetailBtn.addEventListener('click', () => modalRecipeDetail.classList.add('hidden'));

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

      const data = {
        title: document.getElementById('recipe-title').value,
        category: document.getElementById('recipe-category').value.trim(),
        prepTime: document.getElementById('recipe-prep').value,
        cookTime: document.getElementById('recipe-cook').value,
        servings: document.getElementById('recipe-servings').value,
        imageUrl: document.getElementById('recipe-image').value,
        ingredients: document.getElementById('recipe-ingredients').value.split('\n').filter(i => i.trim() !== ''),
        steps: document.getElementById('recipe-steps').value.split('\n').filter(s => s.trim() !== ''),
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
