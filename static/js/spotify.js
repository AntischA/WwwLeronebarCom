let player;
let deviceId = null;
let currentPlaylistUri = null;
let isShuffling = true; // default: uključeno

window.onSpotifyWebPlaybackSDKReady = async () => {
  const token = await getValidToken();
  if (!token) return;

  player = new Spotify.Player({
    name: 'Lerone Web Player',
    getOAuthToken: cb => cb(token),
    volume: 0.5
  });

  player.addListener('ready', ({ device_id }) => {
    deviceId = device_id;
    console.log('🎶 Player spreman, ID:', device_id);
    loadPlaylists(token);
  });

  player.addListener('player_state_changed', state => {
    if (!state) return;
    const current = state.track_window.current_track;
    const progress = (state.position / state.duration) * 100;

    document.getElementById("trackName").textContent = current.name;
    document.getElementById("artistName").textContent = current.artists.map(a => a.name).join(", ");
    document.getElementById("albumImage").src = current.album.images[0].url;
    document.getElementById("playPause").textContent = state.paused ? "PLAY" : "PAUSE";
    document.getElementById("seekSlider").value = progress;

  });

  player.connect();
};

function playPlaylist(uri, autoPlay = false) {
  currentPlaylistUri = uri;
  getValidToken().then(token => {
    fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ context_uri: uri })
    }).then(() => {
      if (autoPlay) {
        // Sačekaj kratko da se učita playlist pre nego što pusti
        setTimeout(() => {
          togglePlay();
        }, 1000); // 1 sekunda je obično dovoljno
      }
    });
  });
}




function seekToPosition(percent) {
  if (!player) return;
  player.getCurrentState().then(state => {
    if (!state) return;
    const duration = state.duration;
    const positionMs = (percent / 100) * duration;
    getValidToken().then(token => {
      fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${Math.floor(positionMs)}&device_id=${deviceId}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
    });
  });
}

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

function setVolume(value) {
  if (!player) return;
  player.setVolume(value).then(() => {
    console.log(`🔊 Volume set to ${value * 100}%`);
  });
}

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

if (localStorage.getItem("refresh_token")) {
  setInterval(getValidToken, 3300000);
}

async function loadPlaylists(token) {
  const res = await fetch("https://api.spotify.com/v1/me/playlists", {
    headers: { "Authorization": `Bearer ${token}` }
  });

  const data = await res.json();
  const list = document.getElementById("playlistList");
  list.innerHTML = "";

  // 🔠 Sortiraj playliste po imenu (A–Ž)
  const sortedPlaylists = data.items.sort((a, b) =>
    a.name.localeCompare(b.name, 'hr', { sensitivity: 'base' })
  );

  let firstPlaylistUri = null;

  sortedPlaylists.forEach((pl, index) => {
    const li = document.createElement("li");
    li.textContent = pl.name;
    li.style.cursor = "pointer";
    li.onclick = () => playPlaylist(pl.uri);
    list.appendChild(li);

    // 🎯 Zapamti URI prve playliste za automatsko pokretanje
    if (index === 0) {
      firstPlaylistUri = pl.uri;
    }
  });

  // ▶️ Automatski pusti prvu playlistu i odmah klikni play
  if (firstPlaylistUri) {
    playPlaylist(firstPlaylistUri, true);
  }
}
