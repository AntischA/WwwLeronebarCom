let clickCount = 0;
let clickTimer;

document.addEventListener('click', function(event) {
    const formRect = document.getElementById('calculatorForm').getBoundingClientRect();
    const clickY = event.clientY;

    // Provjeri je li klik iznad calculatorForm
    if (clickY < formRect.top) {
        clickCount++;

        if (clickCount === 1) {
            clickTimer = setTimeout(() => {
                clickCount = 0;
            }, 500); // maksimalno 500ms između klikova
        }

        if (clickCount === 4) {
            clearTimeout(clickTimer);
            clickCount = 0;

            // Prikaži welcome modal
            const welcomeModal = document.getElementById('welcomeModal');
            welcomeModal.style.display = 'flex';

            // Pozovi API i upiši total
            dohvatOtkazanihNarudzbiZaWelcome();
        }

    } else {
        clickCount = 0; // reset ako klik nije iznad forme
    }
});

// Zatvori welcome modal klikom na dugme
document.getElementById('closeWelcomeBtn').addEventListener('click', function() {
    document.getElementById('welcomeModal').style.display = 'none';
});


async function dohvatOtkazanihNarudzbiZaWelcome() {
    const danas = new Date();
    const datum = danas.toLocaleDateString("hr-HR");

    const response = await fetch("/api/otkazane_narudzbe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            from_date: datum,
            to_date: datum
        })
    });

    const data = await response.json();
    const welcomeDiv = document.getElementById("welcomeTotalInfo");

    if (data.success) {
        welcomeDiv.innerHTML = `<p style="margin-top:10px;">📦 Otkazane narudžbe danas: <strong>${data.total.toFixed(2)} €</strong></p>`;
    } else {
        welcomeDiv.innerHTML = `<p style="color:red;">Greška pri dohvaćanju podataka</p>`;
    }
}


// Zatvori modal kada se klikne X
document.querySelector("#resultModal .close").addEventListener("click", () => {
    document.getElementById("resultModal").style.display = "none";
});


document.getElementById('clearAllBtn').addEventListener('click', function() {
    // Ovdje možeš kasnije dodati logiku
    alert("Makni sve – logika još nije definirana");
});
