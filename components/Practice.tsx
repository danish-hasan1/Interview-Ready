"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { post } from "@/lib/api";
import { DIM, DIM_ORDER } from "@/lib/dims";
import type { Analysis, InterviewState, Score } from "@/lib/types";
import { Radar, Ring } from "./charts";
import Icon from "./Icon";
import { Aurora, Btn, Empty, PageHeader, RatingBar, TypeText, Waveform, ease } from "./ui";

type Item = { q: string; kind: string; a: string; score: Score };
const TARGET = 150;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function Practice({ analysis, notes, goPrepare, onFinished }: { analysis: Analysis | null; notes: string; goPrepare: () => void; onFinished: () => void }) {
  const [sid, setSid] = useState<number | null>(null);
  const [state, setState] = useState<InterviewState | null>(null);
  const [log, setLog] = useState<Item[]>([]);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [speaking, setSpeaking] = useState(true);
  const [secs, setSecs] = useState(0);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const qKey = state?.current?.question;

  useEffect(() => {
    setSecs(0);
    if (!qKey) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [qKey]);

  if (!analysis)
    return (
      <>
        <PageHeader eyebrow="Practice" title="Mock interview" />
        <Empty title="Nothing to practise on yet" text="Upload your CV first. The interviewer builds its questions from your claims and the job description." action={<Btn onClick={goPrepare}>Go to Prepare</Btn>} />
      </>
    );

  async function start() {
    setErr("");
    try {
      const r = await post<{ session_id: number; state: InterviewState }>("/interview/start", { claims: analysis!.claims, gap_questions: analysis!.gap_questions, notes });
      setSid(r.session_id); setState(r.state); setLog([]); setAnswer(""); setSpeaking(true);
    } catch (e) { setErr((e as Error).message); }
  }

  async function submit() {
    if (!state?.current || !answer.trim() || sid === null || busy) return;
    setBusy(true); setErr("");
    try {
      const r = await post<{ score: Score; state: InterviewState; done: boolean }>("/interview/answer", { session_id: sid, state, answer });
      setLog((l) => [...l, { q: state.current!.question, kind: state.current!.kind, a: answer, score: r.score }]);
      setState(r.state); setAnswer(""); setSpeaking(true);
      if (r.done) onFinished();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  const total = state?.queue.length ?? 0;
  const finished = !!state && !state.current;
  const pressing = state?.current?.kind === "followup";
  const latest = log[log.length - 1];

  if (!state)
    return (
      <>
        <PageHeader eyebrow="Practice" title="Ready when you are." />
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[28px] bg-side p-8 text-white sm:p-10">
          <Aurora />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-md">
              <h2 className="font-display text-3xl font-extrabold">{analysis.claims.length} claims. {analysis.gap_questions.length} gap questions.</h2>
              <p className="mt-2 text-white/70">The interviewer pushes back if you ramble, skip numbers or hide behind “we”. Answer out loud first, then type it. About a minute each.</p>
              <Btn variant="light" className="mt-6" onClick={start}>Begin interview <Icon name="arrow" className="h-4 w-4" /></Btn>
              {err && <p role="alert" className="mt-3 text-sm font-medium text-pink">{err}</p>}
            </div>
            <Orb active size={150} />
          </div>
        </motion.div>
      </>
    );

  return (
    <section>
      <PageHeader eyebrow="Practice" title={finished ? "Interview complete." : "Mock interview"}
        action={<Btn variant="ghost" onClick={start}>Restart</Btn>} />

      <div className="mb-6 flex gap-1.5" aria-label={`Question ${Math.min(state.asked, total)} of ${total}`}>
        {Array.from({ length: total }, (_, i) => {
          const done = i < state.asked - (finished ? 0 : 1);
          const cur = i === state.asked - 1 && !finished;
          return <motion.span key={i} layout className="h-1.5 flex-1 rounded-full" animate={{ backgroundColor: done ? "#12a67a" : cur ? "#5b4bff" : "#e4e7f0" }} />;
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          {state.current && (
            <motion.div key={state.current.question} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}
              className={`relative overflow-hidden rounded-[22px] p-6 text-white ${pressing ? "bg-gradient-to-br from-[#7a1f19] to-pen" : "bg-side"}`}>
              {!pressing && <Aurora />}
              <div className="relative flex items-start gap-4">
                <Orb active={speaking} size={56} pen={pressing} />
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-3">
                    <span className="label !text-white/70">{pressing ? "Pushback" : `Question ${state.asked} of ${total}`}</span>
                    <Waveform active={speaking} />
                    <span className={`ml-auto font-mono text-sm ${secs > 75 ? "text-pink" : "text-white/70"}`}>{mmss(secs)}</span>
                  </div>
                  <p className="font-display text-xl font-bold leading-snug sm:text-2xl">
                    <TypeText text={state.current.question} onDone={() => { setSpeaking(false); boxRef.current?.focus(); }} />
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {state.current && (
            <div className="card p-4">
              <textarea ref={boxRef} aria-label="Your answer" className="h-44 w-full resize-y rounded-xl bg-paper/60 p-4 text-[15px] outline-none focus:ring-2 focus:ring-brand/40"
                value={answer} onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }}
                placeholder="Headline first, then your points, an example, the result." />
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <Btn disabled={busy || !answer.trim()} onClick={submit}>{busy ? "Scoring…" : "Submit answer"}</Btn>
                <span className="label hidden sm:inline">⌘ + Enter</span>
                <div className="flex flex-1 items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                    <motion.div className="h-full" initial={false}
                      animate={{ width: `${Math.min(100, (words / TARGET) * 100)}%`, backgroundColor: words > 180 ? "#e5453a" : words >= 40 ? "#12a67a" : "#f0a020" }}
                      transition={{ type: "spring", stiffness: 260, damping: 30 }} />
                  </div>
                  <span className="label w-28 text-right">{words} / ~{TARGET} words</span>
                </div>
              </div>
            </div>
          )}

          {finished && (
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="card flex flex-col items-center gap-3 p-8 text-center">
              <Ring value={Math.round((log.reduce((s, x) => s + x.score.total, 0) / Math.max(1, log.length)) * 10)} size={150} label="this session" />
              <p className="text-muted">Scores saved. Check Progress to see your weakest dimensions.</p>
            </motion.div>
          )}
          {err && <p role="alert" className="text-sm font-medium text-pen">{err}</p>}

          {log.length > 0 && (
            <div className="space-y-3">
              <p className="label">Transcript</p>
              {[...log].reverse().map((it, i) => (
                <details key={log.length - i} className="card overflow-hidden">
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-4 text-sm hover:bg-paper/60">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg font-display font-bold text-white ${it.score.total >= 7 ? "bg-pass" : it.score.total >= 4 ? "bg-amber" : "bg-pen"}`}>{it.score.total}</span>
                    <span className="flex-1 truncate">{it.kind === "followup" ? "↳ " : ""}{it.q}</span>
                  </summary>
                  <div className="space-y-2 border-t border-line bg-paper/50 p-4 text-sm"><p className="label text-brand">You</p><p>{it.a}</p></div>
                </details>
              ))}
            </div>
          )}
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <div className="card p-5">
            <p className="label mb-3">Live assessment</p>
            <AnimatePresence mode="wait">
              {latest ? (
                <motion.div key={log.length} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Ring value={latest.score.total * 10} size={104} stroke={10} />
                    <Radar data={latest.score.dims} size={190} />
                  </div>
                  <div className="space-y-2">{DIM_ORDER.map((d) => <RatingBar key={d} label={DIM[d].label} value={latest.score.dims[d]} />)}</div>
                  {latest.score.framework && <p className="label text-pass">Framework: {latest.score.framework}</p>}
                  <ul className="space-y-2 border-t border-line pt-3 text-sm">
                    {latest.score.fixes.map((f, k) => (
                      <motion.li key={k} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + k * 0.12 }} className="flex gap-2">
                        <span className="label mt-0.5 shrink-0 !text-pen">Fix</span>{f}
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              ) : (
                <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-muted">Submit your first answer to see scores for structure, specificity, concision, delivery and business impact.</motion.p>
              )}
            </AnimatePresence>
          </div>
        </aside>
      </div>
    </section>
  );
}

/** Interviewer avatar: breathing orb with expanding rings while speaking. */
function Orb({ active, size, pen }: { active: boolean; size: number; pen?: boolean }) {
  const grad = pen ? "from-[#ffb199] to-pen" : "from-cyan via-brand to-pink";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden>
      {active && [0, 1].map((i) => (
        <motion.span key={i} className="absolute inset-0 rounded-full border border-white/40" initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.7, opacity: 0 }} transition={{ duration: 2, repeat: Infinity, delay: i * 1, ease: "easeOut" }} />
      ))}
      <motion.div className={`absolute inset-0 rounded-full bg-gradient-to-br ${grad} shadow-[0_0_40px_-4px] shadow-brand/70`}
        animate={{ scale: active ? [1, 1.06, 1] : 1, rotate: active ? [0, 8, 0] : 0 }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
      <span className="absolute inset-[18%] rounded-full bg-white/20 backdrop-blur-sm" />
    </div>
  );
}
