let player;
let deviceId = null;

// Kada je SDK spreman
window.onSpotifyWebPlaybackSDKReady = async () => {
  const token = await getValidToken();
  if (!token) return;

  player = new Spotify.Player({
    name: 'Lerone Web Player',
    getOAuthToken: cb => cb(token),
    volume: 0.5
  });

  player.addListener('ready', ({ device_id }) => {
    console.log('🎶 Player spreman, ID:', device_id);
    deviceId = device_id;
    autoPlay(token, device_id);
    loadPlaylists(token);
  });

  player.addListener('player_state_changed', state => {
    if (!state) return;
    const current = state.track_window.current_track;
    document.getElementById("trackName").textContent = current.name;
    document.getElementById("artistName").textContent = current.artists.map(a => a.name).join(", ");
    document.getElementById("albumImage").src = current.album.images[0].url;
    document.getElementById("playPause").textContent = state.paused ? "PLAY" : "PAUSE";
  });

  player.connect();
};

function autoPlay(token, device_id) {
  fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device_id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      uris: ["spotify:track:7GhIk7Il098yCjg4BQjzvb"]  // Example song
    })
  });
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
function changeVolume(amount) {
  if (!player) return;
  player.getVolume().then(vol => {
    let newVol = Math.min(1, Math.max(0, vol + amount));
    player.setVolume(newVol);
    console.log("🔊 Volume:", newVol);
  });
}

// 🧠 Token refresher
async function getValidToken() {
  const accessToken = localStorage.getItem("access_token");
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) {
    window.location.href = "/spotify_auth";
    return null;
  }

  const ts = parseInt(localStorage.getItem("token_timestamp") || "0");
  if (Date.now() - ts >= 3600 * 1000) {
    const res = await fetch("/refresh_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    const data = await res.json();
    if (res.ok) {
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

// 🔁 Auto refresh tokena
if (localStorage.getItem("refresh_token")) {
  setInterval(getValidToken, 3300000); // 55 min
}

// 📁 Playlist Management
async function loadPlaylists(token) {
  const res = await fetch("https://api.spotify.com/v1/me/playlists", {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const data = await res.json();
  const list = document.getElementById("playlistList");
  list.innerHTML = "";
  data.items.forEach(pl => {
    const li = document.createElement("li");
    li.textContent = pl.name;
    li.style.cursor = "pointer";
    li.onclick = () => loadPlaylistTracks(pl.id, token);
    list.appendChild(li);
  });
}

async function createPlaylist() {
  const name = document.getElementById("newPlaylistName").value.trim();
  if (!name) return alert("Unesi ime playliste!");

  const token = await getValidToken();

  const profileRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const user = await profileRes.json();

  const createRes = await fetch(`https://api.spotify.com/v1/users/${user.id}/playlists`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name })
  });

  if (createRes.ok) {
    alert("✅ Playlista kreirana!");
    loadPlaylists(token);
    document.getElementById("newPlaylistName").value = "";
  } else {
    alert("❌ Greška pri kreiranju.");
  }
}

async function loadPlaylistTracks(playlistId, token) {
  const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const data = await res.json();
  const container = document.getElementById("playlistTracks");
  container.innerHTML = "<h3>Trake u playlisti:</h3>";
  data.items.forEach(item => {
    const div = document.createElement("div");
    const track = item.track;
    div.textContent = `${track.name} – ${track.artists.map(a => a.name).join(", ")}`;
    container.appendChild(div);
  });
}
