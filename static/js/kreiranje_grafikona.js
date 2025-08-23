/* kreiranje_grafikona.js
   Grafikon po satu prikazuje isto što i widgeti Jutro/Popodne SABIRAJU:
   V[HH] = (NaplatePoSatu[HH]) + (NaStol[HH]) − (NaplataStola[HH])
   Popodnevni graf uključuje i "00" (ponoć).
*/

let grafikonCache = {};

// Labela datuma ("DD.MM.YYYY" ili ISO) + dan + (ukupno)
function formatDatumZaLabelu(datum, zbroj) {
  let d;
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(datum)) {
    const [dd, mm, yyyy] = datum.split(".");
    const d2 = String(dd).padStart(2, "0");
    const m2 = String(mm).padStart(2, "0");
    d = new Date(`${yyyy}-${m2}-${d2}`);
  } else {
    d = new Date(datum);
  }
  const daniUTjednu = ["ned", "pon", "uto", "sri", "čet", "pet", "sub"];
  const dan = daniUTjednu[d.getDay()] || "";

  let prikaz = datum;
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(datum)) {
    const [dd, mm] = datum.split(".");
    const d2 = String(dd).padStart(2, "0");
    const m2 = String(mm).padStart(2, "0");
    prikaz = `${d2}.${m2}.`;
  }
  return `${prikaz}\n${dan}\n(${zbroj.toFixed(2)} €)`;
}

// Pretvori string datuma u Date (podržava "D.M.YYYY" i ISO)
function parseDatum(datum) {
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(datum)) {
    const [dd, mm, yyyy] = datum.split(".");
    const d2 = String(dd).padStart(2, "0");
    const m2 = String(mm).padStart(2, "0");
    return new Date(`${yyyy}-${m2}-${d2}`);
  }
  return new Date(datum);
}

function satneOznake(odSat, doSat) {
  const labels = [];
  for (let h = odSat; h <= doSat; h++) labels.push(h.toString().padStart(2, "0"));
  if (doSat === 23) labels.push("00");
  return labels;
}

function prikaziGrafikon(canvasId, naplate_po_satu, odSat, doSat, naStolPoSatu = {}, naplataStolaPoSatu = {}) {
  const labels = satneOznake(odSat, doSat);

  if (grafikonCache[canvasId]) grafikonCache[canvasId].destroy();

  // Sortiraj datume kronološki (+ priprema za vidljivost i boje)
  const sortirano = Object.entries(naplate_po_satu || {})
    .map(([datum, sati]) => ({ datum, sati, d: parseDatum(datum) }))
    .filter(o => !isNaN(o.d))
    .sort((a, b) => a.d - b.d);

  // Vidljivi samo zadnji i pretposljednji
  const lastTwo = sortirano.slice(-2).map(o => o.datum);
  const vidljiviSet = new Set(lastTwo);

  // Odredi referentne datume za boje
  const lastIdx = sortirano.length - 1;
  const prevIdx = sortirano.length - 2;

  const lastDateStr = lastIdx >= 0 ? sortirano[lastIdx].datum : null;
  const prevDateStr = prevIdx >= 0 ? sortirano[prevIdx].datum : null;

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
  }
  let sevenDateStr = null;
  if (lastIdx >= 0) {
    const target = new Date(sortirano[lastIdx].d);
    target.setDate(target.getDate() - 7);
    const found = sortirano.find(o => sameDay(o.d, target));
    if (found) {
      sevenDateStr = found.datum;
    } else if (sortirano.length >= 8) {
      sevenDateStr = sortirano[sortirano.length - 8].datum;
    }
  }

  const datasets = [];

  // Sad = lokalno vrijeme; koristimo za "rezanje" budućih sati
  const now = new Date();
  const nowHour = now.getHours();

  sortirano.forEach(({ datum, sati }, index) => {
    const plusMapa  = naStolPoSatu[datum] || {};
    const minusMapa = naplataStolaPoSatu[datum] || {};

    const isLast = datum === lastDateStr;
    const isToday = sameDay(parseDatum(datum), now);

    // Izračun po satu
    let data = labels.map((hh) => {
      const naplate = Number((sati && sati[hh]) || 0);
      const naStol  = Number(plusMapa[hh] || 0);
      const napStol = Number(minusMapa[hh] || 0);
      return naplate + naStol - napStol;
    });

    // 🚫 Reži buduće sate za zadnji datum ako je to DANAS
    if (isLast && isToday) {
      data = labels.map((hh, i) => {
        if (hh === "00") return null; // ponoć sutrašnjeg dana – nikad ne crtamo za "danas"
        const h = parseInt(hh, 10);
        return (h > nowHour) ? null : data[i];
      });
    }

    // Zbroj (ignorira null)
    const zbroj = data.reduce((a, b) => a + (b ?? 0), 0);
    const label = formatDatumZaLabelu(datum, zbroj);

    // 🎨 Boja linije
    let borderColor;
    if (datum === lastDateStr)       borderColor = "#000000"; // crna
    else if (datum === prevDateStr)  borderColor = "#e53935"; // crvena
    else if (datum === sevenDateStr) borderColor = "#1e88e5"; // plava
    else borderColor = `hsl(${(index * 67) % 360}, 70%, 50%)`;

    datasets.push({
      label,
      data,
      hidden: !vidljiviSet.has(datum), // sakrij sve osim zadnja 2 datuma
      fill: false,
      borderColor,
      borderWidth: 2,
      tension: 0,
      pointRadius: 0,
      pointHoverRadius: 6,
    });
  });

  // Dinamički Y-raspon, računaj samo nad postojećim (ne-null) vrijednostima
  let globalMin = +Infinity, globalMax = -Infinity;
  datasets.forEach(ds => {
    ds.data.forEach(v => {
      if (v == null) return;
      if (v < globalMin) globalMin = v;
      if (v > globalMax) globalMax = v;
    });
  });
  if (!isFinite(globalMin)) { globalMin = 0; globalMax = 10; }
  const yMax = Math.ceil((globalMax + 10) / 10) * 10;
  const yMin = Math.floor((globalMin - 10) / 10) * 10;

  const ctx = document.getElementById(canvasId).getContext("2d");

  grafikonCache[canvasId] = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      spanGaps: false, // važno: ne spajaj preko null vrijednosti
      interaction: { mode: "index", intersect: false },
        backgroundColor: "#ffffff",  // bela pozadina za chart area

      plugins: {
        legend: { position: "top" },
        tooltip: {
          callbacks: {
            label: (c) => `${Number(c.raw ?? 0).toFixed(2)} €`,
          },
        },
        datalabels: {
          color: "#333",
          align: "top",
          anchor: "end",
          formatter: (v) => (v != null && v !== 0 ? `${Number(v).toFixed(2)} €` : ""),
        },
      },
      scales: {
        y: {
          beginAtZero: false,
          min: yMin,
          max: yMax,
          ticks: {
            display: false,
            stepSize: 10,
            callback: (v) => `${v} €`,
          },
        },
      },
    },
    plugins: [ChartDataLabels],
  });
}

// Utility
function resizeChartToScreen(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (canvas) {
    canvas.style.height = window.innerHeight + "px";
    if (grafikonCache[canvasId]) grafikonCache[canvasId].resize();
  }
}
function zatvoriGrafikonModal() { const el = document.getElementById("grafikon-modal"); if (el) el.style.display = "none"; }
function zatvoriGrafikon2Modal() { const el = document.getElementById("grafikon2-modal"); if (el) el.style.display = "none"; }

document.getElementById("grafikon-button")?.addEventListener("click", () => {
  openModal("grafikon-modal");
  resizeChartToScreen("modal-chart06_15");
});
document.getElementById("grafikon2-button")?.addEventListener("click", () => {
  openModal("grafikon2-modal");
  resizeChartToScreen("modal-chart15_01_b");
});
