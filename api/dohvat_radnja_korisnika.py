# api/dohvat_radnja_korisnika.py
import datetime
import requests
import urllib3
import json
from flask import request, jsonify

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def potrebni_podatci():
    remaris_domain = 'maluma'
    remaris_username = 'ante'
    remaris_password = 'antehaker2'
    id_lokacije = '5'
    id_organizacije = '6'
    id_pos_uredjaja = '6'

    if not all([remaris_domain, remaris_username, remaris_password, id_lokacije, id_organizacije, id_pos_uredjaja]):
        raise ValueError("Nedostaju ključni podaci u sesiji.")

    return remaris_domain, remaris_username, remaris_password, id_lokacije, id_organizacije, id_pos_uredjaja


def logiranje_na_domenu(session_requests):
    remaris_domain, remaris_username, remaris_password, *_ = potrebni_podatci()
    login_payload = {
        'remaris_domain': remaris_domain,
        'UserName': remaris_username,
        'Password': remaris_password
    }
    login_url = f'https://{remaris_domain}.gastromaster.com.hr/Account/LogOn'
    response = session_requests.post(login_url, data=login_payload, verify=False)
    return response.status_code == 200 and 'LogOn' not in response.url


def format_time_order_items(vrijeme):
    try:
        date_obj = datetime.datetime.strptime(vrijeme, '%d.%m.%Y %H:%M:%S')
        return date_obj.strftime('%H:%M:%S')
    except ValueError:
        return vrijeme


def radnje_korisnika():
    try:
        remaris_domain, remaris_username, remaris_password, id_lokacije, id_organizacije, id_pos_uredjaja = potrebni_podatci()
    except ValueError as e:
        return jsonify({'success': False, 'message': str(e)}), 400

    data = request.json
    from_date = data.get('from_date')
    to_date = data.get('to_date')

    session_requests = requests.Session()
    if logiranje_na_domenu(session_requests):
        url = f"https://{remaris_domain}.gastromaster.com.hr/Reports/GetUserActionsData?isc_dataFormat=json"
        headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json; charset=utf-8',
            'X-Requested-With': 'XMLHttpRequest'
        }
        payload = {
            "dataSource": "userActionsDS",
            "operationType": "fetch",
            "startRow": 0,
            "endRow": 1000,
            "textMatchStyle": "exact",
            "componentId": "userActionsGrid",
            "data": {
                "from": from_date,
                "to": to_date,
                "locationId": id_lokacije,
                "posId": id_pos_uredjaja
            },
            "oldValues": None
        }

        response = session_requests.post(url, json=payload, headers=headers, verify=False)
        if response.status_code == 200:
            try:
                response_json = response.json()
                fetched_data = response_json.get('response', {}).get('data', [])
                if fetched_data:
                    filtered_data = []
                    for item in fetched_data:
                        opis = item.get('action', '')
                        vrsta_akcije = item.get('actionType', '')
                        # Ako je akcija "Naplata" i opis počinje sa "STOL", preimenuj
                        if vrsta_akcije == "Naplata" and opis.strip().startswith("STOL"):
                            vrsta_akcije = "Naplata stola"

                        filtered_data.append({
                            'vrijeme': format_time_order_items(item.get('date')),
                            'opis': opis,
                            'vrsta_akcije': vrsta_akcije,
                            'iznos': f"{item.get('decimalValue'):.2f} €"
                        })

                    return jsonify({'success': True, 'data': filtered_data})
                else:
                    return jsonify({'success': True, 'data': []})
            except json.JSONDecodeError:
                return jsonify({'success': False, 'message': 'Greška pri parsiranju odgovora.'})
        else:
            return jsonify({'success': False, 'message': 'Neuspješan dohvat podataka.'})
    else:
        return jsonify({'success': False, 'message': 'Neuspješna prijava.'})
