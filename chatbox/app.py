import os, re, json
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import db

MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5-5")
if not db.DB_PATH.exists():
    db.init()

app = FastAPI(title="Blue Devil")
STATIC = Path(__file__).parent / "static"

SYSTEM = """You are Blue Devil, a friendly guide to Duke's campus. Answer ONLY from the records in the <context> block.
Cite each record you mention with its key in square brackets right after it, e.g. [E:3] or [B:duke-chapel].
Never invent events, dates, places or links. Always reply in English, even if the user writes in another language.
Write 2-3 short paragraphs of plain prose (about 100-180 words): a friendly opening, what the relevant items are and who they suit (time, place, duration, audience), and one practical tip.
No bullets, no markdown, no URLs - links are attached automatically. If nothing in the records fits, say so briefly and suggest a nearby topic."""

class ChatIn(BaseModel):
    message: str
    history: list[dict] = []
    near: str | None = None

def fmt(kind, key, r):
    if kind == "E":
        return (f"[{key}] EVENT {r['title']} | {r['category']} | {r['building']} | {r['place']} | {r['when']} | "
                f"{r['duration']} | audience: {r['audience']} | {r['blurb']} {r['details']}")
    return f"[{key}] BUILDING {r['name']} | {r['tagline']} {r['about']} Tips: {r['tips']}"

def extractive(hits):
    if not hits:
        return "I couldn't find anything matching that in the local database. Try asking about music, art, AI, or a building like Duke Chapel."
    evs = [(k, r) for kind, k, r in hits if kind == "E"][:3]
    if not evs:
        kind, k, r = hits[0]
        return f"{r['name']} is {r['tagline'].lower()} {r['about']} [{k}] Tip: {r['tips']}"
    parts = ["Here are some things that match what you're looking for."]
    for k, r in evs:
        parts.append(f"{r['title']} [{k}] is at {r['place']} on {r['when']}, runs about {r['duration']}, and suits {r['audience'].lower()}. {r['blurb']}")
    parts.append("Tip: arrive a little early, since popular events fill up quickly.")
    return "\n\n".join(parts[:1] + [" ".join(parts[1:-1]), parts[-1]])

def ask_claude(message, history, hits):
    import anthropic
    ctx = "\n".join(fmt(*h) for h in hits)
    msgs = [{"role": m["role"], "content": m["content"]} for m in history[-6:] if m.get("role") in ("user", "assistant")]
    msgs.append({"role": "user", "content": f"<context>\n{ctx}\n</context>\n\n{message}"})
    r = anthropic.Anthropic().messages.create(model=MODEL, max_tokens=500, system=SYSTEM, messages=msgs)
    return "".join(b.text for b in r.content if b.type == "text")

def link_for(kind, key, r):
    if kind == "E":
        b = db.conn().execute("SELECT name FROM buildings WHERE slug=?", (r["building"],)).fetchone()
        return dict(key=key, id=r["id"], category=r["category"], title=r["title"], url=r["url"],
                    building=r["building"], building_name=b["name"], when=r["when"])
    return dict(key=key, id=None, category="Building", title=r["name"], url=None, building=r["slug"],
                building_name=r["name"], when=r["address"])

@app.post("/api/chat")
def chat(body: ChatIn):
    hits = db.search(body.message, body.near)
    mode, text = "offline", None
    if os.environ.get("ANTHROPIC_API_KEY"):
        try:
            text, mode = ask_claude(body.message, body.history, hits), "claude"
        except Exception as e:
            print("Claude error, falling back:", e)
    if text is None:
        text = extractive(hits)
    by_key = {k: (kind, k, r) for kind, k, r in hits}
    cited = []
    for k in re.findall(r"\[([EB]:[\w-]+)\]", text):
        if k in by_key and k not in cited:
            cited.append(k)
    links = [link_for(*by_key[k]) for k in cited]
    return dict(reply=text, links=links, mode=mode, model=MODEL if mode == "claude" else None)

@app.get("/api/events")
def events(q: str = "", category: str = ""):
    c = db.conn()
    rows = [dict(r) for r in c.execute("SELECT e.*, b.name building_name FROM events e JOIN buildings b ON b.slug=e.building")]
    if category:
        rows = [r for r in rows if r["category"].lower() == category.lower()]
    if q:
        toks = db.expand(q)
        keep = {int(k.split(":")[1]) for kind, k, _ in db.search(q, None, 30) if kind == "E"} if toks else set()
        rows = [r for r in rows if r["id"] in keep or q.lower() in (r["title"] + r["blurb"]).lower()]
    return rows

@app.get("/api/buildings")
def buildings():
    return [dict(r) for r in db.conn().execute("SELECT * FROM buildings")]

@app.get("/api/buildings/{slug}")
def building(slug: str):
    c = db.conn()
    b = c.execute("SELECT * FROM buildings WHERE slug=?", (slug,)).fetchone()
    if not b:
        raise HTTPException(404)
    d = dict(b)
    d["events"] = [dict(r) for r in c.execute("SELECT * FROM events WHERE building=?", (slug,))]
    return d

@app.get("/api/status")
def status():
    k = bool(os.environ.get("ANTHROPIC_API_KEY"))
    return dict(mode="claude" if k else "offline", model=MODEL if k else None)

@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")

app.mount("/static", StaticFiles(directory=STATIC), name="static")
