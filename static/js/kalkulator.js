
let timeout;


function resetTimer() {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
        location.reload(); // Osvježavanje stranice
    }, 900000); // 15 minuta (900,000 ms)
}

// Resetuj tajmer na bilo koju interakciju korisnika
document.addEventListener("mousemove", resetTimer);
document.addEventListener("keydown", resetTimer);
document.addEventListener("click", resetTimer);
document.addEventListener("scroll", resetTimer);

resetTimer(); // Pokreće inicijalni tajmer





        const modal = document.getElementById("resultModal");
        const span = document.getElementsByClassName("close")[0];

        document.getElementById('izracunaj-button').addEventListener('click', async function() {
            const pocetniPolog = parseFloat(document.getElementById('pocetni-polog').value) || 0;
            const dnevniPromet = parseFloat(document.getElementById('dnevni-promet').value) || 0;

            const ukupnoStvarno = pocetniPolog + dnevniPromet;
            const ukupnoSaNemaknutim = ukupnoStvarno;
            const ukupnoBezNemaknutog = ukupnoSaNemaknutim;

            let stvarno = 0;

            const novcaniceVrijednosti = {
                '5': 5, '10': 10, '20': 20, '50': 50, '100': 100, '200': 200
            };
            const novcaniceKolicine = {};

            const kovaniceVrijednosti = {
                '0.1': 0.1, '0.2': 0.2, '0.5': 0.5, '1': 1, '2': 2
            };
            const kovaniceKolicine = {};

            // Računanje stvarnog iznosa
            Object.keys(kovaniceVrijednosti).forEach(key => {
                const kolicina = parseFloat(document.getElementById(`novcanica-${key}`).value) || 0;
                stvarno += kolicina * kovaniceVrijednosti[key];
                kovaniceKolicine[key] = kolicina;
            });

            Object.keys(novcaniceVrijednosti).forEach(key => {
                const kolicina = parseFloat(document.getElementById(`novcanica-${key}`).value) || 0;
                stvarno += kolicina * novcaniceVrijednosti[key];
                novcaniceKolicine[key] = kolicina;
            });

            const gotovina = parseFloat(document.getElementById('gotovina').value) || 0;
            stvarno += gotovina;



            const razlika = stvarno - ukupnoSaNemaknutim;
            let status = "Taman";
            let resultClass = 'exact';

            if (razlika > 0) {
                status = `VIŠAK: ${razlika.toFixed(2)} €`;
                resultClass = 'positive';
            } else if (razlika < 0) {
                status = `MANJAK: ${Math.abs(razlika).toFixed(2)} €`;
                resultClass = 'negative';
            }


            // Postavite ciljni zbroj na ukupnoBezNemaknutog
            let ciljniZbroj = ukupnoBezNemaknutog + razlika;
            let trenutniZbroj = stvarno;

            const prioritetiSmanjenja = [
                { key: '20', type: 'novcanica' }
            ];

            const prioritetiPovecanja = [
                { key: '10', type: 'novcanica' },
                { key: '5', type: 'novcanica' },
                { key: '2', type: 'kovanica' },
                { key: '1', type: 'kovanica' },
                { key: '0.5', type: 'kovanica' },
                { key: '0.2', type: 'kovanica' },
                { key: '0.1', type: 'kovanica' }
            ];

            // Prvo smanjujemo veće apoene
            for (const prioritet of prioritetiSmanjenja) {
                const { key, type } = prioritet;
                const vrijednost = type === 'novcanica' ? novcaniceVrijednosti[key] : kovaniceVrijednosti[key];
                let kolicina = type === 'novcanica' ? novcaniceKolicine[key] : kovaniceKolicine[key];

                while (kolicina > 0 && trenutniZbroj > ciljniZbroj) {
                    kolicina--;
                    trenutniZbroj -= vrijednost;

                    if (type === 'novcanica') {
                        novcaniceKolicine[key] = kolicina;
                    } else {
                        kovaniceKolicine[key] = kolicina;
                    }

                    if (trenutniZbroj <= ciljniZbroj) {
                        break;
                    }
                }

                if (trenutniZbroj <= ciljniZbroj) {
                    break;
                }
            }

            // Zatim povećavamo manje apoene dok ne postignemo ciljni zbroj
            for (const prioritet of prioritetiPovecanja) {
                const { key, type } = prioritet;
                const vrijednost = type === 'novcanica' ? novcaniceVrijednosti[key] : kovaniceVrijednosti[key];
                let kolicina = type === 'novcanica' ? novcaniceKolicine[key] : kovaniceKolicine[key];

                while (trenutniZbroj < ciljniZbroj) {
                    if (trenutniZbroj + vrijednost > ciljniZbroj) {
                        break;
                    }
                    kolicina++;
                    trenutniZbroj += vrijednost;

                    if (type === 'novcanica') {
                        novcaniceKolicine[key] = kolicina;
                    } else {
                        kovaniceKolicine[key] = kolicina;
                    }

                    if (trenutniZbroj >= ciljniZbroj) {
                        break;
                    }
                }

                if (trenutniZbroj >= ciljniZbroj) {
                    break;
                }
            }


const resultDiv = document.getElementById('result');
resultDiv.className = `result-widget ${resultClass === 'exact' ? 'status-exact' : resultClass === 'positive' ? 'status-positive' : 'status-negative'}`;
resultDiv.innerHTML = `
    <div>Trebaš imati: ${ukupnoStvarno.toFixed(2)} €</div>
    <div>Ti imaš: ${(stvarno).toFixed(2)} €</div>
    <div>Rezultat: ${status}</div>
`;




    // Prikaz prilagođenih unosa s točnim putanjama za slike
    let prilagodeniDetails = '<div><strong></strong></div>';
    let detaljiKovanice = '';
    let detaljiNovcanice = '';


// Generiramo HTML za kovanice
Object.keys(kovaniceVrijednosti).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(key => {
    let prilagodeniIznos = kovaniceKolicine[key] * kovaniceVrijednosti[key];
    let kolicina = kovaniceKolicine[key];
    let slikaSrc = staticImagePaths[key];

    if (kolicina > 0) {
        detaljiKovanice += `<div class="currency-items" style="display: flex; align-items: center; width: 100%; font-size: 26px;">
                                <img src="${slikaSrc}" alt="${key}€" style="height: 50px; margin-right: 10px;">
                                <span>${kolicina} * ${key}€ = ${prilagodeniIznos.toFixed(2)}€</span>
                            </div>`;
    }
});

// Dodajemo gotovinu ispod kovanica, formatirano kao traženo
if (gotovina > 0) {
    detaljiKovanice += `<div class="currency-items" style="display: flex; align-items: center; width: 100%; font-size: 26px;">
                            <span style="text-align: right;">Gotovina: ${gotovina} * 1€ = ${gotovina.toFixed(2)} €</span>
                        </div>`;
}

// Generiramo HTML za novčanice
Object.keys(novcaniceVrijednosti).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(key => {
    let prilagodeniIznos = novcaniceKolicine[key] * novcaniceVrijednosti[key];
    let kolicina = novcaniceKolicine[key];
    let slikaSrc = staticImagePaths[key];

    if (kolicina > 0) {
        detaljiNovcanice += `<div class="currency-items" style="display: flex; align-items: center; width: 100%; font-size: 26px;">
                                <img src="${slikaSrc}" alt="${key}€" style="height: 50px; margin-right: 10px;">
                                <span>${kolicina} * ${key}€ = ${prilagodeniIznos.toFixed(2)}€</span>
                            </div>`;
    }
});

// Prikaz prilagođenih unosa u dvije kolone
prilagodeniDetails += `<div class="currency-columns">
                            <div class="currency-left">${detaljiKovanice}</div>
                            <div class="currency-right">${detaljiNovcanice}</div>
                        </div>
                        <div style="text-align: right; font-size: 26px;"><strong>Zbroj svega:</strong> ${(stvarno).toFixed(2)} €</div>`;

document.getElementById('prilagodeniDetails').innerHTML = prilagodeniDetails;



// Prikaz modalnog prozora
modal.classList.add("maximize-modal");
modal.style.display = "block";

            // Send calculation data to the server
    const response = await fetch('/save_calculation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            pocetni_polog: pocetniPolog,
            dnevni_promet: dnevniPromet,
            ukupno: ukupnoStvarno,
            stvarno: stvarno,
            status: status,
            novcanice: novcaniceKolicine,
            kovanice: kovaniceKolicine,
            gotovina: gotovina
        })
    });


            const saveResult = await response.json();
            if (saveResult.success) {
                console.log('Calculation saved successfully');
            } else {
                console.error('Error saving calculation:', saveResult.message);
            }
        });

        // Zatvaranje modalnog prozora kada korisnik klikne na X
        span.onclick = function() {
            modal.style.display = "none";
        };












document.querySelectorAll('input').forEach((input, index, inputs) => {
    input.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // Sprječava zadano ponašanje Enter tipke
            const nextInput = inputs[index + 1]; // Dohvati sljedeći input
            if (nextInput) {
                nextInput.focus(); // Postavi fokus na sljedeći input
            } else {
                inputs[0].focus(); // Vrati fokus na prvi input ako je zadnji polje
            }
        }
    });
});

document.querySelectorAll('input').forEach(input => {
    input.addEventListener('focus', function() {
        input.select(); // Selektira cijeli sadržaj unutar polja kada dobije fokus
    });
});
