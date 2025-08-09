let player;
let deviceId = null;
let currentPlaylistUri = null;
let currentTracks = [];        // {name, artists, uri, albumImage, originalIndex}
let trackUriToLi = new Map();  // mapa za highlight i scroll
let lastPlayingEl = null;
let displayedOrder = [];       // trenutan prikaz u desnoj listi
let customOrder = null;        // aktivni queue (redoslijed koji Next/Prev prate)
let customIndex = -1;          // indeks u customOrder
let currentTrackUri = null;    // pratimo trenutnu traku
let crossfadeMs = 5000;        // 5s crossfade

const sleep = (ms) => new Promise(r => setTimeout(r, ms));


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

  // NEW:
  currentTrackUri = current.uri;
  if (customOrder) {
    const idx = customOrder.findIndex(t => t.uri === current.uri);
    if (idx !== -1) customIndex = idx;
  }
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
  displayedOrder = tracksArray.slice(); // zapamti trenutan prikaz
  const listEl = document.getElementById("tracksList");
  listEl.innerHTML = "";
  trackUriToLi.clear();

  displayedOrder.forEach((item, idx) => {
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

    // klik na stavku svira prema trenutnom PRIKAZU
    li.onclick = () => {
      customOrder = displayedOrder.slice();
      playByCustomIndex(idx, true); // s crossfade-om
    };

    // ⬇️ novo: ako je ovo trenutno svirajuća, odmah je označi
    if (item.uri === currentTrackUri) {
      li.classList.add("playing");
      lastPlayingEl = li;
    }

    listEl.appendChild(li);
    trackUriToLi.set(item.uri, li);
  });
}

async function playByCustomIndex(index, doCrossfade = false) {
  if (!customOrder || index < 0 || index >= customOrder.length) return;
  const uris = customOrder.map(t => t.uri);
  customIndex = index;

  const token = await getValidToken();
  if (!token) return;

  const startPlayback = () => fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ uris, offset: { position: index }, position_ms: 0 })
  });

  if (doCrossfade) {
    await crossfadeTo(startPlayback);
  } else {
    await startPlayback();
  }
}

// Umesto dosadašnje crossfadeTo:
async function crossfadeTo(startNextFn, opts = {}) {
  if (!player) return;

  const startVol = await player.getVolume();
  const totalMs = opts.totalMs ?? crossfadeMs;  // npr 5000
  const preMs   = opts.preMs   ?? 2000;         // koliko dugo stišavamo "kao" staru (2s)
  const postMs  = Math.max(0, totalMs - preMs); // koliko dugo pojačavamo novu (3s)
  const minVol  = opts.minVol  ?? 0.08;         // "dno" volumena pre switcha (tiho, ali ne 0)

  const preSteps  = 10;                         // koraci za fade down
  const postSteps = 20;                         // koraci za fade up
  const preInt    = preMs  / preSteps;
  const postInt   = postMs / postSteps;

  // 1) Fade down (globalno) – subjektivno “stišavamo staru”
  for (let i = 0; i <= preSteps; i++) {
    const v = startVol - ( (startVol - minVol) * (i / preSteps) );
    await player.setVolume(Math.max(minVol, v));
    await sleep(preInt);
  }

  // 2) SWITCH odmah na sledeću (na niskom volumenu)
  await startNextFn();

  // 3) Fade in do prvobitnog volumena
  for (let i = 0; i <= postSteps; i++) {
    const v = minVol + ( (startVol - minVol) * (i / postSteps) );
    await player.setVolume(Math.min(startVol, v));
    await sleep(postInt);
  }
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

function shuffleTrackList() {
  const copy = currentTracks.slice();

  // Fisher–Yates
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  renderTracks(copy);
  customOrder = copy.slice();

  const idx = customOrder.findIndex(t => t.uri === currentTrackUri);
  customIndex = (idx !== -1) ? idx : 0;

  if (currentTrackUri) {
    requestAnimationFrame(() => {
      highlightAndCenterCurrentTrack(currentTrackUri);
    });
  }

  // ⬇️ KLJUČNI KORAK: reprogramiraj queue na novi poredak,
  // ostajući na istoj pesmi i istoj poziciji.
  applyCustomQueueAtCurrentTrack({ preservePosition: true });
}

async function applyCustomQueueAtCurrentTrack({ preservePosition = true } = {}) {
  if (!customOrder || customIndex < 0) return;

  const token = await getValidToken();
  if (!token) return;

  const uris = customOrder.map(t => t.uri);

  let position_ms = 0;
  if (preservePosition && player) {
    const st = await player.getCurrentState();
    if (st) position_ms = st.position || 0;
  }

  // Ovime Spotify-ju "uvaljujemo" novi queue (na istoj pesmi i istoj poziciji).
  await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({
      uris,
      offset: { position: customIndex },
      position_ms
    })
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

function highlightAndCenterCurrentTrack(trackUri) {
  if (!trackUriToLi.has(trackUri)) return;

  // skini prethodni highlight
  if (lastPlayingEl) lastPlayingEl.classList.remove("playing");

  const el = trackUriToLi.get(trackUri);
  el.classList.add("playing");
  lastPlayingEl = el;

  // scroll-uj tako da je u sredini vidnog polja
  el.scrollIntoView({ block: "center", behavior: "smooth" });
}


function togglePlay() {
  if (!player) return;
  player.togglePlay();
}
function nextTrack() {
  if (customOrder) {
    const next = Math.min(customOrder.length - 1, customIndex + 1);
    playByCustomIndex(next, true); // crossfade
  } else if (player) {
    player.nextTrack();
  }
}

function previousTrack() {
  if (customOrder) {
    const prev = Math.max(0, customIndex - 1);
    playByCustomIndex(prev, true); // crossfade unazad
  } else if (player) {
    player.previousTrack();
  }
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
