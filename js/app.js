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
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

import { CATEGORIES, INITIAL_RECIPES } from './categories.js';

// Global State
let currentUser = null;
let recipes = [];
let activeCategory = 'all';
let searchQuery = '';
let isSignUpMode = false;

// DOM Elements
const categoriesBar = document.getElementById('categories-bar');
const recipesGrid = document.getElementById('recipes-grid');
const emptyState = document.getElementById('empty-state');
const currentCategoryTitle = document.getElementById('current-category-title');
const recipeCount = document.getElementById('recipe-count');
const searchInput = document.getElementById('search-input');

// Auth DOM
const btnAddRecipe = document.getElementById('btn-add-recipe');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const userProfile = document.getElementById('user-profile');
const userAvatar = document.getElementById('user-avatar');
const userEmail = document.getElementById('user-email');

// Modals
const modalAuth = document.getElementById('modal-auth');
const modalRecipeForm = document.getElementById('modal-recipe-form');
const modalRecipeDetail = document.getElementById('modal-recipe-detail');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  renderCategories();
  setupEventListeners();
  initAuthObserver();
  initFirestore();
});

// --- RENDER CATEGORIES ---
function renderCategories() {
  categoriesBar.innerHTML = CATEGORIES.map(cat => `
    <button data-id="${cat.id}" class="category-btn flex items-center space-x-2 px-4 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${cat.id === activeCategory ? 'bg-orange-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}">
      <i class="fa-solid ${cat.icon}"></i>
      <span>${cat.label}</span>
    </button>
  `).join('');

  // Select option populator for recipe form
  const selectCategory = document.getElementById('recipe-category');
  selectCategory.innerHTML = CATEGORIES.filter(c => c.id !== 'all').map(c => `
    <option value="${c.id}">${c.label}</option>
  `).join('');
}

// --- AUTH OBSERVER (Tapis-Vert inspired auto/persist auth) ---
function initAuthObserver() {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
      // User is signed in
      btnLogin.classList.add('hidden');
      userProfile.classList.remove('hidden');
      userEmail.textContent = user.email;
      userAvatar.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=ea580c&color=fff`;
      btnAddRecipe.classList.remove('hidden');
      btnAddRecipe.classList.add('flex');
    } else {
      // Anonymous / Read-Only mode
      btnLogin.classList.remove('hidden');
      userProfile.classList.add('hidden');
      btnAddRecipe.classList.add('hidden');
      btnAddRecipe.classList.remove('flex');
    }
    renderRecipes();
  });
}

// --- FIRESTORE SUBSCRIPTION & DEMO FALLBACK ---
function initFirestore() {
  try {
    const colRef = collection(db, "recipes");
    onSnapshot(colRef, (snapshot) => {
      if (!snapshot.empty) {
        recipes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else {
        recipes = INITIAL_RECIPES.map((r, index) => ({ id: `demo-${index}`, ...r }));
      }
      renderRecipes();
    }, (error) => {
      console.warn("Firestore access offline or unconfigured. Using demo data.", error);
      recipes = INITIAL_RECIPES.map((r, index) => ({ id: `demo-${index}`, ...r }));
      renderRecipes();
    });
  } catch (err) {
    recipes = INITIAL_RECIPES.map((r, index) => ({ id: `demo-${index}`, ...r }));
    renderRecipes();
  }
}

// --- RENDER RECIPES ---
function renderRecipes() {
  let filtered = recipes.filter(r => {
    const matchesCat = activeCategory === 'all' || r.category === activeCategory;
    const matchesSearch = !searchQuery || 
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.ingredients && r.ingredients.some(i => i.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesCat && matchesSearch;
  });

  recipeCount.textContent = filtered.length;
  const currentCatObj = CATEGORIES.find(c => c.id === activeCategory);
  currentCategoryTitle.querySelector('span').textContent = currentCatObj ? currentCatObj.label : 'Toutes les recettes';

  if (filtered.length === 0) {
    recipesGrid.innerHTML = '';
    emptyState.classList.remove('hidden');
    emptyState.classList.add('flex');
    return;
  }

  emptyState.classList.add('hidden');
  emptyState.classList.remove('flex');

  recipesGrid.innerHTML = filtered.map(r => `
    <div class="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col group cursor-pointer" onclick="openRecipeDetail('${r.id}')">
      <div class="relative h-48 overflow-hidden bg-slate-100">
        <img src="${r.imageUrl || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&q=80&w=800'}" alt="${r.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
        <span class="absolute top-3 left-3 bg-white/90 backdrop-blur-md text-slate-800 text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
          ${CATEGORIES.find(c => c.id === r.category)?.label || r.category}
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
            <button onclick="openEditForm('${r.id}')" class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-orange-100 text-slate-600 hover:text-orange-600 flex items-center justify-center transition-colors">
              <i class="fa-solid fa-pen text-xs"></i>
            </button>
            <button onclick="deleteRecipe('${r.id}')" class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-600 flex items-center justify-center transition-colors">
              <i class="fa-solid fa-trash text-xs"></i>
            </button>
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');
}

// Global functions attached to window for HTML event handlers
window.openRecipeDetail = (id) => {
  const r = recipes.find(item => item.id === id);
  if (!r) return;

  const content = document.getElementById('detail-content');
  content.innerHTML = `
    <div class="relative h-64 sm:h-80 w-full">
      <img src="${r.imageUrl || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&q=80&w=800'}" class="w-full h-full object-cover">
      <div class="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent flex items-end p-6 sm:p-8">
        <div>
          <span class="bg-orange-600 text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">${CATEGORIES.find(c => c.id === r.category)?.label || r.category}</span>
          <h2 class="text-2xl sm:text-3xl font-serif font-bold text-white mt-2">${r.title}</h2>
        </div>
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
  document.getElementById('recipe-category').value = r.category;
  document.getElementById('recipe-prep').value = r.prepTime || '';
  document.getElementById('recipe-cook').value = r.cookTime || '';
  document.getElementById('recipe-servings').value = r.servings || '';
  document.getElementById('recipe-image').value = r.imageUrl || '';
  document.getElementById('recipe-ingredients').value = (r.ingredients || []).join('
');
  document.getElementById('recipe-steps').value = (r.steps || []).join('
');

  modalRecipeForm.classList.remove('hidden');
};

window.deleteRecipe = async (id) => {
  if (!confirm("Voulez-vous vraiment supprimer cette recette ?")) return;

  if (id.startsWith('demo-')) {
    recipes = recipes.filter(r => r.id !== id);
    renderRecipes();
    return;
  }

  try {
    await deleteDoc(doc(db, "recipes", id));
  } catch (err) {
    alert("Erreur lors de la suppression : " + err.message);
  }
};

// Event Listeners setup
function setupEventListeners() {
  // Category Bar filter
  categoriesBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.category-btn');
    if (!btn) return;
    activeCategory = btn.dataset.id;
    renderCategories();
    renderRecipes();
  });

  // Search
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderRecipes();
  });

  // Modals Open / Close
  btnLogin.addEventListener('click', () => modalAuth.classList.remove('hidden'));
  
  btnAddRecipe.addEventListener('click', () => {
    document.getElementById('form-title').textContent = "Nouvelle Recette";
    document.getElementById('recipe-form').reset();
    document.getElementById('recipe-id').value = '';
    modalRecipeForm.classList.remove('hidden');
  });

  document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      modalAuth.classList.add('hidden');
      modalRecipeForm.classList.add('hidden');
      modalRecipeDetail.classList.add('hidden');
    });
  });

  // Auth Mode Switch
  document.getElementById('toggle-auth-mode').addEventListener('click', () => {
    isSignUpMode = !isSignUpMode;
    document.getElementById('auth-title').textContent = isSignUpMode ? "Inscription" : "Connexion";
    document.getElementById('auth-submit-btn').textContent = isSignUpMode ? "S'inscrire" : "Se connecter";
    document.getElementById('toggle-auth-mode').textContent = isSignUpMode ? "Déjà un compte ? Se connecter" : "Pas de compte ? S'inscrire";
  });

  // Auth Form Submit
  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const errDiv = document.getElementById('auth-error');
    errDiv.classList.add('hidden');

    try {
      if (isSignUpMode) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      modalAuth.classList.add('hidden');
    } catch (err) {
      errDiv.textContent = err.message;
      errDiv.classList.remove('hidden');
    }
  });

  // Logout
  btnLogout.addEventListener('click', () => signOut(auth));

  // Recipe Form Submit
  document.getElementById('recipe-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('recipe-id').value;

    const data = {
      title: document.getElementById('recipe-title').value,
      category: document.getElementById('recipe-category').value,
      prepTime: document.getElementById('recipe-prep').value,
      cookTime: document.getElementById('recipe-cook').value,
      servings: document.getElementById('recipe-servings').value,
      imageUrl: document.getElementById('recipe-image').value,
      ingredients: document.getElementById('recipe-ingredients').value.split('
').filter(i => i.trim() !== ''),
      steps: document.getElementById('recipe-steps').value.split('
').filter(s => s.trim() !== ''),
      updatedAt: serverTimestamp()
    };

    try {
      if (id && !id.startsWith('demo-')) {
        await updateDoc(doc(db, "recipes", id), data);
      } else {
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, "recipes"), data);
      }
      modalRecipeForm.classList.add('hidden');
    } catch (err) {
      alert("Erreur lors de l'enregistrement : " + err.message);
    }
  });
}
