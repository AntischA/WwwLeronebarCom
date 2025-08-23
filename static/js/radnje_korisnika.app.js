(() => {
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


  // START
  window.addEventListener("DOMContentLoaded", () => {
    initUI();
    fetchData();
  });
})();
