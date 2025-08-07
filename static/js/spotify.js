let token = "BQDCqGTTEuHahoC2PmGjwVQOggx80ENdCURWC7tQG-OsZQNELtmQMuyA3Xhh51M9rV-G9L9kd2UgYRC_cHnrrvqbMn191I-_ZIAUQFhfL2fMqX7EpylnodfAcBxShvly0_esdSdD67EeS0dxXyX2w5Nns_OeydHUY3c5hauONM2zk5i1RzkBX0yJhUv5gRNO6tsLxWgucgewV8SqeuXW4BkKYOmFjYEP0A_7rWdDZJF_i24VC-DiKQrsuZeGp2HvUR6YTy9J7HA";

window.onSpotifyWebPlaybackSDKReady = () => {
  const player = new Spotify.Player({
    name: "My Web Player",
    getOAuthToken: cb => { cb(token); },
    volume: 0.5
  });

  // Eventovi
player.addListener("ready", ({ device_id }) => {
  console.log("Ready with Device ID", device_id);

  // 🎵 Pusti pjesmu odmah
  fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device_id}`, {
    method: "PUT",
    body: JSON.stringify({
      uris: ["spotify:track:7GhIk7Il098yCjg4BQjzvb"]  // primjer pjesme: Rick Astley - Never Gonna Give You Up
    }),
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    }
  });
});


  player.addListener("not_ready", ({ device_id }) => {
    console.log("Device ID has gone offline", device_id);
  });

  player.addListener("player_state_changed", state => {
    if (!state) return;

    const track = state.track_window.current_track;
    document.getElementById("trackName").textContent = track.name;
    document.getElementById("artistName").textContent = track.artists[0].name;
    document.getElementById("albumImage").src = track.album.images[0].url;

    const playPauseBtn = document.getElementById("playPause");
    playPauseBtn.textContent = state.paused ? "PLAY" : "PAUSE";
  });

  player.connect();

  // Kontrole
  window.togglePlay = async () => {
    const state = await player.getCurrentState();
    if (!state) return;
    player.togglePlay();
  };

  window.nextTrack = () => player.nextTrack();
  window.previousTrack = () => player.previousTrack();

  window.changeVolume = async (delta) => {
    const currentVol = await player.getVolume();
    let newVol = Math.min(1, Math.max(0, currentVol + delta));
    player.setVolume(newVol);
  };
};
