# Koristi Python 3.12 kao osnovnu sliku
FROM python:3.12

# Postavi radni direktorijum
WORKDIR /app

# Kopiraj potrebne fajlove u kontejner
COPY requirements.txt requirements.txt
COPY app.py app.py
COPY static static
COPY templates templates
COPY api api

# Instaliraj Python pakete
RUN pip install --no-cache-dir -r requirements.txt

# Pokreni aplikaciju koristeći Gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "app:app"]
