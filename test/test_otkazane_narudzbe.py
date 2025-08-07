import datetime
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


def dohvati_otkazane_narudzbe(from_date, to_date):
    remaris_domain, remaris_username, remaris_password, id_lokacije, id_organizacije, id_pos_uredjaja = potrebni_podatci()
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
        "OrderType": "40",  # Otkazane narudžbe
        "BuyerId": "",
        "allIds": [],
        "sort": "AccountingDate"
    }

    response = session_requests.post(url_orders, json=payload, headers=headers, verify=False)
    if response.status_code != 200:
        return {'success': False, 'message': 'Neuspješan dohvat otkazanih narudžbi.'}

    try:
        response_json = response.json()
        narudzbe = response_json.get('data', [])

        return {
            'success': True,
            'broj_otkazanih_narudzbi': len(narudzbe),
            'narudzbe': narudzbe  # Možeš ispisati detalje po potrebi
        }

    except json.JSONDecodeError:
        return {'success': False, 'message': 'Greška pri parsiranju odgovora.'}


# Test poziv
if __name__ == "__main__":
    from_this_date = "23.07.2025"
    to_this_date = "23.07.2025"
    rezultat = dohvati_otkazane_narudzbe(from_this_date, to_this_date)

    if rezultat["success"] and rezultat["broj_otkazanih_narudzbi"] > 0:
        for narudzba in rezultat["narudzbe"]:
            print(f'Total: {narudzba.get("Total", 0)} €')
    else:
        print("Nema otkazanih narudžbi ili dohvatanje nije uspjelo.")
