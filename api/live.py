from flask import Blueprint

bp_dohvat_radnji = Blueprint('bp_dohvat_radnji', __name__)

@bp_dohvat_radnji.route("/api/posljednje_transakcije", methods=["GET"])
def posljednje_transakcije():
    """Vraća posljednjih 5 transakcija za današnji dan"""
    today_str = datetime.datetime.now().strftime('%d.%m.%Y')
    result = radnje_korisnika(today_str, today_str)
    if not result.get("success"):
        return jsonify(result)

    data = result.get("data_po_datumima", {}).get(today_str, [])
    if not data:
        return jsonify({"success": True, "items": []})

    # Sortiraj po vremenu, uzmi zadnjih 5
    sorted_items = sorted(data, key=lambda x: x.get("vrijeme", ""), reverse=True)[:5]
    return jsonify({"success": True, "items": sorted_items})
