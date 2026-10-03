"use client";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useState } from "react";
import type { Analysis } from "@/lib/types";
import Claims from "./Claims";
import Gaps from "./Gaps";
import Inputs from "./Inputs";
import Interview from "./Interview";
import Profile from "./Profile";

const TABS = ["Inputs", "CV claims", "Gaps", "Mock interview", "Profile"] as const;
type Tab = (typeof TABS)[number];

export default function App() {
  const [tab, setTab] = useState<Tab>("Inputs");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [notes, setNotes] = useState("");

  const ready: Record<Tab, boolean> = {
    Inputs: !!analysis,
    "CV claims": !!analysis,
    Gaps: !!analysis && analysis.gaps.length > 0,
    "Mock interview": false,
    Profile: false,
  };
  const go = (t: Tab) => () => setTab(t);

  return (
    <MotionConfig reducedMotion="user">
    <div className="mx-auto grid min-h-screen w-full max-w-6xl gap-8 px-4 py-6 lg:grid-cols-[220px_1fr] lg:py-10">
      <aside className="lg:sticky lg:top-10 lg:self-start">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink font-display text-sm font-extrabold text-white">IR</span>
          <span className="font-display text-lg font-bold tracking-tight">Interview Ready</span>
        </div>
        <nav aria-label="Steps" className="flex gap-1 overflow-x-auto lg:flex-col">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={go(t)}
              aria-current={tab === t ? "page" : undefined}
              className={`relative flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                tab === t ? "font-semibold" : "text-muted hover:text-ink"
              }`}
            >
              {tab === t && (
                <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-lg bg-card shadow-sm ring-1 ring-line"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }} />
              )}
              <motion.span
                key={`${t}-${ready[t]}`}
                initial={{ scale: ready[t] ? 0.4 : 1 }} animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 18 }}
                className={`relative grid h-5 w-5 place-items-center rounded-full font-mono text-[10px] ${
                ready[t] ? "bg-pass text-white" : tab === t ? "bg-cobalt text-white" : "bg-line text-muted"
              }`}>{ready[t] ? "✓" : i + 1}</motion.span>
              <span className="relative">{t}</span>
            </button>
          ))}
        </nav>
        <p className="label mt-8 hidden lg:block">Your data stays in your own database. No external AI calls.</p>
      </aside>

      <AnimatePresence mode="wait" initial={false}>
      <motion.main key={tab} className="min-w-0 pb-16"
        initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
        {tab === "Inputs" && <Inputs onDone={(a, n) => { setAnalysis(a); setNotes(n); setTab("CV claims"); }} />}
        {tab === "CV claims" && <Claims analysis={analysis} setAnalysis={setAnalysis} goInputs={go("Inputs")} next={go("Gaps")} />}
        {tab === "Gaps" && <Gaps analysis={analysis} goInputs={go("Inputs")} next={go("Mock interview")} />}
        {tab === "Mock interview" && <Interview analysis={analysis} notes={notes} goInputs={go("Inputs")} />}
        {tab === "Profile" && <Profile onDeleted={() => setAnalysis(null)} />}
      </motion.main>
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}
