let player;
let deviceId = null;
let currentPlaylistUri = null;
let currentTracks = [];        // {name, artists, uri, albumImage, originalIndex}
let trackUriToLi = new Map();  // mapa za highlight i scroll
let lastPlayingEl = null;
let pinCurrentOnTop = false; // kad je true, ne centriramo – svirajuća stoji na vrhu


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

  // ⬇️ novo: highlight + centriranje
  highlightAndCenterCurrentTrack(current.uri);
});

  player.connect();
};

function playPlaylist(uri, autoPlay = false) {
  currentPlaylistUri = uri;
  const playlistId = uri.split(':').pop(); // "spotify:playlist:XYZ" -> "XYZ"

  getValidToken().then(token => {
    // 1) pusti playlistu
    fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ context_uri: uri })
    }).then(() => {
      if (autoPlay) {
        setTimeout(() => { togglePlay(); }, 1000);
      }
    });

    // 2) učitaj i prikaži pesme u desnoj koloni
    loadPlaylistTracks(playlistId);
  });
}

async function loadPlaylistTracks(playlistId) {
  const token = await getValidToken();
  if (!token) return;

  let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;
  let items = [];

  while (url) {
    const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
    const data = await res.json();
    if (!data || !data.items) break;
    items = items.concat(data.items);
    url = data.next; // Spotify vraća full URL za sledeću stranicu ili null
  }

  // Normalizacija u naš format
  currentTracks = items
    .map((it, idx) => {
      const t = it.track;
      if (!t) return null;
      return {
        name: t.name,
        artists: (t.artists || []).map(a => a.name).join(", "),
        uri: t.uri,
        albumImage: (t.album && t.album.images && t.album.images.length)
          ? t.album.images[t.album.images.length - 1].url // najmanja slika
          : "",
        originalIndex: idx
      };
    })
    .filter(Boolean);

  renderTracks(currentTracks);
}

function renderTracks(tracksArray) {
  const listEl = document.getElementById("tracksList");
  listEl.innerHTML = "";
  trackUriToLi.clear();

  tracksArray.forEach(item => {
    const li = document.createElement("li");
    li.className = "track-item";

    const img = document.createElement("img");
    img.src = item.albumImage || "";
    img.alt = "Cover";
    img.className = "track-thumb";

    const textWrap = document.createElement("div");
    textWrap.className = "track-text";
    const title = document.createElement("div");
    title.className = "track-title";
    title.textContent = item.name;
    const artist = document.createElement("div");
    artist.className = "track-artist";
    artist.textContent = item.artists;

    textWrap.appendChild(title);
    textWrap.appendChild(artist);

    li.appendChild(img);
    li.appendChild(textWrap);

    li.onclick = () => playTrackByOriginalIndex(item.originalIndex);

    listEl.appendChild(li);
    trackUriToLi.set(item.uri, li);
  });
}

function playTrackByOriginalIndex(originalIndex) {
  if (!currentPlaylistUri || originalIndex == null) return;

  getValidToken().then(token => {
    fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        context_uri: currentPlaylistUri,
        offset: { position: originalIndex },
        position_ms: 0
      })
    }).then(() => {
      // ništa posebno – player_state_changed će odraditi highlight i scroll
    });
  });
}

async function shuffleTrackList() {
  // 1) Dohvati trenutno stanje playera (trenutna pjesma + pozicija)
  const state = await player.getCurrentState();
  if (!state || !state.track_window || !state.track_window.current_track) return;

  const currentUri = state.track_window.current_track.uri;
  const currentPosMs = state.position || 0;

  // 2) Fisher–Yates shuffle kopije
  const shuffled = currentTracks.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // 3) Premjesti trenutno svirajuću na index 0 (vrh liste)
  const idx = shuffled.findIndex(t => t.uri === currentUri);
  if (idx > 0) {
    const [nowPlaying] = shuffled.splice(idx, 1);
    shuffled.unshift(nowPlaying);
  }

  // 4) Render UI sa svirajućom na vrhu
  pinCurrentOnTop = true;       // ne centriramo više – želimo da ostane na vrhu
  renderTracks(shuffled);

  // 5) Zamijeni Spotify queue istim tim poretkom (globalno, vidljivo i u Spotify aplikaciji)
  const uris = shuffled.map(t => t.uri);
  const token = await getValidToken();
  if (!token) return;

  // Ovo će: postaviti novi red (uris), prva pjesma je trenutna (offset:0), zadržati trenutnu poziciju u pjesmi
  await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      uris: uris,
      offset: { position: 0 },
      position_ms: currentPosMs
    })
  });

  // (Opcionalno) ako želiš da se odmah i nastavi sviranje (ako je bila pauza), pozovi togglePlay();
  // player_state_changed će već obojiti prvu stavku kao "playing".
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


function highlightAndCenterCurrentTrack(trackUri) {
  if (!trackUriToLi.has(trackUri)) return;

  if (lastPlayingEl) lastPlayingEl.classList.remove("playing");
  const el = trackUriToLi.get(trackUri);
  el.classList.add("playing");
  lastPlayingEl = el;

  // Ako NISMO u modu "drži trenutno na vrhu", centriraj u listi (staro ponašanje)
  if (!pinCurrentOnTop) {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  // Ako jesmo, ne radimo centriranje – već je na vrhu nakon shuffle-a.
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
