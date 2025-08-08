let player;

window.onSpotifyWebPlaybackSDKReady = async () => {
  const accessToken = localStorage.getItem("access_token");
  const refreshToken = localStorage.getItem("refresh_token");

  if (!accessToken || !refreshToken) {
    console.warn("⛔ Nema tokena. Redirektujem na /spotify_auth");
    window.location.href = "/spotify_auth";
    return;
  }

  const token = await getValidToken();
  if (!token) return;

  // ✅ Ispravno: bez const/let
  player = new Spotify.Player({
    name: "My Web Player",
    getOAuthToken: cb => cb(token),
    volume: 0.5
  });

  player.addListener("ready", ({ device_id }) => {
    console.log("✅ Player spreman. Device ID:", device_id);

    // Automatski pusti pesmu
    fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device_id}`, {
      method: "PUT",
      body: JSON.stringify({
        uris: ["spotify:track:7GhIk7Il098yCjg4BQjzvb"]
      }),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });
  });

  player.addListener("not_ready", ({ device_id }) => {
    console.log("⛔ Player nije spreman:", device_id);
  });

  player.addListener("player_state_changed", state => {
    if (!state) return;

    const currentTrack = state.track_window.current_track;
    document.getElementById("trackName").textContent = currentTrack.name;
    document.getElementById("artistName").textContent = currentTrack.artists.map(a => a.name).join(", ");
    document.getElementById("albumImage").src = currentTrack.album.images[0].url;
    document.getElementById("playPause").textContent = state.paused ? "PLAY" : "PAUSE";
  });

  player.connect();
};

// 🎵 Kontrole
function togglePlay() {
  if (!player) return console.warn("⛔ Player nije spreman");
  player.togglePlay();
}

function nextTrack() {
  if (!player) return;
  player.nextTrack();
}

function previousTrack() {
  if (!player) return;
  player.previousTrack();
}

function changeVolume(amount) {
  if (!player) return;
  player.getVolume().then(volume => {
    const newVolume = Math.min(1, Math.max(0, volume + amount));
    player.setVolume(newVolume).then(() => {
      console.log("🔊 Novi volumen:", newVolume);
    });
  });
}

// 🔁 Token management
async function getValidToken() {
  const accessToken = localStorage.getItem("access_token");
  const refreshToken = localStorage.getItem("refresh_token");

  if (!refreshToken) {
    console.warn("⚠️ Refresh token ne postoji u localStorage!");
    window.location.href = "/spotify_auth";
    return null;
  }

  const tokenTimestamp = parseInt(localStorage.getItem("token_timestamp") || "0");
  const expiresIn = 3600 * 1000; // 1h
  const now = Date.now();

  if (now - tokenTimestamp >= expiresIn) {
    console.log("⏳ Token istekao, pokušavam osvježiti...");

    const response = await fetch("/refresh_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    const data = await response.json();
    console.log("🔁 Odgovor servera:", data);

    if (response.ok) {
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("token_timestamp", Date.now());
      return data.access_token;
    } else {
      alert("⚠️ Greška pri osvježavanju tokena.");
      return null;
    }
  }

  return accessToken;
}

// 🔁 Automatsko osvježavanje tokena svakih 55 minuta
if (localStorage.getItem("refresh_token")) {
  setInterval(async () => {
    console.log("🕒 Proaktivno provjeravam token...");
    await getValidToken();
  }, 3300000); // 55 minuta
}
