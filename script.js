'use strict';

// ══════════════════════════════════════════
// ÉTAT
// ══════════════════════════════════════════
const STORAGE_KEY = 'pokevault_v4';
let collection   = [];
let activeFilter = 'Tous';
const charts     = {};

const RARITY_LABELS = {
  common: 'Commune', uncommon: 'Peu commune',
  rare: 'Rare', ultrarare: 'Ultra Rare', secret: 'Secrète'
};
const RARITY_CLASS = {
  common: 'r-common', uncommon: 'r-uncommon',
  rare: 'r-rare', ultrarare: 'r-ultrarare', secret: 'r-secret'
};

// ══════════════════════════════════════════
// STORAGE
// ══════════════════════════════════════════
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(collection)); }
  catch (e) { console.warn('save error', e); }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    collection = raw ? JSON.parse(raw) : [];
  } catch (e) { collection = []; }
}

// ══════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════
function showView(id, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
  if (id === 'dashboard')  renderDashboard();
  if (id === 'collection') renderCollection();
}

// ══════════════════════════════════════════
// API RECHERCHE
// ══════════════════════════════════════════
async function doSearch() {
  const q = document.getElementById('search-input').value.trim();
  if (!q) return;
  const el = document.getElementById('search-results');
  el.innerHTML = '<div class="loading"><div class="spinner"></div><div>Recherche en cours…</div></div>';
  try {
    const url = 'https://api.pokemontcg.io/v2/cards?q=name:' + encodeURIComponent(q) + '&pageSize=24&orderBy=-set.releaseDate';
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const json = await resp.json();
    renderResults(json.data || []);
  } catch (e) {
    el.innerHTML =
      '<div class="empty"><div class="empty-icon">⚠️</div>' +
      '<p>Impossible de joindre l\'API Pokémon TCG.<br>' +
      'Vérifiez votre connexion ou utilisez la <strong>saisie manuelle</strong>.</p>' +
      '<p style="margin-top:8px;font-size:0.78rem;color:var(--text2)">Erreur : ' + esc(e.message) + '</p></div>';
  }
}

function renderResults(cards) {
  const el = document.getElementById('search-results');
  if (!cards.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">🃏</div><p>Aucune carte trouvée.</p></div>';
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'results-grid';

  cards.forEach(function(card) {
    const cm    = card.cardmarket && card.cardmarket.prices;
    const tcp   = card.tcgplayer  && card.tcgplayer.prices;
    const avg   = (cm && cm.averageSellPrice) || (tcp && tcp.holofoil && tcp.holofoil.market) || (tcp && tcp.normal && tcp.normal.market) || 0;
    const low   = (cm && cm.lowPrice)         || (tcp && tcp.holofoil && tcp.holofoil.low)    || (tcp && tcp.normal && tcp.normal.low)    || null;
    const trend = (cm && cm.trendPrice)       || null;
    const img   = (card.images && card.images.small) || '';
    const safe  = encodeURIComponent(JSON.stringify(card));

    const div = document.createElement('div');
    div.className = 'result-card';
    div.innerHTML =
      (img ? '<img src="' + esc(img) + '" alt="' + esc(card.name) + '" loading="lazy">'
           : '<div class="result-placeholder">🃏</div>') +
      '<button class="add-btn" title="Ajouter" onclick="addFromAPI(event,\'' + safe + '\',' + avg + ')">+</button>' +
      '<div class="result-body">' +
        '<div class="result-name">' + esc(card.name) + '</div>' +
        '<div class="result-set">' + esc((card.set && card.set.name) || '') + ' · ' + esc(card.rarity || '') + '</div>' +
        '<div class="price-row"><span class="price-lbl">💶 Cote</span><span class="p-avg">' + (avg ? avg.toFixed(2) + ' €' : '—') + '</span></div>' +
        (low   ? '<div class="price-row"><span class="price-lbl">📉 Min</span><span class="p-low">'   + low.toFixed(2)   + ' €</span></div>' : '') +
        (trend ? '<div class="price-row"><span class="price-lbl">📈 Tendance</span><span class="p-trend">' + trend.toFixed(2) + ' €</span></div>' : '') +
      '</div>';
    grid.appendChild(div);
  });

  el.innerHTML = '';
  el.appendChild(grid);
}

// ══════════════════════════════════════════
// AJOUTER / SUPPRIMER
// ══════════════════════════════════════════
function addFromAPI(e, safe, price) {
  e.stopPropagation();
  var card = JSON.parse(decodeURIComponent(safe));
  var rk   = mapRarity(card.rarity || '');
  push({
    name       : card.name,
    set        : (card.set && card.set.name) || 'Inconnu',
    rarity     : rk,
    rarityLabel: RARITY_LABELS[rk] || card.rarity || '',
    qty        : 1,
    value      : price || 0,
    condition  : 'Near Mint',
    img        : (card.images && card.images.small) || ''
  });
}

function addManualCard() {
  var name = document.getElementById('f-name').value.trim();
  if (!name) { toast('⚠️ Le nom est obligatoire', true); return; }
  var rarity = document.getElementById('f-rarity').value;
  push({
    name,
    set        : document.getElementById('f-set').value.trim() || 'Inconnu',
    rarity,
    rarityLabel: RARITY_LABELS[rarity],
    qty        : Math.max(1, parseInt(document.getElementById('f-qty').value) || 1),
    value      : parseFloat(document.getElementById('f-value').value) || 0,
    condition  : document.getElementById('f-condition').value,
    img        : document.getElementById('f-img').value.trim()
  });
  ['f-name', 'f-set', 'f-img'].forEach(function(id) { document.getElementById(id).value = ''; });
  document.getElementById('f-qty').value   = 1;
  document.getElementById('f-value').value = '';
}

function push(card) {
  var existing = collection.find(function(c) { return c.name === card.name && c.set === card.set; });
  if (existing) {
    existing.qty += card.qty;
  } else {
    collection.push(Object.assign({ id: Date.now() + Math.random(), addedAt: new Date().toISOString() }, card));
  }
  save();
  toast('✅ ' + card.name + ' ajouté !');
}

function removeCard(id) {
  collection = collection.filter(function(c) { return c.id !== id; });
  save();
  renderCollection();
  renderDashboard();
  toast('🗑️ Carte supprimée');
}

function updateCard(id, value, qty) {
  var c = collection.find(function(c) { return c.id === id; });
  if (!c) return;
  if (!isNaN(value) && value >= 0) c.value = value;
  if (!isNaN(qty)   && qty   >= 1) c.qty   = qty;
  save();
  renderCollection();
  renderDashboard();
  toast('💾 Carte mise à jour !');
}

// ══════════════════════════════════════════
// EXPORT / IMPORT
// ══════════════════════════════════════════
function exportJSON() {
  var data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), collection: collection }, null, 2);
  var blob = new Blob([data], { type: 'application/json' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = 'pokevault_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('⬇️ Collection exportée !');
}

function importJSON(event) {
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var parsed = JSON.parse(e.target.result);
      var cards  = parsed.collection || parsed;
      if (!Array.isArray(cards)) throw new Error('Format invalide');
      cards.forEach(function(c) {
        var existing = collection.find(function(x) { return x.name === c.name && x.set === c.set; });
        if (existing) { existing.qty += (c.qty || 1); }
        else { collection.push(Object.assign({}, c, { id: Date.now() + Math.random() })); }
      });
      save();
      renderDashboard();
      renderCollection();
      toast('⬆️ ' + cards.length + ' cartes importées !');
    } catch (err) {
      toast('❌ Fichier invalide : ' + err.message, true);
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

// ══════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════
function renderDashboard() {
  var totalUnique = collection.length;
  var totalQty    = collection.reduce(function(s, c) { return s + c.qty; }, 0);
  var totalValue  = collection.reduce(function(s, c) { return s + c.value * c.qty; }, 0);
  var avgValue    = totalQty ? totalValue / totalQty : 0;
  var topCard     = collection.slice().sort(function(a, b) { return b.value - a.value; })[0];

  document.getElementById('stats-grid').innerHTML =
    '<div class="stat-card"><div class="stat-label">🃏 Cartes uniques</div><div class="stat-value">' + totalUnique + '</div><div class="stat-sub">références différentes</div></div>' +
    '<div class="stat-card"><div class="stat-label">📦 Exemplaires</div><div class="stat-value">' + totalQty + '</div><div class="stat-sub">cartes au total</div></div>' +
    '<div class="stat-card"><div class="stat-label">💶 Valeur totale</div><div class="stat-value">' + totalValue.toFixed(0) + ' €</div><div class="stat-sub">~' + avgValue.toFixed(2) + ' € / carte</div></div>' +
    '<div class="stat-card"><div class="stat-label">⭐ Plus précieuse</div><div class="stat-value" style="font-size:1.5rem">' + (topCard ? topCard.value.toFixed(2) + ' €' : '—') + '</div><div class="stat-sub">' + (topCard ? esc(topCard.name) : 'Aucune carte') + '</div></div>';

  // Chart sets
  var setMap = {};
  collection.forEach(function(c) { setMap[c.set] = (setMap[c.set] || 0) + c.value * c.qty; });
  var setLabels = Object.keys(setMap).slice(0, 10);
  var setData   = setLabels.map(function(k) { return +setMap[k].toFixed(2); });

  if (charts.sets) charts.sets.destroy();
  charts.sets = new Chart(document.getElementById('chart-sets').getContext('2d'), {
    type: 'bar',
    data: {
      labels: setLabels.length ? setLabels : ['Aucune donnée'],
      datasets: [{ data: setData.length ? setData : [0], backgroundColor: 'rgba(255,203,5,0.65)', borderColor: '#ffcb05', borderWidth: 1, borderRadius: 6 }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8892b0', font: { size: 10 }, maxRotation: 30 }, grid: { color: '#2a2f4a' } },
        y: { ticks: { color: '#8892b0', callback: function(v) { return v + '€'; } }, grid: { color: '#2a2f4a' } }
      }
    }
  });

  // Chart rarity
  var rc = { common: 0, uncommon: 0, rare: 0, ultrarare: 0, secret: 0 };
  collection.forEach(function(c) { if (rc[c.rarity] !== undefined) rc[c.rarity] += c.qty; });

  if (charts.rarity) charts.rarity.destroy();
  charts.rarity = new Chart(document.getElementById('chart-rarity').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Commune', 'Peu commune', 'Rare', 'Ultra Rare', 'Secrète'],
      datasets: [{ data: [rc.common, rc.uncommon, rc.rare, rc.ultrarare, rc.secret], backgroundColor: ['#444', '#1a5a3a', '#162050', '#38104e', '#4a2a06'], borderColor: '#161929', borderWidth: 2 }]
    },
    options: { responsive: true, plugins: { legend: { labels: { color: '#8892b0', font: { size: 11 } } } } }
  });

  // Top 5
  var top5  = collection.slice().sort(function(a, b) { return b.value - a.value; }).slice(0, 5);
  var topEl = document.getElementById('top-cards');
  topEl.innerHTML = '';
  if (!top5.length) {
    topEl.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="empty-icon">🃏</div><p>Ajoutez des cartes pour voir le top !</p></div>';
    return;
  }
  top5.forEach(function(c) {
    var el = document.createElement('div');
    el.className = 'coll-card';
    el.innerHTML = cardHTML(c, false);
    el.onclick = function() { openModal(c); };
    topEl.appendChild(el);
  });
}

// ══════════════════════════════════════════
// COLLECTION
// ══════════════════════════════════════════
function renderCollection() {
  var sets = ['Tous'].concat([...new Set(collection.map(function(c) { return c.set; }))]);
  if (!sets.includes(activeFilter)) activeFilter = 'Tous';

  var fb = document.getElementById('filter-bar');
  fb.innerHTML = '';
  sets.forEach(function(s) {
    var b = document.createElement('button');
    b.className = 'filter-btn' + (s === activeFilter ? ' active' : '');
    b.textContent = s;
    b.onclick = function() { activeFilter = s; renderCollection(); };
    fb.appendChild(b);
  });

  var filtered = activeFilter === 'Tous' ? collection : collection.filter(function(c) { return c.set === activeFilter; });
  var grid = document.getElementById('coll-grid');
  grid.innerHTML = '';

  if (!filtered.length) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="empty-icon">📦</div><p>Votre collection est vide.<br>Recherchez ou ajoutez des cartes !</p></div>';
    return;
  }

  filtered.forEach(function(c) {
    var el = document.createElement('div');
    el.className = 'coll-card';
    el.innerHTML = cardHTML(c, true);
    el.onclick = function() { openModal(c); };
    grid.appendChild(el);
  });
}

function cardHTML(c, showDel) {
  return (c.img ? '<img src="' + esc(c.img) + '" alt="' + esc(c.name) + '" loading="lazy">' : '<div class="coll-placeholder">🃏</div>') +
    '<div class="badge-qty">x' + c.qty + '</div>' +
    (showDel ? '<button class="btn-del" title="Supprimer" onclick="event.stopPropagation();removeCard(' + c.id + ')">✕</button>' : '') +
    '<div class="coll-body">' +
      '<div class="coll-name">' + esc(c.name) + '</div>' +
      '<div class="coll-set">' + esc(c.set) + '</div>' +
      '<div class="coll-unit">💶 ' + c.value.toFixed(2) + ' € / unité</div>' +
      (c.qty > 1 ? '<div class="coll-total">= ' + (c.value * c.qty).toFixed(2) + ' € total</div>' : '') +
      '<span class="rarity ' + (RARITY_CLASS[c.rarity] || 'r-common') + '">' + esc(c.rarityLabel) + '</span>' +
    '</div>';
}

// ══════════════════════════════════════════
// MODAL
// ══════════════════════════════════════════
function openModal(c) {
  closeModal();
  var ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.id = 'card-modal';
  ov.innerHTML =
    '<div class="modal-box">' +
      '<div class="modal-head">' +
        (c.img ? '<img src="' + esc(c.img) + '" alt="' + esc(c.name) + '">' : '<div class="modal-head-placeholder">🃏</div>') +
        '<div>' +
          '<div class="modal-card-name">' + esc(c.name) + '</div>' +
          '<div class="modal-card-set">' + esc(c.set) + '</div>' +
          '<span class="rarity ' + (RARITY_CLASS[c.rarity] || 'r-common') + '">' + esc(c.rarityLabel) + '</span>' +
          '<div style="margin-top:8px;font-size:0.78rem;color:var(--text2)">Condition : <span style="color:var(--text)">' + esc(c.condition) + '</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="modal-prices">' +
          '<div class="modal-price-box"><div class="modal-price-lbl">Cote unitaire</div><div class="modal-price-val" style="color:var(--green)">' + c.value.toFixed(2) + ' €</div></div>' +
          '<div class="modal-price-box"><div class="modal-price-lbl">Total ×' + c.qty + '</div><div class="modal-price-val" style="color:var(--accent)">' + (c.value * c.qty).toFixed(2) + ' €</div></div>' +
        '</div>' +
        '<div class="modal-edit-row">' +
          '<label>Cote (€)</label>' +
          '<input type="number" id="m-val" step="0.01" min="0" value="' + c.value + '">' +
          '<input type="number" id="m-qty" min="1" value="' + c.qty + '" style="width:70px">' +
        '</div>' +
        '<div class="modal-actions">' +
          '<button class="btn" style="flex:1" onclick="applyModal(' + c.id + ')">💾 Enregistrer</button>' +
          '<button class="btn btn-secondary" style="flex:1" onclick="closeModal()">Fermer</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  ov.onclick = function(e) { if (e.target === ov) closeModal(); };
  document.body.appendChild(ov);
}

function closeModal() {
  var m = document.getElementById('card-modal');
  if (m) m.remove();
}

function applyModal(id) {
  var val = parseFloat(document.getElementById('m-val').value);
  var qty = parseInt(document.getElementById('m-qty').value);
  updateCard(id, val, qty);
  closeModal();
}

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════
function mapRarity(r) {
  var s = (r || '').toLowerCase();
  if (s.includes('secret') || s.includes('rainbow') || s.includes('gold')) return 'secret';
  if (s.includes('ultra')  || s.includes('vmax')    || s.includes('full art') || s.includes('ex') || s.includes('gx')) return 'ultrarare';
  if (s.includes('holo')   || s.includes('rare'))   return 'rare';
  if (s.includes('uncommon')) return 'uncommon';
  return 'common';
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toast(msg, warn) {
  var t = document.createElement('div');
  t.className = 'toast' + (warn ? ' warn' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function() { t.remove(); }, 2700);
}

// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════
function init() {
  load();
  if (!collection.length) {
    collection = [
      { id:1, name:'Dracaufeu ex',  set:'Écarlate et Violet', rarity:'ultrarare', rarityLabel:'Ultra Rare', qty:1, value:45.00,  condition:'Near Mint', img:'', addedAt:'' },
      { id:2, name:'Pikachu VMAX',  set:'Épée et Bouclier',   rarity:'ultrarare', rarityLabel:'Ultra Rare', qty:2, value:28.50,  condition:'Mint',      img:'', addedAt:'' },
      { id:3, name:'Mewtwo GX',     set:'Soleil et Lune',     rarity:'rare',      rarityLabel:'Rare',       qty:1, value:12.00,  condition:'Excellent',  img:'', addedAt:'' },
      { id:4, name:'Ronflex',       set:'Écarlate et Violet', rarity:'common',    rarityLabel:'Commune',    qty:4, value:0.50,   condition:'Bon état',   img:'', addedAt:'' },
      { id:5, name:'Lugia V',       set:'Argent Tempête',     rarity:'secret',    rarityLabel:'Secrète',    qty:1, value:120.00, condition:'Mint',       img:'', addedAt:'' }
    ];
    save();
  }
  renderDashboard();
  renderCollection();
}

// Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('./sw.js').catch(function(e) { console.warn('SW:', e); });
  });
}

init();
