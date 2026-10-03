"use client";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { CvReview as Data } from "@/lib/types";
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

export default function CvReview({ refreshKey, goBrief, onTrain }: { refreshKey: unknown; goBrief: () => void; onTrain: (lessonId?: string) => void }) {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api<Data>("/cv-review").then(setD).catch((e) => setErr(e.message)); }, [refreshKey]);

  if (err) return <p role="alert" className="text-pen">{err}</p>;
  if (!d) return null;
  if (!d.has_cv)
    return (
      <>
        <PageHeader title="CV review" />
        <div className="sheet p-8"><p className="max-w-md text-muted">Upload your CV and the review shows how it reads before anyone interviews you: numbers, ownership, results and commercial language.</p>
          <Btn className="mt-4" onClick={goBrief}>Upload your CV</Btn></div>
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
