"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import type { Analysis } from "@/lib/types";

export default function Inputs({ onDone }: { onDone: (a: Analysis, notes: string) => void }) {
  const [cv, setCv] = useState<File | null>(null);
  const [jd, setJd] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run() {
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      if (cv) fd.append("cv", cv);
      fd.append("jd_text", jd);
      onDone(await api<Analysis>("/analyze", { method: "POST", body: fd }), notes);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Upload CV and job description</h2>
      <label className="block text-sm">CV (PDF, DOCX or TXT, max 4 MB)
        <input className="mt-1 block" type="file" accept=".pdf,.docx,.txt,.md" onChange={(e) => setCv(e.target.files?.[0] ?? null)} />
      </label>
      <label className="block text-sm">Job description (paste)
        <textarea className="mt-1 h-48 w-full rounded border p-2" value={jd} onChange={(e) => setJd(e.target.value)} />
      </label>
      <label className="block text-sm">Interviewer / company notes (optional)
        <textarea className="mt-1 h-20 w-full rounded border p-2" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <button disabled={busy} onClick={run} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
        {busy ? "Analysing…" : "Analyse"}
      </button>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </section>
  );
}
