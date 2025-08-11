// === Modal na 3 brza klika DESNO od .page ===================================
(() => {
  const pageEl       = document.querySelector('.page');
  const welcomeModal = document.getElementById('welcomeModal');
  const closeBtn     = document.getElementById('closeWelcomeBtn');

  if (!pageEl || !welcomeModal) return;

  const NEED_CLICKS = 3;
  const GAP_MS = 500;
  let clicks = 0, lastTs = 0;

  function isRightOfPage(e) {
    const r = pageEl.getBoundingClientRect();
    return (e.clientX > r.right) && (e.clientY >= r.top && e.clientY <= r.bottom);
  }

  function openModal() {
    welcomeModal.style.display = 'flex';
    loadTodayState(); // povuci/popravi stanje na otvaranju
  }
  function closeModal() {
    welcomeModal.style.display = 'none';
  }

  document.addEventListener('click', (e) => {
    if (welcomeModal.style.display === 'flex') return;
    if (isRightOfPage(e)) {
      const now = performance.now();
      clicks = (now - lastTs <= GAP_MS) ? clicks + 1 : 1;
      lastTs = now;
      if (clicks >= NEED_CLICKS) {
        clicks = 0; lastTs = 0;
        openModal();
      }
    } else {
      clicks = 0; lastTs = 0;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && welcomeModal.style.display === 'flex') closeModal();
  });
  closeBtn?.addEventListener('click', closeModal);
})();

// === “Baza” + stanje po danu (API -> fallback localStorage) =================
const API_BASE = '/api/danasnje_pjesme'; // vidi Flask ispod; front fallbacka na LS
const todayISO = new Date().toISOString().slice(0,10); // YYYY-MM-DD
const LS_KEY   = 'dp_' + todayISO;

let state = {
  date: todayISO,
  total_secs: 0,     // koliko je “Današnje pjesme” ukupno
  listened_secs: 0,  // koliko je od toga odslušano
};
let lastDeltaStack = []; // za “Undo”

// DOM refs
const elRemaining = document.getElementById('todayRemaining');
const elListened  = document.getElementById('todayListened');
const totalInput  = document.getElementById('totalInput');
const setTotalBtn = document.getElementById('setTotalBtn');
const finishAllBtn= document.getElementById('finishAllBtn');
const customSec   = document.getElementById('customSec');
const addCustomBtn= document.getElementById('addCustomBtn');
const undoBtn     = document.getElementById('undoBtn');

function fmtSec(n){ n = Math.max(0, Math.floor(+n||0)); return n; }
function clampState(s){
  s.listened_secs = Math.max(0, Math.min(s.listened_secs, s.total_secs));
  return s;
}
function render(){
  const remaining = Math.max(0, state.total_secs - state.listened_secs);
  elRemaining.innerHTML = `${fmtSec(remaining)} <span>sek.</span>`;
  elListened.innerHTML  = `${fmtSec(state.listened_secs)} <span>sek.</span>`;
  totalInput.value = state.total_secs || '';
}

// --- Persistence helpers (API -> LS) ---
async function apiGet(dateISO){
  try{
    const r = await fetch(`${API_BASE}?date=${encodeURIComponent(dateISO)}`, {cache:'no-store'});
    if (!r.ok) throw 0;
    return await r.json();
  }catch{ return null; }
}
async function apiPost(body){
  try{
    const r = await fetch(API_BASE, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    if (!r.ok) throw 0;
    return await r.json();
  }catch{ return null; }
}
function lsLoad(){
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return null;
  try{ return JSON.parse(raw); } catch { return null; }
}
function lsSave(s){
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

async function loadTodayState(){
  // pokušaj API…
  const api = await apiGet(todayISO);
  if (api && api.success) {
    state = clampState({
      date: todayISO,
      total_secs: +api.total_secs || 0,
      listened_secs: +api.listened_secs || 0
    });
    lsSave(state); // sync to LS
    render();
    return;
  }
  // …fallback LS
  const ls = lsLoad();
  if (ls) state = clampState(ls);
  render();
}

async function saveTotal(newTotal){
  newTotal = Math.max(0, Math.floor(+newTotal||0));
  state.total_secs = newTotal;
  state = clampState(state);
  render();

  // pokušaj API, inače LS
  const res = await apiPost({date: todayISO, set_total_secs: newTotal});
  if (!(res && res.success)) lsSave(state);
}

async function addListened(delta){
  delta = Math.max(1, Math.floor(+delta||0));
  const before = {...state};
  state.listened_secs = Math.min(state.total_secs, state.listened_secs + delta);
  state = clampState(state);
  render();
  lastDeltaStack.push(delta);

  const res = await apiPost({date: todayISO, delta_listened_secs: delta});
  if (!(res && res.success)) lsSave(state);
}

async function undoLast(){
  const d = lastDeltaStack.pop();
  if (!d) return;
  state.listened_secs = Math.max(0, state.listened_secs - d);
  state = clampState(state);
  render();

  // pošalji negativni delta (backend snosi brigu o clampu)
  const res = await apiPost({date: todayISO, delta_listened_secs: -d});
  if (!(res && res.success)) lsSave(state);
}

async function finishAll(){
  const remaining = Math.max(0, state.total_secs - state.listened_secs);
  if (!remaining) return;
  lastDeltaStack.push(remaining);
  state.listened_secs = state.total_secs;
  render();

  // specifičan endpoint ili samo delta
  const res = await apiPost({date: todayISO, delta_listened_secs: remaining});
  if (!(res && res.success)) lsSave(state);
}

// Event listeners
setTotalBtn?.addEventListener('click', () => {
  saveTotal(totalInput.value);
});
finishAllBtn?.addEventListener('click', finishAll);
addCustomBtn?.addEventListener('click', () => {
  if (!customSec.value) return;
  addListened(customSec.value);
  customSec.value = '';
});
undoBtn?.addEventListener('click', undoLast);

// plus gumbi (+5, +10, +30, +60)
document.querySelectorAll('.pill-btn[data-sec]').forEach(btn=>{
  btn.addEventListener('click', () => addListened(btn.dataset.sec));
});

// inicijalni render (za slučaj da se modal otvori kasnije)
render();
