# dohvat_otkazanih_narudzbi.py
# api/dohvat_otkazanih_narudzbi.py

import requests
import urllib3
import json

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def potrebni_podatci():
    remaris_domain = 'maluma'
    remaris_username = 'ante'
    remaris_password = 'antehaker2'
    id_lokacije = '5'
    id_organizacije = '6'
    id_pos_uredjaja = '6'
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


def dohvati_ukupni_total_otkazanih_narudzbi(from_date, to_date):
    remaris_domain, _, _, id_lokacije, id_organizacije, _ = potrebni_podatci()
    session_requests = requests.Session()

    if not logiranje_na_domenu(session_requests):
        return {'success': False, 'message': 'Neuspješna prijava.'}

    url_orders = f"https://{remaris_domain}.gastromaster.com.hr/Invoicing/GetOrders"
    headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json; charset=utf-8',
        'X-Requested-With': 'XMLHttpRequest'
    }

    payload = {
        "AppContext": {
            "OrganizationId": id_organizacije,
            "LocationId": id_lokacije
        },
        "Context": {
            "OrganizationId": str(id_organizacije),
            "LocationId": str(id_lokacije)
        },
        "OrganizationId": id_organizacije,
        "LocationId": id_lokacije,
        "From": from_date,
        "To": to_date,
        "doSearch": "True",
        "page": 0,
        "perpage": None,
        "TypeName": "AppContextLocation",
        "IsGlobal": "True",
        "ManagerPermissionName": "Fakturiranje",
        "OrderType": "40",
        "BuyerId": "",
        "allIds": [],
        "sort": "AccountingDate"
    }

    response = session_requests.post(url_orders, json=payload, headers=headers, verify=False)
    if response.status_code != 200:
        return {'success': False, 'message': 'Greška u dohvaćanju narudžbi.'}

    try:
        response_json = response.json()
        narudzbe = response_json.get('data', [])
        total = sum(n.get('Total', 0.0) for n in narudzbe)
        return {'success': True, 'total': round(total, 2)}
    except json.JSONDecodeError:
        return {'success': False, 'message': 'Greška pri parsiranju JSON-a.'}
