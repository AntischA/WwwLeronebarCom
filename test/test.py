import datetime
import requests
import urllib3
import json
import re
from collections import defaultdict

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def potrebni_podatci():
    remaris_domain = 'maluma'
    remaris_username = 'ante'
    remaris_password = 'antehaker2'
    id_lokacije = '5'
    id_organizacije = '6'
    id_pos_uredjaja = '6'
    return remaris_domain, remaris_username, remaris_password, id_lokacije, id_organizacije, id_pos_uredjaja


def logiranje_na_domenu(session_requests, remaris_domain, remaris_username, remaris_password):
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


def izvuci_artikle_iz_opisa(opis):
    artikli = []
    matches = re.findall(r'STAVKE\s*\[(.*?)\]', opis)
    for match in matches:
        # Precizno hvata naziv i količinu bez da se razbije artikl koji sadrži zarez u nazivu
        item_matches = re.findall(r'([^,]+?)\s*\(([\d,\.]+)\)', match)
        for naziv, kolicina in item_matches:
            naziv = naziv.strip()
            try:
                kolicina = float(kolicina.replace(',', '.'))
            except ValueError:
                kolicina = 1.0
            artikli.append((naziv, kolicina))
    return artikli



def radnje_korisnika(from_date, to_date):
    remaris_domain, remaris_username, remaris_password, id_lokacije, id_organizacije, id_pos_uredjaja = potrebni_podatci()
    session_requests = requests.Session()

    if logiranje_na_domenu(session_requests, remaris_domain, remaris_username, remaris_password):
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
                filtered_data = []
                artikli_statistika = defaultdict(lambda: {'broj': 0, 'kolicina': 0.0})

                for item in fetched_data:
                    opis = item.get('action', '')
                    vrsta_akcije = item.get('actionType', '')
                    iznos = float(item.get('decimalValue', 0.0))
                    vrijeme = format_time_order_items(item.get('date'))

                    if vrsta_akcije == "Naplata" and "STOL" in opis:
                        vrsta_akcije = "Naplata stola"

                    if vrsta_akcije.startswith("Naplata"):
                        artikli = izvuci_artikle_iz_opisa(opis)
                        for naziv, kolicina in artikli:
                            artikli_statistika[naziv]['broj'] += 1
                            artikli_statistika[naziv]['kolicina'] += kolicina

                    filtered_data.append({
                        'vrijeme': vrijeme,
                        'opis': opis,
                        'vrsta_akcije': vrsta_akcije,
                        'iznos': f"{iznos:.2f} €"
                    })

                return {
                    'success': True,
                    'data': filtered_data,
                    'potrosnja_artikala': dict(artikli_statistika)
                }

            except json.JSONDecodeError:
                return {'success': False, 'message': 'Greška pri parsiranju odgovora.'}
        else:
            return {'success': False, 'message': 'Neuspješan dohvat podataka.'}
    else:
        return {'success': False, 'message': 'Neuspješna prijava.'}


# Test poziv
if __name__ == "__main__":
    from_date = "28.07.2025"
    to_date = "28.07.2025"
    rezultat = radnje_korisnika(from_date, to_date)
    print(json.dumps(rezultat, indent=2, ensure_ascii=False))

