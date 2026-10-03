"use client";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Analysis, Profile, Workspace } from "@/lib/types";
import Brief, { type DrillRequest } from "./Brief";
import Practice from "./Practice";
import Privacy from "./Privacy";
import Record from "./Record";

const NAV = [
  { id: "board", label: "Defence board" },
  { id: "practice", label: "Practice" },
  { id: "record", label: "Record" },
  { id: "data", label: "Your data" },
] as const;
type Page = (typeof NAV)[number]["id"];

export default function App() {
  const [page, setPage] = useState<Page>("board");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [notes, setNotes] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [drill, setDrill] = useState<(DrillRequest & { id: number }) | null>(null);

  const refresh = useCallback(() => { api<Profile>("/profile").then(setProfile).catch(() => {}); }, []);

  useEffect(() => {
    refresh();
    api<Workspace>("/workspace").then((w) => {
      if (w.has_cv) setAnalysis({ claims: w.claims, gaps: w.gaps, gap_items: w.gap_items, cv_name: w.cv_name });
    }).catch(() => {});
  }, [refresh]);

  const startDrill = (r: DrillRequest) => { setDrill({ ...r, id: Date.now() }); setPage("practice"); };

  return (
    <MotionConfig reducedMotion="user">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-5 py-3">
          <span className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-ink font-display text-[11px] font-extrabold text-white">IR</span>
            <span className="font-display text-base font-extrabold tracking-tight">Interview Ready</span>
          </span>
          <nav aria-label="Main" className="-mb-3 flex gap-1 overflow-x-auto">
            {NAV.map((n) => (
              <button key={n.id} onClick={() => setPage(n.id)} aria-current={page === n.id ? "page" : undefined}
                className={`relative whitespace-nowrap px-3 pb-3 pt-1 text-sm font-semibold transition-colors ${page === n.id ? "text-ink" : "text-muted hover:text-ink"}`}>
                {n.label}
                {page === n.id && <motion.span layoutId="tab" className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-blue" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Practice stays mounted so an interview in progress survives tab changes. */}
      <div className={`mx-auto w-full max-w-5xl px-5 py-8 pb-24 ${page === "practice" ? "" : "hidden"}`}>
        <Practice analysis={analysis} notes={notes} profile={profile} request={drill} onConsumed={() => setDrill(null)} goBrief={() => setPage("board")} onFinished={refresh} />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {page !== "practice" && <motion.main key={page} className="mx-auto w-full max-w-5xl px-5 py-8 pb-24"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {page === "board" && <Brief analysis={analysis} setAnalysis={setAnalysis} notes={notes} setNotes={setNotes} profile={profile} onDrill={startDrill} />}
          {page === "record" && <Record profile={profile} goPractice={() => setPage("practice")} />}
          {page === "data" && <Privacy onDeleted={() => { setAnalysis(null); setProfile(null); setDrill(null); refresh(); }} />}
        </motion.main>}
      </AnimatePresence>
    </MotionConfig>
  );
}
