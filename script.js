// ═══════════════════════════════════════════════
// CONSTANTES & ÉTAT
// ═══════════════════════════════════════════════
var KEY  = 'pokevault_v5';
var LANG = 'fr'; // fr | en | jp
var RLBL = ['Commune','Peu commune','Rare','Ultra Rare','Secrète'];
var RCLS = ['rc0','rc1','rc2','rc3','rc4'];
var collection = [];
var filter = 'Tous';
var CH = {};
window._pendingCards = [];
window._lastCards    = [];

// ═══════════════════════════════════════════════
// CONFIG LANGUES
// ═══════════════════════════════════════════════
var LANG_CONF = {
  fr: {
    label    : '🇫🇷 Français',
    info     : '💶 Cotes Cardmarket Europe (€) — éditions françaises',
    currency : '€',
    placeholder: 'Ex : Dracaufeu, Pikachu VMAX, Mew…',
    getPrice : function(c) {
      var cm  = c.cardmarket && c.cardmarket.prices;
      return {
        avg  : (cm && cm.averageSellPrice) || 0,
        low  : (cm && cm.lowPrice)         || 0,
        trend: (cm && cm.trendPrice)       || 0
      };
    }
  },
  en: {
    label    : '🇬🇧 English',
    info     : '💵 Prices from TCGPlayer USA ($) — English editions',
    currency : '$',
    placeholder: 'Ex: Charizard, Pikachu VMAX, Mew…',
    getPrice : function(c) {
      var tcp = c.tcgplayer && c.tcgplayer.prices;
      var pr  = tcp && (tcp.holofoil || tcp.normal || tcp['1stEditionHolofoil'] || tcp.reverseHolofoil || tcp.unlimited) || null;
      return {
        avg  : (pr && pr.market) || 0,
        low  : (pr && pr.low)    || 0,
        trend: (pr && pr.mid)    || 0
      };
    }
  },
  jp: {
    label    : '🇯🇵 Japonais',
    info     : '¥ Estimation marché japonais (conversion USD→JPY ×155)',
    currency : '¥',
    placeholder: 'Ex: リザードン, ピカチュウ, ミュウ…',
    getPrice : function(c) {
      var tcp = c.tcgplayer && c.tcgplayer.prices;
      var pr  = tcp && (tcp.holofoil || tcp.normal) || null;
      return {
        avg  : pr && pr.market ? Math.round(pr.market * 155) : 0,
        low  : pr && pr.low    ? Math.round(pr.low    * 155) : 0,
        trend: 0
      };
    }
  }
};

// ═══════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(collection)); } catch(e) {}
}
function load() {
  try { var r = localStorage.getItem(KEY); collection = r ? JSON.parse(r) : []; } catch(e) { collection = []; }
}

// ═══════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════
function showView(id) {
  var views = document.querySelectorAll('.view');
  for (var i = 0; i < views.length; i++) views[i].classList.remove('active');
  var btns = document.querySelectorAll('.nb');
  for (var j = 0; j < btns.length; j++) btns[j].classList.remove('active');
  document.getElementById('view-' + id).classList.add('active');
  document.getElementById('nav-' + id).classList.add('active');
  if (id === 'dashboard')  renderDash();
  if (id === 'collection') renderColl();
}

// ═══════════════════════════════════════════════
// GESTION DE LA LANGUE
// ═══════════════════════════════════════════════
function setLang(l) {
  LANG = l;
  // Boutons actifs
  var langs = ['fr','en','jp'];
  for (var i = 0; i < langs.length; i++) {
    var b = document.getElementById('lang-' + langs[i]);
    if (b) b.classList.toggle('active', langs[i] === l);
  }
  // Info message
  var info = document.getElementById('lang-info');
  if (info) info.textContent = LANG_CONF[l].info;
  // Placeholder
  var inp = document.getElementById('sinp');
  if (inp) inp.placeholder = LANG_CONF[l].placeholder;
  // Rerendre les résultats si déjà chargés
  if (window._lastCards && window._lastCards.length) {
    renderResults(window._lastCards);
  }
}

// ═══════════════════════════════════════════════
// API POKEMON TCG — RECHERCHE
// ═══════════════════════════════════════════════
function doSearch() {
  var q = document.getElementById('sinp').value.trim();
  if (!q) return;
  var el = document.getElementById('results');
  el.innerHTML = '<div class="ld"><div class="sp"></div><div>Recherche en cours…</div></div>';

  // L'API pokemontcg.io filtre par langue avec le paramètre language
  // FR = French, EN = English, JP = Japanese
  var langMap = { fr: 'French', en: 'English', jp: 'Japanese' };
  var langParam = langMap[LANG] || 'French';

  // Recherche avec filtre langue
  var urlLang = 'https://api.pokemontcg.io/v2/cards?q=name:' + encodeURIComponent(q)
    + ' language:' + encodeURIComponent(langParam)
    + '&pageSize=24&orderBy=-set.releaseDate';

  // URL fallback sans filtre langue si 0 résultat
  var urlAll = 'https://api.pokemontcg.io/v2/cards?q=name:' + encodeURIComponent(q)
    + '&pageSize=24&orderBy=-set.releaseDate';

  fetch(urlLang)
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(json) {
      var cards = json.data || [];
      if (cards.length > 0) {
        window._lastCards = cards;
        renderResults(cards);
      } else {
        // Fallback : toutes langues
        return fetch(urlAll)
          .then(function(r2) { return r2.json(); })
          .then(function(j2) {
            window._lastCards = j2.data || [];
            renderResults(window._lastCards);
          });
      }
    })
    .catch(function(e) {
      el.innerHTML = '<div class="em"><div class="ei">⚠️</div>'
        + '<p>Impossible de joindre l\'API Pokémon TCG.<br>'
        + 'Vérifiez votre connexion ou utilisez la <strong>saisie manuelle</strong>.</p>'
        + '<p style="margin-top:8px;font-size:.76rem;color:var(--t2)">' + esc(e.message) + '</p></div>';
    });
}

// ═══════════════════════════════════════════════
// AFFICHAGE DES RÉSULTATS
// ═══════════════════════════════════════════════
function renderResults(cards) {
  var el = document.getElementById('results');
  if (!cards || !cards.length) {
    el.innerHTML = '<div class="em"><div class="ei">🃏</div><p>Aucune carte trouvée.<br>Essayez une autre langue ou vérifiez l\'orthographe.</p></div>';
    return;
  }

  var conf = LANG_CONF[LANG] || LANG_CONF.fr;
  var cur  = conf.currency;
  window._pendingCards = []; // reset à chaque nouvelle recherche/langue

  var html = '<div class="rg">';
  for (var i = 0; i < cards.length; i++) {
    var c      = cards[i];
    var prices = conf.getPrice(c);
    var avg    = prices.avg;
    var low    = prices.low;
    var trend  = prices.trend;
    var img    = (c.images && c.images.small) || '';
    var idx    = window._pendingCards.length;
    window._pendingCards.push({ card: c, price: avg, currency: cur, lang: LANG });

    // Badge langue de la carte
    var langLabel = c.language ? esc(c.language) : '';
    var langBadge = langLabel ? '<span class="lang-badge">' + langLabel + '</span>' : '';

    html += '<div class="rc">';
    html += img
      ? '<img src="' + esc(img) + '" alt="' + esc(c.name) + '" loading="lazy">'
      : '<div class="rph">🃏</div>';
    html += '<button class="addb" onclick="addPending(' + idx + ')">+</button>';
    html += '<div class="rb">';
    html += '<div class="rn">' + esc(c.name) + ' ' + langBadge + '</div>';
    html += '<div class="rset">' + esc((c.set && c.set.name) || '') + ' · ' + esc(c.rarity || '') + '</div>';

    // Prix selon la langue
    html += '<div class="pr"><span class="pl">Cote ' + cur + '</span>'
          + '<span class="pa">' + (avg ? avg.toFixed(avg < 1000 ? 2 : 0) + ' ' + cur : '—') + '</span></div>';
    if (low)   html += '<div class="pr"><span class="pl">📉 Min</span><span class="plo">'     + low.toFixed(low < 1000 ? 2 : 0)   + ' ' + cur + '</span></div>';
    if (trend) html += '<div class="pr"><span class="pl">📈 Tendance</span><span class="ptr">' + trend.toFixed(trend < 1000 ? 2 : 0) + ' ' + cur + '</span></div>';

    html += '</div></div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

// ═══════════════════════════════════════════════
// AJOUTER DEPUIS API
// ═══════════════════════════════════════════════
function addPending(idx) {
  var item = window._pendingCards[idx];
  if (!item) return;
  var c  = item.card;
  var rk = mapRarity(c.rarity || '');
  pushCard({
    name      : c.name,
    set       : (c.set && c.set.name) || 'Inconnu',
    rarity    : rk,
    rarityLabel: RLBL[rk],
    qty       : 1,
    value     : item.price || 0,
    currency  : item.currency || '€',
    lang      : item.lang || 'fr',
    condition : 'Near Mint',
    img       : (c.images && c.images.small) || ''
  });
}

// ═══════════════════════════════════════════════
// AJOUTER / SUPPRIMER / MODIFIER
// ═══════════════════════════════════════════════
function addManual() {
  var name = document.getElementById('f-name').value.trim();
  if (!name) { toast('⚠️ Le nom est obligatoire', true); return; }
  var ri = parseInt(document.getElementById('f-rarity').value);
  pushCard({
    name      : name,
    set       : document.getElementById('f-set').value.trim() || 'Inconnu',
    rarity    : ri,
    rarityLabel: RLBL[ri],
    qty       : Math.max(1, parseInt(document.getElementById('f-qty').value) || 1),
    value     : parseFloat(document.getElementById('f-value').value) || 0,
    currency  : '€',
    lang      : 'fr',
    condition : document.getElementById('f-cond').value,
    img       : document.getElementById('f-img').value.trim()
  });
  document.getElementById('f-name').value  = '';
  document.getElementById('f-set').value   = '';
  document.getElementById('f-img').value   = '';
  document.getElementById('f-qty').value   = '1';
  document.getElementById('f-value').value = '';
}

function pushCard(card) {
  var found = null;
  for (var i = 0; i < collection.length; i++) {
    if (collection[i].name === card.name && collection[i].set === card.set) { found = collection[i]; break; }
  }
  if (found) { found.qty += card.qty; }
  else {
    collection.push({
      id         : collection.length + 1 + '_' + Date.now(),
      addedAt    : new Date().toISOString(),
      name       : card.name,
      set        : card.set,
      rarity     : card.rarity,
      rarityLabel: card.rarityLabel,
      qty        : card.qty,
      value      : card.value,
      currency   : card.currency || '€',
      lang       : card.lang    || 'fr',
      condition  : card.condition,
      img        : card.img
    });
  }
  save();
  toast('✅ ' + card.name + ' ajouté !');
}

function removeCard(id) {
  var next = [];
  for (var i = 0; i < collection.length; i++) {
    if (String(collection[i].id) !== String(id)) next.push(collection[i]);
  }
  collection = next;
  save(); renderColl(); renderDash();
  toast('🗑️ Supprimé');
}

function updateCard(id, val, qty) {
  for (var i = 0; i < collection.length; i++) {
    if (String(collection[i].id) === String(id)) {
      if (!isNaN(val) && val >= 0) collection[i].value = val;
      if (!isNaN(qty) && qty >= 1) collection[i].qty   = qty;
      break;
    }
  }
  save(); renderColl(); renderDash();
  toast('💾 Mise à jour !');
}

// ═══════════════════════════════════════════════
// EXPORT / IMPORT
// ═══════════════════════════════════════════════
function exportJSON() {
  var data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), collection: collection }, null, 2);
  var blob = new Blob([data], { type: 'application/json' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.download = 'pokevault_' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('⬇️ Exporté !');
}

function importJSON(e) {
  var file = e.target.files[0]; if (!file) return;
  var reader = new FileReader();
  reader.onload = function(ev) {
    try {
      var parsed = JSON.parse(ev.target.result);
      var cards  = parsed.collection || parsed;
      if (!Array.isArray(cards)) throw new Error('Format invalide');
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i];
        var found = null;
        for (var j = 0; j < collection.length; j++) {
          if (collection[j].name === c.name && collection[j].set === c.set) { found = collection[j]; break; }
        }
        if (found) found.qty += (c.qty || 1);
        else collection.push(Object.assign({}, c, { id: collection.length + 1 + '_' + Date.now() }));
      }
      save(); renderDash(); renderColl();
      toast('⬆️ ' + cards.length + ' cartes importées !');
    } catch(err) { toast('❌ ' + err.message, true); }
    e.target.value = '';
  };
  reader.readAsText(file);
}

// ═══════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════
function renderDash() {
  var tU = collection.length;
  var tQ = 0, tV = 0;
  for (var i = 0; i < collection.length; i++) { tQ += collection[i].qty; tV += collection[i].value * collection[i].qty; }
  var avgV = tQ ? tV / tQ : 0;
  var top  = collection.slice().sort(function(a,b){return b.value-a.value;})[0];

  document.getElementById('stats-grid').innerHTML =
    sc('🃏 Cartes uniques', tU, 'références') +
    sc('📦 Exemplaires',    tQ, 'au total') +
    sc('💶 Valeur totale',  tV.toFixed(0) + ' €', '~' + avgV.toFixed(2) + ' € / carte') +
    sc('⭐ Plus précieuse', top ? top.value.toFixed(2) + ' ' + (top.currency||'€') : '—', top ? esc(top.name) : 'Aucune');

  // Chart sets (valeur en €)
  var sm = {};
  for (var i = 0; i < collection.length; i++) sm[collection[i].set] = (sm[collection[i].set]||0) + collection[i].value * collection[i].qty;
  var sl = Object.keys(sm).slice(0,10);
  var sd = sl.map(function(k){return +sm[k].toFixed(2);});

  if (CH.sets) CH.sets.destroy();
  CH.sets = new Chart(document.getElementById('chart-sets').getContext('2d'), {
    type: 'bar',
    data: { labels: sl.length ? sl : ['Aucune donnée'], datasets:[{ data: sd.length ? sd : [0], backgroundColor:'rgba(255,203,5,.65)', borderColor:'#ffcb05', borderWidth:1, borderRadius:6 }] },
    options: { responsive:true, plugins:{legend:{display:false}}, scales:{ x:{ticks:{color:'#8892b0',font:{size:10},maxRotation:30},grid:{color:'#2a2f4a'}}, y:{ticks:{color:'#8892b0',callback:function(v){return v+'€';}},grid:{color:'#2a2f4a'}} } }
  });

  // Chart rarity
  var rc = [0,0,0,0,0];
  for (var i = 0; i < collection.length; i++) { var ri = parseInt(collection[i].rarity); if (ri >= 0 && ri <= 4) rc[ri] += collection[i].qty; }
  if (CH.rar) CH.rar.destroy();
  CH.rar = new Chart(document.getElementById('chart-rarity').getContext('2d'), {
    type: 'doughnut',
    data: { labels: RLBL, datasets:[{ data: rc, backgroundColor:['#444','#1a5a3a','#162050','#38104e','#4a2a06'], borderColor:'#161929', borderWidth:2 }] },
    options: { responsive:true, plugins:{legend:{labels:{color:'#8892b0',font:{size:11}}}} }
  });

  // Top 5
  var t5  = collection.slice().sort(function(a,b){return b.value-a.value;}).slice(0,5);
  var tel = document.getElementById('top-cards');
  if (!t5.length) { tel.innerHTML = '<div class="em" style="grid-column:1/-1"><div class="ei">🃏</div><p>Ajoutez des cartes !</p></div>'; return; }
  var html = '';
  for (var i = 0; i < t5.length; i++) html += cardHTML(t5[i], false);
  tel.innerHTML = html;
  var els = tel.querySelectorAll('.cc');
  for (var i = 0; i < els.length; i++) {
    (function(el, card){ el.onclick = function(){ openModal(card); }; })(els[i], t5[i]);
  }
}

function sc(lbl, val, sub) {
  return '<div class="sc"><div class="sl">'+lbl+'</div><div class="sv">'+val+'</div><div class="ss">'+sub+'</div></div>';
}

// ═══════════════════════════════════════════════
// COLLECTION
// ═══════════════════════════════════════════════
function renderColl() {
  var sets = ['Tous'];
  for (var i = 0; i < collection.length; i++) { if (sets.indexOf(collection[i].set) === -1) sets.push(collection[i].set); }
  if (sets.indexOf(filter) === -1) filter = 'Tous';
  window._sets = sets;

  var fb = document.getElementById('filter-bar');
  var fhtml = '';
  for (var i = 0; i < sets.length; i++) fhtml += '<button class="fbt' + (sets[i]===filter?' active':'') + '" onclick="setFilter('+i+',this)">' + esc(sets[i]) + '</button>';
  fb.innerHTML = fhtml;

  var filtered = filter === 'Tous' ? collection : collection.filter(function(c){return c.set===filter;});
  var grid = document.getElementById('coll-grid');
  if (!filtered.length) { grid.innerHTML = '<div class="em" style="grid-column:1/-1"><div class="ei">📦</div><p>Collection vide.<br>Recherchez ou ajoutez des cartes !</p></div>'; return; }

  var html = '';
  for (var i = 0; i < filtered.length; i++) html += cardHTML(filtered[i], true);
  grid.innerHTML = html;

  var els = grid.querySelectorAll('.cc');
  for (var i = 0; i < els.length; i++) {
    (function(el, card){ el.onclick = function(e){ if (e.target.classList.contains('bdel')) return; openModal(card); }; })(els[i], filtered[i]);
  }
}

function setFilter(idx, btn) {
  filter = window._sets[idx];
  var btns = document.querySelectorAll('.fbt');
  for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
  btn.classList.add('active');
  renderColl();
}

function cardHTML(c, showDel) {
  var ri  = parseInt(c.rarity) || 0;
  var cur = c.currency || '€';
  // Badge langue de la carte dans la collection
  var langFlag = { fr:'🇫🇷', en:'🇬🇧', jp:'🇯🇵' };
  var flag = c.lang ? (langFlag[c.lang] || '') : '';
  return '<div class="cc">' +
    (c.img ? '<img src="'+esc(c.img)+'" alt="'+esc(c.name)+'" loading="lazy">' : '<div class="cph">🃏</div>') +
    '<div class="bq">x'+c.qty+'</div>' +
    (flag ? '<div class="flag-badge">'+flag+'</div>' : '') +
    (showDel ? '<button class="bdel" onclick="removeCard(\''+c.id+'\')">✕</button>' : '') +
    '<div class="cbd">' +
      '<div class="cn">'+esc(c.name)+'</div>' +
      '<div class="cset">'+esc(c.set)+'</div>' +
      '<div class="cu">'+cur+' '+c.value.toFixed(c.value < 1000 ? 2 : 0)+' / unité</div>' +
      (c.qty > 1 ? '<div class="ctot">= '+(c.value*c.qty).toFixed(c.value < 1000 ? 2 : 0)+' '+cur+' total</div>' : '') +
      '<span class="rar '+RCLS[ri]+'">'+esc(c.rarityLabel)+'</span>' +
    '</div></div>';
}

// ═══════════════════════════════════════════════
// MODAL
// ═══════════════════════════════════════════════
function openModal(c) {
  closeModal();
  var ri  = parseInt(c.rarity) || 0;
  var cur = c.currency || '€';
  window._modalCard = c;
  var ov = document.createElement('div');
  ov.className = 'mo'; ov.id = 'modal';
  ov.innerHTML =
    '<div class="mb">'+
      '<div class="mh">'+
        (c.img ? '<img src="'+esc(c.img)+'" alt="'+esc(c.name)+'">' : '<div class="mhp">🃏</div>')+
        '<div>'+
          '<div class="mn">'+esc(c.name)+'</div>'+
          '<div class="ms">'+esc(c.set)+'</div>'+
          '<span class="rar '+RCLS[ri]+'">'+esc(c.rarityLabel)+'</span>'+
          '<div style="margin-top:6px;font-size:.75rem;color:var(--t2)">Condition : <span style="color:var(--t)">'+esc(c.condition)+'</span></div>'+
          '<div style="margin-top:4px;font-size:.75rem;color:var(--t2)">Devise : <span style="color:var(--a)">'+cur+'</span></div>'+
        '</div>'+
      '</div>'+
      '<div class="mbody">'+
        '<div class="mp">'+
          '<div class="mpb"><div class="mpl">Cote unitaire</div><div class="mpv" style="color:var(--g)">'+c.value.toFixed(2)+' '+cur+'</div></div>'+
          '<div class="mpb"><div class="mpl">Total ×'+c.qty+'</div><div class="mpv" style="color:var(--a)">'+(c.value*c.qty).toFixed(2)+' '+cur+'</div></div>'+
        '</div>'+
        '<div class="mer">'+
          '<label>Cote</label>'+
          '<input type="number" id="m-val" step="0.01" min="0" value="'+c.value+'">'+
          '<input type="number" id="m-qty" min="1" value="'+c.qty+'" style="width:68px">'+
        '</div>'+
        '<div class="ma">'+
          '<button class="btn" style="flex:1" onclick="applyModal()">💾 Enregistrer</button>'+
          '<button class="btn btn2" style="flex:1" onclick="closeModal()">Fermer</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  ov.onclick = function(e){ if (e.target === ov) closeModal(); };
  document.body.appendChild(ov);
}

function closeModal() { var m = document.getElementById('modal'); if (m) m.remove(); }

function applyModal() {
  var c = window._modalCard; if (!c) return;
  updateCard(c.id, parseFloat(document.getElementById('m-val').value), parseInt(document.getElementById('m-qty').value));
  closeModal();
}

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════
function mapRarity(r) {
  var s = (r||'').toLowerCase();
  if (s.indexOf('secret')>-1||s.indexOf('rainbow')>-1||s.indexOf('gold')>-1) return 4;
  if (s.indexOf('ultra')>-1||s.indexOf('vmax')>-1||s.indexOf('full art')>-1||s.indexOf(' ex')>-1||s.indexOf('gx')>-1) return 3;
  if (s.indexOf('holo')>-1||s.indexOf('rare')>-1) return 2;
  if (s.indexOf('uncommon')>-1) return 1;
  return 0;
}

function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function toast(msg, warn) {
  var t = document.createElement('div');
  t.className = 'toast' + (warn ? ' warn' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function(){ if (t.parentNode) t.parentNode.removeChild(t); }, 2700);
}

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
load();
if (!collection.length) {
  collection = [
    {id:'1',name:'Dracaufeu ex',  set:'Écarlate et Violet',rarity:3,rarityLabel:'Ultra Rare', qty:1,value:45.00, currency:'€',lang:'fr',condition:'Near Mint',img:'',addedAt:''},
    {id:'2',name:'Pikachu VMAX',  set:'Épée et Bouclier',  rarity:3,rarityLabel:'Ultra Rare', qty:2,value:28.50, currency:'€',lang:'fr',condition:'Mint',     img:'',addedAt:''},
    {id:'3',name:'Charizard ex',  set:'Scarlet & Violet',  rarity:3,rarityLabel:'Ultra Rare', qty:1,value:38.00, currency:'$',lang:'en',condition:'Near Mint',img:'',addedAt:''},
    {id:'4',name:'Mewtwo GX',     set:'Soleil et Lune',    rarity:2,rarityLabel:'Rare',        qty:1,value:12.00, currency:'€',lang:'fr',condition:'Excellent',img:'',addedAt:''},
    {id:'5',name:'Lugia V',       set:'Argent Tempête',    rarity:4,rarityLabel:'Secrète',     qty:1,value:120.00,currency:'€',lang:'fr',condition:'Mint',     img:'',addedAt:''}
  ];
  save();
}
renderDash();
renderColl();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(function(){});
}
