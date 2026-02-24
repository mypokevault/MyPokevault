'use strict';

const STORAGE_KEY = 'pokevault_v4';
let collection = [];
let charts = {};
let activeFilter = 'Tous';

function save(){
localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
}

function load(){
collection = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

function showView(id,btn){
document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
document.getElementById('view-'+id).classList.add('active');
if(btn) btn.classList.add('active');

if(id==='dashboard') renderDashboard();
if(id==='collection') renderCollection();
}

function doSearch(){
const q=document.getElementById('search-input').value.trim();
if(!q) return;

fetch('https://api.pokemontcg.io/v2/cards?q=name:'+encodeURIComponent(q)+'&pageSize=20')
.then(r=>r.json())
.then(data=>renderResults(data.data||[]))
.catch(()=>document.getElementById('search-results').innerHTML="Erreur API");
}

function renderResults(cards){
const el=document.getElementById('search-results');
el.innerHTML='';
cards.forEach(card=>{
const div=document.createElement('div');
div.className='card';
div.innerHTML="<img src="${card.images?.small||''}" width="100%"> <div>${card.name}</div> <button>Ajouter</button>";
div.querySelector('button').onclick=()=>addFromAPI(card);
el.appendChild(div);
});
}

function addFromAPI(card){
collection.push({
id:Date.now()+Math.random(),
name:card.name,
set:card.set?.name||'Inconnu',
value:0,
qty:1
});
save();
alert("Carte ajoutée");
}

function addManualCard(){
const name=document.getElementById('f-name').value.trim();
if(!name) return alert("Nom requis");

collection.push({
id:Date.now(),
name:name,
set:document.getElementById('f-set').value,
value:parseFloat(document.getElementById('f-value').value)||0,
qty:1
});
save();
renderCollection();
}

function renderCollection(){
const grid=document.getElementById('coll-grid');
grid.innerHTML='';
collection.forEach(c=>{
const div=document.createElement('div');
div.className='card';
div.innerHTML="<div>${c.name}</div> <div>${c.set}</div> <div>${c.value}€</div> <button>Supprimer</button>";
div.querySelector('button').onclick=()=>{
collection=collection.filter(x=>x.id!==c.id);
save();
renderCollection();
};
grid.appendChild(div);
});
}

function renderDashboard(){
const total=collection.reduce((s,c)=>s+c.value*c.qty,0);
document.getElementById('stats-grid').innerHTML="Valeur totale : "+total+" €";

if(typeof Chart==='undefined') return;

if(charts.sets) charts.sets.destroy();

const ctx=document.getElementById('chart-sets');
charts.sets=new Chart(ctx,{
type:'bar',
data:{
labels:['Total'],
datasets:[{data:[total]}]
}
});
}

function exportJSON(){
const blob=new Blob([JSON.stringify(collection)],{type:'application/json'});
const a=document.createElement('a');
a.href=URL.createObjectURL(blob);
a.download='collection.json';
a.click();
}

function importJSON(e){
const file=e.target.files[0];
const reader=new FileReader();
reader.onload=()=>{
collection=JSON.parse(reader.result);
save();
renderCollection();
};
reader.readAsText(file);
}

function init(){
load();
renderDashboard();
renderCollection();
}

window.onload=init;

// Service Worker
if('serviceWorker' in navigator){
navigator.serviceWorker.register('./sw.js');
}
