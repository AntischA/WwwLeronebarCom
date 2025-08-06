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
        }
    } else {
        clickCount = 0; // reset ako klik nije iznad forme
    }
});

// Zatvori welcome modal klikom na dugme
document.getElementById('closeWelcomeBtn').addEventListener('click', function() {
    document.getElementById('welcomeModal').style.display = 'none';
});
