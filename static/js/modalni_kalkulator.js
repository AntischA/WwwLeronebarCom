// === Welcome modal: današnje pjesme / odslušane pjesme ======================
// očekuje elemente:
//  #welcomeModal, #closeWelcomeBtn
//  #welcomeTotalInfo        (lijevo gore)           -> "Današnje pjesme X.X sekundi"
//  #welcomeListenedInfo     (desno gore)            -> "Današnje odslušane pjesme Y.Y sekundi"
//  gumbi u desnom dolje: #btnPlus5, #btnPlus10, #btnPlus30, #btnPlus60, #btnFinish
//  (trigger otvaranja modala – zadržavam tvoj "klik desno od .page" ako ga već imaš)

// #### Klijent drži jedinicu: desetinka sekunde (deciseconds) ####
//   - u DB šaljemo INTEGER = sekunde * 10
//   - s DB-a čitamo INTEGER i prikazujemo /10 s jednom decimalom

(() => {
  const SCALE = 10; // 1 = 0.1 sek
  const todayISO = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (za /api/danasnje_pjesme)
  const todayHR  = new Date().toLocaleDateString("hr-HR"); // za /api/otkazane_narudzbe (ako ga koristiš)

  // UI refs
  const modalEl      = document.getElementById('welcomeModal');
  const closeBtn     = document.getElementById('closeWelcomeBtn');
  const totalEl      = document.getElementById('welcomeTotalInfo');     // lijevo gore
  const listenedEl   = document.getElementById('welcomeListenedInfo');  // desno gore

  // kontrole (desno dolje)
  const btnPlus5     = document.getElementById('btnPlus5');
  const btnPlus10    = document.getElementById('btnPlus10');
  const btnPlus30    = document.getElementById('btnPlus30');
  const btnPlus60    = document.getElementById('btnPlus60');
  const btnFinish    = document.getElementById('btnFinish');

  // lokalno stanje (u decisekundama)
  const state = {
    date: todayISO,
    total_ds: 0,
    listened_ds: 0,
  };

  // --------- Helpers ---------
  const fmtSec = (ds) => (ds / SCALE).toFixed(1);     // "X.X"
  const remaining_ds = () => Math.max(0, state.total_ds - state.listened_ds);

  function render() {
    if (totalEl)    totalEl.textContent    = `${fmtSec(state.total_ds)} sekundi`;
    if (listenedEl) listenedEl.textContent = `${fmtSec(state.listened_ds)} sekundi`;

    const rem = remaining_ds(); // total - listened (u decisekundama)
    if (finishRemainingEl) finishRemainingEl.textContent = `${fmtSec(rem)} sekundi`;
    if (btnFinish) btnFinish.disabled = rem <= 0; // opcionalno
  }


  async function refreshFromDB() {
    const res = await fetch(`/api/danasnje_pjesme?date=${encodeURIComponent(state.date)}`, { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (json && json.success) {
      // backend vraća integer; držimo u decisekundama
      state.total_ds    = Number(json.total_secs)    || 0;
      state.listened_ds = Number(json.listened_secs) || 0;
      render();
    }
  }

  // Postavi TOTAL iz vanjskog izvora (tvoja postojeća funkcija – ime zadržano)
  // Ova funkcija sada:
  // 1) dohvaća "sekunde" iz /api/otkazane_narudzbe (tvoj postojeći endpoint)
  // 2) postavlja taj total u našu tablicu /api/danasnje_pjesme (set_total_secs)
  // 3) refresha prikaz
  async function dohvatOtkazanihNarudzbiZaWelcome() {
    try {
      const response = await fetch("/api/otkazane_narudzbe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_date: todayHR, to_date: todayHR })
      });
      const data = await response.json();
      const secs = Number(data?.total) || 0;  // npr. 10.7

      // upiši u našu DB (kao decisekunde)
      await fetch('/api/danasnje_pjesme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: state.date,
          set_total_secs: Math.round(secs * SCALE)
        })
      });

      await refreshFromDB();
    } catch (err) {
      console.error('dohvatOtkazanihNarudzbiZaWelcome error:', err);
    }
  }

  // Povećaj odslušane za delta sekundi (float dozvoljen); clamp radi backend
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

  // Odsušaj do kraja – prebaci sve što je ostalo
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

  // --------- Wire-up kontrola ---------
  btnPlus5  ?.addEventListener('click', () => addListenedSeconds(5));
  btnPlus10 ?.addEventListener('click', () => addListenedSeconds(10));
  btnPlus30 ?.addEventListener('click', () => addListenedSeconds(30));
  btnPlus60 ?.addEventListener('click', () => addListenedSeconds(60));
  btnFinish ?.addEventListener('click', finishAll);

  closeBtn  ?.addEventListener('click', () => { modalEl.style.display = 'none'; });

  // Ako modal otvaraš “klikom desno od .page”, kad se otvori – povuci podatke i postavi total:
  function openWelcomeModal() {
    modalEl.style.display = 'flex';
    // 1) povuci što već postoji u DB (ako je bilo ranije)
    refreshFromDB().then(() => {
      // 2) zatim DOHVATI današnji total iz vanjske funkcije i upiši kao "Današnje pjesme"
      //    (ako endpoint ne vrati ništa, ostat će prethodno stanje)
      dohvatOtkazanihNarudzbiZaWelcome();
    });
  }

  // Ako već imaš svoj trigger, pozovi openWelcomeModal() iz njega.
  // Primjer (otvaranje na 3 brza klika desno od .page):
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
