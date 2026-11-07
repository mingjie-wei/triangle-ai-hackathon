import sqlite3, re
from pathlib import Path
from seed_data import BUILDINGS, EVENTS

DB_PATH = Path(__file__).parent / "campus.db"

def conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c

def init():
    DB_PATH.unlink(missing_ok=True)
    c = conn()
    c.executescript("""
    CREATE TABLE buildings(slug TEXT PRIMARY KEY, name, zone, tagline, about, history, tips, address, image,
        x REAL, y REAL, w REAL, h REAL);
    CREATE TABLE events(id INTEGER PRIMARY KEY, title, category, building, blurb, details, place, "when", url, audience, duration);
    CREATE VIRTUAL TABLE corpus USING fts5(key UNINDEXED, kind UNINDEXED, body, tokenize='porter unicode61');
    """)
    for b in BUILDINGS:
        c.execute("INSERT INTO buildings VALUES(:slug,:name,:zone,:tagline,:about,:history,:tips,:address,:image,:x,:y,:w,:h)", b)
        c.execute("INSERT INTO corpus VALUES(?,?,?)", (f"B:{b['slug']}", "B",
                  " ".join([b["name"], b["zone"], b["tagline"], b["about"], b["history"], b["tips"]])))
    for i, e in enumerate(EVENTS, 1):
        c.execute("INSERT INTO events VALUES(?,?,?,?,?,?,?,?,?,?,?)", (i, *e))
        bname = next(b["name"] for b in BUILDINGS if b["slug"] == e[2])
        c.execute("INSERT INTO corpus VALUES(?,?,?)", (f"E:{i}", "E", " ".join([e[0], e[1], bname, e[3], e[4], e[5], e[6], e[8], e[9]])))
    c.commit(); c.close()

SYN = {}  # English only for now; add synonyms here if needed

def expand(q: str) -> list[str]:
    extra = [v for k, v in SYN.items() if k in q]
    return re.findall(r"[A-Za-z0-9]+", q.lower() + " " + " ".join(extra))

def search(q: str, near: str | None = None, k: int = 6):
    toks = expand(q)
    c = conn()
    scored = []
    if toks:
        match = " OR ".join(f'"{t}"' for t in toks)
        rows = c.execute("SELECT key, bm25(corpus) s FROM corpus WHERE corpus MATCH ? ORDER BY s LIMIT 30", (match,)).fetchall()
        scored = [(r["key"], -r["s"]) for r in rows]
    if near:
        boosted = {}
        for key, s in scored:
            boosted[key] = s
        for e in c.execute("SELECT id FROM events WHERE building=?", (near,)):
            boosted[f"E:{e['id']}"] = boosted.get(f"E:{e['id']}", 0) * 1.5 + 0.5
        boosted[f"B:{near}"] = boosted.get(f"B:{near}", 0) * 1.5 + 0.3
        scored = list(boosted.items())
    scored.sort(key=lambda x: -x[1])
    out = []
    for key, _ in scored[:k]:
        kind, ident = key.split(":", 1)
        if kind == "E":
            out.append(("E", key, dict(c.execute("SELECT * FROM events WHERE id=?", (ident,)).fetchone())))
        else:
            out.append(("B", key, dict(c.execute("SELECT * FROM buildings WHERE slug=?", (ident,)).fetchone())))
    c.close()
    return out
