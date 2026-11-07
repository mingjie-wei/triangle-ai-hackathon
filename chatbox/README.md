# Blue Devil chatbox (demo)

Vanilla HTML/CSS/JS frontend + FastAPI + SQLite FTS5 RAG + Claude. All content is **sample data**; links are placeholders.

```sh
cd chatbox
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
export ANTHROPIC_API_KEY=...   # optional; without it the offline extractive fallback is used
.venv/bin/uvicorn app:app --port 8000
```
Open http://localhost:8000. Hooks: `window.CampusChat.setNear(slug)`; a `campus:locate` CustomEvent fires on "Map".
