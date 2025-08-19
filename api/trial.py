# projekt/api/trial.py
from routeros_api import RouterOsApiPool

MT_HOST = os.getenv("MT_HOST", "192.168.88.1")
MT_USER = os.getenv("MT_USER", "admin")
MT_PASS = os.getenv("MT_PASS", "password")
MT_PORT = int(os.getenv("MT_PORT", "8728"))

def mt_connect():
    pool = RouterOsApiPool(MT_HOST, username=MT_USER, password=MT_PASS,
                           port=MT_PORT, plaintext_login=True)
    return pool, pool.get_api()

@app.post("/api/trial")
def api_trial():
    """
    JSON: { "mac": "AA:BB:CC:DD:EE:FF", "minutes": 2 }
    Kreira/azurira user = MAC sa profile=trial i limit-uptime=2m.
    """
    data = request.get_json(force=True)
    mac = (data.get("mac") or "").upper().strip()
    minutes = int(data.get("minutes") or 2)
    if not mac: return jsonify(success=False, error="missing mac"), 400
    if minutes <= 0 or minutes > 180: return jsonify(success=False, error="invalid minutes"), 400

    pool, api = mt_connect()
    try:
        users = api.get_resource("/ip/hotspot/user")
        existing = []
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
