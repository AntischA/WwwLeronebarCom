from flask import Flask, render_template, send_from_directory, redirect, request, jsonify
import os
from api.dohvat_radnja_korisnika import radnje_korisnika
from api.dohvat_otkazanih_narudzbi import dohvati_ukupni_total_otkazanih_narudzbi
import urllib.parse
import requests

CLIENT_ID = "1984f9c1fdff48d3b5ecc493152dc5c4"
CLIENT_SECRET = "e82cf9f67fca4450a68a85ce6ab2f253"
REDIRECT_URI = "https://leronebar.com/callback"

SPOTIFY_SCOPES = "streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state"


app = Flask(__name__, static_folder="static")

# Učitaj API ključ iz okruženja
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
# --- gore u settingsima ---
SPOTIFY_SCOPES = "streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state playlist-read-private playlist-read-collaborative"

@app.route('/spotify_auth')
def spotify_auth():
    query_params = {
        "client_id": CLIENT_ID,
        "response_type": "code",
        "redirect_uri": REDIRECT_URI,
        "scope": SPOTIFY_SCOPES,
        "show_dialog": "true",  # prisili ekran dopuštenja (da dobiješ novi refresh_token s novim scopeovima)
    }
    url = f"https://accounts.spotify.com/authorize?{urllib.parse.urlencode(query_params)}"
    return redirect(url)

@app.route('/refresh_token', methods=['POST'])
def refresh_token():
    refresh_token = request.json.get("refresh_token")

    if not refresh_token:
        return jsonify({"success": False, "message": "Nedostaje refresh_token."}), 400

    payload = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET
    }

    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    response = requests.post("https://accounts.spotify.com/api/token", data=payload, headers=headers)

    if response.status_code == 200:
        data = response.json()
        return jsonify({
            "access_token": data["access_token"],
            "expires_in": data.get("expires_in", 3600)  # u sekundama
        })
    else:
        return jsonify({"success": False, "message": "Neuspješno osvježavanje tokena.", "error": response.text}), 400

@app.route('/callback')
def spotify_callback():
    code = request.args.get("code")
    if not code:
        return "Greška: Kod nije poslan!"

    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": REDIRECT_URI,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET
    }

    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    response = requests.post("https://accounts.spotify.com/api/token", data=payload, headers=headers)

    if response.status_code == 200:
        data = response.json()
        access_token = data["access_token"]
        refresh_token = data["refresh_token"]
        return render_template("callback.html", access_token=access_token, refresh_token=refresh_token)
    else:
        return f"Token greška: {response.text}", 400


@app.route('/')
def home():
    return render_template('index.html')


@app.route('/kalkulator')
def prikaz_kalkulator():
    return render_template('kalkulator.html')

@app.route('/dalmacija')
def prikaz_dalmacija():
    return render_template('dalmacija.html')

@app.route('/spotify')
def prikaz_spotify():
    return render_template('spotify.html')


@app.route('/radnje')
def prikaz_radnja_korisnika():
    print("Otvaram radnje_korisnika.html")
    return render_template('radnje_korisnika.html')


# 🔹 API endpoint koji poziva funkciju i vraća JSON
@app.route('/api/radnje_korisnika', methods=['POST'])
def radnje_json():
    data = request.get_json()
    from_date = data.get("from_date")
    to_date = data.get("to_date")

    if not from_date or not to_date:
        return jsonify({"success": False, "message": "Nedostaje datum."}), 400

    return jsonify(radnje_korisnika(from_date, to_date))

@app.route('/api/otkazane_narudzbe', methods=['POST'])
def total_otkazanih():
    data = request.get_json()
    from_date = data.get("from_date")
    to_date = data.get("to_date")

    if not from_date or not to_date:
        return jsonify({"success": False, "message": "Nedostaje datum."}), 400

    return jsonify(dohvati_ukupni_total_otkazanih_narudzbi(from_date, to_date))

@app.route('/cjenik')
def cjenik():
    return redirect("https://www.dotyourspot.com/Fnp253", code=302)  # 302 = Temporary Redirect


@app.route("/<path:filename>")
def serve_static(filename):
    return send_from_directory("static", filename)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(
        host="0.0.0.0",
        port=port,
        debug=True  # 🔹 Omogućava automatski reload servera
    )
