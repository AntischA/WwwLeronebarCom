# app.py

from flask import Flask, render_template, send_from_directory, redirect, request, jsonify, session, url_for, render_template_string
import os
from api.dohvat_radnja_korisnika import radnje_korisnika
from api.dohvat_otkazanih_narudzbi import dohvati_ukupni_total_otkazanih_narudzbi
import urllib.parse
import requests
from app_db import init_db, get_day, upsert_day
from routeros_api import RouterOsApiPool
import hmac
import secrets


MT_HOST = os.getenv("MT_HOST", "192.168.88.1")
MT_USER = os.getenv("MT_USER", "admin")
MT_PASS = os.getenv("MT_PASS", "password")
MT_PORT = int(os.getenv("MT_PORT", "8728"))

PRINT_PIN = os.getenv("PRINT_PIN", "778899")
RADNJE_PIN = os.getenv("RADNJE_PIN", "778899")

def mt_connect():
    pool = RouterOsApiPool(MT_HOST, username=MT_USER, password=MT_PASS,
                           port=MT_PORT, plaintext_login=True)
    return pool, pool.get_api()

CLIENT_ID = "1984f9c1fdff48d3b5ecc493152dc5c4"
CLIENT_SECRET = "e82cf9f67fca4450a68a85ce6ab2f253"
REDIRECT_URI = "https://leronebar.com/callback"

SPOTIFY_SCOPES = "streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state"


app = Flask(__name__, static_folder="static")
app.secret_key = os.getenv("FLASK_SECRET_KEY", secrets.token_hex(16))
init_db()

# Učitaj API ključ iz okruženja
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
# --- gore u settingsima ---
SPOTIFY_SCOPES = "streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state playlist-read-private playlist-read-collaborative"



RADNJE_LOGIN_HTML = """
<!doctype html>
<html lang="hr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Zaštićeno · Radnje</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Arial;background:#0b1020;color:#e8eef7;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
    .card{background:#11182a;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.35);padding:24px;max-width:360px;width:92%}
    h1{font-size:1.2rem;margin:0 0 10px}
    label{display:block;margin-bottom:8px;color:#a7b2c6}
    input[type=password]{width:100%;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.25);color:#fff;outline:none}
    button{margin-top:12px;width:100%;padding:12px;border-radius:12px;border:0;cursor:pointer;background:#1db954;color:#062d16;font-weight:800}
    .error{color:#ffb4b4;margin-top:10px}
  </style>
</head>
<body>
  <div class="card">
    <h1>Unesi kod za pristup</h1>
    <form method="post">
      <input type="hidden" name="next" value="{{ next }}">
      <label for="pin">Kod</label>
      <input id="pin" name="pin" type="password" inputmode="numeric" autocomplete="one-time-code" required>
      <button type="submit">Otključaj</button>
      {% if error %}<div class="error">{{ error }}</div>{% endif %}
    </form>
  </div>
</body>
</html>
"""




@app.post("/api/print_auth")
def api_print_auth():
    try:
        data = request.get_json(force=True)
    except Exception:
        return jsonify(success=False, error="invalid json"), 400

    pin = str((data or {}).get("pin", "")).strip()
    ok = hmac.compare_digest(pin, PRINT_PIN)  # sigurna usporedba

    # Ako je točan -> 200 + success=True, inače 401
    return (jsonify(success=True), 200) if ok else (jsonify(success=False), 401)

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

@app.route('/wifi')
def prikaz_wifi():
    return render_template('users.html')

@app.route('/spotify')
def prikaz_spotify():
    return render_template('spotify.html')


@app.route('/radnje_login', methods=['GET', 'POST'])
def radnje_login():
    # gdje se vratiti nakon uspješnog logina
    nxt = request.values.get('next') or url_for('prikaz_radnja_korisnika')

    if request.method == 'POST':
        pin = (request.form.get('pin') or '').strip()
        if hmac.compare_digest(pin, RADNJE_PIN):
            session['radnje_ok'] = True
            # zaštita od open-redirecta
            dest = nxt if str(nxt).startswith('/') else url_for('prikaz_radnja_korisnika')
            return redirect(dest)
        return render_template_string(RADNJE_LOGIN_HTML, error="Pogrešan kod.", next=nxt), 401

    # GET
    return render_template_string(RADNJE_LOGIN_HTML, error=None, next=nxt)


@app.route('/radnje')
def prikaz_radnja_korisnika():
    # ako nije autentificiran, pošalji na login i sačuvaj cijeli URL (s queryjem)
    if not session.get('radnje_ok'):
        full = request.full_path if request.query_string else request.path
        return redirect(url_for('radnje_login', next=full))

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




@app.get('/api/danasnje_pjesme')
def get_today():
    day = request.args.get('date')
    if not day: return jsonify(success=False, error='missing date'), 400
    total, listened = get_day(day)
    return jsonify(success=True, date=day, total_secs=total, listened_secs=listened)

@app.post('/api/danasnje_pjesme')
def post_today():
    data = request.get_json(force=True)
    day = data.get('date')
    if not day: return jsonify(success=False, error='missing date'), 400
    set_total = data.get('set_total_secs')
    delta = data.get('delta_listened_secs')
    total, listened = upsert_day(day, total=set_total, delta=delta)
    return jsonify(success=True, date=day, total_secs=total, listened_secs=listened)


# --- DODAJ: /api/trial (prima i form i json)
@app.post("/api/trial")
def api_trial():
    if request.is_json:
        data = request.get_json(force=True)
        mac = (data.get("mac") or "").upper().strip()
        minutes = int(data.get("minutes") or 2)
    else:
        mac = (request.form.get("mac") or "").upper().strip()
        minutes = int(request.form.get("minutes") or 2)

    if not mac:
        return jsonify(success=False, error="missing mac"), 400
    if minutes <= 0 or minutes > 180:
        return jsonify(success=False, error="invalid minutes"), 400

    pool, api = mt_connect()
    try:
        users = api.get_resource("/ip/hotspot/user")
        try:
            existing = users.get(name=mac)
        except Exception:
            existing = []

        if existing:
            users.set(id=existing[0][".id"], profile="trial",
                      limit_uptime=f"{minutes}m", password="google",
                      comment="auto-trial")
        else:
            users.add(name=mac, password="google", profile="trial",
                      limit_uptime=f"{minutes}m", comment="auto-trial")
        return jsonify(success=True)
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500
    finally:
        pool.disconnect()

# --- DODAJ: /api/grant (ostaje isto, samo u app.py i vraća success)
@app.post("/api/grant")
def api_grant():
    try:
        data = request.get_json(force=True)
    except Exception:
        return jsonify(success=False, error="invalid json"), 400

    mac = (data or {}).get("mac", "").upper().strip()
    hours = int((data or {}).get("hours", 5))
    if not mac:
        return jsonify(success=False, error="missing mac"), 400
    if hours <= 0 or hours > 24*24:
        return jsonify(success=False, error="invalid hours"), 400

    pool, api = mt_connect()
    try:
        users = api.get_resource("/ip/hotspot/user")
        try:
            existing = users.get(name=mac)
        except Exception:
            existing = []

        if existing:
            users.set(id=existing[0][".id"], profile="standard",
                      limit_uptime=f"{hours}h", password="google",
                      comment="auto-grant")
        else:
            users.add(name=mac, password="google", profile="standard",
                      limit_uptime=f"{hours}h", comment="auto-grant")
        return jsonify(success=True)
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500
    finally:
        pool.disconnect()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(
        host="0.0.0.0",
        port=port,
        debug=True  # 🔹 Omogućava automatski reload servera
    )
