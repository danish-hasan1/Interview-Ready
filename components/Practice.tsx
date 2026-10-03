"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, post } from "@/lib/api";
import { DIM, DIM_ORDER } from "@/lib/dims";
import { defence, SOLID_AT } from "@/lib/status";
import type { Analysis, Coach, InterviewState, Persona, Profile, Score, StoriesData } from "@/lib/types";
import type { DrillRequest } from "./Brief";
import { Btn, CountUp, PageHeader, RatingBar, Stamp, ease } from "./ui";

type Item = { q: string; kind: string; ref: string; a: string; score: Score; coach: Coach };
const TARGET = 150;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function Practice({ analysis, notes, profile, request, onConsumed, goBrief, onFinished, stageLabel }: {
  analysis: Analysis | null; notes: string; profile: Profile | null; request: (DrillRequest & { id: number }) | null; onConsumed: () => void; goBrief: () => void; onFinished: () => void; stageLabel?: boolean;
}) {
  const [sid, setSid] = useState<number | null>(null);
  const [state, setState] = useState<InterviewState | null>(null);
  const [log, setLog] = useState<Item[]>([]);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [secs, setSecs] = useState(0);
  const [persona, setPersona] = useState("auto");
  const [usedPersona, setUsedPersona] = useState("standard");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [stories, setStories] = useState<StoriesData | null>(null);
  const [voice, setVoice] = useState(false);
  const [vmetrics, setVmetrics] = useState<VoiceResult | null>(null);
  const lastReq = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const qKey = state?.current?.question;

  useEffect(() => {
    api<{ personas: Persona[] }>("/personas").then((r) => setPersonas(r.personas)).catch(() => {});
    api<{ available: boolean }>("/voice").then((r) => setVoice(r.available)).catch(() => {});
  }, []);

  const order = useMemo(() => {
    if (!analysis) return [];
    const rank = { shaky: 0, untested: 1, solid: 2 } as const;
    return [...analysis.claims].sort((a, b) => rank[defence(a.text, profile?.refs).state] - rank[defence(b.text, profile?.refs).state]);
  }, [analysis, profile]);

  async function start(req: DrillRequest = {}) {
    if (!analysis) return;
    setErr("");
    try {
      const refs = req.refs ? new Set(req.refs) : null;
      const claims = req.custom ? [] : refs ? analysis.claims.filter((c) => refs.has(c.text)) : req.weakest || !req.focus ? order : analysis.claims;
      const gap_items = req.custom ?? (refs ? analysis.gap_items.filter((g) => refs.has(g.ref)) : analysis.gap_items);
      const r = await post<{ session_id: number; state: InterviewState; persona: string }>("/interview/start", {
        claims: req.mode ? order : claims, gap_items, notes, focus: req.focus ?? "", persona, mode: req.mode ?? "default", max_questions: req.refs || req.custom ? 10 : 6,
      });
      setUsedPersona(r.persona);
      api<StoriesData>("/stories").then(setStories).catch(() => {});
      setSid(r.session_id); setState(r.state); setLog([]); setAnswer(""); setVmetrics(null);
    } catch (e) { setErr((e as Error).message); }
  }

  useEffect(() => {
    if (request && request.id !== lastReq.current) { lastReq.current = request.id; start(request); onConsumed(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id]);

  useEffect(() => {
    setSecs(0);
    if (!qKey) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [qKey]);

  useEffect(() => { if (!qKey && !log.length) return; endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); boxRef.current?.focus({ preventScroll: true }); }, [qKey, log.length]);

  async function submit() {
    if (!state?.current || !answer.trim() || sid === null || busy) return;
    setBusy(true); setErr("");
    const cur = state.current;
    try {
      const r = await post<{ score: Score; state: InterviewState; done: boolean; coach: Coach }>("/interview/answer", { session_id: sid, state, answer });
      setLog((l) => [...l, { q: cur.question, kind: cur.kind, ref: cur.ref ?? "", a: answer, score: r.score, coach: r.coach }]);
      setState(r.state); setAnswer("");
      onFinished();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  if (!analysis)
    return (
      <>
        <PageHeader title="Practice" />
        <div className="sheet p-8"><p className="max-w-md text-muted">Nothing to practise on yet. Brief the coach with your CV and the role first, so the questions come from your own claims.</p>
          <Btn className="mt-4" onClick={goBrief}>Go to the board</Btn></div>
      </>
    );

  if (!state)
    return (
      <>
        <PageHeader title="Practice">Choose who interviews you and what you are tested on. Each answer is scored and the claim it tests gets a defence stamp on your board.</PageHeader>
        <div className="sheet mb-4 p-4">
          <p className="label mb-2">Interviewer</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setPersona("auto")} aria-pressed={persona === "auto"} title="Pick the interviewer that matches the interview stage"
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${persona === "auto" ? "border-ink bg-ink text-white" : "border-line bg-card hover:border-ink"}`}>Match the interview</button>
            {personas.map((p) => (
              <button key={p.id} onClick={() => setPersona(p.id)} aria-pressed={persona === p.id} title={p.blurb}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${persona === p.id ? "border-ink bg-ink text-white" : "border-line bg-card hover:border-ink"}`}>{p.label}</button>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">{persona === "auto" ? "General: standard. A specific interview picks its own: friendly for HR screens, CEO-style for executives, technical for technical rounds." : personas.find((p) => p.id === persona)?.blurb}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <button onClick={() => start({ mode: "stage" })} className="sheet p-6 text-left transition-colors hover:border-ink md:col-span-2">
            <p className="label !text-blue">Recommended {stageLabel ? "for your interview" : ""}</p>
            <p className="mt-1 font-display text-xl font-bold">Match this interview</p>
            <p className="mt-1 text-sm text-muted">A session shaped like the real stage: tell-me-about-yourself first, then core questions, your claims and the role gaps in the right mix, with a matching interviewer.</p>
          </button>
          <button onClick={() => start({ mode: "core" })} className="sheet p-6 text-left transition-colors hover:border-ink">
            <p className="label">Basics</p>
            <p className="mt-1 font-display text-xl font-bold">Core questions only</p>
            <p className="mt-1 text-sm text-muted">Tell me about yourself, why this company, strengths, weakness, salary and your questions for them.</p>
          </button>
          <button onClick={() => start({ weakest: true })} className="sheet p-6 text-left transition-colors hover:border-ink">
            <p className="label">Claims</p>
            <p className="mt-1 font-display text-xl font-bold">Weakest first</p>
            <p className="mt-1 text-sm text-muted">Shaky and untested claims first, mixed with the role requirements your CV does not prove. Six questions.</p>
          </button>
          <button onClick={goBrief} className="sheet p-6 text-left transition-colors hover:border-ink">
            <p className="label">Targeted</p>
            <p className="mt-1 font-display text-xl font-bold">Pick a claim on the board</p>
            <p className="mt-1 text-sm text-muted">Open any claim and press “Drill” to be questioned only on that line, from every angle.</p>
          </button>
        </div>
        {err && <p role="alert" className="mt-4 text-sm font-medium text-pen">{err}</p>}
      </>
    );

  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  const total = state.queue.length;
  const finished = !state.current;
  const cur = state.current;
  const pressing = cur?.kind === "followup";
  const avg = log.length ? log.reduce((s, x) => s + x.score.total, 0) / log.length : 0;
  const liveState = (ref: string) => {
    const last = [...log].reverse().find((x) => x.ref === ref);
    return last ? (last.score.total >= SOLID_AT ? "solid" : "shaky") : defence(ref, profile?.refs).state;
  };

  return (
    <section>
      <PageHeader title={finished ? "Session complete" : `Practice · ${personas.find((p) => p.id === usedPersona)?.label ?? ""} interviewer`}
        action={<Btn variant="ghost" onClick={() => { setState(null); setLog([]); }}>End session</Btn>}>
        {finished ? "Scores are saved and your board is updated." : "Answer as you would in the room: headline first, then points, an example, the result."}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          {log.map((it, i) => (
            <div key={i} className="space-y-3">
              <Interviewer text={it.q} pressing={it.kind === "followup"} />
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="ml-6 border-l-[3px] border-blue pl-4 text-[15px]">
                <p className="label mb-1 !text-blue">You</p><p className="whitespace-pre-wrap">{it.a}</p>
              </motion.div>
              <Assessment score={it.score} refText={it.ref} state={liveState(it.ref)} coach={it.coach} question={it.q} />
            </div>
          ))}

          {cur && (
            <motion.div key={cur.question} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }} className="space-y-3">
              {cur.ref && !pressing && <p className="label">Testing · <span className="normal-case tracking-normal text-ink">{cur.ref}</span></p>}
              <Interviewer text={cur.question} pressing={pressing} big />
              {!pressing && <StoryHint stories={stories} question={cur.question} />}
              <div className="sheet p-3">
                <textarea ref={boxRef} aria-label="Your answer" value={answer} onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }}
                  className="h-40 w-full resize-y rounded-md bg-paper/60 p-3 text-[15px] outline-none focus:ring-2 focus:ring-blue/30" placeholder="Your answer…" />
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Btn disabled={busy || !answer.trim()} onClick={submit}>{busy ? "Scoring…" : "Submit answer"}</Btn>
                  {voice && <Recorder onResult={(r) => { setAnswer((a) => (a ? a + " " : "") + r.text); setVmetrics(r); }} />}
                  <span className="label hidden sm:inline">⌘ + Enter</span>
                  <div className="ml-auto flex items-center gap-3">
                    <div className="h-1.5 w-28 overflow-hidden rounded-full bg-line">
                      <motion.div className="h-full" initial={false}
                        animate={{ width: `${Math.min(100, (words / TARGET) * 100)}%`, backgroundColor: words > 180 ? "#cf3a2e" : words >= 40 ? "#157a58" : "#b9720a" }}
                        transition={{ type: "spring", stiffness: 260, damping: 30 }} />
                    </div>
                    <span className="label w-24">{words} / ~{TARGET} words</span>
                    <span className={`label w-10 text-right ${secs > 75 ? "!text-pen" : ""}`}>{mmss(secs)}</span>
                  </div>
                </div>
              </div>
              {vmetrics && (
                <div className="mt-3 rounded-md bg-paper/70 p-3 text-sm">
                  <p className="label mb-1">Delivery · {vmetrics.metrics.wpm} words a minute · {vmetrics.metrics.pause_count} long pauses · fillers {Object.values(vmetrics.metrics.fillers).reduce((a, b) => a + b, 0)}</p>
                  <ul className="space-y-0.5">{vmetrics.coaching.map((c) => <li key={c}>– {c}</li>)}</ul>
                </div>
              )}
            </motion.div>
          )}

          {finished && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="sheet p-6">
              <p className="label">Session score</p>
              <p className="font-display text-5xl font-extrabold"><CountUp value={+avg.toFixed(1)} decimals={1} /><span className="text-xl text-muted">/10</span></p>
              <ul className="mt-4 space-y-2">
                {[...new Set(log.map((l) => l.ref).filter(Boolean))].map((ref) => (
                  <li key={ref} className="flex items-start gap-3 text-sm"><span className="w-20 shrink-0"><Stamp state={liveState(ref)} /></span><span>{ref}</span></li>
                ))}
              </ul>
              <div className="mt-5 flex gap-2"><Btn onClick={goBrief}>Back to the board</Btn><Btn variant="ghost" onClick={() => start({ weakest: true })}>Another round</Btn></div>
            </motion.div>
          )}
          {err && <p role="alert" className="text-sm font-medium text-pen">{err}</p>}
          <div ref={endRef} />
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="sheet p-4">
            <p className="label mb-3">Session · {Math.min(state.asked, total)} of {total}</p>
            <ol className="space-y-2">
              {state.queue.map((t, i) => {
                const done = i < state.asked - (finished ? 0 : 1);
                const now = i === state.asked - 1 && !finished;
                return (
                  <li key={i} className={`flex gap-2 text-sm ${now ? "font-semibold" : done ? "text-muted" : "text-muted/70"}`}>
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${done ? "bg-solid" : now ? "bg-blue" : "bg-line"}`} />
                    <span className="line-clamp-2">{t.question}</span>
                  </li>
                );
              })}
            </ol>
            {log.length > 0 && <p className="label mt-4 border-t border-line pt-3">Running average <span className="text-ink">{avg.toFixed(1)}</span></p>}
          </div>
        </aside>
      </div>
    </section>
  );
}

function Interviewer({ text, pressing, big }: { text: string; pressing: boolean; big?: boolean }) {
  return pressing ? (
    <motion.div className="pen-note" initial={{ x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 380, damping: 24 }}>
      <p className="label mb-1 !text-pen">Pushback</p><p className={`font-semibold ${big ? "text-lg" : ""}`}>{text}</p>
    </motion.div>
  ) : (
    <div><p className="label mb-1">Interviewer</p><p className={`font-display font-bold leading-snug ${big ? "text-2xl" : "text-lg"}`}>{text}</p></div>
  );
}

function Assessment({ score, refText, state, coach, question }: { score: Score; refText: string; state: "untested" | "shaky" | "solid"; coach: Coach; question: string }) {
  const [saved, setSaved] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="sheet p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="label">Assessment</p>
        {refText && <span className="flex items-center gap-2"><span className="label">This claim is now</span><Stamp state={state} /></span>}
        <p className={`font-display text-3xl font-extrabold ${score.total >= 7 ? "text-solid" : score.total >= 4 ? "text-shaky" : "text-pen"}`}>{score.total}<span className="text-sm text-muted">/10</span></p>
      </div>
      <div className="grid gap-x-8 gap-y-1.5 md:grid-cols-2">{DIM_ORDER.map((d) => <RatingBar key={d} compact label={DIM[d].label} value={score.dims[d]} />)}</div>
      {score.framework && <p className="label mt-3 !text-solid">Framework detected: {score.framework}</p>}
      <ul className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
        {score.fixes.map((f, k) => <li key={k} className="flex gap-2"><span className="label mt-0.5 shrink-0 !text-pen">Fix</span>{f}</li>)}
      </ul>
      {coach && (
        <div className="mt-3 rounded-md border-l-[3px] border-blue bg-blue/5 p-3 text-sm">
          <p className="label mb-1 !text-blue">Coach note · {coach.source === "library" ? "from your library" : "AI-written"}</p>
          <p>{coach.text}</p>
          {coach.source === "model" && (
            <button disabled={saved} onClick={() => post("/library", { kind: "feedback", question, text: coach.text }).then(() => setSaved(true))}
              className="label mt-2 underline hover:text-ink">{saved ? "Saved for review in Your data" : "Save to library for review"}</button>
          )}
        </div>
      )}
    </motion.div>
  );
}


type VoiceResult = { text: string; metrics: { wpm: number; pause_count: number; longest_pause: number; fillers: Record<string, number> }; coaching: string[] };

function StoryHint({ stories, question }: { stories: StoriesData | null; question: string }) {
  const [open, setOpen] = useState(false);
  if (!stories) return null;
  const q = question.toLowerCase();
  let theme = "", hits = 0;
  for (const t of stories.themes.themes) { const n = t.cues.filter((c) => q.includes(c)).length; if (n > hits) { theme = t.id; hits = n; } }
  if (!theme) return null;
  const label = stories.themes.themes.find((t) => t.id === theme)!.label;
  const best = stories.stories.filter((s) => s.theme === theme).sort((a, b) => b.score - a.score)[0];
  if (!best) return <p className="label">Story bank: no <span className="text-ink">{label.toLowerCase()}</span> story yet. Add one in Stories to reuse it here.</p>;
  return (
    <div className="rounded-md border-l-[3px] border-blue bg-blue/5 p-3 text-sm">
      <button onClick={() => setOpen(!open)} className="label !text-blue underline">From your story bank · {label} · {best.title || "untitled"} · {best.score}/10 {open ? "(hide)" : "(show)"}</button>
      {open && <p className="mt-2">{best.composed}</p>}
    </div>
  );
}

/** Local voice: records in the browser, transcribes on this machine, never stores audio. */
function Recorder({ onResult }: { onResult: (r: VoiceResult) => void }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function toggle() {
    setErr("");
    if (rec) { rec.stop(); setRec(null); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setBusy(true);
        try {
          const fd = new FormData();
          fd.append("audio", new Blob(chunks, { type: mr.mimeType }), "answer.webm");
          onResult(await api<VoiceResult>("/voice/transcribe", { method: "POST", body: fd }));
        } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
      };
      mr.start(); setRec(mr);
    } catch { setErr("Microphone not available. Check browser permission."); }
  }
  return (
    <span className="flex items-center gap-2">
      <Btn variant="ghost" onClick={toggle} disabled={busy}>{rec ? "Stop recording" : busy ? "Transcribing…" : "Answer by voice"}</Btn>
      {err && <span role="alert" className="text-sm text-pen">{err}</span>}
    </span>
  );
}
