let player;
let currentState = null;

window.onSpotifyWebPlaybackSDKReady = async () => {
  const accessToken = localStorage.getItem("access_token");
  const refreshToken = localStorage.getItem("refresh_token");

  if (!accessToken || !refreshToken) {
    console.warn("⛔ Tokeni nedostaju.");
    window.location.href = "/spotify_auth";
    return;
  }

  const token = await getValidToken();
  if (!token) return;

  player = new Spotify.Player({
    name: "My Web Player",
    getOAuthToken: cb => cb(token),
    volume: 0.5
  });

  player.addListener("ready", ({ device_id }) => {
    console.log("✅ Player spreman. ID:", device_id);
    playTrack(device_id, token);
  });

  player.addListener("not_ready", ({ device_id }) => {
    console.log("⛔ Player nije spreman:", device_id);
  });

  player.addListener("player_state_changed", state => {
    if (!state) return;
    currentState = state;

    const currentTrack = state.track_window.current_track;
    document.getElementById("trackName").textContent = currentTrack.name;
    document.getElementById("artistName").textContent = currentTrack.artists.map(a => a.name).join(", ");
    document.getElementById("albumImage").src = currentTrack.album.images[0].url;
    document.getElementById("playPause").textContent = state.paused ? "▶️" : "⏸️";

    updateTime(state);
  });

  player.connect();

  setInterval(() => updateSeekBar(), 1000);
};

// 🎵 Automatska pjesma
function playTrack(device_id, token) {
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
}

// 🔁 Token management
async function getValidToken() {
  const accessToken = localStorage.getItem("access_token");
  const refreshToken = localStorage.getItem("refresh_token");
  const tokenTimestamp = parseInt(localStorage.getItem("token_timestamp") || "0");
  const expiresIn = 3600 * 1000;
  const now = Date.now();

  if (!refreshToken) {
    window.location.href = "/spotify_auth";
    return null;
  }

  if (now - tokenTimestamp >= expiresIn) {
    const response = await fetch("/refresh_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("token_timestamp", Date.now());
      return data.access_token;
    } else {
      alert("⚠️ Neuspješno osvježavanje tokena.");
      return null;
    }
  }

  return accessToken;
}

// 🎧 Kontrole
function togglePlay() {
  if (!player) return;
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

function changeVolume(delta) {
  if (!player) return;
  player.getVolume().then(vol => {
    let newVol = Math.min(1, Math.max(0, vol + delta));
    player.setVolume(newVol);
    document.getElementById("volumeSlider").value = newVol;
  });
}

function setVolume(value) {
  if (!player) return;
  player.setVolume(parseFloat(value));
}

// 🕓 Prikaz vremena i seek
function updateTime(state) {
  const position = state.position / 1000;
  const duration = state.duration / 1000;

  document.getElementById("currentTime").textContent = formatTime(position);
  document.getElementById("duration").textContent = formatTime(duration);
  document.getElementById("seekBar").max = duration;
  document.getElementById("seekBar").value = position;
}

function updateSeekBar() {
  if (!currentState) return;
  currentState.position += 1000;
  updateTime(currentState);
}

document.getElementById("seekBar").addEventListener("input", e => {
  if (!player) return;
  const seconds = parseFloat(e.target.value);
  player.seek(seconds * 1000);
});

function formatTime(sec) {
  const minutes = Math.floor(sec / 60);
  const seconds = Math.floor(sec % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// 🔁 Automatsko osvježavanje tokena
if (localStorage.getItem("refresh_token")) {
  setInterval(async () => {
    console.log("🕒 Osvježavam token...");
    await getValidToken();
  }, 3300000);
}
