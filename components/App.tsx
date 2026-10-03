"use client";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Analysis, Profile, Workspace } from "@/lib/types";
import { Ring } from "./charts";
import Dashboard from "./Dashboard";
import Icon from "./Icon";
import Practice from "./Practice";
import Prepare from "./Prepare";
import Privacy from "./Privacy";
import Progress from "./Progress";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "prepare", label: "Prepare", icon: "prepare" },
  { id: "practice", label: "Practice", icon: "practice" },
  { id: "progress", label: "Progress", icon: "progress" },
  { id: "privacy", label: "Privacy", icon: "privacy" },
] as const;
type Page = (typeof NAV)[number]["id"];

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [notes, setNotes] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [greeting, setGreeting] = useState("Welcome back");

  const refresh = useCallback(() => { api<Profile>("/profile").then(setProfile).catch(() => {}); }, []);

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
    refresh();
    api<Workspace>("/workspace").then((w) => {
      if (w.has_cv) setAnalysis({ claims: w.claims, gaps: w.gaps, gap_questions: w.gap_questions, cv_name: w.cv_name });
    }).catch(() => {});
  }, [refresh]);

  const go = (p: Page) => () => setPage(p);
  const readiness = profile && profile.sessions.length
    ? Math.round((profile.sessions.reduce((s, x) => s + x.avg_total, 0) / profile.sessions.length) * 10) : null;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
        <aside className="relative z-20 hidden flex-col overflow-hidden bg-side p-5 text-white lg:flex lg:sticky lg:top-0 lg:h-screen">
          <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-brand/40 blur-3xl" />
          <div className="relative flex items-center gap-3 px-1 py-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan via-brand to-pink font-display text-sm font-extrabold shadow-lg">IR</span>
            <div><p className="font-display text-lg font-bold leading-none">Interview Ready</p><p className="label mt-1 !text-white/50">Career coach</p></div>
          </div>
          <nav aria-label="Main" className="relative mt-8 flex flex-col gap-1">
            {NAV.map((n) => (
              <button key={n.id} onClick={go(n.id)} aria-current={page === n.id ? "page" : undefined}
                className={`relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${page === n.id ? "text-white" : "text-white/55 hover:text-white"}`}>
                {page === n.id && <motion.span layoutId="nav" className="absolute inset-0 rounded-xl bg-white/10 ring-1 ring-white/15" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                <Icon name={n.icon} className="relative h-[18px] w-[18px]" /><span className="relative">{n.label}</span>
                {n.id === "practice" && analysis && page !== "practice" && <span className="relative ml-auto h-2 w-2 rounded-full bg-cyan shadow-[0_0_10px] shadow-cyan" />}
              </button>
            ))}
          </nav>
          <div className="relative mt-auto space-y-3">
            <div className="glass flex items-center gap-4 p-4">
              {readiness !== null ? <Ring value={readiness} size={64} stroke={7} dark /> : <span className="grid h-16 w-16 place-items-center rounded-full border border-dashed border-white/25 font-mono text-xs text-white/50">—</span>}
              <div><p className="font-display text-sm font-bold">Readiness</p><p className="text-xs text-white/55">{readiness !== null ? "Across all sessions" : "Complete a mock interview"}</p></div>
            </div>
            <p className="label flex items-center gap-2 px-1 !text-white/40"><Icon name="lock" className="h-3.5 w-3.5" /> Private. No external AI.</p>
          </div>
        </aside>

        <div className="min-w-0 pb-24 lg:pb-0">
          <header className="flex items-center justify-between gap-3 border-b border-line bg-card/70 px-5 py-3 backdrop-blur lg:hidden">
            <span className="flex items-center gap-2 font-display font-bold"><span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-cyan via-brand to-pink text-xs font-extrabold text-white">IR</span>Interview Ready</span>
          </header>
          <AnimatePresence mode="wait" initial={false}>
            <motion.main key={page} className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10 lg:py-10"
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
              {page === "dashboard" && <Dashboard profile={profile} analysis={analysis} greeting={greeting} go={(p) => setPage(p)} />}
              {page === "prepare" && <Prepare analysis={analysis} setAnalysis={(a) => { setAnalysis(a); }} notes={notes} setNotes={setNotes} goPractice={go("practice")} />}
              {page === "practice" && <Practice analysis={analysis} notes={notes} goPrepare={go("prepare")} onFinished={refresh} />}
              {page === "progress" && <Progress profile={profile} goPractice={go("practice")} />}
              {page === "privacy" && <Privacy onDeleted={() => { setAnalysis(null); setProfile(null); refresh(); }} />}
            </motion.main>
          </AnimatePresence>
        </div>

        <nav aria-label="Main" className="fixed inset-x-3 bottom-3 z-30 flex justify-around rounded-2xl bg-side/95 p-1.5 shadow-2xl backdrop-blur lg:hidden">
          {NAV.map((n) => (
            <button key={n.id} onClick={go(n.id)} aria-label={n.label} aria-current={page === n.id ? "page" : undefined}
              className={`grid flex-1 place-items-center rounded-xl py-2.5 ${page === n.id ? "bg-white/15 text-white" : "text-white/55"}`}><Icon name={n.icon} /></button>
          ))}
        </nav>
      </div>
    </MotionConfig>
  );
}
