"use client";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Analysis, Profile, Target, Workspace } from "@/lib/types";
import type { DrillRequest } from "./Brief";
import Debrief from "./Debrief";
import InterviewBrief from "./InterviewBrief";
import Practice from "./Practice";
import Prepare, { type PrepTab } from "./Prepare";
import Privacy from "./Privacy";
import Record from "./Record";
import Targets from "./Targets";
import Unlock from "./Unlock";
import Today from "./Today";

const NAV = [
  { id: "today", label: "Today" },
  { id: "targets", label: "Interviews" },
  { id: "prepare", label: "Prepare" },
  { id: "practice", label: "Practice" },
  { id: "debrief", label: "Debrief" },
  { id: "record", label: "Record" },
  { id: "data", label: "Your data" },
] as const;
type Page = (typeof NAV)[number]["id"] | "brief";

export default function App() {
  const [page, setPage] = useState<Page>("today");
  const [prep, setPrep] = useState<PrepTab>("board");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [notes, setNotes] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [active, setActive] = useState<Target | null>(null);
  const [rev, setRev] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [drill, setDrill] = useState<(DrillRequest & { id: number }) | null>(null);

  const refresh = useCallback(() => { api<Profile>("/profile").then(setProfile).catch(() => {}); setRev((x) => x + 1); }, []);
  const loadActive = useCallback(() => { api<Target>("/targets/active").then(setActive).catch(() => {}); }, []);
  const reloadWorkspace = useCallback(() => {
    api<Workspace>("/workspace").then((w) => {
      if (w.has_cv) setAnalysis({ claims: w.claims, gaps: w.gaps, gap_items: w.gap_items, cv_name: w.cv_name });
      else setAnalysis(null);
    }).catch(() => {});
  }, []);
  const changed = useCallback(() => { reloadWorkspace(); loadActive(); refresh(); }, [reloadWorkspace, loadActive, refresh]);

  useEffect(() => {
    const lock = () => setLocked(true);
    window.addEventListener("ir-locked", lock);
    api<{ required: boolean; ok: boolean }>("/access").then((a) => { if (a.required && !a.ok) setLocked(true); }).catch(() => {});
    return () => window.removeEventListener("ir-locked", lock);
  }, []);

  useEffect(() => { refresh(); reloadWorkspace(); loadActive(); }, [refresh, reloadWorkspace, loadActive]);

  const startDrill = (r: DrillRequest) => { setDrill({ ...r, id: Date.now() }); setPage("practice"); };

  /** One router for every "open this" button: nav items, readiness criteria and plan tasks. */
  const navigate = (spec: string) => {
    setLessonId(null);
    if (spec === "board") { setPrep("board"); setPage("prepare"); }
    else if (spec.startsWith("prepare:")) { setPrep(spec.split(":")[1] as PrepTab); setPage("prepare"); }
    else if (spec === "practice:stage") startDrill({ mode: "stage" });
    else if (spec.startsWith("drill:")) startDrill({ focus: spec.slice(6) });
    else if (spec.startsWith("lesson:")) { setLessonId(spec.slice(7)); setPrep("train"); setPage("prepare"); }
    else setPage(spec as Page);
  };

  if (locked) return <Unlock onUnlocked={() => { setLocked(false); changed(); }} />;

  const label = active ? (active.kind === "general" ? "General preparation" : [active.role || "Interview", active.company].filter(Boolean).join(" · ")) : "";

  return (
    <MotionConfig reducedMotion="user">
      <header className="no-print sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-5 pt-3">
          <span className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-ink font-display text-[11px] font-extrabold text-white">IR</span>
            <span className="font-display text-base font-extrabold tracking-tight">Interview Ready</span>
          </span>
          <nav aria-label="Main" className="flex gap-1 overflow-x-auto">
            {NAV.map((n) => (
              <button key={n.id} onClick={() => navigate(n.id)} aria-current={page === n.id ? "page" : undefined}
                className={`relative whitespace-nowrap px-3 pb-3 pt-1 text-sm font-semibold transition-colors ${page === n.id ? "text-ink" : "text-muted hover:text-ink"}`}>
                {n.label}
                {page === n.id && <motion.span layoutId="tab" className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-blue" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
              </button>
            ))}
          </nav>
          {active && (
            <button onClick={() => setPage("targets")} className="label mb-3 ml-auto max-w-[16rem] truncate rounded-full border border-line bg-card px-3 py-1 hover:border-ink" title="Switch interview">
              Preparing for: <span className="text-ink">{label}</span>{active.days_left !== null && active.days_left >= 0 ? ` · ${active.days_left}d` : ""}
            </button>
          )}
        </div>
      </header>

      {/* Practice stays mounted so an interview in progress survives tab changes. */}
      <div className={`mx-auto w-full max-w-5xl px-5 py-8 pb-24 ${page === "practice" ? "" : "hidden"}`}>
        <Practice analysis={analysis} notes={notes} profile={profile} request={drill} onConsumed={() => setDrill(null)} goBrief={() => navigate("board")} onFinished={refresh} stageLabel={active?.kind === "interview"} />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {page !== "practice" && <motion.main key={`${page}-${page === "prepare" ? "" : ""}`} className="mx-auto w-full max-w-5xl px-5 py-8 pb-24"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {page === "today" && <Today navigate={navigate} refreshKey={rev} onChanged={refresh} />}
          {page === "targets" && <Targets onChanged={changed} navigate={navigate} />}
          {page === "prepare" && <Prepare tab={prep} setTab={setPrep} analysis={analysis} setAnalysis={setAnalysis} notes={notes} setNotes={setNotes} profile={profile}
            onDrill={startDrill} onAnalysed={changed} lessonId={lessonId} setLessonId={setLessonId} onChanged={refresh} goBrief={() => setPage("brief")} goPractice={() => setPage("practice")} />}
          {page === "debrief" && <Debrief onPractise={(qs) => startDrill({ custom: qs })} />}
          {page === "brief" && <InterviewBrief goBoard={() => navigate("board")} />}
          {page === "record" && <Record profile={profile} goPractice={() => setPage("practice")} />}
          {page === "data" && <Privacy onDeleted={() => { setAnalysis(null); setProfile(null); setDrill(null); changed(); }} />}
        </motion.main>}
      </AnimatePresence>
    </MotionConfig>
  );
}
