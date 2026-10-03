"use client";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { api, post } from "@/lib/api";
import { useAi } from "@/lib/useAi";
import type { AiReview, CvReview as Data, CvVersion } from "@/lib/types";
import AiConsent from "./AiConsent";
import { Btn, CountUp, PageHeader, RatingBar, itemV, listV } from "./ui";

const CAT: Record<string, { label: string; hint: string }> = {
  impact: { label: "Numbers", hint: "Share of lines with a figure" },
  ownership: { label: "Ownership", hint: "Strong verbs, no weak phrasing" },
  outcomes: { label: "Results", hint: "Lines that state what changed" },
  business: { label: "Commercial", hint: "Revenue, cost, margin, budget" },
  concision: { label: "Concision", hint: "Line length and CV length" },
  structure: { label: "Structure", hint: "Standard sections present" },
};
const SEV = { high: ["High", "text-pen"], med: ["Medium", "text-shaky"], low: ["Low", "text-muted"] } as const;
const LESSON_TITLE: Record<string, string> = {
  structure: "Answer in a structure", defend_number: "Defend every number", own_it: "Say what you did", cv_bullets: "Rewrite CV lines as proof",
  pl_fluency: "Speak P&L like an operator", biz_vocab: "Business vocabulary", strategic: "Answer strategically", pressure: "Recover when interrupted", concise: "Land it in a minute",
};

export default function CvReview({ refreshKey, onAnalysed, onTrain, onPractise }: {
  refreshKey: unknown; onAnalysed: () => void; onTrain: (lessonId?: string) => void; onPractise: (qs: { question: string; ref: string }[]) => void;
}) {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => { api<Data>("/cv-review").then(setD).catch((e) => setErr(e.message)); }, [refreshKey, tick]);

  if (err) return <p role="alert" className="text-pen">{err}</p>;
  if (!d) return null;
  if (!d.has_cv)
    return (
      <>
        <PageHeader title="CV review" />
        <div className="sheet p-8"><p className="mb-4 max-w-md text-muted">Upload your CV and the review shows how it reads before anyone interviews you: numbers, ownership, results and commercial language.</p>
          <CvUploader onDone={() => { setTick((x) => x + 1); onAnalysed(); }} /></div>
      </>
    );

  const r = d.review;
  const color = r.score >= 75 ? "text-solid" : r.score >= 55 ? "text-shaky" : "text-pen";

  return (
    <section>
      <PageHeader title="CV review" action={<Btn onClick={() => onTrain()}>Start training plan</Btn>}>
        How your CV reads before anyone interviews you, and what to fix first.
      </PageHeader>

      <motion.div variants={listV} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={itemV} className="sheet flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="min-w-0"><p className="label">Reviewing</p><p className="truncate font-display font-bold">{d.versions[d.versions.length - 1]?.name ?? "Your CV"}</p>
            {d.versions.length > 1 && <p className="label mt-1">Versions: {d.versions.map((v: CvVersion) => `${v.name} ${v.score}`).join("  →  ")}</p>}</div>
          <CvUploader label="Replace with a new version" onDone={() => { setTick((x) => x + 1); onAnalysed(); }} />
        </motion.div>
        <AiPanel onPractise={onPractise} />
        <motion.div variants={itemV} className="sheet grid gap-6 p-6 md:grid-cols-[200px_minmax(0,1fr)]">
          <div>
            <p className="label">CV score</p>
            <p className={`font-display text-6xl font-extrabold leading-none ${color}`}><CountUp value={r.score} /><span className="text-xl text-muted">/100</span></p>
            <p className="mt-2"><span className={`stamp ${color}`}>{r.band}</span></p>
            <p className="label mt-4">{r.stats.lines} lines · {r.stats.words} words</p>
          </div>
          <div className="space-y-3">
            {Object.entries(CAT).map(([k, c]) => (
              <div key={k} title={c.hint}><RatingBar label={c.label} value={+(r.categories[k] / 10).toFixed(1)} /></div>
            ))}
          </div>
        </motion.div>

        {r.strengths.length > 0 && (
          <motion.div variants={itemV} className="sheet border-l-[3px] border-l-solid p-5">
            <p className="label mb-2 !text-solid">What already works</p>
            <ul className="space-y-1 text-sm">{r.strengths.map((s) => <li key={s}>✓ {s}</li>)}</ul>
          </motion.div>
        )}

        <motion.div variants={itemV}>
          <p className="label mb-3">What to fix, most serious first</p>
          <ul className="space-y-3">
            {r.findings.map((f) => (
              <li key={f.title} className="sheet p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className={`stamp ${SEV[f.severity][1]}`}>{SEV[f.severity][0]}</span>
                    <h3 className="mt-2 font-display text-lg font-bold">{f.title}</h3>
                    <p className="mt-1 text-sm text-muted">{f.detail}</p>
                    <p className="mt-2 text-sm"><span className="label mr-2">Fix</span>{f.fix}</p>
                  </div>
                  {f.lesson && <Btn variant="ghost" className="shrink-0" onClick={() => onTrain(f.lesson!)}>Train: {LESSON_TITLE[f.lesson] ?? "lesson"}</Btn>}
                </div>
                {f.evidence.length > 0 && (
                  <ul className="mt-3 space-y-1.5">{f.evidence.map((e) => <li key={e} className="border-l-2 border-pen/60 pl-3 text-sm">{e}</li>)}</ul>
                )}
              </li>
            ))}
            {r.findings.length === 0 && <li className="sheet p-5 text-muted">No major issues found. Move on to practice.</li>}
          </ul>
        </motion.div>

        {r.bullets_to_fix.length > 0 && (
          <motion.div variants={itemV} className="sheet overflow-hidden">
            <div className="flex items-center justify-between p-5 pb-3">
              <p className="label">Weakest lines on your CV</p>
              <Btn variant="ghost" onClick={() => onTrain("cv_bullets")}>Rewrite these lines</Btn>
            </div>
            {r.bullets_to_fix.map((b) => (
              <div key={b.text} className="flex gap-4 border-t border-line p-4">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md font-display font-bold text-white ${b.score >= 60 ? "bg-shaky" : "bg-pen"}`}>{b.score}</span>
                <div className="min-w-0"><p className="text-[15px]">{b.text}</p>
                  <ul className="mt-1 space-y-0.5 text-sm text-muted">{b.issues.map((i) => <li key={i}>– {i}</li>)}</ul></div>
              </div>
            ))}
          </motion.div>
        )}
      </motion.div>
    </section>
  );
}


function CvUploader({ onDone, label = "Upload your CV" }: { onDone: () => void; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function send(file: File) {
    setBusy(true); setErr("");
    try { const fd = new FormData(); fd.append("cv", file); await api("/analyze", { method: "POST", body: fd }); onDone(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <span className="flex flex-col items-start gap-1">
      <label className="btn btn-ghost cursor-pointer">
        <input className="sr-only" type="file" accept=".pdf,.docx,.txt,.md" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) send(f); e.target.value = ""; }} />
        {busy ? "Reading…" : label}
      </label>
      <span className="label">PDF, DOCX or TXT · up to 4 MB</span>
      {err && <span role="alert" className="text-sm text-pen">{err}</span>}
    </span>
  );
}

function AiPanel({ onPractise }: { onPractise: (qs: { question: string; ref: string }[]) => void }) {
  const { ai, refresh, on } = useAi();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState("");
  const [res, setRes] = useState<AiReview | null>(null);
  const [qs, setQs] = useState<{ question: string; ref: string }[] | null>(null);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  if (!ai) return null;

  async function run(kind: "review" | "questions") {
    setBusy(kind); setErr("");
    try {
      if (kind === "review") setRes(await post<AiReview>("/ai/cv-review", {}));
      else setQs((await post<{ questions: { question: string; ref: string }[] }>("/ai/questions", {})).questions);
      refresh();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  }

  if (!ai.configured)
    return <div className="sheet p-4 text-sm text-muted"><span className="label mr-2">AI</span>Off. Add <code className="font-mono">GROQ_API_KEY</code> to <code className="font-mono">.env.local</code> and restart the API to enable AI suggestions. Rule-based review works without it.</div>;
  if (consent) return <AiConsent ai={ai} onDone={() => { setConsent(false); refresh(); }} onCancel={() => setConsent(false)} />;
  if (!ai.enabled || !ai.consent)
    return <div className="sheet flex flex-wrap items-center justify-between gap-3 p-4"><p className="text-sm"><span className="label mr-2">AI</span>Add a second opinion: seniority read, rewrites that must beat the rule score, and the questions an interviewer would ask.</p><Btn onClick={() => setConsent(true)}>Set up AI</Btn></div>;

  return (
    <div className="space-y-4">
      <div className="sheet flex flex-wrap items-center justify-between gap-3 border-l-[3px] border-l-blue p-4">
        <p className="text-sm"><span className="label mr-2 !text-blue">AI on</span>Redacted text goes to {ai.provider}. Suggestions are AI-written: check every line.</p>
        <div className="flex gap-2">
          {on("cv_review") && <Btn disabled={!!busy} onClick={() => run("review")}>{busy === "review" ? "Reviewing…" : "Run AI review"}</Btn>}
          {on("questions") && <Btn variant="ghost" disabled={!!busy} onClick={() => run("questions")}>{busy === "questions" ? "Writing…" : "Hard questions"}</Btn>}
        </div>
      </div>
      {err && <p role="alert" className="text-sm font-medium text-pen">{err}</p>}

      {qs && (
        <div className="sheet p-5">
          <p className="label mb-3">AI-written interview questions from your CV and the role</p>
          <ul className="space-y-2 text-sm">{qs.map((q) => <li key={q.question} className="border-l-2 border-blue/60 pl-3"><p>{q.question}</p><p className="label mt-0.5">About: {q.ref}</p></li>)}</ul>
          <Btn className="mt-4" onClick={() => onPractise(qs)}>Practise these {qs.length}</Btn>
        </div>
      )}

      {res && (
        <div className="sheet space-y-5 p-5">
          <div><p className="label mb-1 !text-blue">AI read · seniority</p><p className="font-display text-lg font-bold">{res.seniority}</p><p className="mt-1 text-sm text-muted">{res.summary}</p></div>
          {res.risks.length > 0 && <div><p className="label mb-2">What an interviewer will distrust</p><ul className="space-y-1 text-sm">{res.risks.map((r) => <li key={r} className="border-l-2 border-pen/60 pl-3">{r}</li>)}</ul></div>}
          {res.rewrites.length > 0 && (
            <div><p className="label mb-2">Rewrites that beat the rule score</p>
              <ul className="space-y-3">{res.rewrites.map((w) => (
                <li key={w.original} className="rounded-md border border-line p-3 text-sm">
                  <p className="text-muted line-through">{w.original}</p><p className="mt-1 font-medium">{w.rewrite}</p>
                  <p className="label mt-1">{w.before} → {w.after}{w.needs_figure ? " · fill the [bracketed] figure from your own records" : ""} · {w.why}</p>
                  <button disabled={saved[w.original]} className="label mt-1 underline hover:text-ink" onClick={() => post("/library", { kind: "cv_rewrite", question: w.original, text: w.rewrite }).then(() => setSaved({ ...saved, [w.original]: true }))}>{saved[w.original] ? "Saved to library" : "Save to library"}</button>
                </li>))}</ul></div>
          )}
          {res.missing_evidence.length > 0 && <div><p className="label mb-2">Missing evidence for the role</p><ul className="space-y-1 text-sm">{res.missing_evidence.map((m) => <li key={m}>– {m}</li>)}</ul></div>}
          <p className="label">Contact details removed before sending · {Object.values(res.redacted).reduce((a, b) => a + b, 0)} items{res.dropped ? ` · ${res.dropped} unusable AI rewrite${res.dropped > 1 ? "s" : ""} discarded` : ""}</p>
        </div>
      )}
    </div>
  );
}
