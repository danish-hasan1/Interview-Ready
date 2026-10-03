"""In-memory PostgREST stand-in. It enforces the request shapes SupabaseStore relies on (filters, order, limit,
select, upsert, return=representation), so wrong parameter names or logic fail in tests before a real deploy.
It cannot check RLS or SQL types; run supabase/migrations against a real project for that."""
import json
from datetime import datetime, timezone
from urllib.parse import parse_qsl

import httpx

NO_ID = {"settings", "ai_usage", "llm_cache"}
PK = {"settings": "key", "ai_usage": "day", "llm_cache": "key"}
DEFAULTS = {"library": {"approved": False}, "debriefs": {"outcome": "pending", "notes": "", "questions": []}, "stories": {"title": ""},
            "targets": {"jd_text": "", "interviewer_notes": "", "research": {}}, "claims": {"numbers": []}}
HAS_CREATED = {"documents", "sessions", "answers", "stories", "debriefs", "library", "training", "targets", "prepared_answers", "llm_cache"}
KNOWN = {"documents", "claims", "sessions", "answers", "training", "library", "stories", "debriefs", "targets", "prepared_answers", "settings", "ai_usage", "llm_cache"}


class FakePostgREST:
    def __init__(self):
        self.tables = {t: [] for t in KNOWN}
        self.seq = {t: 0 for t in KNOWN}
        self.log = []

    def _match(self, row, params):
        for col, expr in params:
            if col in ("select", "order", "limit", "on_conflict"):
                continue
            op, _, val = expr.partition(".")
            cur = row.get(col)
            if op == "eq":
                ok = str(cur).lower() == val.lower() if isinstance(cur, bool) else str(cur) == val
            elif op == "neq":
                ok = str(cur) != val
            elif op == "gt":
                ok = float(cur) > float(val)
            else:
                raise AssertionError(f"unsupported filter {col}={expr}")
            if not ok:
                return False
        return True

    def handler(self, req: httpx.Request) -> httpx.Response:
        table = req.url.path.rsplit("/", 1)[-1]
        assert table in self.tables, f"unknown table {table}"
        params = parse_qsl(req.url.query.decode(), keep_blank_values=True)
        prefer = req.headers.get("prefer", "")
        self.log.append((req.method, table, dict(params)))
        rows = self.tables[table]
        body = json.loads(req.content) if req.content else None

        if req.method == "GET":
            out = [dict(r) for r in rows if self._match(r, params)]
            order = dict(params).get("order")
            if order:
                col, _, d = order.partition(".")
                out.sort(key=lambda r: (r.get(col) is None, r.get(col)), reverse=(d == "desc"))
            if "limit" in dict(params):
                out = out[: int(dict(params)["limit"])]
            sel = dict(params).get("select")
            if sel and sel != "*":
                cols = sel.split(",")
                out = [{c: r.get(c) for c in cols} for r in out]
            return httpx.Response(200, json=out)

        if req.method == "POST":
            items = body if isinstance(body, list) else [body]
            made = []
            for item in items:
                row = {**DEFAULTS.get(table, {}), **item}
                if table in HAS_CREATED:
                    row.setdefault("created", datetime.now(timezone.utc).isoformat(timespec="seconds"))
                key_cols = (dict(params).get("on_conflict") or PK.get(table, "")).split(",") if "merge-duplicates" in prefer else []
                existing = next((r for r in rows if key_cols and key_cols != [""] and all(r.get(c) == row.get(c) for c in key_cols)), None)
                if existing is not None:
                    existing.update(row)
                    made.append(dict(existing))
                    continue
                if table not in NO_ID:
                    self.seq[table] += 1
                    row["id"] = self.seq[table]
                rows.append(row)
                made.append(dict(row))
            return httpx.Response(201, json=made) if "return=representation" in prefer else httpx.Response(201)

        if req.method == "PATCH":
            hit = [r for r in rows if self._match(r, params)]
            for r in hit:
                r.update(body)
            return httpx.Response(200, json=[dict(r) for r in hit]) if "return=representation" in prefer else httpx.Response(204)

        if req.method == "DELETE":
            assert params, "DELETE without a filter would be rejected by PostgREST"
            keep = [r for r in rows if not self._match(r, params)]
            deleted = [r for r in rows if self._match(r, params)]
            self.tables[table] = keep
            return httpx.Response(200, json=deleted) if "return=representation" in prefer else httpx.Response(204)
        raise AssertionError(req.method)

    def transport(self):
        return httpx.MockTransport(self.handler)
