// === Welcome modal trigger: 4 brza klika DESNO od .page ======================
(() => {
  const pageEl        = document.querySelector('.page');
  const welcomeModal  = document.getElementById('welcomeModal');
  const closeBtn      = document.getElementById('closeWelcomeBtn');
  const clearAllBtn   = document.getElementById('clearAllBtn');

  if (!pageEl || !welcomeModal) return; // nema elemenata – nema logike

  const NEED_CLICKS = 3;   // koliko klikova treba
  const GAP_MS     = 500;  // max razmak između uzastopnih klikova

  let clicks = 0;
  let lastTs = 0;

  function isRightOfPage(e) {
    const r = pageEl.getBoundingClientRect();
    // desno od .page i unutar njezina vertikalnog raspona
    return (e.clientX > r.right) && (e.clientY >= r.top && e.clientY <= r.bottom);
  }

  function openWelcomeModal() {
    welcomeModal.style.display = 'flex';
    // dohvat podataka (ako postoji funkcija)
    if (typeof dohvatOtkazanihNarudzbiZaWelcome === 'function') {
      dohvatOtkazanihNarudzbiZaWelcome();
    }
  }

  function closeWelcomeModal() {
    welcomeModal.style.display = 'none';
  }

  document.addEventListener('click', (e) => {
    // ako je modal već otvoren – ne brojimo klikove
    if (welcomeModal.style.display === 'flex') return;

    if (isRightOfPage(e)) {
      const now = performance.now();
      clicks = (now - lastTs <= GAP_MS) ? clicks + 1 : 1;
      lastTs = now;

      if (clicks >= NEED_CLICKS) {
        clicks = 0;
        lastTs = 0;
        openWelcomeModal();
      }
    } else {
      // klik nije u ciljanoj zoni: reset
      clicks = 0;
      lastTs = 0;
    }
  });

  // ESC zatvara modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && welcomeModal.style.display === 'flex') {
      closeWelcomeModal();
    }
  });

  // Zatvaranje modalnog (gumb)
  closeBtn?.addEventListener('click', closeWelcomeModal);



  // Gumb "Makni sve"
  clearAllBtn?.addEventListener('click', () => {
    alert("Makni sve – logika još nije definirana");
  });

  // Ako imaš #resultModal u layoutu, ovo ga sigurno zatvara (ako postoji)
  document.querySelector('#resultModal .close')?.addEventListener('click', () => {
    document.getElementById('resultModal').style.display = 'none';
  });
})();


// === Dohvat podataka za welcome (ostavljeno tvoje, dodan try/catch) =========
async function dohvatOtkazanihNarudzbiZaWelcome() {
  try {
    const danas = new Date();
    const datum = danas.toLocaleDateString("hr-HR");

    const response = await fetch("/api/otkazane_narudzbe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from_date: datum, to_date: datum })
    });

    const data = await response.json();
    const welcomeDiv = document.getElementById("welcomeTotalInfo");

    if (data?.success) {
      welcomeDiv.innerHTML = `<p style="margin-top:10px;">📦 Otkazane narudžbe danas: <strong>${Number(data.total).toFixed(2)} €</strong></p>`;
    } else {
      welcomeDiv.innerHTML = `<p style="color:red;">Greška pri dohvaćanju podataka</p>`;
    }
  } catch (err) {
    const welcomeDiv = document.getElementById("welcomeTotalInfo");
    if (welcomeDiv) {
      welcomeDiv.innerHTML = `<p style="color:red;">Greška pri dohvaćanju podataka</p>`;
    }
    console.error('dohvatOtkazanihNarudzbiZaWelcome error:', err);
  }
}
