"use client";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { api, post } from "@/lib/api";
import type { CoreCheck, CoreData, CoreQ } from "@/lib/types";
import { Btn, PageHeader, Stamp } from "./ui";

export default function CoreAnswers({ onChanged }: { onChanged: () => void }) {
  const [d, setD] = useState<CoreData | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => api<CoreData>("/core").then(setD), []);
  useEffect(() => { load(); }, [load]);
  if (!d) return null;
  const ready = d.questions.filter((q) => (q.prepared?.score ?? 0) >= 6).length;

  return (
    <section>
      <PageHeader title="Core answers">
        The questions asked in almost every interview. Write each answer once, get rule-checked feedback, and keep it as your prepared answer. For {d.stage_label.toLowerCase()}{d.target.company ? ` at ${d.target.company}` : ""}.
      </PageHeader>
      <div className="sheet mb-5 flex items-center justify-between p-4">
        <p className="font-display text-xl font-extrabold">{ready} of {d.questions.length} ready</p>
        <div className="h-2 w-48 overflow-hidden rounded-full bg-line"><motion.div className="h-full bg-solid" initial={{ width: 0 }} animate={{ width: `${(ready / d.questions.length) * 100}%` }} /></div>
      </div>
      <ul className="space-y-3">
        {d.questions.map((q) => (
          <li key={q.id} className="sheet overflow-hidden">
            <button onClick={() => setOpen(open === q.id ? null : q.id)} aria-expanded={open === q.id} className="flex w-full items-start gap-4 p-4 text-left hover:bg-paper/50">
              <span className="w-20 shrink-0"><Stamp state={!q.prepared ? "untested" : q.prepared.score >= 6 ? "solid" : "shaky"} /></span>
              <span className="min-w-0 flex-1"><span className="label block">{q.label}</span><span className="mt-0.5 block font-display font-bold">{q.question}</span></span>
              {q.prepared && <span className="label shrink-0">{q.prepared.score}/10</span>}
            </button>
            {open === q.id && <Editor q={q} done={() => { load(); onChanged(); }} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Editor({ q, done }: { q: CoreQ; done: () => void }) {
  const [text, setText] = useState(q.prepared?.text ?? "");
  const [res, setRes] = useState<CoreCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  async function run(save: boolean) {
    setBusy(true); setErr("");
    try {
      const r = save ? await api<CoreCheck>("/core/answer", { method: "PUT", body: JSON.stringify({ question_id: q.id, text }) }) : await post<CoreCheck>("/core/check", { question_id: q.id, text });
      setRes(r); if (save) done();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-4 border-t border-line bg-paper/50 p-4">
      <ul className="space-y-1 text-sm text-muted">{q.guidance.map((g) => <li key={g}>– {g}</li>)}</ul>
      <div>
        <textarea aria-label={`Your answer: ${q.label}`} rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write it as you would say it."
          className="w-full resize-y rounded-md border border-line bg-card p-3 text-[15px] outline-none focus:border-blue" />
        <p className="label mt-1">{words} words · aim for {q.words[0]} to {q.words[1]}{q.words[1] > 60 ? ` (about ${Math.round(words / 2.5)} seconds)` : ""}</p>
      </div>
      <div className="flex items-center gap-3">
        <Btn variant="ghost" disabled={busy || !text.trim()} onClick={() => run(false)}>Check</Btn>
        <Btn disabled={busy || !text.trim()} onClick={() => run(true)}>Save as my answer</Btn>
        {err && <p role="alert" className="text-sm text-pen">{err}</p>}
      </div>
      {res && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <div className="flex items-center gap-3"><Stamp state={res.ready ? "solid" : "shaky"} /><span className="font-display text-2xl font-extrabold">{res.score}<span className="text-sm text-muted">/10</span></span></div>
          <ul className="space-y-1 text-sm">{res.checks.map((c) => <li key={c.msg} className={c.ok ? "text-solid" : "text-pen"}>{c.ok ? "✓" : "✗"} {c.msg}</li>)}</ul>
        </motion.div>
      )}
    </div>
  );
}
