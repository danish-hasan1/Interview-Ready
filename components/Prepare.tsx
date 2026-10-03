"use client";
import { motion } from "motion/react";
import type { Analysis, Profile } from "@/lib/types";
import Brief, { type DrillRequest } from "./Brief";
import CoreAnswers from "./CoreAnswers";
import CvReview from "./CvReview";
import Stories from "./Stories";
import Train from "./Train";

export const PREP_TABS = [
  { id: "board", label: "Defence board" },
  { id: "review", label: "CV review" },
  { id: "core", label: "Core answers" },
  { id: "stories", label: "Stories" },
  { id: "train", label: "Training" },
] as const;
export type PrepTab = (typeof PREP_TABS)[number]["id"];

export default function Prepare(p: {
  tab: PrepTab; setTab: (t: PrepTab) => void; analysis: Analysis | null; setAnalysis: (a: Analysis) => void; notes: string; setNotes: (n: string) => void;
  profile: Profile | null; onDrill: (r: DrillRequest) => void; onAnalysed: () => void; lessonId: string | null; setLessonId: (id: string | null) => void;
  onChanged: () => void; goBrief: () => void; goPractice: () => void;
}) {
  return (
    <div>
      <nav aria-label="Prepare sections" className="no-print mb-6 flex gap-1 overflow-x-auto rounded-lg border border-line bg-card p-1">
        {PREP_TABS.map((t) => (
          <button key={t.id} onClick={() => { p.setLessonId(null); p.setTab(t.id); }} aria-current={p.tab === t.id ? "page" : undefined}
            className={`relative whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${p.tab === t.id ? "text-white" : "text-muted hover:text-ink"}`}>
            {p.tab === t.id && <motion.span layoutId="prep-pill" className="absolute inset-0 rounded-md bg-ink" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </nav>
      {p.tab === "board" && <Brief analysis={p.analysis} setAnalysis={p.setAnalysis} notes={p.notes} setNotes={p.setNotes} profile={p.profile} onDrill={p.onDrill}
        goTo={(x) => (x === "brief" ? p.goBrief() : p.setTab(x === "review" ? "review" : "train"))} />}
      {p.tab === "review" && <CvReview refreshKey={p.analysis} onAnalysed={p.onAnalysed} onTrain={(id) => { p.setLessonId(id ?? null); p.setTab("train"); }} onPractise={(qs) => p.onDrill({ custom: qs })} />}
      {p.tab === "core" && <CoreAnswers onChanged={p.onChanged} />}
      {p.tab === "stories" && <Stories />}
      {p.tab === "train" && <Train initialLesson={p.lessonId} goBrief={() => p.setTab("board")} goPractice={p.goPractice} onChanged={p.onChanged} />}
    </div>
  );
}
