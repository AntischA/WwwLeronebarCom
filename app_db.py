import sqlite3, os
DB_PATH = os.environ.get('DB_PATH', '/tmp/listening.sqlite3')  # default u /tmp

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with sqlite3.connect(DB_PATH) as con:
        con.execute("""
          CREATE TABLE IF NOT EXISTS listening_daily (
            day TEXT PRIMARY KEY,
            total_secs INTEGER NOT NULL DEFAULT 0,
            listened_secs INTEGER NOT NULL DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        """)
        con.commit()


def get_day(day):
    with sqlite3.connect(DB_PATH) as con:
        row = con.execute("SELECT total_secs, listened_secs FROM listening_daily WHERE day=?", (day,)).fetchone()
        return row if row else (0,0)

def upsert_day(day, total=None, delta=None):
    with sqlite3.connect(DB_PATH) as con:
        cur = con.cursor()
        cur.execute("INSERT OR IGNORE INTO listening_daily(day,total_secs,listened_secs) VALUES(?,0,0)", (day,))
        if total is not None:
            cur.execute("UPDATE listening_daily SET total_secs = ?, updated_at = CURRENT_TIMESTAMP WHERE day=?", (int(total), day))
        if delta:
            cur.execute("UPDATE listening_daily SET listened_secs = listened_secs + ?, updated_at = CURRENT_TIMESTAMP WHERE day=?", (int(delta), day))
        # clamp
        cur.execute("UPDATE listening_daily SET listened_secs = MAX(0, MIN(listened_secs, total_secs)) WHERE day=?", (day,))
        con.commit()
        row = cur.execute("SELECT total_secs, listened_secs FROM listening_daily WHERE day=?", (day,)).fetchone()
        return row
