from flask import Flask, render_template, send_from_directory, redirect
import os
from api.dohvat_radnja_korisnika import radnje_korisnika

app = Flask(__name__, static_folder="static")

# Učitaj API ključ iz okruženja
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/kalkulator')
def prikaz_kalkulator():
    return render_template('kalkulator.html')

@app.route('/radnje')
def prikaz_radnja_korisnika():
    print("Otvaram radnje_korisnika.html")
    return render_template('radnje_korisnika.html')


# 🔹 API endpoint koji poziva funkciju i vraća JSON
@app.route('/api/radnje_korisnika', methods=['POST'])
def radnje_json():
    return radnje_korisnika()

@app.route('/cjenik')
def cjenik():
    return redirect("https://www.dotyourspot.com/Fnp253", code=302)  # 302 = Temporary Redirect


@app.route("/<path:filename>")
def serve_static(filename):
    return send_from_directory("static", filename)


@app.route("/get-maps-api-key")
def get_maps_api_key():
    return f'<script src="https://maps.googleapis.com/maps/api/js?key={AIzaSyAQxY9g9ua-uI7KzU3-dRujg2WZ_gbQ7Ts}&callback=initMap&libraries=places&map_ids=a4bce58eae79aebb&loading=async" defer></script>'


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)