
// === Welcome modal: današnje pjesme / odslušane pjesme ======================
(() => {
  const SCALE = 10; // radimo u "decisekundama"
  const todayISO = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const todayHR  = new Date().toLocaleDateString("hr-HR");

  // UI refs
  const modalEl      = document.getElementById('welcomeModal');
  const closeBtn     = document.getElementById('closeWelcomeBtn');
  const totalEl      = document.getElementById('welcomeTotalInfo');     // lijevo gore
  const listenedEl   = document.getElementById('welcomeListenedInfo');  // desno gore
  const finishBtn    = document.getElementById('btnFinish');
  const finishRemainingEl = document.getElementById('finishRemaining'); // 🔧 DODANO

  // kontrole (desno dolje)
  const btnPlus5     = document.getElementById('btnPlus5');
  const btnPlus10    = document.getElementById('btnPlus10');
  const btnPlus15    = document.getElementById('btnPlus30'); // id ostao, ali je label "+15s"
  const btnPlus20    = document.getElementById('btnPlus60'); // id ostao, ali je label "+20s"

  // lokalno stanje (u decisekundama)
  const state = { date: todayISO, total_ds: 0, listened_ds: 0 };

  // Helpers
  const fmtSec = (ds) => (ds / SCALE).toFixed(1); // X.X
  const remaining_ds = () => Math.max(0, state.total_ds - state.listened_ds);

  function render() {
    const rem = remaining_ds();
    // zadrži mali "sek." span
    if (totalEl)    totalEl.innerHTML    = `${fmtSec(state.total_ds)}<span> sek.</span>`;
    if (listenedEl) listenedEl.innerHTML = `${fmtSec(state.listened_ds)}<span> sek.</span>`;
    if (finishRemainingEl) finishRemainingEl.textContent = `${fmtSec(rem)} sekundi`;
    if (finishBtn) finishBtn.disabled = rem <= 0;
  }

  async function refreshFromDB() {
    try {
      const res = await fetch(`/api/danasnje_pjesme?date=${encodeURIComponent(state.date)}`, { cache: 'no-store' });
      const json = await res.json();
      if (json?.success) {
        state.total_ds    = Number(json.total_secs)    || 0; // backend vraća int (držimo ga kao decisekunde)
        state.listened_ds = Number(json.listened_secs) || 0;
        render();
      }
    } catch (e) {
      console.error('refreshFromDB error:', e);
    }
  }

  // dohvat total-a (u sekundama) pa postavi u našu tablicu
  async function dohvatOtkazanihNarudzbiZaWelcome() {
    try {
      const response = await fetch("/api/otkazane_narudzbe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_date: todayHR, to_date: todayHR })
      });
      const data = await response.json();

      // robustno parsiranje (podrži "10,7" i broj)
      const secsRaw = data?.total;
      const secs = typeof secsRaw === 'number'
        ? secsRaw
        : parseFloat(String(secsRaw).replace(',', '.')) || 0;

      await fetch('/api/danasnje_pjesme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: state.date,
          set_total_secs: Math.round(secs * SCALE) // spremamo u decisekundama
        })
      });

      await refreshFromDB();
    } catch (err) {
      console.error('dohvatOtkazanihNarudzbiZaWelcome error:', err);
    }
  }

  async function addListenedSeconds(deltaSecs) {
    const delta_ds = Math.round(Number(deltaSecs || 0) * SCALE);
    if (!delta_ds) return;
    await fetch('/api/danasnje_pjesme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: state.date,
        delta_listened_secs: delta_ds
      })
    });
    await refreshFromDB();
  }

  async function finishAll() {
    const rem = remaining_ds();
    if (rem <= 0) return;
    await fetch('/api/danasnje_pjesme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: state.date,
        delta_listened_secs: rem
      })
    });
    await refreshFromDB();
  }

  // Wire-up kontrole (usklađeno s novim labelima)
  btnPlus5  ?.addEventListener('click', () => addListenedSeconds(5));
  btnPlus10 ?.addEventListener('click', () => addListenedSeconds(10));
  btnPlus15 ?.addEventListener('click', () => addListenedSeconds(15)); // 🔧
  btnPlus20 ?.addEventListener('click', () => addListenedSeconds(20)); // 🔧
  finishBtn ?.addEventListener('click', finishAll);
  closeBtn  ?.addEventListener('click', () => { modalEl.style.display = 'none'; });

  // Otvaranje + inicijalni dohvat
function openWelcomeModal() {
  modalEl.style.display = 'flex';
  // 1) povuci već upisano iz DB
  refreshFromDB().then(() => {
    // 2) pa ažuriraj današnji total iz vanjskog endpointa
    dohvatOtkazanihNarudzbiZaWelcome();
  });

  // 🔧 Auto-close nakon 5 sekundi neaktivnosti
  let inactivityTimer;
  const AUTO_CLOSE_MS = 60000; // 60 sekundi = 60.000 ms

  function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      modalEl.style.display = 'none';
    }, AUTO_CLOSE_MS);
  }

  // Startujemo timer čim se otvori modal
  resetInactivityTimer();

  // Ako se bilo šta klikne unutar modala — resetujemo timer
  modalEl.addEventListener('click', resetInactivityTimer);
}

  // Primjer trigera: 3 brza klika desno od .page
  (function initTripleClickRightOfPage() {
    const pageEl = document.querySelector('.page');
    if (!pageEl) return;
    const NEED = 3, GAP = 500;
    let clicks = 0, last = 0;

    function isRight(e) {
      const r = pageEl.getBoundingClientRect();
      return (e.clientX > r.right) && (e.clientY >= r.top && e.clientY <= r.bottom);
    }

    document.addEventListener('click', (e) => {
      if (!isRight(e)) { clicks = 0; last = 0; return; }
      const now = performance.now();
      clicks = (now - last <= GAP) ? clicks + 1 : 1;
      last = now;
      if (clicks >= NEED) { clicks = 0; last = 0; openWelcomeModal(); }
    });
  })();
})();
