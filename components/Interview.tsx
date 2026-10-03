"use client";
import { useState } from "react";
import { post } from "@/lib/api";
import type { Analysis, InterviewState, Score } from "@/lib/types";
import { AnimatePresence, motion } from "motion/react";
import { Btn, CountUp, Empty, PageTitle, RatingBar, ease } from "./ui";

const pop = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, ease } };

function Question({ q, pressing, big }: { q: string; pressing: boolean; big?: boolean }) {
  return pressing ? (
    <motion.div className="pen-note" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: [-24, 6, -3, 0] }} transition={{ duration: 0.5, ease }}>
      <p className="font-medium">{q}</p>
    </motion.div>
  ) : (
    <motion.p {...pop} className={`font-display font-bold leading-snug ${big ? "text-2xl" : "text-xl"}`}>{q}</motion.p>
  );
}

type Item = { q: string; kind: string; a: string; score: Score };
const TARGET = 150;

export default function Interview({ analysis, notes, goInputs }: { analysis: Analysis | null; notes: string; goInputs: () => void }) {
  const [sid, setSid] = useState<number | null>(null);
  const [state, setState] = useState<InterviewState | null>(null);
  const [log, setLog] = useState<Item[]>([]);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!analysis) return <Empty text="Analyse your CV first, then the interviewer has something to ask." action={<Btn onClick={goInputs}>Go to inputs</Btn>} />;

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
      setLog([...log, { q: state.current.question, kind: state.current.kind, a: answer, score: r.score }]);
      setState(r.state); setAnswer("");
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  const total = state ? state.queue.length : 0;
  const finished = !!state && !state.current;
  const pressing = state?.current?.kind === "followup";

  if (!state) {
    return (
      <section>
        <PageTitle eyebrow="Step 4 · Mock interview" title="Ready when you are.">
          {analysis.claims.length} claims and {analysis.gap_questions.length} gap questions are loaded. The interviewer will push back if you ramble, skip numbers, or hide behind “we”.
        </PageTitle>
        <Btn onClick={start}>Begin interview <span aria-hidden>→</span></Btn>
        {err && <p role="alert" className="mt-3 text-sm font-medium text-pen">{err}</p>}
      </section>
    );
  }

  return (
    <section>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="label mb-2">Step 4 · Mock interview</p>
          <div className="flex gap-1.5" aria-label={`Question ${Math.min(state.asked, total)} of ${total}`}>
            {Array.from({ length: total }, (_, i) => (
              <motion.span key={i} layout className="h-1.5 rounded-full"
                animate={{ width: i === state.asked - 1 && !finished ? 44 : 32,
                  backgroundColor: i < state.asked - (finished ? 0 : 1) ? "#1d8a6c" : i === state.asked - 1 && !finished ? "#2446d6" : "#d3dae1" }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }} />
            ))}
          </div>
        </div>
        <Btn variant="ghost" onClick={start}>Restart</Btn>
      </div>

      <div className="space-y-6">
        {log.map((it, i) => (
          <div key={i} className="space-y-3">
            <Question q={it.q} pressing={it.kind === "followup"} />
            <motion.div {...pop} transition={{ ...pop.transition, delay: 0.1 }} className="ml-auto max-w-[92%] rounded-2xl rounded-tr-sm bg-cobalt/10 p-4 text-[15px]"><p className="label mb-1 text-cobalt">You</p>{it.a}</motion.div>
            <motion.div {...pop} transition={{ ...pop.transition, delay: 0.25 }} className="card p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <p className="label">Assessment</p>
                <p className="font-display text-3xl font-extrabold"><CountUp value={it.score.total} /><span className="text-base text-muted">/10</span></p>
              </div>
              <div className="space-y-2">{Object.entries(it.score.dims).map(([d, v]) => <RatingBar key={d} label={d} value={v} />)}</div>
              {it.score.framework && <p className="label mt-3 text-pass">Framework detected: {it.score.framework}</p>}
              <ul className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
                {it.score.fixes.map((f, k) => <li key={k} className="flex gap-2"><span className="label mt-0.5 shrink-0 text-pen">Fix</span>{f}</li>)}
              </ul>
            </motion.div>
          </div>
        ))}

        {state.current && (
          <div className="space-y-3">
            <Question key={state.current.question} q={state.current.question} pressing={pressing} big />
            <textarea aria-label="Your answer" className="card h-40 w-full resize-y p-4 text-[15px] outline-none focus:border-cobalt"
              value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Answer as you would out loud. Headline first, then your points, an example, the result." />
            <div className="flex items-center gap-4">
              <Btn disabled={busy || !answer.trim()} onClick={submit}>{busy ? "Scoring…" : "Submit answer"}</Btn>
              <div className="flex flex-1 items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                  <motion.div className="h-full" initial={false}
                    animate={{ width: `${Math.min(100, (words / TARGET) * 100)}%`, backgroundColor: words > 180 ? "#d03a2f" : words >= 40 ? "#1d8a6c" : "#c98a12" }}
                    transition={{ type: "spring", stiffness: 260, damping: 30 }} />
                </div>
                <span className="label w-28 text-right">{words} / ~{TARGET} words</span>
              </div>
            </div>
          </div>
        )}
        {finished && <motion.div {...pop} className="card border-pass/50 bg-pass/5 p-5"><p className="font-display text-xl font-bold text-pass">Interview complete. Scores saved.</p><p className="mt-1 text-sm text-muted">Open Profile to see your weakest dimensions.</p></motion.div>}
        {err && <p role="alert" className="text-sm font-medium text-pen">{err}</p>}
      </div>
    </section>
  );
}
