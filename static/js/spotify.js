let token = "BQDCqGTTEuHahoC2PmGjwVQOggx80ENdCURWC7tQG-OsZQNELtmQMuyA3Xhh51M9rV-G9L9kd2UgYRC_cHnrrvqbMn191I-_ZIAUQFhfL2fMqX7EpylnodfAcBxShvly0_esdSdD67EeS0dxXyX2w5Nns_OeydHUY3c5hauONM2zk5i1RzkBX0yJhUv5gRNO6tsLxWgucgewV8SqeuXW4BkKYOmFjYEP0A_7rWdDZJF_i24VC-DiKQrsuZeGp2HvUR6YTy9J7HA";

let player;

window.onSpotifyWebPlaybackSDKReady = () => {
  player = new Spotify.Player({
    name: "My Web Player",
    getOAuthToken: cb => { cb(token); },
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
