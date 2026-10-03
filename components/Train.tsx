"use client";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { api, post } from "@/lib/api";
import { DIM, DIM_ORDER } from "@/lib/dims";
import type { BulletReview, Drill, DrillField, Lesson, QuizQ, TrainingOverview } from "@/lib/types";
import { Btn, PageHeader, RatingBar, Stamp, ease, itemV, listV } from "./ui";

const DONE_AT = 6;

export default function Train({ initialLesson, goBrief, goPractice, onChanged }: {
  initialLesson?: string | null; goBrief: () => void; goPractice: () => void; onChanged: () => void;
}) {
  const [o, setO] = useState<TrainingOverview | null>(null);
  const [active, setActive] = useState<string | null>(initialLesson ?? null);
  const [pressure, setPressure] = useState(false);
  const load = useCallback(() => api<TrainingOverview>("/training").then(setO), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (initialLesson) setActive(initialLesson); }, [initialLesson]);

  if (!o) return null;
  if (pressure) return <PressureDrill back={() => setPressure(false)} onSaved={() => { load(); onChanged(); }} />;
  const lesson = o.lessons.find((l) => l.id === active);
  if (lesson) return <LessonView lesson={lesson} o={o} back={() => setActive(null)} onSaved={() => { load(); onChanged(); }} next={(id) => setActive(id)} />;

  const done = (id: string) => (o.progress[id]?.best ?? 0) >= DONE_AT;
  const doneCount = o.plan.filter((p) => done(p.lesson_id)).length;
  const planIds = new Set(o.plan.map((p) => p.lesson_id));
  const others = o.lessons.filter((l) => !planIds.has(l.id));

  return (
    <section>
      <PageHeader title="Train before the interview" action={<Btn variant="ghost" onClick={goPractice}>Go to practice</Btn>}>
        Short lessons with drills, picked from your CV review, the role&apos;s gaps and how you score in practice. Each one is rule-checked, so feedback is instant.
      </PageHeader>

      {!o.has_cv && (
        <div className="sheet mb-6 p-5"><p className="text-sm text-muted">Upload your CV for a plan built around your gaps. The lessons below work without it.</p>
          <Btn className="mt-3" onClick={goBrief}>Upload your CV</Btn></div>
      )}

      {o.plan.length > 0 && (
        <div className="sheet mb-8 p-5">
          <div className="mb-4 flex items-end justify-between">
            <div><p className="label">Your plan</p><p className="font-display text-2xl font-extrabold">{doneCount} of {o.plan.length} done</p></div>
            <div className="h-2 w-40 overflow-hidden rounded-full bg-line">
              <motion.div className="h-full bg-solid" initial={{ width: 0 }} animate={{ width: `${(doneCount / o.plan.length) * 100}%` }} transition={{ duration: 0.7, ease }} />
            </div>
          </div>
          <motion.ol variants={listV} initial="hidden" animate="show" className="divide-y divide-line">
            {o.plan.map((p, i) => (
              <motion.li key={p.lesson_id} variants={itemV} className="flex items-start gap-4 py-4">
                <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold ${done(p.lesson_id) ? "bg-solid text-white" : "bg-line text-muted"}`}>{done(p.lesson_id) ? "✓" : i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-bold">{p.title}</p>
                  <p className="text-sm text-muted">{p.reason}</p>
                  <p className="label mt-1">{p.minutes} min{o.progress[p.lesson_id] ? ` · best ${o.progress[p.lesson_id].best}/10 · ${o.progress[p.lesson_id].attempts}×` : ""}</p>
                </div>
                <Btn variant={done(p.lesson_id) ? "ghost" : "primary"} onClick={() => setActive(p.lesson_id)}>{done(p.lesson_id) ? "Review" : "Start"}</Btn>
              </motion.li>
            ))}
          </motion.ol>
        </div>
      )}

      <button onClick={() => setPressure(true)} className="sheet mb-8 flex w-full items-center justify-between gap-4 border-l-[3px] border-l-pen p-5 text-left transition-colors hover:border-ink">
        <span><span className="label !text-pen">Timed practice</span>
          <span className="block font-display text-xl font-bold">Pressure drills</span>
          <span className="text-sm text-muted">Six rounds. The interviewer interrupts with a challenge and you have 45 seconds to recover. {o.progress["pressure_drill"] ? `Best ${o.progress["pressure_drill"].best}/10.` : ""}</span></span>
        <span className="btn btn-primary">Start</span>
      </button>

      {others.length > 0 && (
        <>
          <p className="label mb-3">More lessons</p>
          <div className="grid gap-3 md:grid-cols-2">
            {others.map((l) => (
              <button key={l.id} onClick={() => setActive(l.id)} className="sheet p-4 text-left transition-colors hover:border-ink">
                <p className="font-display font-bold">{l.title}</p>
                <p className="label mt-1">{l.minutes} min{o.progress[l.id] ? ` · best ${o.progress[l.id].best}/10` : ""}</p>
              </button>
            ))}
          </div>
        </>
      )}
      {o.resources.length > 0 && (
        <div className="mt-10">
          <p className="label mb-1">Read next, matched to your weak spots</p>
          <p className="mb-3 text-sm text-muted">Titles only, so search them or borrow them. Check the current edition.</p>
          <ul className="grid gap-3 md:grid-cols-2">
            {o.resources.map((r) => (
              <li key={r.title} className="sheet p-4">
                <p className="font-display font-bold">{r.title}</p>
                <p className="label">{r.author} · {r.format} · {r.level}</p>
                <p className="mt-2 text-sm text-muted">{r.why}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function LessonView({ lesson, o, back, onSaved, next }: { lesson: Lesson; o: TrainingOverview; back: () => void; onSaved: () => void; next: (id: string) => void }) {
  const idx = o.plan.findIndex((p) => p.lesson_id === lesson.id);
  const nextId = idx >= 0 && idx < o.plan.length - 1 ? o.plan[idx + 1].lesson_id : null;
  const save = async (score: number) => { await post("/training/complete", { lesson_id: lesson.id, score }); onSaved(); };

  return (
    <section>
      <button onClick={back} className="label mb-4 hover:text-ink">← Back to plan</button>
      <PageHeader title={lesson.title}>{lesson.why}</PageHeader>

      <motion.ol variants={listV} initial="hidden" animate="show" className="sheet mb-6 divide-y divide-line">
        {lesson.steps.map((s, i) => (
          <motion.li key={s.title} variants={itemV} className="flex gap-4 p-4">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink font-mono text-xs text-white">{i + 1}</span>
            <div><p className="font-display font-bold">{s.title}</p><p className="text-sm text-muted">{s.body}</p></div>
          </motion.li>
        ))}
      </motion.ol>

      {lesson.weak && (
        <div className="mb-6 grid gap-3 md:grid-cols-2">
          <div className="pen-note"><p className="label mb-1 !text-pen">Weak</p><p className="text-sm">{lesson.weak}</p></div>
          <div className="rounded-md border-l-[3px] border-solid bg-solid/[.07] p-3 pl-4"><p className="label mb-1 !text-solid">Strong</p><p className="text-sm">{lesson.strong}</p></div>
        </div>
      )}

      <div className="sheet p-5">
        <p className="label mb-1">Drill</p>
        <h2 className="font-display text-xl font-bold">{lesson.drill.title}</h2>
        <DrillBody key={lesson.id} lesson={lesson} drill={lesson.drill} o={o} save={save} />
      </div>
      {nextId && <div className="mt-6"><Btn variant="ghost" onClick={() => next(nextId)}>Next lesson in your plan →</Btn></div>}
    </section>
  );
}

function DrillBody({ lesson, drill, o, save }: { lesson: Lesson; drill: Drill; o: TrainingOverview; save: (s: number) => Promise<void> }) {
  if (drill.type === "build") return <BuildDrill lesson={lesson} drill={drill} o={o} save={save} />;
  if (drill.type === "rewrite") return <RewriteDrill drill={drill} bullets={o.rewrite_bullets} save={save} />;
  return <QuizDrill questions={o.quizzes[drill.quiz] ?? []} save={save} />;
}

type BuildRes = { fields: { key: string; ok: boolean; msg: string }[]; composed: string; score: number; dims: Record<string, number>; fixes: string[]; framework: string; pass: boolean };

function BuildDrill({ lesson, drill, o, save }: { lesson: Lesson; drill: Extract<Drill, { type: "build" }>; o: TrainingOverview; save: (s: number) => Promise<void> }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [res, setRes] = useState<BuildRes | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const prompt = drill.prompt.replace("{claim}", o.claim || "your most senior role").replace("{metric}", o.metric || o.claim || "your headline result");

  async function check() {
    setBusy(true); setErr("");
    try {
      const r = await post<BuildRes>("/training/check", { kind: "build", lesson_id: lesson.id, values: vals });
      setRes(r); await save(r.score);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  const words = (k: string) => (vals[k] ?? "").trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="mt-3 space-y-4">
      <p className="rounded-md bg-paper/70 p-3 text-[15px]">{prompt}</p>
      {drill.fields.map((f: DrillField) => {
        const note = res?.fields.find((x) => x.key === f.key);
        return (
          <div key={f.key}>
            <label htmlFor={f.key} className="label mb-1 flex justify-between"><span>{f.label}</span>
              {(f.max_words || f.min_words) && <span>{words(f.key)} words{f.max_words ? ` / max ${f.max_words}` : ""}</span>}</label>
            <textarea id={f.key} rows={f.rows ?? 2} value={vals[f.key] ?? ""} placeholder={f.hint}
              onChange={(e) => { setVals({ ...vals, [f.key]: e.target.value }); }}
              className={`w-full resize-y rounded-md border bg-paper/60 p-3 text-sm outline-none focus:border-blue ${note ? (note.ok ? "border-solid" : "border-pen") : "border-line"}`} />
            {note && !note.ok && <p className="mt-1 text-sm font-medium text-pen">{note.msg}</p>}
          </div>
        );
      })}
      <div className="flex items-center gap-3">
        <Btn disabled={busy} onClick={check}>{busy ? "Checking…" : "Check my answer"}</Btn>
        {err && <p role="alert" className="text-sm font-medium text-pen">{err}</p>}
      </div>
      <AnimatePresence>
        {res && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 border-t border-line pt-4">
            <div className="flex items-center justify-between">
              <p className="label">Assessment of your assembled answer</p>
              <span className="flex items-center gap-3"><Stamp state={res.pass ? "solid" : "shaky"} /><span className="font-display text-2xl font-extrabold">{res.score}<span className="text-sm text-muted">/10</span></span></span>
            </div>
            <div className="grid gap-x-8 gap-y-1.5 md:grid-cols-2">{DIM_ORDER.map((d) => <RatingBar key={d} compact label={DIM[d].label} value={res.dims[d]} />)}</div>
            <details className="text-sm"><summary className="label cursor-pointer">Read your answer as the interviewer hears it</summary><p className="mt-2 rounded-md bg-paper/70 p-3">{res.composed}</p></details>
            <ul className="space-y-1.5 text-sm">{res.fixes.map((f) => <li key={f} className="flex gap-2"><span className="label mt-0.5 shrink-0 !text-pen">Fix</span>{f}</li>)}</ul>
            {!res.pass && <p className="text-sm text-muted">Revise the flagged fields and check again. A pass needs every field to clear and a score of 6 or more.</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type RwRes = { before: number; after: number; issues: string[]; improved: boolean; good: boolean };

function RewriteDrill({ drill, bullets, save }: { drill: Extract<Drill, { type: "rewrite" }>; bullets: BulletReview[]; save: (s: number) => Promise<void> }) {
  const items = bullets.slice(0, drill.count);
  const [texts, setTexts] = useState<Record<number, string>>({});
  const [res, setRes] = useState<Record<number, RwRes>>({});
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  if (items.length === 0) return <p className="mt-3 text-sm text-muted">No weak lines found on your CV, or no CV uploaded yet. Upload a CV on the Defence board to get lines to rewrite.</p>;

  async function score(i: number) {
    setErr("");
    try { setRes({ ...res, [i]: await post<RwRes>("/training/check", { kind: "rewrite", original: items[i].text, text: texts[i] ?? "" }) }); }
    catch (e) { setErr((e as Error).message); }
  }
  const results = Object.values(res);
  const avg = results.length ? results.reduce((s, r) => s + r.after, 0) / results.length / 10 : 0;

  return (
    <div className="mt-3 space-y-5">
      <p className="rounded-md bg-paper/70 p-3 text-[15px]">{drill.prompt}</p>
      {items.map((b, i) => (
        <div key={b.text} className="space-y-2">
          <div className="pen-note"><p className="label mb-1 !text-pen">Your line · scores {b.score}</p><p className="text-sm">{b.text}</p></div>
          <textarea rows={2} value={texts[i] ?? ""} onChange={(e) => setTexts({ ...texts, [i]: e.target.value })} placeholder="Your rewrite…"
            className="w-full resize-y rounded-md border border-line bg-paper/60 p-3 text-sm outline-none focus:border-blue" />
          <div className="flex items-center gap-3">
            <Btn variant="ghost" onClick={() => score(i)} disabled={!(texts[i] ?? "").trim()}>Score my rewrite</Btn>
            {res[i] && <span className={`font-display text-lg font-bold ${res[i].good ? "text-solid" : res[i].improved ? "text-shaky" : "text-pen"}`}>{res[i].before} → {res[i].after}</span>}
          </div>
          {res[i] && res[i].issues.length > 0 && <ul className="space-y-0.5 text-sm text-muted">{res[i].issues.map((x) => <li key={x}>– {x}</li>)}</ul>}
          {res[i]?.good && <p className="text-sm font-medium text-solid">Good. This line now invites the questions you want.</p>}
        </div>
      ))}
      {err && <p role="alert" className="text-sm font-medium text-pen">{err}</p>}
      <div className="flex items-center gap-3 border-t border-line pt-4">
        <Btn disabled={results.length === 0 || saved} onClick={async () => { await save(+avg.toFixed(1)); setSaved(true); }}>{saved ? "Saved" : "Save this lesson"}</Btn>
        {results.length > 0 && <span className="label">Average after rewrite {avg.toFixed(1)}/10 · 6 or more completes the lesson</span>}
      </div>
    </div>
  );
}

function QuizDrill({ questions, save }: { questions: QuizQ[]; save: (s: number) => Promise<void> }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const q = questions[i];
  if (!q) return null;

  async function advance() {
    if (i + 1 >= questions.length) { setDone(true); await save(+((correct / questions.length) * 10).toFixed(1)); }
    else { setI(i + 1); setPicked(null); }
  }

  if (done)
    return (
      <div className="mt-3"><p className="font-display text-4xl font-extrabold">{correct}<span className="text-xl text-muted"> / {questions.length}</span></p>
        <p className="mt-1 text-sm text-muted">{correct >= 8 ? "Fluent. Use these terms with numbers in your answers." : "Re-read the reasons for the ones you missed, then take it again."}</p>
        <Btn variant="ghost" className="mt-3" onClick={() => { setI(0); setPicked(null); setCorrect(0); setDone(false); }}>Take it again</Btn></div>
    );

  return (
    <div className="mt-3 space-y-3">
      <p className="label">Question {i + 1} of {questions.length}</p>
      <p className="font-display text-lg font-bold">{q.q}</p>
      <div className="space-y-2">
        {q.options.map((opt, k) => {
          const show = picked !== null;
          const right = k === q.answer;
          return (
            <button key={opt} disabled={show} onClick={() => { setPicked(k); if (right) setCorrect((c) => c + 1); }}
              className={`block w-full rounded-md border p-3 text-left text-sm transition-colors ${show ? (right ? "border-solid bg-solid/10" : k === picked ? "border-pen bg-pen/10" : "border-line opacity-60") : "border-line bg-card hover:border-ink"}`}>{opt}</button>
          );
        })}
      </div>
      {picked !== null && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <p className="text-sm"><span className="label mr-2">Why</span>{q.why}</p>
          <Btn onClick={advance}>{i + 1 >= questions.length ? "Finish" : "Next question"}</Btn>
        </motion.div>
      )}
    </div>
  );
}


type Round = { key: string; challenge: string; claim: string; seconds: number };

function PressureDrill({ back, onSaved }: { back: () => void; onSaved: () => void }) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [i, setI] = useState(0);
  const [text, setText] = useState("");
  const [left, setLeft] = useState(45);
  const [result, setResult] = useState<{ pass: boolean; words: number; message: string } | null>(null);
  const [passes, setPasses] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => { api<{ rounds: Round[] }>("/drills/pressure").then((r) => setRounds(r.rounds)); }, []);
  useEffect(() => {
    setLeft(rounds[i]?.seconds ?? 45);
    if (!rounds.length || result || done) return;
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [i, rounds, result, done]);

  const r = rounds[i];
  async function submit() {
    const res = await post<{ pass: boolean; words: number; message: string }>("/training/check", { kind: "pressure", lesson_id: r.key, text });
    setResult(left === 0 ? { ...res, pass: false, message: "Out of time. " + res.message } : res);
    if (res.pass && left > 0) setPasses((p) => p + 1);
  }
  async function next() {
    if (i + 1 >= rounds.length) {
      setDone(true);
      await post("/training/complete", { lesson_id: "pressure_drill", score: +((passes / rounds.length) * 10).toFixed(1) });
      onSaved();
    } else { setI(i + 1); setText(""); setResult(null); }
  }
  if (!r) return null;

  if (done)
    return (
      <section><PageHeader title="Pressure drills complete" />
        <div className="sheet p-6"><p className="font-display text-5xl font-extrabold">{passes}<span className="text-xl text-muted"> / {rounds.length}</span></p>
          <p className="mt-2 text-sm text-muted">{passes >= 5 ? "You recover cleanly. Keep it under real conditions in Practice with an aggressive interviewer." : "Run it again. The answer to every challenge is shorter, with a number."}</p>
          <div className="mt-4 flex gap-2"><Btn onClick={() => { setI(0); setText(""); setResult(null); setPasses(0); setDone(false); }}>Run again</Btn><Btn variant="ghost" onClick={back}>Back to training</Btn></div></div></section>
    );

  return (
    <section>
      <button onClick={back} className="label mb-4 hover:text-ink">← Back to training</button>
      <PageHeader title="Pressure drills">Round {i + 1} of {rounds.length}. Answer in one or two sentences.</PageHeader>
      <div className="sheet space-y-4 p-5">
        <p className="label">You said on your CV</p>
        <p className="text-[15px]">{r.claim}</p>
        <div className="pen-note"><p className="label mb-1 !text-pen">Interviewer interrupts</p><p className="text-lg font-semibold">{r.challenge}</p></div>
        <div className="flex items-center justify-between">
          <span className={`font-mono text-2xl font-semibold ${left <= 10 ? "text-pen" : ""}`}>0:{String(left).padStart(2, "0")}</span>
          <span className="label">{text.trim() ? text.trim().split(/\s+/).length : 0} words</span>
        </div>
        <textarea aria-label="Your recovery" rows={3} value={text} disabled={!!result} onChange={(e) => setText(e.target.value)} placeholder="Your recovery…"
          className="w-full resize-y rounded-md border border-line bg-paper/60 p-3 text-sm outline-none focus:border-blue" />
        {!result ? <Btn disabled={!text.trim()} onClick={submit}>Submit</Btn> : (
          <div className="space-y-3">
            <p className={`font-semibold ${result.pass ? "text-solid" : "text-pen"}`}>{result.message}</p>
            <Btn onClick={next}>{i + 1 >= rounds.length ? "Finish" : "Next round"}</Btn>
          </div>
        )}
      </div>
    </section>
  );
}
