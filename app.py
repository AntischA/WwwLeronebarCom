from flask import Flask, send_from_directory
import os

app = Flask(__name__, static_folder="static")

# Učitaj API ključ iz okruženja
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

@app.route('/')
def home():
    return render_template('index.html')


@app.route("/<path:filename>")
def serve_static(filename):
    return send_from_directory("static", filename)



@app.route("/get-maps-api-key")
def get_maps_api_key():
    return f'<script src="https://maps.googleapis.com/maps/api/js?key={GOOGLE_MAPS_API_KEY}&callback=initMap&libraries=places&map_ids=a4bce58eae79aebb&loading=async" defer></script>'


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
