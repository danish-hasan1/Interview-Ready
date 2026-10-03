"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import type { Analysis } from "@/lib/types";
import { PageTitle } from "./ui";

export default function Inputs({ onDone }: { onDone: (a: Analysis, notes: string) => void }) {
  const [cv, setCv] = useState<File | null>(null);
  const [jd, setJd] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);

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
    <section>
      <PageTitle eyebrow="Step 1 · Inputs" title="Walk in ready for the hard questions.">
        Upload your CV and paste the job description. We pull out every claim you have made and the questions an interviewer will press on.
      </PageTitle>

      <div className="grid gap-5 lg:grid-cols-2">
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); setCv(e.dataTransfer.files?.[0] ?? null); }}
          className={`card rise flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed p-8 text-center transition-colors ${
            drag ? "border-cobalt bg-cobalt/5" : cv ? "border-pass bg-pass/5" : "hover:border-ink"
          }`}
        >
          <input className="sr-only" type="file" accept=".pdf,.docx,.txt,.md" onChange={(e) => setCv(e.target.files?.[0] ?? null)} />
          <span className="grid h-12 w-12 place-items-center rounded-full bg-ink text-xl text-white">{cv ? "✓" : "↑"}</span>
          {cv ? (
            <>
              <span className="font-display text-lg font-bold">{cv.name}</span>
              <span className="label">{(cv.size / 1024).toFixed(0)} KB · click to replace</span>
            </>
          ) : (
            <>
              <span className="font-display text-lg font-bold">Drop your CV here</span>
              <span className="label">PDF · DOCX · TXT — up to 4 MB</span>
            </>
          )}
        </label>

        <div className="card rise flex flex-col p-5" style={{ animationDelay: "60ms" }}>
          <label htmlFor="jd" className="label mb-2">Job description</label>
          <textarea id="jd" className="min-h-48 flex-1 resize-y rounded-lg border border-line bg-paper/50 p-3 text-sm outline-none focus:border-cobalt"
            placeholder="Paste the requirements here…" value={jd} onChange={(e) => setJd(e.target.value)} />
        </div>
      </div>

      <div className="card rise mt-5 p-5" style={{ animationDelay: "120ms" }}>
        <label htmlFor="notes" className="label mb-2 block">Interviewer or company notes <span className="normal-case tracking-normal">(optional)</span></label>
        <textarea id="notes" className="h-20 w-full resize-y rounded-lg border border-line bg-paper/50 p-3 text-sm outline-none focus:border-cobalt"
          placeholder="Who is interviewing? What do you know about them?" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button disabled={busy} onClick={run} className="btn btn-primary">{busy ? "Reading your CV…" : "Find my weak spots"} <span aria-hidden>→</span></button>
        {err && <p role="alert" className="text-sm font-medium text-pen">{err}</p>}
      </div>
    </section>
  );
}
