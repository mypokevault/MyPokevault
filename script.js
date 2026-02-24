// ═══════════════════════════════════════════════════════
// POKÉVAULT PRO — script.js
// ═══════════════════════════════════════════════════════
var KEY      = 'pokevault_pro_v1';
var KEY_HIST = 'pokevault_history_v1';
var LANG     = 'fr';
var RLBL     = ['Commune','Peu commune','Rare','Ultra Rare','Secrète'];
var RCLS     = ['rc0','rc1','rc2','rc3','rc4'];
var collection    = [];
var history7d     = []; // [{date, totalValue}]
var filter        = 'Tous';
var resaleFilter  = 'all';
var CH            = {};
window._pendingCards = [];
window._lastCards    = [];
window._modalCard    = null;
window._sets         = [];

// ═══════════════════════════════════════════════════════
// CONFIG LANGUES
// ═══════════════════════════════════════════════════════
var LANG_CONF = {
  fr: {
    info: '💶 Cotes Cardmarket Europe (€) — éditions françaises',
    currency: '€',
    placeholder: 'Ex : Dracaufeu, Pikachu VMAX, Mew…',
    getPrice: function(c) {
      var cm = c.cardmarket && c.cardmarket.prices;
      return { avg: (cm && cm.averageSellPrice)||0, low: (cm && cm.lowPrice)||0, trend: (cm && cm.trendPrice)||0 };
    }
  },
  en: {
    info: '💵 Prix TCGPlayer USA ($) — éditions anglaises',
    currency: '$',
    placeholder: 'Ex: Charizard, Pikachu VMAX, Mew…',
    getPrice: function(c) {
      var tcp = c.tcgplayer && c.tcgplayer.prices;
      var pr  = tcp && (tcp.holofoil || tcp.normal || tcp['1stEditionHolofoil'] || tcp.reverseHolofoil || tcp.unlimited) || null;
      return { avg: (pr && pr.market)||0, low: (pr && pr.low)||0, trend: (pr && pr.mid)||0 };
    }
  },
  jp: {
    info: '¥ Estimation marché japonais (×155 USD)',
    currency: '¥',
    placeholder: 'Ex: リザードン, ピカチュウ…',
    getPrice: function(c) {
      var tcp = c.tcgplayer && c.tcgplayer.prices;
      var pr  = tcp && (tcp.holofoil || tcp.normal) || null;
      return { avg: pr && pr.market ? Math.round(pr.market*155):0, low: pr && pr.low ? Math.round(pr.low*155):0, trend:0 };
    }
  }
};

// ═══════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(collection)); } catch(e) {}
}
function load() {
  try { var r = localStorage.getItem(KEY); collection = r ? JSON.parse(r) : []; } catch(e) { collection = []; }
}
function saveHistory() {
  try { localStorage.setItem(KEY_HIST, JSON.stringify(history7d)); } catch(e) {}
}
function loadHistory() {
  try { var r = localStorage.getItem(KEY_HIST); history7d = r ? JSON.parse(r) : []; } catch(e) { history7d = []; }
}

// ═══════════════════════════════════════════════════════
// HISTORIQUE 7 JOURS (snapshots quotidiens)
// ═══════════════════════════════════════════════════════
function snapshotToday() {
  var today = new Date().toISOString().slice(0,10);
  var total = collection.reduce(function(s,c){ return s + c.value * c.qty; }, 0);
  // Remplacer ou ajouter le snapshot du jour
  var idx = -1;
  for (var i = 0; i < history7d.length; i++) { if (history7d[i].date === today) { idx = i; break; } }
  if (idx >= 0) history7d[idx].total = total;
  else history7d.push({ date: today, total: total });
  // Garder seulement 7 jours
  history7d.sort(function(a,b){ return a.date.localeCompare(b.date); });
  if (history7d.length > 7) history7d = history7d.slice(history7d.length - 7);
  saveHistory();
}

// Générer des données simulées pour la démo 7 jours
function ensureHistory() {
  if (history7d.length >= 2) return;
  var total = collection.reduce(function(s,c){ return s + c.value * c.qty; }, 0);
  var base  = total * 0.88;
  history7d = [];
  for (var i = 6; i >= 0; i--) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    var noise = (Math.random() - 0.3) * total * 0.06;
    history7d.push({ date: d.toISOString().slice(0,10), total: Math.max(0, base + noise + (total - base) * ((6-i)/6)) });
  }
  // Dernier jour = valeur réelle
  history7d[history7d.length-1].total = total;
  saveHistory();
}

// Calcul variation
function getVariation7d() {
  if (history7d.length < 2) return null;
  var first = history7d[0].total;
  var last  = history7d[history7d.length-1].total;
  if (!first) return null;
  return { abs: last - first, pct: ((last - first) / first) * 100 };
}

// ═══════════════════════════════════════════════════════
// ALERTES
// ═══════════════════════════════════════════════════════
function computeAlerts() {
  var alerts = [];
  var sorted = collection.slice().sort(function(a,b){ return b.value - a.value; });
  var maxVal = sorted.length ? sorted[0].value : 0;

  collection.forEach(function(c) {
    var roi = getRoi(c);
    // Alerte SELL : ROI > 50% et statut pas SELL
    if (roi !== null && roi >= 50 && c.status !== 'sell') {
      alerts.push({ type:'up', name: c.name, msg: '📈 ROI +' + roi.toFixed(0) + '% — Bon moment pour vendre !' });
    }
    // Alerte perte : ROI < -20%
    if (roi !== null && roi <= -20) {
      alerts.push({ type:'down', name: c.name, msg: '📉 -' + Math.abs(roi).toFixed(0) + '% — En baisse par rapport au prix d\'achat' });
    }
    // Alerte record : carte la plus chère de la collection
    if (c.value === maxVal && c.value > 50) {
      alerts.push({ type:'record', name: c.name, msg: '⭐ Record — Carte la plus précieuse de votre collection (' + c.value.toFixed(2) + ' €)' });
    }
    // Alerte sous-évaluée : cote < prix achat mais statut SELL
    if (c.status === 'sell' && c.buyPrice && c.value < c.buyPrice) {
      alerts.push({ type:'down', name: c.name, msg: '⚠️ Statut SELL mais cote inférieure au prix d\'achat' });
    }
  });

  return alerts;
}

// ═══════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════
function showView(id) {
  var views = document.querySelectorAll('.view');
  for (var i=0; i<views.length; i++) views[i].classList.remove('active');
  var btns = document.querySelectorAll('.nb');
  for (var j=0; j<btns.length; j++) btns[j].classList.remove('active');
  document.getElementById('view-'+id).classList.add('active');
  document.getElementById('nav-'+id).classList.add('active');
  if (id === 'dashboard')  renderDash();
  if (id === 'collection') renderColl();
  if (id === 'resale')     renderResale();
}

// ═══════════════════════════════════════════════════════
// LANGUE
// ═══════════════════════════════════════════════════════
function setLang(l) {
  LANG = l;
  var langs = ['fr','en','jp'];
  for (var i=0; i<langs.length; i++) {
    var b = document.getElementById('lang-'+langs[i]);
    if (b) b.classList.toggle('active', langs[i]===l);
  }
  var info = document.getElementById('lang-info');
  if (info) info.textContent = LANG_CONF[l].info;
  var inp = document.getElementById('sinp');
  if (inp) inp.placeholder = LANG_CONF[l].placeholder;
  if (window._lastCards && window._lastCards.length) renderResults(window._lastCards);
}

// ═══════════════════════════════════════════════════════
// API RECHERCHE
// ═══════════════════════════════════════════════════════
function doSearch() {
  var q = document.getElementById('sinp').value.trim();
  if (!q) return;
  var el = document.getElementById('results');
  el.innerHTML = '<div class="ld"><div class="sp"></div><div>Recherche en cours…</div></div>';
  var langMap = { fr:'French', en:'English', jp:'Japanese' };
  var urlLang = 'https://api.pokemontcg.io/v2/cards?q=name:'+encodeURIComponent(q)+' language:'+encodeURIComponent(langMap[LANG]||'French')+'&pageSize=24&orderBy=-set.releaseDate';
  var urlAll  = 'https://api.pokemontcg.io/v2/cards?q=name:'+encodeURIComponent(q)+'&pageSize=24&orderBy=-set.releaseDate';
  fetch(urlLang)
    .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
    .then(function(json){
      var cards = json.data||[];
      if (cards.length > 0) { window._lastCards=cards; renderResults(cards); }
      else return fetch(urlAll).then(function(r2){return r2.json();}).then(function(j2){ window._lastCards=j2.data||[]; renderResults(window._lastCards); });
    })
    .catch(function(e){
      el.innerHTML='<div class="em"><div class="ei">⚠️</div><p>Impossible de joindre l\'API Pokémon TCG.<br>Vérifiez votre connexion ou utilisez la <strong>saisie manuelle</strong>.</p><p style="font-size:.74rem;color:var(--t2);margin-top:6px">'+esc(e.message)+'</p></div>';
    });
}

function renderResults(cards) {
  var el = document.getElementById('results');
  if (!cards||!cards.length) { el.innerHTML='<div class="em"><div class="ei">🃏</div><p>Aucune carte trouvée.</p></div>'; return; }
  var conf = LANG_CONF[LANG]||LANG_CONF.fr;
  var cur  = conf.currency;
  window._pendingCards = [];
  var html = '<div class="rg">';
  for (var i=0; i<cards.length; i++) {
    var c      = cards[i];
    var prices = conf.getPrice(c);
    var avg=prices.avg, low=prices.low, trend=prices.trend;
    var img    = (c.images&&c.images.small)||'';
    var idx    = window._pendingCards.length;
    window._pendingCards.push({card:c, price:avg, currency:cur, lang:LANG});
    var lb = c.language ? '<span class="lang-badge">'+esc(c.language)+'</span>' : '';
    html += '<div class="rc">';
    html += img ? '<img src="'+esc(img)+'" alt="'+esc(c.name)+'" loading="lazy">' : '<div class="rph">🃏</div>';
    html += '<button class="addb" onclick="addPending('+idx+')">+</button>';
    html += '<div class="rb"><div class="rn">'+esc(c.name)+' '+lb+'</div>';
    html += '<div class="rset">'+esc((c.set&&c.set.name)||'')+' · '+esc(c.rarity||'')+'</div>';
    html += '<div class="pr"><span class="pl">Cote '+cur+'</span><span class="pa">'+(avg ? fmt(avg,cur) : '—')+'</span></div>';
    if (low)   html += '<div class="pr"><span class="pl">📉 Min</span><span class="plo">'+fmt(low,cur)+'</span></div>';
    if (trend) html += '<div class="pr"><span class="pl">📈 Tendance</span><span class="ptr">'+fmt(trend,cur)+'</span></div>';
    html += '</div></div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

// ═══════════════════════════════════════════════════════
// AJOUTER
// ═══════════════════════════════════════════════════════
function addPending(idx) {
  var item = window._pendingCards[idx]; if (!item) return;
  var c  = item.card;
  var rk = mapRarity(c.rarity||'');
  openAddModal(c, item.price, item.currency, item.lang, rk);
}

// Modal d'ajout avec prix achat
function openAddModal(apiCard, suggestedPrice, cur, lang, rk) {
  closeModal();
  window._addCard = { apiCard: apiCard, rk: rk, cur: cur, lang: lang };
  var ov = document.createElement('div');
  ov.className='mo'; ov.id='modal';
  var img = (apiCard.images&&apiCard.images.small)||'';
  ov.innerHTML =
    '<div class="mb">'+
    '<div class="mh">'+
    (img?'<img src="'+esc(img)+'">':'<div class="mhp">🃏</div>')+
    '<div><div class="mn">'+esc(apiCard.name)+'</div>'+
    '<div class="ms">'+esc((apiCard.set&&apiCard.set.name)||'')+'</div>'+
    '<span class="rar '+RCLS[rk]+'">'+RLBL[rk]+'</span></div></div>'+
    '<div class="mbody">'+
    '<div class="fr" style="gap:10px;margin-bottom:12px">'+
    '<div class="fg"><label>Prix achat ('+cur+')</label><input type="number" id="add-buy" step="0.01" min="0" placeholder="0.00"></div>'+
    '<div class="fg"><label>Qté</label><input type="number" id="add-qty" min="1" value="1"></div>'+
    '</div>'+
    '<div class="fg" style="margin-bottom:12px"><label>Cote actuelle ('+cur+') — auto : '+fmt(suggestedPrice,cur)+'</label>'+
    '<input type="number" id="add-val" step="0.01" min="0" value="'+suggestedPrice.toFixed(2)+'"></div>'+
    '<div class="fg" style="margin-bottom:14px"><label>Statut revente</label>'+
    '<select id="add-status"><option value="watch">🔵 WATCH</option><option value="hold" selected>🟡 HOLD</option><option value="sell">🔴 SELL</option></select></div>'+
    '<div class="ma">'+
    '<button class="btn" style="flex:1" onclick="confirmAdd()">➕ Ajouter</button>'+
    '<button class="btn btn2" style="flex:1" onclick="closeModal()">Annuler</button>'+
    '</div></div></div>';
  ov.onclick = function(e){ if(e.target===ov) closeModal(); };
  document.body.appendChild(ov);
}

function confirmAdd() {
  var ac  = window._addCard; if (!ac) return;
  var c   = ac.apiCard;
  var buy = parseFloat(document.getElementById('add-buy').value)||0;
  var val = parseFloat(document.getElementById('add-val').value)||0;
  var qty = parseInt(document.getElementById('add-qty').value)||1;
  var st  = document.getElementById('add-status').value||'hold';
  pushCard({
    name: c.name, set: (c.set&&c.set.name)||'Inconnu',
    rarity: ac.rk, rarityLabel: RLBL[ac.rk],
    qty: qty, value: val, buyPrice: buy,
    currency: ac.cur, lang: ac.lang,
    status: st, condition: 'Near Mint',
    img: (c.images&&c.images.small)||''
  });
  closeModal();
}

function addManual() {
  var name = document.getElementById('f-name').value.trim();
  if (!name) { toast('⚠️ Le nom est obligatoire',true); return; }
  var ri  = parseInt(document.getElementById('f-rarity').value);
  var buy = parseFloat(document.getElementById('f-buy').value)||0;
  var val = parseFloat(document.getElementById('f-value').value)||buy;
  pushCard({
    name: name, set: document.getElementById('f-set').value.trim()||'Inconnu',
    rarity: ri, rarityLabel: RLBL[ri],
    qty: Math.max(1,parseInt(document.getElementById('f-qty').value)||1),
    value: val, buyPrice: buy,
    currency: '€', lang: 'fr',
    status: document.getElementById('f-status').value||'hold',
    condition: document.getElementById('f-cond').value,
    img: document.getElementById('f-img').value.trim()
  });
  ['f-name','f-set','f-img','f-buy','f-value'].forEach(function(id){ document.getElementById(id).value=''; });
  document.getElementById('f-qty').value='1';
}

function pushCard(card) {
  var found=null;
  for (var i=0; i<collection.length; i++) {
    if (collection[i].name===card.name && collection[i].set===card.set) { found=collection[i]; break; }
  }
  if (found) { found.qty += card.qty; }
  else {
    collection.push({
      id: collection.length+1+'_'+Date.now(), addedAt: new Date().toISOString(),
      name:card.name, set:card.set, rarity:card.rarity, rarityLabel:card.rarityLabel,
      qty:card.qty, value:card.value, buyPrice:card.buyPrice||0,
      currency:card.currency||'€', lang:card.lang||'fr',
      status:card.status||'hold', condition:card.condition, img:card.img
    });
  }
  save(); snapshotToday(); ensureHistory();
  toast('✅ '+card.name+' ajouté !');
}

function removeCard(id) {
  collection = collection.filter(function(c){ return String(c.id)!==String(id); });
  save(); snapshotToday(); renderColl(); renderDash();
  toast('🗑️ Supprimé');
}

function updateCard(id, val, qty, buy, status) {
  for (var i=0; i<collection.length; i++) {
    if (String(collection[i].id)===String(id)) {
      if (!isNaN(val)  && val>=0)  collection[i].value    = val;
      if (!isNaN(qty)  && qty>=1)  collection[i].qty      = qty;
      if (!isNaN(buy)  && buy>=0)  collection[i].buyPrice = buy;
      if (status)                  collection[i].status   = status;
      break;
    }
  }
  save(); snapshotToday(); renderColl(); renderDash(); renderResale();
  toast('💾 Mise à jour !');
}

// ═══════════════════════════════════════════════════════
// EXPORT / IMPORT
// ═══════════════════════════════════════════════════════
function exportJSON() {
  var data = JSON.stringify({version:2, exportedAt:new Date().toISOString(), collection:collection}, null, 2);
  var blob = new Blob([data],{type:'application/json'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href=url; a.download='pokevault_'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('⬇️ Exporté !');
}

function importJSON(e) {
  var file=e.target.files[0]; if(!file) return;
  var reader=new FileReader();
  reader.onload=function(ev){
    try {
      var parsed=JSON.parse(ev.target.result);
      var cards=parsed.collection||parsed;
      if (!Array.isArray(cards)) throw new Error('Format invalide');
      for (var i=0; i<cards.length; i++) {
        var c=cards[i];
        var found=null;
        for (var j=0; j<collection.length; j++) { if(collection[j].name===c.name&&collection[j].set===c.set){found=collection[j];break;} }
        if (found) found.qty+=(c.qty||1);
        else collection.push(Object.assign({},c,{id:collection.length+1+'_'+Date.now(), buyPrice:c.buyPrice||0, status:c.status||'hold'}));
      }
      save(); snapshotToday(); ensureHistory(); renderDash(); renderColl(); renderResale();
      toast('⬆️ '+cards.length+' cartes importées !');
    } catch(err){ toast('❌ '+err.message,true); }
    e.target.value='';
  };
  reader.readAsText(file);
}

// ═══════════════════════════════════════════════════════
// DASHBOARD PRO
// ═══════════════════════════════════════════════════════
function renderDash() {
  snapshotToday();
  ensureHistory();

  var tU=collection.length;
  var tQ=0, tV=0, tBuy=0;
  for (var i=0; i<collection.length; i++) { tQ+=collection[i].qty; tV+=collection[i].value*collection[i].qty; tBuy+=(collection[i].buyPrice||0)*collection[i].qty; }
  var profit = tV - tBuy;
  var var7   = getVariation7d();
  var alerts = computeAlerts();

  // KPI
  var varHtml = '';
  if (var7) {
    var cls  = var7.pct >= 0 ? 'green' : 'red';
    var sign = var7.pct >= 0 ? '+' : '';
    varHtml  = '<div class="sc '+cls+'"><div class="sl">📈 Variation 7j</div><div class="sv '+cls+'">'+sign+var7.pct.toFixed(1)+'%</div><div class="ss">'+sign+var7.abs.toFixed(2)+' €</div></div>';
  }

  var profitCls = profit >= 0 ? 'green' : 'red';
  document.getElementById('stats-grid').innerHTML =
    sc('🃏 Cartes', tU, tQ+' exemplaires') +
    sc('💶 Valeur totale', tV.toFixed(0)+' €', '~'+(tQ?tV/tQ:0).toFixed(2)+' € / carte') +
    sc('💸 Investi', tBuy.toFixed(0)+' €', 'prix achat total') +
    '<div class="sc '+profitCls+'"><div class="sl">💰 Bénéfice potentiel</div><div class="sv '+profitCls+'">'+(profit>=0?'+':'')+profit.toFixed(0)+' €</div><div class="ss">ROI global '+(tBuy?(profit/tBuy*100).toFixed(1):0)+'%</div></div>' +
    (varHtml || sc('📈 Variation 7j', '—', 'données insuffisantes')) +
    sc('⚡ Alertes', alerts.length, alerts.length ? 'action recommandée' : 'tout va bien');

  // Badge alertes
  var ac = document.getElementById('alert-count');
  if (ac) ac.textContent = alerts.length;

  // Variation bar
  var vb = document.getElementById('variation-bar');
  if (vb && var7) {
    var sign = var7.pct>=0?'+':'';
    var cls2 = var7.pct>=0?'vbar-pos':'vbar-neg';
    vb.innerHTML =
      '<span class="vbar-lbl">📊 Performance 7 jours</span>'+
      '<span class="vbar-sep"></span>'+
      '<span class="vbar-lbl">Variation :</span> <span class="vbar-val '+cls2+'">'+sign+var7.pct.toFixed(2)+'%</span>'+
      '<span class="vbar-sep"></span>'+
      '<span class="vbar-lbl">En valeur :</span> <span class="vbar-val '+cls2+'">'+sign+var7.abs.toFixed(2)+' €</span>'+
      '<span class="vbar-sep"></span>'+
      '<span class="vbar-lbl">Début :</span> <span class="vbar-val vbar-neu">'+history7d[0].total.toFixed(2)+' €</span>'+
      '<span class="vbar-sep"></span>'+
      '<span class="vbar-lbl">Aujourd\'hui :</span> <span class="vbar-val vbar-neu">'+history7d[history7d.length-1].total.toFixed(2)+' €</span>';
    vb.style.display='flex';
  } else if (vb) { vb.style.display='none'; }

  // Chart historique 7j
  var labels7 = history7d.map(function(h){ var d=new Date(h.date); return (d.getDate())+'/'+(d.getMonth()+1); });
  var data7   = history7d.map(function(h){ return +h.total.toFixed(2); });
  if (CH.hist) CH.hist.destroy();
  CH.hist = new Chart(document.getElementById('chart-history').getContext('2d'),{
    type:'line',
    data:{ labels:labels7.length?labels7:['—'], datasets:[{
      data:data7.length?data7:[0],
      borderColor:tV>=tBuy?'#4ecca3':'#e53935', backgroundColor:tV>=tBuy?'rgba(78,204,163,.1)':'rgba(229,57,53,.1)',
      borderWidth:2, fill:true, tension:.4, pointBackgroundColor:tV>=tBuy?'#4ecca3':'#e53935', pointRadius:4
    }]},
    options:{ responsive:true, plugins:{legend:{display:false}},
      scales:{ x:{ticks:{color:'#8892b0',font:{size:10}},grid:{color:'#2a2f4a'}}, y:{ticks:{color:'#8892b0',callback:function(v){return v+'€';}},grid:{color:'#2a2f4a'}} } }
  });

  // Chart sets
  var sm={};
  for (var i=0; i<collection.length; i++) sm[collection[i].set]=(sm[collection[i].set]||0)+collection[i].value*collection[i].qty;
  var sl=Object.keys(sm).slice(0,8), sd=sl.map(function(k){return +sm[k].toFixed(2);});
  if (CH.sets) CH.sets.destroy();
  CH.sets = new Chart(document.getElementById('chart-sets').getContext('2d'),{
    type:'bar',
    data:{labels:sl.length?sl:['Aucune donnée'],datasets:[{data:sd.length?sd:[0],backgroundColor:'rgba(255,203,5,.65)',borderColor:'#ffcb05',borderWidth:1,borderRadius:6}]},
    options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#8892b0',font:{size:10},maxRotation:35},grid:{color:'#2a2f4a'}},y:{ticks:{color:'#8892b0',callback:function(v){return v+'€';}},grid:{color:'#2a2f4a'}}}}
  });

  // Chart rarity
  var rc=[0,0,0,0,0];
  for (var i=0; i<collection.length; i++) { var ri=parseInt(collection[i].rarity); if(ri>=0&&ri<=4) rc[ri]+=collection[i].qty; }
  if (CH.rar) CH.rar.destroy();
  CH.rar = new Chart(document.getElementById('chart-rarity').getContext('2d'),{
    type:'doughnut',
    data:{labels:RLBL,datasets:[{data:rc,backgroundColor:['#444','#1a5a3a','#162050','#38104e','#4a2a06'],borderColor:'#161929',borderWidth:2}]},
    options:{responsive:true,plugins:{legend:{labels:{color:'#8892b0',font:{size:10}}}}}
  });

  // Chart status (revente)
  var ss={sell:0,hold:0,watch:0};
  for (var i=0; i<collection.length; i++) { var st=collection[i].status||'hold'; ss[st]=(ss[st]||0)+1; }
  if (CH.st) CH.st.destroy();
  CH.st = new Chart(document.getElementById('chart-status').getContext('2d'),{
    type:'doughnut',
    data:{labels:['🔴 SELL','🟡 HOLD','🔵 WATCH'],datasets:[{data:[ss.sell,ss.hold,ss.watch],backgroundColor:['rgba(229,57,53,.7)','rgba(245,158,11,.7)','rgba(59,130,246,.7)'],borderColor:'#161929',borderWidth:2}]},
    options:{responsive:true,plugins:{legend:{labels:{color:'#8892b0',font:{size:11}}}}}
  });

  // Top 5
  var t5 = collection.slice().sort(function(a,b){return b.value-a.value;}).slice(0,5);
  var tel = document.getElementById('top-cards');
  if (!t5.length) { tel.innerHTML='<div class="em"><div class="ei">🃏</div><p>Ajoutez des cartes !</p></div>'; }
  else {
    var html='';
    for (var i=0; i<t5.length; i++) {
      var c=t5[i]; var cur=c.currency||'€';
      html+='<div class="top-card-row" data-idx="'+i+'">';
      html+='<div class="top-rank">'+(i+1)+'</div>';
      html+=c.img?'<img class="top-img" src="'+esc(c.img)+'">':'<div class="top-img-ph">🃏</div>';
      html+='<div class="top-info"><div class="top-name">'+esc(c.name)+'</div>';
      html+='<div class="top-set">'+esc(c.set)+'</div>';
      html+='<span class="status-pill status-'+( c.status||'hold')+'">'+( c.status||'HOLD').toUpperCase()+'</span></div>';
      html+='<div class="top-val">'+fmt(c.value,cur)+'</div></div>';
    }
    tel.innerHTML=html;
    tel.querySelectorAll('.top-card-row').forEach(function(el){
      el.onclick=function(){ openModal(t5[parseInt(this.getAttribute('data-idx'))]); };
    });
  }

  // Alertes
  var al = document.getElementById('alerts-list');
  if (!alerts.length) { al.innerHTML='<div class="no-alerts">✅ Aucune alerte — collection saine</div>'; }
  else {
    var ahtml='';
    alerts.slice(0,6).forEach(function(a){
      ahtml+='<div class="alert-item alert-'+a.type+'"><div class="alert-name">'+esc(a.name)+'</div><div class="alert-msg">'+a.msg+'</div></div>';
    });
    al.innerHTML=ahtml;
  }
}

function sc(lbl,val,sub,cls){ return '<div class="sc'+(cls?' '+cls:'')+'"><div class="sl">'+lbl+'</div><div class="sv">'+val+'</div><div class="ss">'+sub+'</div></div>'; }

// ═══════════════════════════════════════════════════════
// COLLECTION
// ═══════════════════════════════════════════════════════
function renderColl() {
  var sets=['Tous'];
  for (var i=0; i<collection.length; i++) { if(sets.indexOf(collection[i].set)===-1) sets.push(collection[i].set); }
  if (sets.indexOf(filter)===-1) filter='Tous';
  window._sets=sets;

  var fb=document.getElementById('filter-bar');
  var fhtml='';
  for (var i=0; i<sets.length; i++) fhtml+='<button class="fbt'+(sets[i]===filter?' active':'')+'" onclick="setFilter('+i+',this)">'+esc(sets[i])+'</button>';
  fb.innerHTML=fhtml;

  var filtered=filter==='Tous'?collection:collection.filter(function(c){return c.set===filter;});
  var grid=document.getElementById('coll-grid');
  if (!filtered.length) { grid.innerHTML='<div class="em" style="grid-column:1/-1"><div class="ei">📦</div><p>Collection vide.<br>Recherchez ou ajoutez des cartes !</p></div>'; return; }

  var html='';
  for (var i=0; i<filtered.length; i++) html+=cardHTML(filtered[i],true);
  grid.innerHTML=html;

  var els=grid.querySelectorAll('.cc');
  for (var i=0; i<els.length; i++) {
    (function(el,card){ el.onclick=function(e){ if(e.target.classList.contains('bdel')) return; openModal(card); }; })(els[i],filtered[i]);
  }
}

function setFilter(idx,btn) {
  filter=window._sets[idx];
  document.querySelectorAll('.fbt').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  renderColl();
}

function cardHTML(c,showDel) {
  var ri=parseInt(c.rarity)||0;
  var cur=c.currency||'€';
  var roi=getRoi(c);
  var roiHtml='';
  if (roi!==null) {
    var rcls=roi>=0?'roi-pos':'roi-neg';
    roiHtml='<div style="font-size:.7rem;margin-top:3px"><span class="'+rcls+'" style="font-weight:800">'+(roi>=0?'+':'')+roi.toFixed(0)+'% ROI</span></div>';
  }
  var flags={fr:'🇫🇷',en:'🇬🇧',jp:'🇯🇵'};
  var flag=c.lang?(flags[c.lang]||''):'';
  return '<div class="cc">'+
    (c.img?'<img src="'+esc(c.img)+'" loading="lazy">':'<div class="cph">🃏</div>')+
    '<div class="bq">x'+c.qty+'</div>'+
    (flag?'<div class="flag-badge">'+flag+'</div>':'')+
    (showDel?'<button class="bdel" onclick="removeCard(\''+c.id+'\')">✕</button>':'')+
    '<div class="cbd"><div class="cn">'+esc(c.name)+'</div>'+
    '<div class="cset">'+esc(c.set)+'</div>'+
    '<div class="cu">'+fmt(c.value,cur)+' / unité</div>'+
    (c.qty>1?'<div class="ctot">= '+fmt(c.value*c.qty,cur)+' total</div>':'')+
    roiHtml+
    '<div style="margin-top:4px;display:flex;align-items:center;justify-content:space-between">'+
    '<span class="rar '+RCLS[ri]+'">'+esc(c.rarityLabel)+'</span>'+
    '<span class="status-pill status-'+(c.status||'hold')+'">'+(c.status||'hold').toUpperCase()+'</span>'+
    '</div></div></div>';
}

// ═══════════════════════════════════════════════════════
// REVENTE PRO
// ═══════════════════════════════════════════════════════
function setResaleFilter(f, btn) {
  resaleFilter = f;
  document.querySelectorAll('.stat-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  renderResale();
}

function getRoi(c) {
  if (!c.buyPrice || c.buyPrice === 0) return null;
  return ((c.value - c.buyPrice) / c.buyPrice) * 100;
}

function renderResale() {
  // Stats revente
  var invested=0, currentVal=0, toSell=0, toSellBen=0;
  collection.forEach(function(c){
    invested   += (c.buyPrice||0) * c.qty;
    currentVal += c.value * c.qty;
    if (c.status==='sell') { toSell++; toSellBen += (c.value-(c.buyPrice||0)) * c.qty; }
  });
  var profit = currentVal - invested;
  var roi    = invested ? (profit/invested*100) : 0;
  var profitCls = profit>=0?'green':'red';
  var roiCls    = roi>=0?'green':'red';

  document.getElementById('resale-stats').innerHTML =
    sc('💸 Total investi', invested.toFixed(0)+' €', 'prix d\'achat cumulé') +
    sc('💶 Valeur actuelle', currentVal.toFixed(0)+' €', 'cotes actuelles') +
    '<div class="sc '+profitCls+'"><div class="sl">💰 Bénéfice potentiel</div><div class="sv '+profitCls+'">'+(profit>=0?'+':'')+profit.toFixed(0)+' €</div><div class="ss">'+(roi>=0?'+':'')+roi.toFixed(1)+'% ROI global</div></div>'+
    sc('🔴 À vendre', toSell+' carte'+(toSell>1?'s':''), toSell?(toSellBen>=0?'+':'')+toSellBen.toFixed(0)+' € bénéfice estimé':'Aucune marquée SELL');

  // Liste
  var filtered = resaleFilter==='all' ? collection : collection.filter(function(c){ return (c.status||'hold')===resaleFilter; });
  filtered = filtered.slice().sort(function(a,b){
    var ra=getRoi(a)||0, rb=getRoi(b)||0;
    return rb - ra;
  });

  var grid = document.getElementById('resale-grid');
  if (!filtered.length) { grid.innerHTML='<div class="em"><div class="ei">💰</div><p>Aucune carte dans ce statut.</p></div>'; return; }

  var html='';
  filtered.forEach(function(c){
    var cur  = c.currency||'€';
    var roi  = getRoi(c);
    var roiCls  = roi===null?'roi-neu':(roi>=0?'roi-pos':'roi-neg');
    var roiText = roi===null?'—':(roi>=0?'+':'')+roi.toFixed(1)+'%';
    var benefit = c.buyPrice ? (c.value - c.buyPrice) * c.qty : null;

    html += '<div class="resale-card" data-id="'+c.id+'">';
    html += c.img ? '<img src="'+esc(c.img)+'" loading="lazy">' : '<div class="resale-img-ph">🃏</div>';
    html += '<div class="resale-info">';
    html += '<div class="resale-name">'+esc(c.name)+'</div>';
    html += '<div class="resale-set">'+esc(c.set)+' × '+c.qty+'</div>';
    html += '<div class="resale-prices">';
    html += '<div class="resale-price-item"><span class="rpi-lbl">Achat</span><span class="rpi-val">'+(c.buyPrice?fmt(c.buyPrice,cur):'—')+'</span></div>';
    html += '<div class="resale-price-item"><span class="rpi-lbl">Actuel</span><span class="rpi-val" style="color:var(--g)">'+fmt(c.value,cur)+'</span></div>';
    if (benefit!==null) html += '<div class="resale-price-item"><span class="rpi-lbl">Bénéfice</span><span class="rpi-val" style="color:'+(benefit>=0?'var(--g)':'var(--r)')+'">'+(benefit>=0?'+':'')+fmt(benefit,cur)+'</span></div>';
    html += '</div>';
    html += '<div style="margin-top:5px"><span class="status-pill status-'+(c.status||'hold')+'">'+(c.status||'hold').toUpperCase()+'</span></div>';
    html += '</div>';
    html += '<div class="resale-right">';
    html += '<div class="roi-val '+roiCls+'">'+roiText+'</div>';
    html += '<div style="font-size:.68rem;color:var(--t2)">ROI</div>';
    html += '</div>';
    html += '</div>';
  });

  grid.innerHTML=html;
  grid.querySelectorAll('.resale-card').forEach(function(el){
    el.onclick=function(){ var c=collection.find(function(x){return String(x.id)===String(el.getAttribute('data-id'));}); if(c) openModal(c); };
  });
}

// ═══════════════════════════════════════════════════════
// MODAL DÉTAIL + ÉDITION
// ═══════════════════════════════════════════════════════
function openModal(c) {
  closeModal();
  var ri  = parseInt(c.rarity)||0;
  var cur = c.currency||'€';
  var roi = getRoi(c);
  var benefit = c.buyPrice ? (c.value-c.buyPrice)*c.qty : null;
  window._modalCard = c;

  var ov=document.createElement('div'); ov.className='mo'; ov.id='modal';
  ov.innerHTML=
    '<div class="mb">'+
    '<div class="mh">'+
    (c.img?'<img src="'+esc(c.img)+'">':'<div class="mhp">🃏</div>')+
    '<div>'+
    '<div class="mn">'+esc(c.name)+'</div>'+
    '<div class="ms">'+esc(c.set)+'</div>'+
    '<span class="rar '+RCLS[ri]+'">'+esc(c.rarityLabel)+'</span>'+
    '<div style="margin-top:6px;font-size:.73rem;color:var(--t2)">Condition : <span style="color:var(--t)">'+esc(c.condition)+'</span></div>'+
    '<div style="margin-top:3px;font-size:.73rem"><span class="status-pill status-'+(c.status||'hold')+'">'+(c.status||'hold').toUpperCase()+'</span></div>'+
    '</div></div>'+
    '<div class="mbody">'+
    // Prix
    '<div class="mp">'+
    '<div class="mpb"><div class="mpl">Prix achat</div><div class="mpv" style="color:var(--t2)">'+(c.buyPrice?fmt(c.buyPrice,cur):'—')+'</div></div>'+
    '<div class="mpb"><div class="mpl">Cote actuelle</div><div class="mpv" style="color:var(--g)">'+fmt(c.value,cur)+'</div></div>'+
    '<div class="mpb"><div class="mpl">Total ×'+c.qty+'</div><div class="mpv" style="color:var(--a)">'+fmt(c.value*c.qty,cur)+'</div></div>'+
    '</div>'+
    // ROI box
    (benefit!==null?
    '<div class="roi-box">'+
    '<div><div class="roi-box-lbl">ROI</div><div class="roi-box-lbl" style="margin-top:2px">Bénéfice ×'+c.qty+'</div></div>'+
    '<div>'+
    '<div class="roi-box-val '+(roi>=0?'roi-pos':'roi-neg')+'">'+(roi>=0?'+':'')+roi.toFixed(1)+'%</div>'+
    '<div style="font-size:.8rem;font-weight:700;color:'+(benefit>=0?'var(--g)':'var(--r)')+'">'+(benefit>=0?'+':'')+fmt(benefit,cur)+'</div>'+
    '</div></div>':'') +
    // Édition
    '<div class="mer">'+
    '<div><label>Achat '+cur+'</label><input type="number" id="m-buy" step="0.01" min="0" value="'+(c.buyPrice||0)+'"></div>'+
    '<div><label>Cote '+cur+'</label><input type="number" id="m-val" step="0.01" min="0" value="'+c.value+'"></div>'+
    '<div><label>Qté</label><input type="number" id="m-qty" min="1" value="'+c.qty+'"></div>'+
    '</div>'+
    '<div class="mer-status"><label>Statut revente</label>'+
    '<select id="m-status">'+
    '<option value="watch"'+(c.status==='watch'?' selected':'')+'>🔵 WATCH — Observer</option>'+
    '<option value="hold"'+((!c.status||c.status==='hold')?' selected':'')+'>🟡 HOLD — Conserver</option>'+
    '<option value="sell"'+(c.status==='sell'?' selected':'')+'>🔴 SELL — Vendre</option>'+
    '</select></div>'+
    '<div class="ma">'+
    '<button class="btn" style="flex:1" onclick="applyModal()">💾 Enregistrer</button>'+
    '<button class="btn btn2" style="flex:1" onclick="closeModal()">Fermer</button>'+
    '</div></div></div>';

  ov.onclick=function(e){ if(e.target===ov) closeModal(); };
  document.body.appendChild(ov);
}

function closeModal() { var m=document.getElementById('modal'); if(m) m.remove(); }

function applyModal() {
  var c=window._modalCard; if(!c) return;
  updateCard(
    c.id,
    parseFloat(document.getElementById('m-val').value),
    parseInt(document.getElementById('m-qty').value),
    parseFloat(document.getElementById('m-buy').value),
    document.getElementById('m-status').value
  );
  closeModal();
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
function fmt(val, cur) {
  if (!val && val!==0) return '—';
  cur = cur||'€';
  var n = Number(val);
  if (cur==='¥') return Math.round(n)+' ¥';
  return n.toFixed(2)+' '+cur;
}

function mapRarity(r) {
  var s=(r||'').toLowerCase();
  if (s.indexOf('secret')>-1||s.indexOf('rainbow')>-1||s.indexOf('gold')>-1) return 4;
  if (s.indexOf('ultra')>-1||s.indexOf('vmax')>-1||s.indexOf('full art')>-1||s.indexOf(' ex')>-1||s.indexOf('gx')>-1) return 3;
  if (s.indexOf('holo')>-1||s.indexOf('rare')>-1) return 2;
  if (s.indexOf('uncommon')>-1) return 1;
  return 0;
}

function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function toast(msg,warn) {
  var t=document.createElement('div');
  t.className='toast'+(warn?' warn':''); t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); },2700);
}

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
load();
loadHistory();

if (!collection.length) {
  collection = [
    {id:'1',name:'Dracaufeu ex',    set:'Écarlate et Violet',rarity:3,rarityLabel:'Ultra Rare', qty:1,value:45.00, buyPrice:28.00, currency:'€',lang:'fr',status:'hold',condition:'Near Mint',img:'',addedAt:''},
    {id:'2',name:'Pikachu VMAX',    set:'Épée et Bouclier',  rarity:3,rarityLabel:'Ultra Rare', qty:2,value:28.50, buyPrice:15.00, currency:'€',lang:'fr',status:'sell',condition:'Mint',     img:'',addedAt:''},
    {id:'3',name:'Charizard ex',    set:'Scarlet & Violet',  rarity:3,rarityLabel:'Ultra Rare', qty:1,value:38.00, buyPrice:40.00, currency:'$',lang:'en',status:'watch',condition:'Near Mint',img:'',addedAt:''},
    {id:'4',name:'Mewtwo GX',       set:'Soleil et Lune',    rarity:2,rarityLabel:'Rare',        qty:1,value:12.00, buyPrice:8.00,  currency:'€',lang:'fr',status:'hold',condition:'Excellent',img:'',addedAt:''},
    {id:'5',name:'Lugia V',         set:'Argent Tempête',    rarity:4,rarityLabel:'Secrète',     qty:1,value:120.00,buyPrice:75.00, currency:'€',lang:'fr',status:'sell',condition:'Mint',     img:'',addedAt:''},
    {id:'6',name:'Ronflex',         set:'Écarlate et Violet',rarity:0,rarityLabel:'Commune',     qty:4,value:0.50,  buyPrice:0.10,  currency:'€',lang:'fr',status:'watch',condition:'Bon état', img:'',addedAt:''}
  ];
  save();
}

snapshotToday();
ensureHistory();
renderDash();
renderColl();
renderResale();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(function(){});
}
