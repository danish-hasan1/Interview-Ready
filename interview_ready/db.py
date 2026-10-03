"""Storage backends: local SQLite (default) and Supabase Postgres (single owner)."""
import json
import os
import sqlite3
from datetime import datetime, timezone

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (id INTEGER PRIMARY KEY, kind TEXT, name TEXT, text TEXT, created TEXT);
CREATE TABLE IF NOT EXISTS claims (id INTEGER PRIMARY KEY, doc_id INTEGER, text TEXT, type TEXT, numbers TEXT, ownership TEXT);
CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY, role TEXT, notes TEXT, created TEXT);
CREATE TABLE IF NOT EXISTS answers (id INTEGER PRIMARY KEY, session_id INTEGER, question TEXT, kind TEXT, answer TEXT, dims TEXT, fixes TEXT, total REAL, created TEXT);
CREATE TABLE IF NOT EXISTS llm_cache (key TEXT PRIMARY KEY, value TEXT);
"""
TABLES = ["documents", "claims", "sessions", "answers"]


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def summarise(answers: list, sessions: list) -> dict:
    """Pure aggregation so every backend fetches rows once."""
    by_session, sums = {}, {}
    for a in answers:
        by_session.setdefault(a["session_id"], []).append(a["total"])
        for k, v in a["dims"].items():
            sums[k] = sums.get(k, 0) + v
    out = []
    for s in sessions:
        totals = by_session.get(s["id"])
        if totals:
            out.append({"id": s["id"], "created": s["created"], "role": s.get("role") or "",
                        "n": len(totals), "avg_total": round(sum(totals) / len(totals), 1)})
    n = len(answers)
    dims = {k: round(v / n, 1) for k, v in sums.items()} if n else {}
    return {"sessions": sorted(out, key=lambda r: r["id"]), "dims": dims, "answers": n,
            "weaknesses": sorted(dims.items(), key=lambda x: x[1])[:3]}


class BaseStore:
    """Aggregations shared by every backend. Subclasses supply raw rows."""

    def list_answers(self) -> list:  # [{session_id, dims(dict), total, created}]
        raise NotImplementedError

    def list_sessions(self) -> list:  # [{id, created, role}]
        raise NotImplementedError

    def profile(self) -> dict:
        return summarise(self.list_answers(), self.list_sessions())

    def session_summaries(self):
        return self.profile()["sessions"]

    def weaknesses(self, limit=3):
        return self.profile()["weaknesses"][:limit]


class Store(BaseStore):
    """SQLite. Name kept for the Streamlit app."""

    def __init__(self, path=None):
        path = path or config.DB_PATH
        if str(path) != ":memory:":
            config.DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(path), check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(SCHEMA)

    def _q(self, sql, args=()):
        cur = self.conn.execute(sql, args)
        self.conn.commit()
        return cur

    def add_document(self, kind, name, text):
        return self._q("INSERT INTO documents(kind,name,text,created) VALUES(?,?,?,?)", (kind, name, text, _now())).lastrowid

    def latest_document(self, kind):
        r = self.conn.execute("SELECT * FROM documents WHERE kind=? ORDER BY id DESC LIMIT 1", (kind,)).fetchone()
        return dict(r) if r else None

    def replace_claims(self, doc_id, claims):
        self._q("DELETE FROM claims")
        for c in claims:
            self.conn.execute(
                "INSERT INTO claims(doc_id,text,type,numbers,ownership) VALUES(?,?,?,?,?)",
                (doc_id, c.text, c.type, json.dumps(c.numbers), c.ownership),
            )
        self.conn.commit()

    def new_session(self, role="", notes=""):
        return self._q("INSERT INTO sessions(role,notes,created) VALUES(?,?,?)", (role, notes, _now())).lastrowid

    def save_answer(self, session_id, question, kind, answer, score):
        self._q(
            "INSERT INTO answers(session_id,question,kind,answer,dims,fixes,total,created) VALUES(?,?,?,?,?,?,?,?)",
            (session_id, question, kind, answer, json.dumps(score.dims), json.dumps(score.fixes), score.total, _now()),
        )

    def list_answers(self):
        return [{"session_id": r["session_id"], "dims": json.loads(r["dims"]), "total": r["total"], "created": r["created"]}
                for r in self.conn.execute("SELECT * FROM answers ORDER BY id")]

    def list_sessions(self):
        return [dict(r) for r in self.conn.execute("SELECT id, created, role FROM sessions")]

    # cache interface for CachedProvider
    def get(self, key):
        r = self.conn.execute("SELECT value FROM llm_cache WHERE key=?", (key,)).fetchone()
        return r["value"] if r else None

    def put(self, key, value):
        self._q("INSERT OR REPLACE INTO llm_cache(key,value) VALUES(?,?)", (key, value))

    def export_all(self):
        return {t: [dict(r) for r in self.conn.execute(f"SELECT * FROM {t}")] for t in TABLES}

    def delete_all(self):
        for t in TABLES + ["llm_cache"]:
            self.conn.execute(f"DELETE FROM {t}")
        self.conn.commit()


class SupabaseStore(BaseStore):
    """Single-owner Supabase Postgres via PostgREST. Uses the service-role key, which stays
    server-side only (never NEXT_PUBLIC). Tables have RLS on with no policies, so the public
    anon key cannot read them. Keep the deployment itself private (Vercel Deployment Protection)."""

    def __init__(self, url=None, service_key=None):
        import httpx

        url = (url or os.environ["SUPABASE_URL"]).rstrip("/")
        key = service_key or os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        self.http = httpx.Client(
            base_url=f"{url}/rest/v1",
            headers={"apikey": key, "Authorization": f"Bearer {key}",
                     "Content-Type": "application/json", "Prefer": "return=representation"},
            timeout=20,
        )

    def _req(self, method, table, **kw):
        r = self.http.request(method, f"/{table}", **kw)
        r.raise_for_status()
        return r.json() if r.content else []

    def add_document(self, kind, name, text):
        return self._req("POST", "documents", json={"kind": kind, "name": name, "text": text})[0]["id"]

    def latest_document(self, kind):
        rows = self._req("GET", "documents", params={"kind": f"eq.{kind}", "order": "id.desc", "limit": 1})
        return rows[0] if rows else None

    def replace_claims(self, doc_id, claims):
        self._req("DELETE", "claims", params={"id": "gt.0"})
        if claims:
            self._req("POST", "claims", json=[
                {"doc_id": doc_id, "text": c.text, "type": c.type, "numbers": c.numbers, "ownership": c.ownership}
                for c in claims])

    def new_session(self, role="", notes=""):
        return self._req("POST", "sessions", json={"role": role, "notes": notes})[0]["id"]

    def save_answer(self, session_id, question, kind, answer, score):
        self._req("POST", "answers", json={
            "session_id": session_id, "question": question, "kind": kind, "answer": answer,
            "dims": score.dims, "fixes": score.fixes, "total": score.total})

    def list_answers(self):
        return self._req("GET", "answers", params={"select": "session_id,dims,total,created", "order": "id"})

    def list_sessions(self):
        return self._req("GET", "sessions", params={"select": "id,created,role"})

    def export_all(self):
        return {t: self._req("GET", t) for t in TABLES}

    def delete_all(self):
        for t in ["answers", "sessions", "claims", "documents"]:
            self._req("DELETE", t, params={"id": "gt.0"})
