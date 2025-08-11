# Koristi Python 3.12 kao osnovnu sliku
FROM python:3.12

# Postavi radni direktorij
WORKDIR /app

# Kopiraj potrebne fajlove
COPY requirements.txt requirements.txt
COPY app.py app.py
COPY app_db.py app_db.py
COPY static static
COPY templates templates
COPY api api

# Instaliraj
RUN pip install --no-cache-dir -r requirements.txt

# Environment (Cloud Run može i prebrisati)
ENV DB_PATH=/tmp/listening.sqlite3

# Pokreni koristeći $PORT koji zada Cloud Run
CMD ["bash","-lc","gunicorn --bind 0.0.0.0:${PORT:-8080} --workers 1 --threads 8 app:app"]
