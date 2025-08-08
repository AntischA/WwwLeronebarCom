
let player;

window.onSpotifyWebPlaybackSDKReady = async () => {
  const token = await getValidToken();
  if (!token) return;

  const player = new Spotify.Player({
    name: "My Web Player",
    getOAuthToken: cb => cb(token),
    volume: 0.5
  });


  // Prikaz statusa
  player.addListener("ready", ({ device_id }) => {
    console.log("Player spreman. Device ID:", device_id);

    // Automatski pusti pesmu kad je spreman
    fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device_id}`, {
      method: "PUT",
      body: JSON.stringify({
        uris: ["spotify:track:7GhIk7Il098yCjg4BQjzvb"] // Never Gonna Give You Up
      }),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    // frontend na stranici koja se otvori nakon autorizacije
fetch(window.location.href)
  .then(res => res.json())
  .then(data => {
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    localStorage.setItem("token_timestamp", Date.now());
    window.location.href = "/spotify";  // preusmjeri na Spotify player
  });




  });

  player.addListener("not_ready", ({ device_id }) => {
    console.log("Player nije spreman:", device_id);
  });

  player.addListener("player_state_changed", state => {
    if (!state) return;

    const currentTrack = state.track_window.current_track;
    document.getElementById("trackName").textContent = currentTrack.name;
    document.getElementById("artistName").textContent = currentTrack.artists.map(artist => artist.name).join(", ");
    document.getElementById("albumImage").src = currentTrack.album.images[0].url;

    document.getElementById("playPause").textContent = state.paused ? "PLAY" : "PAUSE";
  });

  player.connect();
};

// Kontrole
function togglePlay() {
  player.togglePlay();
}

function nextTrack() {
  player.nextTrack();
}

function previousTrack() {
  player.previousTrack();
}

function changeVolume(amount) {
  player.getVolume().then(volume => {
    let newVolume = Math.min(1, Math.max(0, volume + amount));
    player.setVolume(newVolume).then(() => {
      console.log("Novi volumen:", newVolume);
    });
  });
}

async function getValidToken() {
  const accessToken = localStorage.getItem("access_token");
  const refreshToken = localStorage.getItem("refresh_token");
  const tokenTimestamp = parseInt(localStorage.getItem("token_timestamp") || "0");

  const expiresIn = 3600 * 1000;  // 1 sat u ms

  const now = Date.now();
  if (now - tokenTimestamp >= expiresIn) {
    console.log("Token istekao, osvježavam...");

    const response = await fetch("/refresh_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("token_timestamp", Date.now());
      return data.access_token;
    } else {
      alert("Greška pri osvježavanju tokena.");
      return null;
    }
  }

  return accessToken;
}
