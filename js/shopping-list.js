// Création d'une liste de courses ListMe à partir d'une recette.
// Les ingrédients sont envoyés à ListMe par les paramètres de l'adresse
// (?list=ID ou ?name=Titre, puis un paramètre par produit : produit=quantité).

// Adresse de ListMe, utilisée quand aucun lien de liste existante n'est fourni.
export const LISTME_URL = 'https://maximemons.github.io/ListMe/';

const LAST_LINK_KEY = 'aux-fourneaux:listme-link';
const LISTME_RESERVED = new Set(['list', 'name', 'items', 'add', 'fbclid', 'gclid']);

// Unités de poids / volume : la quantité est utile pour faire les courses.
const MEASURE_UNITS = [
  ['kg', /^(kg|kilos?|kilogrammes?)$/i],
  ['g', /^(g|gr|grammes?)$/i],
  ['mg', /^(mg)$/i],
  ['l', /^(l|litres?)$/i],
  ['dl', /^(dl)$/i],
  ['cl', /^(cl)$/i],
  ['ml', /^(ml)$/i],
];

// Unités de conditionnement : on garde « 2 gousses », « 1 boîte »…
const PACK_UNITS = /^(gousses?|boîtes?|boites?|pots?|sachets?|tranches?|bottes?|bouquets?|paquets?|briques?|bouteilles?|barquettes?|plaquettes?|tablettes?|rouleaux?|pâtes?|filets? de poisson|têtes?|pièces?|morceaux?|branches?|tiges?|bocaux?|canettes?|verres?|tasses?|bols?)$/i;

// Mesures de cuisine : inutiles en magasin, on achète simplement le produit.
const KITCHEN_UNITS = /^(c\.?\s?à\.?\s?(s|c|soupe|café)\.?|cs|cc|càs|càc|cuill(?:è|e)res?(?:\s+à\s+(?:soupe|café))?|pincées?|filets?|traits?|noix|noisettes?|zestes?|brins?|feuilles?|poignées?|cubes?|gouttes?|doses?|un peu|qs)$/i;

const UNIT_PATTERN =
  "(c\\.?\\s?à\\.?\\s?(?:s|c|soupe|café)\\.?|cuill(?:è|e)res?(?:\\s+à\\s+(?:soupe|café))?|[a-zA-Zàâäéèêëîïôöûüç]+\\.?)";

function normalize(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function parseNumber(t) {
  if (!t) return null;
  const frac = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const n = parseFloat(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function cleanName(raw) {
  let name = raw
    .replace(/\([^)]*\)/g, ' ') // « (facultatif) »
    .split(/[,;]| à température| bien mûre?s?| coupée?s? | émincée?s?\b| hachée?s?\b| fondue?s?\b| ramollie?s?\b/i)[0]
    .replace(/^(environ|env\.?|~)\s+/i, '')
    .replace(/^(de la |de l['’]|du |des |de |d['’]|l['’]|le |la |les )/i, '')
    .replace(/[:=*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
}

/** « 200 g de chocolat », « 2 gousses d'ail », « 1 c. à s. d'huile », « Sel » → { name, amount, unit, kind } */
export function parseIngredient(line) {
  const text = String(line || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const re = new RegExp(`^(?:environ\\s+|~\\s*)?(\\d+(?:[.,]\\d+)?(?:\\s*\\/\\s*\\d+)?)\\s*${UNIT_PATTERN}?\\s*(.*)$`, 'i');
  const m = text.match(re);
  if (!m) return { name: cleanName(text), amount: null, unit: '', kind: 'none' };

  const amount = parseNumber(m[1]);
  const unitRaw = (m[2] || '').trim();
  let rest = (m[3] || '').trim();
  const unitBare = unitRaw.replace(/\.$/, '');

  const measure = MEASURE_UNITS.find(([, r]) => r.test(unitBare));
  if (measure) return { name: cleanName(rest), amount, unit: measure[0], kind: 'measure' };
  if (unitRaw && KITCHEN_UNITS.test(unitRaw)) return { name: cleanName(rest), amount: null, unit: '', kind: 'none' };
  if (unitRaw && PACK_UNITS.test(unitBare)) return { name: cleanName(rest), amount, unit: unitBare.toLowerCase(), kind: 'pack' };

  // Pas d'unité reconnue : le mot fait partie du nom (« 3 œufs », « 2 oignons »).
  rest = `${unitRaw} ${rest}`.trim();
  return { name: cleanName(rest), amount, unit: '', kind: 'count' };
}

function toBaseUnit(amount, unit) {
  const factors = { kg: ['g', 1000], g: ['g', 1], mg: ['g', 0.001], l: ['ml', 1000], dl: ['ml', 100], cl: ['ml', 10], ml: ['ml', 1] };
  const [base, f] = factors[unit] || [unit, 1];
  return { base, value: amount * f };
}

function round(n) {
  return Math.round(n * 100) / 100;
}

function formatMeasure(value, base) {
  const fr = (n) => String(round(n)).replace('.', ',');
  if (base === 'g') return value >= 1000 ? `${fr(value / 1000)} kg` : `${fr(Math.ceil(value))} g`;
  if (base === 'ml') return value >= 1000 ? `${fr(value / 1000)} l` : value >= 10 ? `${fr(value / 10)} cl` : `${fr(value)} ml`;
  return `${fr(value)} ${base}`;
}

/** Regroupe et met à l'échelle les ingrédients. */
export function buildShoppingItems(lines, ratio = 1) {
  const map = new Map();
  // « Sel, poivre » sans quantité : un article par élément.
  const expanded = lines.flatMap((l) => (/^\s*\d/.test(l) ? [l] : String(l).split(/,/)));
  for (const line of expanded) {
    const p = parseIngredient(line);
    if (!p || !p.name) continue;
    // Clé au singulier : « 1 œuf » et « 3 œufs » sont regroupés.
    const key = normalize(p.name).split(' ').map((w) => (w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w)).join(' ');
    if (!map.has(key)) map.set(key, { name: p.name, names: [], count: 0, measures: {}, packs: {}, plain: false });
    const e = map.get(key);
    e.names.push(p.name);
    const amount = p.amount != null ? p.amount * ratio : null;
    if (p.kind === 'measure' && amount != null) {
      const { base, value } = toBaseUnit(amount, p.unit);
      e.measures[base] = (e.measures[base] || 0) + value;
    } else if (p.kind === 'pack' && amount != null) {
      e.packs[p.unit] = (e.packs[p.unit] || 0) + amount;
    } else if (p.kind === 'count' && amount != null) {
      e.count += amount;
    } else {
      e.plain = true;
    }
  }
  return [...map.values()].map((e) => {
    const parts = [];
    for (const [base, v] of Object.entries(e.measures)) parts.push(formatMeasure(v, base));
    for (const [unit, v] of Object.entries(e.packs)) {
      const n = Math.ceil(v);
      const u = n > 1 && !/[sx]$/.test(unit) ? `${unit}s` : unit;
      parts.push(`${n} ${u}`);
    }
    let qty;
    if (e.count > 1) e.name = e.names.find((n) => /[sx]$/i.test(n)) || e.name;
    if (!parts.length) qty = e.count ? Math.ceil(e.count) : 1;
    else {
      if (e.count) parts.unshift(String(Math.ceil(e.count)));
      qty = parts.join(' + ');
    }
    return { name: e.name, qty };
  });
}

/** Valide un lien de partage ListMe et renvoie { base, listId }. */
export function parseListMeLink(link) {
  const t = (link || '').trim();
  if (!t) return null;
  let url;
  try {
    url = new URL(t);
  } catch {
    return { error: 'Lien invalide. Copiez le lien depuis le bouton « Partager » de ListMe.' };
  }
  const listId = url.searchParams.get('list');
  if (!listId || !/^[A-Za-z0-9_-]{8,64}$/.test(listId)) {
    return { error: 'Ce lien ne contient pas d’identifiant de liste ListMe (paramètre « list »).' };
  }
  return { base: `${url.origin}${url.pathname}`, listId };
}

export function buildListMeUrl({ items, listLink, title }) {
  const params = new URLSearchParams();
  let base = LISTME_URL;
  if (listLink) {
    base = listLink.base;
    params.set('list', listLink.listId);
  } else {
    params.set('name', title.slice(0, 60));
  }
  for (const it of items) {
    let name = it.name.slice(0, 60);
    if (LISTME_RESERVED.has(name.toLowerCase()) || name.toLowerCase().startsWith('utm_')) name = `${name} `;
    params.append(name, String(it.qty).slice(0, 20));
  }
  return `${base}?${params.toString()}`;
}

/* -------------------------------------------------------------- Interface */

let current = null; // { recipe, servings, items }

function getModal() {
  return document.getElementById('modal-shopping');
}

export function isShoppingListOpen() {
  const m = getModal();
  return !!m && !m.classList.contains('hidden');
}

export function closeShoppingListModal() {
  const m = getModal();
  if (m) m.classList.add('hidden');
  current = null;
}

function lastLink() {
  try { return localStorage.getItem(LAST_LINK_KEY) || ''; } catch { return ''; }
}

function rememberLink(link) {
  try {
    if (link) localStorage.setItem(LAST_LINK_KEY, link);
    else localStorage.removeItem(LAST_LINK_KEY);
  } catch { /* rien */ }
}

function updateSubmitLabel() {
  const linkInput = document.getElementById('shopping-link');
  const label = document.getElementById('shopping-submit-label');
  const hint = document.getElementById('shopping-link-hint');
  const hasLink = !!linkInput.value.trim();
  label.textContent = hasLink ? 'Ajouter à la liste existante' : 'Créer la liste de courses';
  hint.textContent = hasLink
    ? 'Les ingrédients cochés seront ajoutés à cette liste.'
    : `Laissez vide pour créer une nouvelle liste « ${current?.recipe.title || 'Recette'} ».`;
}

function updateCount() {
  const boxes = [...document.querySelectorAll('#shopping-items input[type=checkbox]')];
  const n = boxes.filter((b) => b.checked).length;
  document.getElementById('shopping-count').textContent = `${n} / ${boxes.length}`;
  document.getElementById('shopping-submit').disabled = n === 0;
  document.getElementById('shopping-toggle-all').textContent = n === boxes.length ? 'Tout décocher' : 'Tout cocher';
}

export function openShoppingListModal(recipe, servings, baseServings) {
  const modal = getModal();
  if (!modal || !recipe) return;
  const sections =
    recipe.ingredientsSections && recipe.ingredientsSections.length
      ? recipe.ingredientsSections
      : [{ title: null, items: recipe.ingredients || [] }];
  const lines = sections.flatMap((s) => s.items || []);
  const ratio = baseServings ? servings / baseServings : 1;
  const items = buildShoppingItems(lines, ratio);
  current = { recipe, servings, items };

  document.getElementById('shopping-subtitle').textContent =
    `${recipe.title}, pour ${servings} ${servings > 1 ? 'personnes' : 'personne'}`;

  const list = document.getElementById('shopping-items');
  list.innerHTML = items.length
    ? items
        .map(
          (it, i) => `
        <li>
          <label class="flex items-center gap-3 py-2.5 px-1 cursor-pointer select-none">
            <input type="checkbox" checked data-index="${i}" class="w-5 h-5 rounded accent-orange-600 flex-shrink-0">
            <span class="flex-grow text-sm text-slate-800">${escapeHtml(it.name)}</span>
            <span class="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full whitespace-nowrap">${escapeHtml(String(it.qty).replace('.', ','))}</span>
          </label>
        </li>`
        )
        .join('')
    : '<li class="text-sm text-slate-500 py-3">Cette recette ne contient pas d’ingrédients.</li>';

  const linkInput = document.getElementById('shopping-link');
  linkInput.value = lastLink();
  document.getElementById('shopping-error').classList.add('hidden');
  updateSubmitLabel();
  updateCount();
  modal.classList.remove('hidden');
}

export function initShoppingList() {
  const modal = getModal();
  if (!modal) return;

  document.getElementById('btn-close-shopping').addEventListener('click', closeShoppingListModal);
  document.getElementById('shopping-items').addEventListener('change', updateCount);
  document.getElementById('shopping-toggle-all').addEventListener('click', () => {
    const boxes = [...document.querySelectorAll('#shopping-items input[type=checkbox]')];
    const allChecked = boxes.every((b) => b.checked);
    boxes.forEach((b) => (b.checked = !allChecked));
    updateCount();
  });

  const linkInput = document.getElementById('shopping-link');
  linkInput.addEventListener('input', () => {
    document.getElementById('shopping-error').classList.add('hidden');
    updateSubmitLabel();
  });
  document.getElementById('shopping-link-clear').addEventListener('click', () => {
    linkInput.value = '';
    rememberLink('');
    updateSubmitLabel();
    linkInput.focus();
  });

  document.getElementById('shopping-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!current) return;
    const errorEl = document.getElementById('shopping-error');
    const raw = linkInput.value.trim();
    const listLink = parseListMeLink(raw);
    if (listLink && listLink.error) {
      errorEl.textContent = listLink.error;
      errorEl.classList.remove('hidden');
      linkInput.focus();
      return;
    }
    const selected = [...document.querySelectorAll('#shopping-items input[type=checkbox]:checked')].map(
      (b) => current.items[Number(b.dataset.index)]
    );
    if (!selected.length) return;
    rememberLink(raw);
    const url = buildListMeUrl({ items: selected, listLink, title: current.recipe.title || 'Recette' });
    window.open(url, '_blank', 'noopener');
    closeShoppingListModal();
  });
}
