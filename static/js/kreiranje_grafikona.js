let grafikonCache = {};

function prikaziGrafikon(canvasId, naplate_po_satu, odSat, doSat) {
  const labels = [];
  for (let h = odSat; h <= doSat; h++) {
    labels.push(h.toString().padStart(2, '0'));
  }
  if (doSat === 23) {
    labels.push("00");
  }

  const datasets = [];
  const customLabels = [];

  Object.entries(naplate_po_satu).forEach(([datum, sati], index) => {
    const podaci = labels.map(sat => sati[sat] || 0);
    const zbroj = podaci.reduce((a, b) => a + b, 0);
    const datumParts = datum.split('.');
    const datumObj = new Date(`${datumParts[2]}-${datumParts[1]}-${datumParts[0]}`);
    const daniUTjednu = ['ned', 'pon', 'uto', 'sri', 'čet', 'pet', 'sub'];
    const dan = daniUTjednu[datumObj.getDay()];
    const prikazDatuma = `${datumParts[0]}.${datumParts[1]}.\n${dan}\n(${zbroj.toFixed(2)} €)`;

    customLabels.push(prikazDatuma);

    datasets.push({
      label: prikazDatuma,
      data: podaci,
      fill: false,
      borderColor: `hsl(${(index * 67) % 360}, 70%, 50%)`,
      tension: 0,
      pointRadius: 0,
      pointHoverRadius: 6
    });
  });

  // ✅ Sada izračunavamo maksimalnu vrijednost iz svih podataka
  let maxValue = 0;
  datasets.forEach(dataset => {
    const localMax = Math.max(...dataset.data);
    if (localMax > maxValue) maxValue = localMax;
  });
  const yMax = Math.ceil((maxValue + 10) / 10) * 10;

  if (grafikonCache[canvasId]) {
    grafikonCache[canvasId].destroy();
  }

  const ctx = document.getElementById(canvasId).getContext("2d");

  grafikonCache[canvasId] = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false, // <-- dodaj ovo!
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: ctx => ctx.raw.toFixed(2) + ' €'
          }
        },
        datalabels: {
          color: '#333',
          align: 'top',
          anchor: 'end',
          formatter: value => value > 0 ? value.toFixed(2) + ' €' : ''
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: yMax,
          ticks: {
                display: false, // sakriva brojeve sa y-osi
            stepSize: 10,
            callback: value => value + " €"
          }
        }
      }
    },
    plugins: [ChartDataLabels]
  });
}

function resizeChartToScreen(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (canvas) {
    canvas.style.height = window.innerHeight + "px";
  }
}

function zatvoriGrafikonModal() {
  document.getElementById("grafikon-modal").style.display = "none";
}

function zatvoriGrafikon2Modal() {
  document.getElementById("grafikon2-modal").style.display = "none";
}


document.getElementById("grafikon-button").addEventListener("click", () => {
  const modal = document.getElementById("grafikon-modal");
  modal.style.display = "block";
  resizeChartToScreen("modal-chart06_15");
});

document.getElementById("grafikon2-button").addEventListener("click", () => {
  const modal = document.getElementById("grafikon2-modal");
  modal.style.display = "block";
  resizeChartToScreen("modal-chart15_01_b");
});