'use strict';

// État
let collection = JSON.parse(localStorage.getItem('pokevault_v3') || '[]');
let alerts = JSON.parse(localStorage.getItem('alerts_v3') || '[]');

// ─── COLLECTION ─────────────────
function save() {
  localStorage.setItem('pokevault_v3', JSON.stringify(collection));
}

function renderCollection() {
  const grid = document.getElementById('coll-grid');
  grid.innerHTML = '';
  if (!collection.length) { grid.innerHTML = '<p>Collection vide</p>'; return; }
  collection.forEach(c => {
    const div = document.createElement('div');
    div.innerHTML = `<strong>${c.name}</strong> | ${c.set} | 💶 ${c.value} € | x${c.qty}
                     <button onclick="removeCard(${c.id})">✕</button>`;
    grid.appendChild(div);
  });
}

function addManualCard(name, set, value, qty=1) {
  collection.push({ id: Date.now(), name, set, value, qty });
  save();
  renderCollection();
}

function removeCard(id) {
  collection = collection.filter(c => c.id !== id);
  save();
  renderCollection();
}

// Import / Export JSON
function exportJSON() {
  const blob = new Blob([JSON.stringify(collection)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'collection.json';
  a.click();
}
function importJSON(event) {
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = e => {
    collection = JSON.parse(e.target.result);
    save();
    renderCollection();
  };
  reader.readAsText(file);
}

// ─── RECHERCHE API POKÉMON TCG ─────────────────
async function doSearch() {
  const q = document.getElementById('search-input').value.trim();
  if (!q) return;
  const resEl = document.getElementById('search-results');
  resEl.innerHTML = '<p>Recherche...</p>';
  try {
    const resp = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:${encodeURIComponent(q)}&pageSize=12`);
    const json = await resp.json();
    resEl.innerHTML = '';
    json.data.forEach(card => {
      const div = document.createElement('div');
      div.innerHTML = `${card.name} | ${card.set?.name || '—'} | <img src="${card.images?.small}" width="60">
                       <button onclick="addFromAPI('${encodeURIComponent(JSON.stringify(card))}')">➕</button>`;
      resEl.appendChild(div);
    });
  } catch(e) {
    resEl.innerHTML = `<p>Erreur API : ${e.message}</p>`;
  }
}
function addFromAPI(safe) {
  const card = JSON.parse(decodeURIComponent(safe));
  addManualCard(card.name, card.set?.name || 'Inconnu', card.cardmarket?.prices?.averageSellPrice || 0, 1);
}

// ─── ALERTES BUSINESS++ ─────────────────
function setAlert() {
  const price = parseFloat(document.getElementById('alert-price').value);
  if (!price) return alert('Indiquez un prix valide');
  alerts.push(price);
  localStorage.setItem('alerts_v3', JSON.stringify(alerts));
  renderAlerts();
}

function renderAlerts() {
  const ul = document.getElementById('alerts-list');
  ul.innerHTML = '';
  alerts.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `💶 Prix seuil : ${p} €`;
    ul.appendChild(li);
  });
}
function checkAlerts() {
  if (Notification.permission !== "granted") Notification.requestPermission();
  collection.forEach(c => {
    alerts.forEach(a => {
      if (c.value >= a) new Notification(`⚡ ${c.name} atteint ${c.value} €`);
    });
  });
}
setInterval(checkAlerts, 1000*60*60); // toutes les heures
checkAlerts();
renderCollection();
renderAlerts();
