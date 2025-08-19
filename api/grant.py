# api/grant.py (unutar tvog Flask projekta)
from flask import Blueprint, request, jsonify
from routeros_api import RouterOsApiPool
import os

bp = Blueprint("grant", __name__)

MT_HOST = os.getenv("MT_HOST", "192.168.88.1")
MT_USER = os.getenv("MT_USER", "admin")
MT_PASS = os.getenv("MT_PASS", "password")  # promijeni!
MT_PORT = int(os.getenv("MT_PORT", "8728"))  # API port

def mt():
    pool = RouterOsApiPool(MT_HOST, username=MT_USER, password=MT_PASS, port=MT_PORT, plaintext_login=True)
    return pool, pool.get_api()

@bp.route("/api/grant", methods=["POST"])
def grant():
    data = request.get_json(force=True)
    mac = (data.get("mac") or "").upper()
    hours = int(data.get("hours") or 5)
    if not mac:
        return jsonify(ok=False, error="missing mac"), 400

    pool, api = mt()
    try:
        users = api.get_resource('/ip/hotspot/user')
        # Traži postojećeg usera s tim imenom (MAC kao name)
        existing = users.get(name=mac) if users else []
        if existing:
            # update: profil i limit
            users.set(id=existing[0]['.id'], profile='standard', limit_uptime=f"{hours}h", password='google', comment='auto-grant')
        else:
            # create
            users.add(name=mac, password='google', profile='standard', limit_uptime=f"{hours}h", comment='auto-grant')

        return jsonify(ok=True)
    except Exception as e:
        return jsonify(ok=False, error=str(e)), 500
    finally:
        pool.disconnect()
