# projekt/api/grant.py
from flask import Blueprint, request, jsonify
from routeros_api import RouterOsApiPool
import os
from routeros_api import RouterOsApiPool  # <— NOVO

# MikroTik API parametri (po želji ih drži u env varijablama)
MT_HOST = os.getenv("MT_HOST", "192.168.88.1")
MT_USER = os.getenv("MT_USER", "admin")
MT_PASS = os.getenv("MT_PASS", "password")   # promijeni!
MT_PORT = int(os.getenv("MT_PORT", "8728"))  # default API port




def mt_connect():
    """
    Vrati (pool, api) konekciju na MikroTik.
    RouterOS v6 traži plaintext_login=True.
    """
    pool = RouterOsApiPool(
        MT_HOST, username=MT_USER, password=MT_PASS,
        port=MT_PORT, plaintext_login=True
    )
    return pool, pool.get_api()


@app.post("/api/grant")
def api_grant():
    """
    Tvoj login.html (na serveru) poziva POST /api/grant sa json:
    { "mac": "C0:06:C3:F6:C3:1F", "hours": 5 }

    Ovdje kreiramo/azuriramo Hotspot user-a na MikroTiku:
      - name = MAC (lakše praćenje)
      - profile = 'standard'  (napravi ga u WinBoxu)
      - limit-uptime = Xh     (npr. 5h)
      - password = 'google'   (isto koristi u hidden formi prema $(link-login-only))
    """
    try:
        data = request.get_json(force=True)
    except Exception:
        return jsonify(success=False, error="invalid json"), 400

    mac = (data or {}).get("mac", "").upper().strip()
    hours = int((data or {}).get("hours", 5))

    if not mac:
        return jsonify(success=False, error="missing mac"), 400
    if hours <= 0 or hours > 24*24:  # neka razumna granica
        return jsonify(success=False, error="invalid hours"), 400

    pool, api = mt_connect()
    try:
        users = api.get_resource("/ip/hotspot/user")

        existing = []
        try:
            existing = users.get(name=mac)
        except Exception:
            existing = []

        if existing:
            users.set(
                id=existing[0][".id"],
                profile="standard",
                limit_uptime=f"{hours}h",
                password="google",
                comment="auto-grant"
            )
        else:
            users.add(
                name=mac,
                password="google",
                profile="standard",
                limit_uptime=f"{hours}h",
                comment="auto-grant"
            )

        return jsonify(success=True)
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500
    finally:
        pool.disconnect()
