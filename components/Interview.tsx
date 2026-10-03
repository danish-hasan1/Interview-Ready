"use client";
import { useState } from "react";
import { post } from "@/lib/api";
import type { Analysis, InterviewState, Score } from "@/lib/types";

type Item = { q: string; a: string; score: Score };

export default function Interview({ analysis, notes }: { analysis: Analysis | null; notes: string }) {
  const [sid, setSid] = useState<number | null>(null);
  const [state, setState] = useState<InterviewState | null>(null);
  const [log, setLog] = useState<Item[]>([]);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!analysis) return <p className="text-neutral-500">Run Analyse first.</p>;

  async function start() {
    setErr("");
    try {
      const r = await post<{ session_id: number; state: InterviewState }>("/interview/start", {
        claims: analysis!.claims, gap_questions: analysis!.gap_questions, notes,
      });
      setSid(r.session_id); setState(r.state); setLog([]); setAnswer("");
    } catch (e) { setErr((e as Error).message); }
  }

  async function submit() {
    if (!state?.current || !answer.trim() || sid === null) return;
    setBusy(true); setErr("");
    try {
      const r = await post<{ score: Score; state: InterviewState }>("/interview/answer", { session_id: sid, state, answer });
      setLog([...log, { q: state.current.question, a: answer, score: r.score }]);
      setState(r.state); setAnswer("");
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  const finished = state && !state.current;
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Mock interview</h2>
        <button onClick={start} className="rounded bg-black px-3 py-1 text-white">{state ? "Restart" : "Start interview"}</button>
      </div>
      {log.map((it, i) => (
        <div key={i} className="space-y-1">
          <p className="font-medium">🎙 {it.q}</p>
          <p className="rounded bg-neutral-100 p-2">{it.a}</p>
          <div className="rounded border p-2 text-sm">
            <b>Score {it.score.total}/10</b> — {Object.entries(it.score.dims).map(([d, v]) => `${d}: ${v}`).join(" · ")}
            {it.score.framework && <p className="text-neutral-500">Framework: {it.score.framework}</p>}
            <ul className="list-disc pl-5">{it.score.fixes.map((f, k) => <li key={k}>{f}</li>)}</ul>
          </div>
        </div>
      ))}
      {state?.current && (
        <div className="space-y-2">
          <p className="font-medium">🎙 {state.current.question}</p>
          <textarea className="h-32 w-full rounded border p-2" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer" />
          <button disabled={busy} onClick={submit} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">{busy ? "Scoring…" : "Submit answer"}</button>
        </div>
      )}
      {finished && <p className="text-green-700">Interview finished. Scores saved — see Profile.</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </section>
  );
}
