// radnje_kirisnika.app.js
(() => {
  // ===== FORMAT OPIS FUNKCIJA =====
function formatOpis(opisRaw) {
  if (!opisRaw) return "";

  // 1️⃣ Ukloni riječ STAVKE i višak razmaka
  let opis = opisRaw.replace(/STAVKE\s*/gi, "").trim();

  // 2️⃣ Izdvoji stol, artikle u uglatim zagradama i ostatak
  const stolMatch = opis.match(/^(.*?)\s*\[/);
  const artikliMatch = opis.match(/\[(.*?)\]/);
  const nakonZagrada = opis.split("]").pop().trim();

  const stol = stolMatch ? stolMatch[1].trim() : "";
  const artikliStr = artikliMatch ? artikliMatch[1] : "";

  // 3️⃣ Split samo po zarezima van ( )
  const artikli = [];
  let current = "";
  let depth = 0;

  for (const ch of artikliStr) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      artikli.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) artikli.push(current.trim());

  // 4️⃣ Parsiraj i grupiraj po imenu artikla
  const mapa = {}; // { naziv: suma }

  artikli.forEach(a => {
    const m = a.match(/^(.+?)\(([\d,\.]+)\)$/);
    if (m) {
      const naziv = m[1].trim();
      const kol = parseFloat(m[2].replace(",", "."));
      if (!mapa[naziv]) mapa[naziv] = 0;
      mapa[naziv] += kol;
    } else if (a) {
      // artikl bez količine
      if (!mapa[a]) mapa[a] = 0;
      mapa[a] += 1;
    }
  });

  // 5️⃣ Sortiraj artikle po imenu i formatiraj
  const artikliFormatted = Object.entries(mapa)
    .sort((a, b) => a[0].localeCompare(b[0], "hr"))
    .map(([naziv, kol]) => {
      const prikazKol = kol % 1 === 0 ? kol.toFixed(0) : kol.toFixed(1);
      return `<div class="opis-artikl">${naziv} × ${prikazKol}</div>`;
    })
    .join("");

  // 6️⃣ Spoji sve dijelove
  const lines = [];
  if (stol) lines.push(`<div class="opis-stol">${stol}</div>`);
  if (artikliFormatted) lines.push(artikliFormatted);
  if (nakonZagrada) lines.push(`<div class="opis-nakon">${nakonZagrada}</div>`);

  return lines.join("");
}

  // ===== STATE =====
  const S = {
    potrosnjaArtikalaPoDanu: null,
    potrosnjaArtikala: null,
    naplatePoSatu: null,
    aktivniFilteri: new Set(),
    naplataStolaPoSatu: {},
    naStolPoSatu: {},
    sviDatumi: [],
    customFilter: null,
    nazivMap: { "Dodavanje na stol": "Na stol", "Otkazivanje narudžbe": "Otkaz stola" }
  };

  // ===== HELPERS =====
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

  const formatDateToInput = d => d.toISOString().split("T")[0];
  const formatDateForBackend = ymd => ymd.split("-").reverse().join(".");
  const parseDateInput = id => new Date($( `#${id}` ).value);

  const sortDDMMYYYY = (a,b) => {
    const [da,ma,ya] = a.split("."); const [db,mb,yb] = b.split(".");
    return new Date(`${yb}-${mb.padStart(2,"0")}-${db.padStart(2,"0")}`) -
           new Date(`${ya}-${ma.padStart(2,"0")}-${da.padStart(2,"0")}`);
  };

    // ===== PRINT MODE – query parami =====
  const QP = new URLSearchParams(window.location.search);
  const PRINT_MODE = QP.get('print');          // očekujemo 'today_total'
  const PRINT_DATE_ISO = QP.get('date');       // npr. '2025-08-26' (opcionalno)
  const POS_WIDTH_MM = QP.get('pos');   // "58" | "80" | null

// Normalizacija 'DD.MM.YYYY' -> 'YYYY-MM-DD'
function toISOFromDatumKey(datumStr){
  if (!datumStr) return null;
  const parts = datumStr.split('.').filter(Boolean);
  if (parts.length < 3) return null;
  const [d, m, y] = parts;
  const dd = String(parseInt(d, 10)).padStart(2, '0');
  const mm = String(parseInt(m, 10)).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

// Nađi ključ iz S.sviDatumi koji odgovara ISO datumu
function findDateKeyForISO(isoYMD){
  if (!isoYMD || !Array.isArray(S.sviDatumi)) return null;
  // direktno
  if (S.sviDatumi.includes(isoYMD)) return isoYMD;
  // preko normalizacije
  for (const k of S.sviDatumi){
    if (toISOFromDatumKey(k) === isoYMD) return k;
  }
  return null;
}

function printUkupnoForDateKey(datumKey) {
  const li = document.querySelector(`li[data-vrsta="Ukupno"][data-datum="${datumKey}"]`);

  // Helperi
  const getTxt = (sel) => (li?.querySelector(sel)?.textContent || "").trim();
  const sanitize = (s) => s.replace(/\s+/g, " ");
  const W = POS_WIDTH_MM ? `${parseInt(POS_WIDTH_MM, 10)}mm` : null;

  // Ako nema widgeta – ispiši poruku i zatvori
  if (!li) {
    document.body.innerHTML = `
      <div class="print-wrap">
        <h1>Radnje korisnika — Ukupno</h1>
        <div class="meta">Datum: ${datumKey}</div>
        <div class="no-data">Nema podataka za odabrani dan.</div>
      </div>`;
    injectPrintStyle(W);
    doPrintAndClose(datumKey);
    return;
  }

  // Izvuci vrijednosti iz DOM-a (ne oslanjamo se na vanjski CSS)
  // očekujemo:
  //   .ukupno-sub            → gornji
  //   .ukupno-sub.lower      → donji
  //   .ukupno-bottom         → ukupno (bold)
  const upperTxt = sanitize(getTxt('.ukupno-sub:not(.lower)')) || '';
  const lowerTxt = sanitize(getTxt('.ukupno-sub.lower')) || '';
  const totalTxt = sanitize(getTxt('.ukupno-bottom')) || '';

  // Fallback ako se nešto promijenilo u markupu
  const hasData = totalTxt || upperTxt || lowerTxt;
  const safeUpper = upperTxt || '—';
  const safeLower = lowerTxt || '—';
  const safeTotal = totalTxt || sanitize(li.textContent) || '—';

  // Složi minimalni ticket-HTML
  document.body.innerHTML = `
    <div class="print-wrap">
      <h1>Radnje korisnika — Ukupno</h1>
      <div class="meta">Datum: ${datumKey}</div>

      <div class="row">
        <span class="label">Gornji zbroj</span>
        <span class="val">${safeUpper}</span>
      </div>
      <div class="row">
        <span class="label">Donji zbroj</span>
        <span class="val">${safeLower}</span>
      </div>
      <hr>
      <div class="row total">
        <span class="label">UKUPNO</span>
        <span class="val">${safeTotal}</span>
      </div>
    </div>
  `;

  // Ubaci print CSS (jedna stranica, opcionalna POS širina)
  injectPrintStyle(W);
  doPrintAndClose(datumKey);

  // ------- lokalni helperi --------
  function injectPrintStyle(Wmm) {
    const css = `
      @page { ${Wmm ? `size:${Wmm} auto;` : `size:auto;`} margin:0; }
      @media print {
        html, body {
          ${Wmm ? `width:${Wmm};` : ``}
          margin:0 !important; padding:0 !important; overflow:hidden !important;
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
          font-family: system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
        }
        .print-wrap {
          ${Wmm ? `width:calc(${Wmm} - 6mm);` : ``}
          margin:0 !important; padding:3mm !important;
          page-break-inside: avoid !important; break-inside: avoid !important;
          break-after: page !important; page-break-after: always !important;
          max-height: 200mm; overflow: hidden;
        }
        h1 { margin:0 0 6px; font-size:16px; font-weight:700; }
        .meta { margin:0 0 10px; font-size:12px; opacity:.85; }
        .row { display:flex; justify-content:space-between; align-items:center;
               font-size:14px; line-height:1.35; padding:2px 0; }
        .row.total { font-weight:800; font-size:16px; padding-top:6px; }
        hr { border:0; border-top:1px dashed #999; margin:6px 0; }
        .label { opacity:.9; }
        .val { font-variant-numeric: tabular-nums; }
        .no-data { font-size:14px; }
      }
    `;
    const el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
  }

  function doPrintAndClose(dKey) {
    document.title = `Radnje korisnika – Ukupno – ${dKey}`;
    const closeAfter = () => { try { window.close(); } catch(_) {} };
    window.addEventListener('afterprint', closeAfter, { once:true });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.print();
      setTimeout(closeAfter, 2000); // fallback
    }));
  }
}


// Ako smo u print modu, pokreni auto-print nakon što se render kompletira
function maybeAutoPrint(){
  if (PRINT_MODE !== 'today_total') return;

  // ISO datum iz queryja ili današnji
  const iso = PRINT_DATE_ISO || new Date().toISOString().split('T')[0];
  const key = findDateKeyForISO(iso);

  if (!key){
    console.warn("Današnji datum nije pronađen u podacima za prikaz:", iso, S.sviDatumi);
    // Ipak probaj otvoriti print (prazan), pa zatvori
    window.addEventListener('afterprint', () => { try{ window.close(); }catch(_){} }, { once:true });
    setTimeout(() => window.print(), 100);
    setTimeout(() => { try{ window.close(); }catch(_){} }, 2000);
    return;
  }

  printUkupnoForDateKey(key);
}

  const findNaplateDay = (datum) => {
    const src = S.naplatePoSatu; if(!src) return null;
    if (src[datum]) return src[datum];
    const [d,m,y] = datum.split(".");
    if (d && m && y){
      const bezNula = `${parseInt(d,10)}.${parseInt(m,10)}.${y}`;
      if (src[bezNula]) return src[bezNula];
      const iso = `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      if (src[iso]) return src[iso];
    }
    return null;
  };

  const findPotrosnjaDay = (datum) => {
    const src = S.potrosnjaArtikalaPoDanu; if(!src) return null;
    if (src[datum]) return src[datum];
    const [d,m,y] = datum.split(".");
    if (d && m && y){
      const bezNula = `${parseInt(d,10)}.${parseInt(m,10)}.${y}`;
      if (src[bezNula]) return src[bezNula];
      const iso = `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      if (src[iso]) return src[iso];
    }
    return null;
  };

  const show = el => el.hidden = false;
  const hide = el => el.hidden = true;

  // ===== API =====
  async function dohvati(fromDate, toDate){
    const loader = $("#loader"); show(loader);
    try{
      const r = await fetch("/api/radnje_korisnika", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ from_date: fromDate, to_date: toDate })
      });
      const result = await r.json();
      hide(loader);
      if (!(result.success && result.data_po_datumima && Object.keys(result.data_po_datumima).length)){
        porukaBezPodataka();
        return null;
      }
      return result;
    }catch(e){
      console.error("Greška kod dohvata:", e);
      hide(loader);
      porukaGreska();
      return null;
    }
  }

  // ===== RENDER =====
  function porukaBezPodataka(){
    $("#results-container").innerHTML = `<p>Nema podataka za odabrani raspon.</p>`;
    $("#artikli-summary-list").innerHTML = `<li><i>Nema potrošnje artikala za odabrani period.</i></li>`;
  }
  function porukaGreska(){
    $("#results-container").innerHTML = `<p style="color:red">Greška pri dohvatu podataka.</p>`;
  }

function resetPrikaz(){
  $("#artikli-summary-list").innerHTML = "";
  $("#results-container").innerHTML = "";
  $("#summary-list").innerHTML = "";
  $("#results-container").hidden = true;   // ⬅️
  S.aktivniFilteri.clear();
  S.naplataStolaPoSatu = {};
  S.naStolPoSatu = {};
}



  function addCard(container, item, totalsByType, datum){
    const map = S.nazivMap;
    const iznos = parseFloat(item.iznos.replace(" €","").replace(",", ".")) || 0;
    const vrsta = map[item.vrsta_akcije] || item.vrsta_akcije;

    const sat = item.vrijeme ? parseInt(item.vrijeme.split(":")[0], 10) : NaN;
    const jutro = !isNaN(sat) && sat >= 6 && sat <= 14;

    let dataVrsta = vrsta;
    let dataDnevno = vrsta;

    if (vrsta === "Naplata" || vrsta === "Naplata stola"){
      const vrstaDnevno = jutro ? "Jutro" : "Popodne";
      totalsByType[vrstaDnevno] = (totalsByType[vrstaDnevno]||0)+iznos;
      if (vrsta !== "Naplata"){
        totalsByType[vrsta] = (totalsByType[vrsta]||0)+iznos;
      }
      dataDnevno = vrstaDnevno;
    } else {
      totalsByType[vrsta] = (totalsByType[vrsta]||0)+iznos;
      if (vrsta === "Na stol" && !isNaN(sat)) dataDnevno = jutro ? "Jutro":"Popodne";
    }

    // satna suma za grafove
    const satHH = item.vrijeme ? item.vrijeme.split(":")[0].padStart(2,"0") : null;
    if (satHH){
      if (vrsta === "Naplata stola"){
        S.naplataStolaPoSatu[datum] ??= {};
        S.naplataStolaPoSatu[datum][satHH] = (S.naplataStolaPoSatu[datum][satHH]||0)+iznos;
      }
      if (vrsta === "Na stol"){
        S.naStolPoSatu[datum] ??= {};
        S.naStolPoSatu[datum][satHH] = (S.naStolPoSatu[datum][satHH]||0)+iznos;
      }
    }

    const el = document.createElement("div");
    el.className = "card";
    el.dataset.vrsta = dataVrsta;
    el.dataset.dnevno = dataDnevno;
    el.dataset.datum = datum;
    el.innerHTML = `
      <div class="card-header">
        <span class="vrijeme">${item.vrijeme||""}</span>
        <span class="vrsta">${vrsta}</span>
        <span class="iznos">${item.iznos}</span>
      </div>
      <div class="card-opis">${item.opis || "-"}</div>
    `;
    container.appendChild(el);
  }

function widget(vrsta, suma, datum, opts = {}) {
  const map = S.nazivMap;
  const item = document.createElement("li");
  item.dataset.vrsta = vrsta;
  item.dataset.datum = datum;

  item.addEventListener("click", () => toggleFiltriranje(vrsta, datum, item));

  const mainTotal = `<div class="iznos ukupno-bottom">${Number(suma).toFixed(2)} €</div>`;
  let body = "";

if ((vrsta === "Jutro" || vrsta === "Popodne") && opts.diff) {
  const naStol = Number(opts.diff.naStol) || 0;
  const napStola = Number(opts.diff.naplataStola) || 0;
  const razlika = naStol - napStola;
  const combined = Number(suma) + razlika;

  body = `
    <div class="iznos jp-prim">${Number(suma).toFixed(1)} €</div>
    <div class="podiznos jp-sec">${razlika.toFixed(1)} €</div>
    <div class="iznos jp-total">${combined.toFixed(1)} €</div>
  `;
}
else if (vrsta === "Ukupno" && opts.components) {
  const { upper = 0, lower = 0 } = opts.components;
  body = `
    <div class="ukupno-sub">${upper.toFixed(1)}€</div>
    <div class="ukupno-sub lower">${lower.toFixed(1)}€</div>
    <div class="iznos ukupno-bottom">${Number(suma).toFixed(1)} €</div>
  `;
}
else {
  body = `<div class="iznos">${Number(suma).toFixed(1)}€</div>`;
}


  // ⬇️ ne prikazuj naslov za Jutro/Popodne/Ukupno
  const hideTitle = (vrsta === "Jutro" || vrsta === "Popodne" || vrsta === "Ukupno");
  const titleHtml = hideTitle ? "" : `<div class="naziv">${map[vrsta] || vrsta}</div>`;

  item.innerHTML = `${titleHtml}${body}`;
  if (vrsta === "Ukupno") item.classList.add("ukupno-bold");
  return item;
}

  function renderPodaciPoDatumima(data_po_datumima){
    const summaryList = $("#summary-list");
    const results = $("#results-container");
    const daniUTjednu = ["Nedjelja","Ponedjeljak","Utorak","Srijeda","Četvrtak","Petak","Subota"];
    const ignor = new Set(["Prijava","Odjava","Izlaz iz aplikacije","Čitanje liste totala","Čitanje totala konobara","Prijava, neuspješna","Ostalo","Pokretanje aplikacije","Čitanje totala","Premještanje stola"]);

    let tjedniZbroj = 0;
    const daniPodaci = [];
    const sviDatumi = Object.keys(data_po_datumima).sort(sortDDMMYYYY);
    S.sviDatumi = sviDatumi;

    sviDatumi.forEach(datum => {
      const items = data_po_datumima[datum];
      const totalsByType = {};

      let napJ=0, napP=0, stolJ=0, stolP=0;

      const section = document.createElement("li");
      section.className = "date-section";

const list = document.createElement("ul");
list.className = "summary-date";

const [d,m,y] = datum.split(".");
const jsDate = new Date(`${y}-${m}-${d}`);
const dayName = daniUTjednu[jsDate.getDay()];
const dateWidget = document.createElement("li");
dateWidget.className = "date-widget";
dateWidget.innerHTML = `<div class="naziv">${dayName}</div><div class="iznos">${d.padStart(2,"0")}.${m.padStart(2,"0")}.</div>`;

// ➡️ OVO JE NEDOSTAJALO
list.appendChild(dateWidget);
      dateWidget.innerHTML = `<div class="naziv">${dayName}</div><div class="iznos">${d.padStart(2,"0")}.${m.padStart(2,"0")}.</div>`;
dateWidget.addEventListener("click", () => {
  // 1) Ostali mini-widgeti (tvoj wrap) – kao i do sada
  wrap.style.display = (wrap.style.display === "none" || !wrap.style.display) ? "grid" : "none";

  // 2) Otvori/zatvori detalje (zelene/crvene) u Jutro/Popodne/Ukupno
  section.classList.toggle("expanded");

  // 3) Prikaži kartice za taj dan
  const container = document.getElementById("results-container");
  container.hidden = false;                 // pokaži kontejner s karticama
  document.querySelectorAll("#results-container .card").forEach(c => {
    c.style.display = (c.dataset.datum === datum) ? "block" : "none";
  });
});
      const wrap = document.createElement("div");
      wrap.className = "ostali-wrapper";
      wrap.style.display = "none";

      items.forEach(it => {
        const vrstaNorm = S.nazivMap[it.vrsta_akcije] || it.vrsta_akcije;
        const iznos = parseFloat(it.iznos.replace(" €","").replace(",", ".")) || 0;
        const sat = parseInt(it.vrijeme.split(":")[0],10);
        const jeJ = (sat>=6 && sat<=15);
        if (vrstaNorm==="Naplata stola"){ jeJ ? (napJ+=iznos) : (napP+=iznos); }
        if (vrstaNorm==="Na stol"){ jeJ ? (stolJ+=iznos) : (stolP+=iznos); }
        addCard(results, it, totalsByType, datum);
      });

      // J/P iz naplate_po_satu (ako postoji), fallback totalsByType
      let jutro=0, popodne=0;
      const sati = findNaplateDay(datum);
      if (sati){
        for (let h=6; h<=15; h++) jutro += (sati[String(h).padStart(2,"0")]||0);
        for (let h=16; h<=23; h++) popodne += (sati[String(h).padStart(2,"0")]||0);
        popodne += (sati["00"]||0);
      } else {
        jutro = totalsByType["Jutro"]||0;
        popodne = totalsByType["Popodne"]||0;
      }

      const razJ = stolJ - napJ;
      const razP = stolP - napP;

      const gornji = jutro + popodne;
      const donji  = razJ + razP;
      const ukupno = gornji + donji;
      const jutroBottom = jutro + razJ;
      const popodneBottom = popodne + razP;

      list.appendChild( widget("Jutro",   jutro,   datum, { diff:{naStol:stolJ, naplataStola:napJ} }) );
      list.appendChild( widget("Popodne", popodne, datum, { diff:{naStol:stolP, naplataStola:napP} }) );
      list.appendChild( widget("Ukupno",  ukupno,  datum, { components:{upper:gornji, lower:donji} }) );

      tjedniZbroj += ukupno;
      daniPodaci.push({ datum, jutro:jutroBottom, popodne:popodneBottom, ukupno });

      // Ostali widgeti
      Object.entries(totalsByType)
        .filter(([k]) => k!=="Jutro" && k!=="Popodne" && !ignor.has(k))
        .sort((a,b) => b[1]-a[1])
        .forEach(([vrsta, suma]) => wrap.appendChild( widget(vrsta, suma, datum) ));

      section.appendChild(list);
      section.appendChild(wrap);
      summaryList.appendChild(section);
    });

    // Prosjek (bez prvog dana)
    if (daniPodaci.length>1){
      const ostatak = daniPodaci.slice(1), n = ostatak.length || 1;
      const pj = ostatak.reduce((s,d)=>s+d.jutro,0)/n;
      const pp = ostatak.reduce((s,d)=>s+d.popodne,0)/n;
      const pu = ostatak.reduce((s,d)=>s+d.ukupno,0)/n;

      const prosjek = document.createElement("ul");
      prosjek.className = "summary-date prosjek-red";
      prosjek.innerHTML = `
        <li><div class="naziv">Prosjek</div></li>
        <li><div class="iznos">${pj.toFixed(2)} €</div></li>
        <li><div class="iznos">${pp.toFixed(2)} €</div></li>
        <li><div class="iznos">${pu.toFixed(2)} €</div></li>
      `;
      const first = $("#summary-list .date-section");
      if (first && first.nextSibling) $("#summary-list").insertBefore(prosjek, first.nextSibling);
    }

    const tjedni = document.createElement("div");
    tjedni.className = "tjedni-ukupno";
    tjedni.innerHTML = `<strong>📅 Tjedan ukupno: ${tjedniZbroj.toFixed(2)} €</strong>`;
    summaryList.appendChild(tjedni);
  }

  function prikaziPotrosnjuArtikalaTotal(src){
    const root = $("#artikli-summary-list"); root.innerHTML = "";
    if (!src || !Object.keys(src).length){
      root.innerHTML = `<li><i>Nema potrošnje artikala za odabrani period.</i></li>`; return;
    }
    Object.entries(src)
      .sort((a,b)=>(b[1]?.kolicina||0)-(a[1]?.kolicina||0))
      .forEach(([naziv,s])=>{
        const li = document.createElement("li");
        li.className="card"; li.style.display="block"; li.style.marginBottom="6px";
        li.innerHTML = `
          <div class="card-header">
            <span class="vrsta">${naziv}</span>
            <span class="iznos">${(s?.kolicina??0).toFixed(2)} kom</span>
          </div>
          <div class="card-opis">Puta: ${s?.broj??0}</div>
        `;
        root.appendChild(li);
      });
  }

  function otvoriArtikliModal(){
    const modal = $("#artikli-modal");
    const listRoot = $("#artikli-summary-list");
    listRoot.innerHTML = "";

    const perDan = S.potrosnjaArtikalaPoDanu && Object.keys(S.potrosnjaArtikalaPoDanu).length;
    if (!perDan){
      prikaziPotrosnjuArtikalaTotal(S.potrosnjaArtikala);
      return openModal("artikli-modal");
    }

    const daniWrap = document.createElement("ul");
    daniWrap.className = "summary-date"; daniWrap.style.marginBottom = "10px";

    const dani = Object.keys(S.potrosnjaArtikalaPoDanu).sort(sortDDMMYYYY);
    if (!dani.length){
      listRoot.innerHTML = `<li><i>Nema potrošnje artikala za odabrani period.</i></li>`;
      return openModal("artikli-modal");
    }

    const karticeWrap = document.createElement("ul");
    karticeWrap.id = "artikli-kartice";
    karticeWrap.style.listStyle="none"; karticeWrap.style.padding="0"; karticeWrap.style.margin="8px 0 0 0";

    let aktivniLi = null;
    const renderDan = (datum) => {
      if (aktivniLi) aktivniLi.classList.remove("active");
      aktivniLi = [...daniWrap.children].find(li=>li.dataset.datum===datum) || null;
      if (aktivniLi) aktivniLi.classList.add("active");

      karticeWrap.innerHTML = "";
      const data = findPotrosnjaDay(datum);
      if (!data || !Object.keys(data).length){
        karticeWrap.innerHTML = `<li><i>Nema artikala za ${datum}.</i></li>`; return;
      }
      Object.entries(data)
        .sort((a,b)=>(b[1]?.kolicina||0)-(a[1]?.kolicina||0))
        .forEach(([naziv,s])=>{
          const li = document.createElement("li");
          li.className="card"; li.style.display="block"; li.style.marginBottom="6px";
          li.innerHTML = `
            <div class="card-header">
              <span class="vrsta">${naziv}</span>
              <span class="iznos">${(s?.kolicina??0).toFixed(2)} kom</span>
            </div>
            <div class="card-opis">Puta: ${s?.broj??0}</div>
          `;
          karticeWrap.appendChild(li);
        });
    };

    dani.forEach(datum=>{
      const li = document.createElement("li");
      li.dataset.datum = datum;
      li.innerHTML = `<div class="naziv">Dan</div><div class="iznos">${datum}</div>`;
      li.addEventListener("click", ()=>renderDan(datum));
      daniWrap.appendChild(li);
    });

    listRoot.appendChild(daniWrap);
    listRoot.appendChild(karticeWrap);
    renderDan(dani[0]);
    openModal("artikli-modal");
  }

  // ===== FILTERI =====
function applyFilters(){
  const container = $("#results-container");
  const cards = $$("#results-container .card");
  const cf = S.customFilter;

  if (cf){
    // postoji custom (Jutro/Popodne) filter -> prikaži container
    container.hidden = false;
    cards.forEach(c=>{
      const ok = (c.dataset.datum===cf.datum) && (c.dataset.dnevno===cf.period) && (cf.vrste.includes(c.dataset.vrsta));
      c.style.display = ok ? "block" : "none";
    });
    return;
  }

  if (!S.aktivniFilteri.size){
    // nema filtera -> sakrij cijeli container i kartice
    container.hidden = true;
    cards.forEach(c => c.style.display = "none");
    return;
  }

  // postoje filteri -> prikaži container i filtriraj
  container.hidden = false;
  cards.forEach(c=>{
    const key1 = `${c.dataset.vrsta}_${c.dataset.datum}`;
    const key2 = `${c.dataset.dnevno}_${c.dataset.datum}`;
    c.style.display = (S.aktivniFilteri.has(key1)||S.aktivniFilteri.has(key2)) ? "block":"none";
  });
}


  function toggleFiltriranje(vrsta, datum, el){
    const isPeriod = (vrsta==="Jutro"||vrsta==="Popodne");
    if (isPeriod){
      const isSame = S.customFilter && S.customFilter.period===vrsta && S.customFilter.datum===datum;
      if (isSame){ S.customFilter=null; el.classList.remove("active","active-sub"); }
      else{
        S.customFilter = { period: vrsta, datum, vrste:["Naplata","Naplata stola","Na stol"] };
        S.aktivniFilteri.clear();
        el.classList.add("active","active-sub");
      }
      return applyFilters();
    }
    S.customFilter = null; el.classList.remove("active-sub");
    const key = `${vrsta}_${datum}`;
    if (S.aktivniFilteri.has(key)){ S.aktivniFilteri.delete(key); el.classList.remove("active"); }
    else{ S.aktivniFilteri.add(key); el.classList.add("active"); }
    applyFilters();
  }

  // ===== MODALS =====
function openModal(id){
  const m = document.getElementById(id);
  m.setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");   // ➕ sakrij toolbar
}

function closeModal(id){
  const m = document.getElementById(id);
  m.setAttribute("aria-hidden","true");
  document.body.classList.remove("modal-open"); // ➖ vrati toolbar
}

  // Delegirano zatvaranje
  document.addEventListener("click",(e)=>{
    const btn = e.target.closest(".close");
    if (btn && btn.dataset.close) closeModal(btn.dataset.close);
  });

  // ===== GRAFOVI (poziva tvoj kreiranje_grafikona.js) =====
  function prikaziGrafikone(){
    if (!S.naplatePoSatu) return;
    // Jutro 06–15
    prikaziGrafikon("modal-chart06_15", S.naplatePoSatu, 6, 15, S.naStolPoSatu, S.naplataStolaPoSatu);
    // Popodne 16–23 + 00
    prikaziGrafikon("modal-chart15_01_b", S.naplatePoSatu, 16, 23, S.naStolPoSatu, S.naplataStolaPoSatu);
  }

  // ===== FLOW =====
async function fetchData(){
  resetPrikaz();
  const from = formatDateForBackend($("#from_date").value);
  const to   = formatDateForBackend($("#to_date").value);
  const res = await dohvati(from, to);
  if (!res) return;
  S.potrosnjaArtikalaPoDanu = res.potrosnja_artikala_po_danu || null;
  S.potrosnjaArtikala = res.potrosnja_artikala || null;
  S.naplatePoSatu = res.naplate_po_satu || null;
  renderPodaciPoDatumima(res.data_po_datumima);
  prikaziPotrosnjuArtikalaTotal(S.potrosnjaArtikala);
  prikaziGrafikone();

  // ⬇️ sakrij kartice dok nema filtera
  applyFilters();
  maybeAutoPrint();

}

let liveTimer = null;
let countdownTimer = null;
let countdownValue = 10; // sekundi
const REFRESH_INTERVAL = 10; // ⏱️ svakih 10 sekundi

async function dohvatiPosljednjeTransakcije() {
  try {
    const r = await fetch("/api/posljednje_transakcije");
    const data = await r.json();
    const list = document.getElementById("live-list");
    list.innerHTML = "";

    if (!data.success || !data.items?.length) {
      list.innerHTML = "<li><i>Nema novih transakcija...</i></li>";
      return;
    }

    data.items.forEach(item => {
      const li = document.createElement("li");
      li.className = "card";

      li.innerHTML = `
        <div class="card-header">
          <span class="vrijeme">${item.vrijeme}</span>
          <span class="vrsta">${item.vrsta_akcije}</span>
          <span class="iznos">${item.iznos}</span>
        </div>
        <div class="card-opis">${formatOpis(item.opis)}</div>
      `;

      if (item.vrsta_akcije.includes("Otkaz")) {
        li.style.borderLeft = "3px solid #ff3b3b";
      } else if (item.vrsta_akcije.includes("Dodavanje")) {
        li.style.borderLeft = "3px solid #3bff3b";
      }

      list.appendChild(li);
    });
  } catch (e) {
    console.error("Live fetch error:", e);
  }
}

function otvoriLiveModal() {
  openModal("live-modal");
  dohvatiPosljednjeTransakcije();

  // 🕓 Pripremi odbrojavanje
  const titleEl = document.querySelector("#live-modal h3");
  countdownValue = REFRESH_INTERVAL;
  if (countdownTimer) clearInterval(countdownTimer);
  if (liveTimer) clearInterval(liveTimer);

  // 🔁 interval za osvježavanje svakih 10 sekundi
  liveTimer = setInterval(() => {
    dohvatiPosljednjeTransakcije();
    countdownValue = REFRESH_INTERVAL; // resetuj odbrojavanje
  }, REFRESH_INTERVAL * 1000);

  // ⏳ interval za prikaz odbrojavanja svake 1 sekundu
  countdownTimer = setInterval(() => {
    if (!titleEl) return;
    countdownValue--;
    if (countdownValue < 0) countdownValue = REFRESH_INTERVAL;
    titleEl.innerHTML = `🔴 Posljednje transakcije <span style="font-size:0.8em;color:#aaa;">(${countdownValue}s)</span>`;
  }, 1000);
}

function zatvoriLiveModal() {
  closeModal("live-modal");
  if (liveTimer) clearInterval(liveTimer);
  if (countdownTimer) clearInterval(countdownTimer);
}



  // ===== INIT UI =====
  function initUI(){
    // range form
    $("#drugired-form").addEventListener("submit", e => { e.preventDefault(); fetchData(); });

    // prev/next 7 dana
    $("#prev-day").addEventListener("click", ()=>{
      const f=parseDateInput("from_date"), t=parseDateInput("to_date");
      f.setDate(f.getDate()-7); t.setDate(t.getDate()-7);
      $("#from_date").value = formatDateToInput(f);
      $("#to_date").value   = formatDateToInput(t);
      fetchData();
    });
    $("#next-day").addEventListener("click", ()=>{
      const f=parseDateInput("from_date"), t=parseDateInput("to_date");
      f.setDate(f.getDate()+7); t.setDate(t.getDate()+7);
      $("#from_date").value = formatDateToInput(f);
      $("#to_date").value   = formatDateToInput(t);
      fetchData();
    });

    // init date range (tjedan unazad)
    const today = new Date(), weekAgo = new Date();
    weekAgo.setDate(today.getDate()-7);
    $("#from_date").value = formatDateToInput(weekAgo);
    $("#to_date").value   = formatDateToInput(today);

    // modali: artikli
    $("#artikli-button").addEventListener("click", otvoriArtikliModal);

    // modali: grafovi
    $("#grafikon-button").addEventListener("click", ()=> openModal("grafikon-modal"));
    $("#grafikon2-button").addEventListener("click", ()=> openModal("grafikon2-modal"));
  }

document.getElementById("live-button").addEventListener("click", otvoriLiveModal);
document.querySelector('[data-close="live-modal"]').addEventListener("click", zatvoriLiveModal);

  // START
  window.addEventListener("DOMContentLoaded", () => {
    initUI();
    fetchData();
  });
})();
