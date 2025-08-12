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

// PRIMAJ i naStolPoSatu i naplataStolaPoSatu
function prikaziGrafikon(canvasId, naplate_po_satu, odSat, doSat, naStolPoSatu = {}, naplataStolaPoSatu = {}) {
  const labels = satneOznake(odSat, doSat);

  if (grafikonCache[canvasId]) grafikonCache[canvasId].destroy();

  // --- Odredi koja 2 datuma trebaju biti VIDljiva (zadnji i pretposljednji) ---
  const entries = Object.entries(naplate_po_satu || {});
  const sortirano = entries
    .map(([datum, sati]) => ({ datum, sati, d: parseDatum(datum) }))
    .filter(o => !isNaN(o.d))
    .sort((a, b) => a.d - b.d);

  const lastTwo = sortirano.slice(-2).map(o => o.datum);
  const vidljiviSet = new Set(lastTwo); // samo ova dva su vidljiva inicijalno

  const datasets = [];
  let globalMin = Infinity;
  let globalMax = -Infinity;

  entries.forEach(([datum, sati], index) => {
    const plusMapa  = naStolPoSatu[datum] || {};
    const minusMapa = naplataStolaPoSatu[datum] || {};

    const data = labels.map((hh) => {
      const naplate = Number((sati && sati[hh]) || 0);    // + Naplate po satu
      const naStol  = Number(plusMapa[hh] || 0);          // + Na stol po satu
      const napStol = Number(minusMapa[hh] || 0);         // − Naplata stola po satu
      const v = naplate + naStol - napStol;
      if (v < globalMin) globalMin = v;
      if (v > globalMax) globalMax = v;
      return v;
    });

    const zbroj = data.reduce((a, b) => a + b, 0);
    const label = formatDatumZaLabelu(datum, zbroj);

    datasets.push({
      label,
      data,
      hidden: !vidljiviSet.has(datum), // 🔥 sakrij sve osim zadnja 2 datuma
      fill: false,
      borderColor: `hsl(${(index * 67) % 360}, 70%, 50%)`,
      tension: 0,
      pointRadius: 0,
      pointHoverRadius: 6,
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
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "top" }, // korisnik i dalje može uključiti ostale datume
        tooltip: {
          callbacks: {
            label: (c) => `${Number(c.raw || 0).toFixed(2)} €`,
          },
        },
        datalabels: {
          color: "#333",
          align: "top",
          anchor: "end",
          formatter: (v) => (v !== 0 ? `${Number(v).toFixed(2)} €` : ""),
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
  const modal = document.getElementById("grafikon-modal");
  if (modal) { modal.style.display = "block"; resizeChartToScreen("modal-chart06_15"); }
});
document.getElementById("grafikon2-button")?.addEventListener("click", () => {
  const modal = document.getElementById("grafikon2-modal");
  if (modal) { modal.style.display = "block"; resizeChartToScreen("modal-chart15_01_b"); }
});
