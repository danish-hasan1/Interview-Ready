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
CREATE TABLE IF NOT EXISTS answers (id INTEGER PRIMARY KEY, session_id INTEGER, question TEXT, kind TEXT, ref TEXT DEFAULT '', answer TEXT, dims TEXT, fixes TEXT, total REAL, created TEXT);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS ai_usage (day TEXT PRIMARY KEY, count INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS targets (id INTEGER PRIMARY KEY, kind TEXT DEFAULT 'interview', company TEXT, role TEXT, stage TEXT, interview_date TEXT, jd_text TEXT, interviewer_notes TEXT, research TEXT, created TEXT, updated TEXT);
CREATE TABLE IF NOT EXISTS prepared_answers (id INTEGER PRIMARY KEY, target_id INTEGER, question_id TEXT, text TEXT, score REAL, updated TEXT, UNIQUE(target_id, question_id));
CREATE TABLE IF NOT EXISTS stories (id INTEGER PRIMARY KEY, theme TEXT, title TEXT, fields TEXT, composed TEXT, score REAL, created TEXT, updated TEXT);
CREATE TABLE IF NOT EXISTS debriefs (id INTEGER PRIMARY KEY, company TEXT, role TEXT, interview_date TEXT, outcome TEXT, notes TEXT, questions TEXT, created TEXT);
CREATE TABLE IF NOT EXISTS library (id INTEGER PRIMARY KEY, kind TEXT, question TEXT, text TEXT, approved INTEGER DEFAULT 0, created TEXT);
CREATE TABLE IF NOT EXISTS training (id INTEGER PRIMARY KEY, lesson_id TEXT, score REAL, created TEXT);
CREATE TABLE IF NOT EXISTS llm_cache (key TEXT PRIMARY KEY, value TEXT);
"""
TABLES = ["documents", "claims", "sessions", "answers", "training", "library", "stories", "debriefs", "targets", "prepared_answers"]


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def summarise(answers: list, sessions: list) -> dict:
    """Pure aggregation so every backend fetches rows once."""
    by_session, sums, refs, per_session_dims = {}, {}, {}, {}
    for a in answers:
        by_session.setdefault(a["session_id"], []).append(a["total"])
        sd = per_session_dims.setdefault(a["session_id"], {})
        for k, v in a["dims"].items():
            sums[k] = sums.get(k, 0) + v
            sd.setdefault(k, []).append(v)
        ref = a.get("ref") or ""
        if ref:
            r = refs.setdefault(ref, {"attempts": 0, "last": 0, "best": 0, "last_at": ""})
            r["attempts"] += 1
            r["last"] = a["total"]
            r["last_at"] = str(a["created"])
            r["best"] = max(r["best"], a["total"])
    out = []
    for s in sessions:
        totals = by_session.get(s["id"])
        if totals:
            sd = {k: round(sum(v) / len(v), 1) for k, v in per_session_dims[s["id"]].items()}
            out.append({"id": s["id"], "created": s["created"], "role": s.get("role") or "",
                        "n": len(totals), "avg_total": round(sum(totals) / len(totals), 1), "dims": sd})
    n = len(answers)
    dims = {k: round(v / n, 1) for k, v in sums.items()} if n else {}
    return {"sessions": sorted(out, key=lambda r: r["id"]), "dims": dims, "answers": n, "refs": refs,
            "weaknesses": sorted(dims.items(), key=lambda x: x[1])[:3]}


def summarise_training(rows: list) -> dict:
    out: dict = {}
    for r in rows:
        o = out.setdefault(r["lesson_id"], {"attempts": 0, "best": 0, "last": 0})
        o["attempts"] += 1
        o["last"] = r["score"]
        o["best"] = max(o["best"], r["score"])
    return out


class BaseStore:
    """Aggregations shared by every backend. Subclasses supply raw rows."""

    def list_training(self) -> list:  # [{lesson_id, score}]
        raise NotImplementedError

    def training_progress(self) -> dict:
        return summarise_training(self.list_training())

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
        cols = [r[1] for r in self.conn.execute("PRAGMA table_info(answers)")]
        if "ref" not in cols:
            self.conn.execute("ALTER TABLE answers ADD COLUMN ref TEXT DEFAULT ''")
            self.conn.commit()

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

    def save_answer(self, session_id, question, kind, answer, score, ref=""):
        self._q(
            "INSERT INTO answers(session_id,question,kind,ref,answer,dims,fixes,total,created) VALUES(?,?,?,?,?,?,?,?,?)",
            (session_id, question, kind, ref, answer, json.dumps(score.dims), json.dumps(score.fixes), score.total, _now()),
        )

    def list_answers(self):
        return [{"session_id": r["session_id"], "dims": json.loads(r["dims"]), "total": r["total"], "created": r["created"], "ref": r["ref"] or ""}
                for r in self.conn.execute("SELECT * FROM answers ORDER BY id")]

    def list_sessions(self):
        return [dict(r) for r in self.conn.execute("SELECT id, created, role FROM sessions")]

    def set_ownership(self, text, ownership):
        self._q("UPDATE claims SET ownership=? WHERE text=?", (ownership, text))

    def get_ownerships(self):
        return {r["text"]: r["ownership"] for r in self.conn.execute("SELECT text, ownership FROM claims")}

    def list_documents(self, kind):
        return [dict(r) for r in self.conn.execute("SELECT id, name, text, created FROM documents WHERE kind=? ORDER BY id", (kind,))]

    def answers_for(self, ref, limit=20):
        rows = self.conn.execute("SELECT id, session_id, question, kind, answer, dims, total, created FROM answers WHERE ref=? ORDER BY id DESC LIMIT ?", (ref, limit))
        return [{**dict(r), "dims": json.loads(r["dims"])} for r in rows]

    def get_setting(self, key, default=None):
        r = self.conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        return json.loads(r["value"]) if r else default

    def set_setting(self, key, value):
        self._q("INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)", (key, json.dumps(value)))

    def usage_today(self, day):
        r = self.conn.execute("SELECT count FROM ai_usage WHERE day=?", (day,)).fetchone()
        return r["count"] if r else 0

    def incr_usage(self, day):
        self._q("INSERT INTO ai_usage(day,count) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET count=count+1", (day,))

    def list_targets(self):
        return [{**dict(r), "research": json.loads(r["research"] or "{}")} for r in self.conn.execute("SELECT * FROM targets ORDER BY id")]

    def save_target(self, target_id, kind, company, role, stage, interview_date, jd_text, interviewer_notes, research):
        if target_id:
            self._q("UPDATE targets SET company=?, role=?, stage=?, interview_date=?, jd_text=?, interviewer_notes=?, research=?, updated=? WHERE id=?",
                    (company, role, stage, interview_date, jd_text, interviewer_notes, json.dumps(research), _now(), target_id))
            return target_id
        return self._q("INSERT INTO targets(kind,company,role,stage,interview_date,jd_text,interviewer_notes,research,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?)",
                       (kind, company, role, stage, interview_date, jd_text, interviewer_notes, json.dumps(research), _now(), _now())).lastrowid

    def delete_target(self, target_id):
        self._q("DELETE FROM prepared_answers WHERE target_id=?", (target_id,))
        self._q("DELETE FROM targets WHERE id=? AND kind != 'general'", (target_id,))

    def list_prepared(self, target_id):
        return [dict(r) for r in self.conn.execute("SELECT question_id, text, score, updated FROM prepared_answers WHERE target_id=?", (target_id,))]

    def save_prepared(self, target_id, question_id, text, score):
        self._q("INSERT INTO prepared_answers(target_id,question_id,text,score,updated) VALUES(?,?,?,?,?) "
                "ON CONFLICT(target_id,question_id) DO UPDATE SET text=excluded.text, score=excluded.score, updated=excluded.updated",
                (target_id, question_id, text, score, _now()))

    def list_stories(self):
        return [{**dict(r), "fields": json.loads(r["fields"] or "{}")} for r in self.conn.execute("SELECT * FROM stories ORDER BY id")]

    def save_story(self, story_id, theme, title, fields, composed, score):
        if story_id:
            self._q("UPDATE stories SET theme=?, title=?, fields=?, composed=?, score=?, updated=? WHERE id=?",
                    (theme, title, json.dumps(fields), composed, score, _now(), story_id))
            return story_id
        return self._q("INSERT INTO stories(theme,title,fields,composed,score,created,updated) VALUES(?,?,?,?,?,?,?)",
                       (theme, title, json.dumps(fields), composed, score, _now(), _now())).lastrowid

    def delete_story(self, story_id):
        self._q("DELETE FROM stories WHERE id=?", (story_id,))

    def list_debriefs(self):
        return [{**dict(r), "questions": json.loads(r["questions"] or "[]")} for r in self.conn.execute("SELECT * FROM debriefs ORDER BY id DESC")]

    def add_debrief(self, company, role, interview_date, outcome, notes, questions):
        return self._q("INSERT INTO debriefs(company,role,interview_date,outcome,notes,questions,created) VALUES(?,?,?,?,?,?,?)",
                       (company, role, interview_date, outcome, notes, json.dumps(questions), _now())).lastrowid

    def update_debrief(self, debrief_id, outcome, notes):
        self._q("UPDATE debriefs SET outcome=?, notes=? WHERE id=?", (outcome, notes, debrief_id))

    def delete_debrief(self, debrief_id):
        self._q("DELETE FROM debriefs WHERE id=?", (debrief_id,))

    def add_library(self, kind, question, text):
        return self._q("INSERT INTO library(kind,question,text,approved,created) VALUES(?,?,?,0,?)", (kind, question, text, _now())).lastrowid

    def list_library(self):
        return [{**dict(r), "approved": bool(r["approved"])} for r in self.conn.execute("SELECT * FROM library ORDER BY id DESC")]

    def approve_library(self, item_id, approved=True):
        self._q("UPDATE library SET approved=? WHERE id=?", (1 if approved else 0, item_id))

    def delete_library(self, item_id):
        self._q("DELETE FROM library WHERE id=?", (item_id,))

    def find_approved(self, question):
        r = self.conn.execute("SELECT text FROM library WHERE approved=1 AND question=? ORDER BY id DESC LIMIT 1", (question,)).fetchone()
        return r["text"] if r else None

    def record_training(self, lesson_id, score):
        self._q("INSERT INTO training(lesson_id,score,created) VALUES(?,?,?)", (lesson_id, score, _now()))

    def list_training(self):
        return [{"lesson_id": r["lesson_id"], "score": r["score"]} for r in self.conn.execute("SELECT * FROM training ORDER BY id")]

    # cache interface for CachedProvider
    def get(self, key):
        r = self.conn.execute("SELECT value FROM llm_cache WHERE key=?", (key,)).fetchone()
        return r["value"] if r else None

    def put(self, key, value):
        self._q("INSERT OR REPLACE INTO llm_cache(key,value) VALUES(?,?)", (key, value))

    def export_all(self):
        return {t: [dict(r) for r in self.conn.execute(f"SELECT * FROM {t}")] for t in TABLES}

    def delete_all(self):
        for t in TABLES + ["llm_cache", "settings"]:  # ai_usage is kept so the daily cap cannot be reset by deleting data
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

    def save_answer(self, session_id, question, kind, answer, score, ref=""):
        self._req("POST", "answers", json={
            "session_id": session_id, "question": question, "kind": kind, "ref": ref, "answer": answer,
            "dims": score.dims, "fixes": score.fixes, "total": score.total})

    def list_answers(self):
        return self._req("GET", "answers", params={"select": "session_id,dims,total,created,ref", "order": "id"})

    def list_sessions(self):
        return self._req("GET", "sessions", params={"select": "id,created,role"})

    def set_ownership(self, text, ownership):
        self._req("PATCH", "claims", params={"text": f"eq.{text}"}, json={"ownership": ownership})

    def get_ownerships(self):
        return {r["text"]: r["ownership"] for r in self._req("GET", "claims", params={"select": "text,ownership"})}

    def list_documents(self, kind):
        return self._req("GET", "documents", params={"kind": f"eq.{kind}", "select": "id,name,text,created", "order": "id"})

    def answers_for(self, ref, limit=20):
        return self._req("GET", "answers", params={"ref": f"eq.{ref}", "select": "id,session_id,question,kind,answer,dims,total,created",
                                                    "order": "id.desc", "limit": limit})

    def get_setting(self, key, default=None):
        rows = self._req("GET", "settings", params={"key": f"eq.{key}"})
        return rows[0]["value"] if rows else default

    def set_setting(self, key, value):
        self.http.post("/settings", json={"key": key, "value": value},
                       headers={"Prefer": "resolution=merge-duplicates,return=minimal"}).raise_for_status()

    def usage_today(self, day):
        rows = self._req("GET", "ai_usage", params={"day": f"eq.{day}"})
        return rows[0]["count"] if rows else 0

    def incr_usage(self, day):
        n = self.usage_today(day) + 1
        self.http.post("/ai_usage", json={"day": day, "count": n},
                       headers={"Prefer": "resolution=merge-duplicates,return=minimal"}).raise_for_status()

    def get(self, key):
        rows = self._req("GET", "llm_cache", params={"key": f"eq.{key}"})
        return rows[0]["value"] if rows else None

    def put(self, key, value):
        self.http.post("/llm_cache", json={"key": key, "value": value},
                       headers={"Prefer": "resolution=merge-duplicates,return=minimal"}).raise_for_status()

    def list_targets(self):
        return self._req("GET", "targets", params={"order": "id"})

    def save_target(self, target_id, kind, company, role, stage, interview_date, jd_text, interviewer_notes, research):
        body = {"company": company, "role": role, "stage": stage, "interview_date": interview_date or None, "jd_text": jd_text,
                "interviewer_notes": interviewer_notes, "research": research}
        if target_id:
            self._req("PATCH", "targets", params={"id": f"eq.{target_id}"}, json={**body, "updated": _now()})
            return target_id
        return self._req("POST", "targets", json={**body, "kind": kind})[0]["id"]

    def delete_target(self, target_id):
        self._req("DELETE", "prepared_answers", params={"target_id": f"eq.{target_id}"})
        self._req("DELETE", "targets", params={"id": f"eq.{target_id}", "kind": "neq.general"})

    def list_prepared(self, target_id):
        return self._req("GET", "prepared_answers", params={"target_id": f"eq.{target_id}", "select": "question_id,text,score,updated"})

    def save_prepared(self, target_id, question_id, text, score):
        self.http.post("/prepared_answers", params={"on_conflict": "target_id,question_id"},
                       json={"target_id": target_id, "question_id": question_id, "text": text, "score": score, "updated": _now()},
                       headers={"Prefer": "resolution=merge-duplicates,return=minimal"}).raise_for_status()

    def list_stories(self):
        return self._req("GET", "stories", params={"order": "id"})

    def save_story(self, story_id, theme, title, fields, composed, score):
        body = {"theme": theme, "title": title, "fields": fields, "composed": composed, "score": score}
        if story_id:
            self._req("PATCH", "stories", params={"id": f"eq.{story_id}"}, json={**body, "updated": _now()})
            return story_id
        return self._req("POST", "stories", json=body)[0]["id"]

    def delete_story(self, story_id):
        self._req("DELETE", "stories", params={"id": f"eq.{story_id}"})

    def list_debriefs(self):
        return self._req("GET", "debriefs", params={"order": "id.desc"})

    def add_debrief(self, company, role, interview_date, outcome, notes, questions):
        return self._req("POST", "debriefs", json={"company": company, "role": role, "interview_date": interview_date or None,
                                                    "outcome": outcome, "notes": notes, "questions": questions})[0]["id"]

    def update_debrief(self, debrief_id, outcome, notes):
        self._req("PATCH", "debriefs", params={"id": f"eq.{debrief_id}"}, json={"outcome": outcome, "notes": notes})

    def delete_debrief(self, debrief_id):
        self._req("DELETE", "debriefs", params={"id": f"eq.{debrief_id}"})

    def add_library(self, kind, question, text):
        return self._req("POST", "library", json={"kind": kind, "question": question, "text": text, "approved": False})[0]["id"]

    def list_library(self):
        return self._req("GET", "library", params={"order": "id.desc"})

    def approve_library(self, item_id, approved=True):
        self._req("PATCH", "library", params={"id": f"eq.{item_id}"}, json={"approved": approved})

    def delete_library(self, item_id):
        self._req("DELETE", "library", params={"id": f"eq.{item_id}"})

    def find_approved(self, question):
        rows = self._req("GET", "library", params={"approved": "eq.true", "question": f"eq.{question}", "order": "id.desc", "limit": 1})
        return rows[0]["text"] if rows else None

    def record_training(self, lesson_id, score):
        self._req("POST", "training", json={"lesson_id": lesson_id, "score": score})

    def list_training(self):
        return self._req("GET", "training", params={"select": "lesson_id,score", "order": "id"})

    def export_all(self):
        return {t: self._req("GET", t) for t in TABLES}

    def delete_all(self):
        for t in ["prepared_answers", "targets", "debriefs", "stories", "library", "training", "answers", "sessions", "claims", "documents"]:
            self._req("DELETE", t, params={"id": "gt.0"})
        self._req("DELETE", "settings", params={"key": "neq."})
        self._req("DELETE", "llm_cache", params={"key": "neq."})
