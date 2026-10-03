"use client";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { api, post } from "@/lib/api";
import type { PlanTask, TodayData } from "@/lib/types";
import { Btn, CountUp, PageHeader } from "./ui";

const STAGE_TXT = (t: TodayData["target"]) => (t.kind === "general" ? "General preparation" : [t.role || "Interview", t.company].filter(Boolean).join(" · "));

export default function Today({ navigate, refreshKey, onChanged }: { navigate: (spec: string) => void; refreshKey: unknown; onChanged: () => void }) {
  const [d, setD] = useState<TodayData | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => api<TodayData>("/today").then(setD).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load, refreshKey]);
  if (err) return <p role="alert" className="text-pen">{err}</p>;
  if (!d) return null;

  const r = d.readiness;
  const tone = r.score >= 85 ? "text-solid" : r.score >= 65 ? "text-shaky" : "text-pen";
  const today = d.plan.tasks.filter((t) => t.day === 0 && !t.done);
  const upcoming = d.plan.tasks.filter((t) => t.day !== null && t.day > 0 && !t.done);
  const later = d.plan.tasks.filter((t) => t.day === null && !t.done);
  const doneN = d.plan.tasks.filter((t) => t.done).length;
  const toggle = async (t: PlanTask) => { await post("/plan/toggle", { task_id: t.id, done: !t.done }); load(); };
  const when = (t: PlanTask) => (t.due ? new Date(t.due + "T00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : "If time allows");

  return (
    <section>
      <PageHeader title="Today" action={<Btn variant="ghost" onClick={() => navigate("targets")}>Change interview</Btn>}>
        {STAGE_TXT(d.target)}
        {d.target.kind !== "general" && r.days_left !== null && (r.days_left >= 0 ? ` · ${r.days_left === 0 ? "interview is today" : `${r.days_left} day${r.days_left === 1 ? "" : "s"} to go`}` : " · date has passed")}
        {d.target.kind !== "general" && r.days_left === null && " · no date set"}
      </PageHeader>

      {!d.has_cv && (
        <div className="sheet mb-4 flex flex-wrap items-center justify-between gap-3 border-l-[3px] border-l-blue p-4">
          <p className="text-sm"><b>Start with your CV.</b> Everything else is built from it.</p><Btn onClick={() => navigate("board")}>Upload your CV</Btn>
        </div>
      )}

      <div className="sheet mb-6 grid gap-6 p-6 md:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <p className="label">Readiness</p>
          <p className={`font-display text-7xl font-extrabold leading-none ${tone}`}><CountUp value={r.score} /><span className="text-2xl text-muted">/100</span></p>
          <p className="mt-2"><span className={`stamp ${tone}`}>{r.label}</span></p>
          {r.cap_note && <p className="mt-3 text-sm text-muted">{r.cap_note}</p>}
        </div>
        <div className="space-y-2.5">
          {r.criteria.map((c) => (
            <button key={c.id} onClick={() => navigate(c.page)} className="group block w-full text-left" title={c.action}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{c.label}</span><span className="label truncate">{c.detail}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
                <motion.div className={`h-full ${c.value >= 0.85 ? "bg-solid" : c.value >= 0.5 ? "bg-shaky" : "bg-pen"}`} initial={{ width: 0 }}
                  animate={{ width: `${Math.max(3, c.value * 100)}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {r.blockers.length > 0 && (
        <div className="mb-6">
          <p className="label mb-3">What is holding you back</p>
          <div className="grid gap-3 md:grid-cols-3">
            {r.blockers.map((b) => (
              <div key={b.id} className="sheet flex flex-col justify-between gap-3 p-4">
                <div><p className="font-display font-bold">{b.label}</p><p className="mt-1 text-sm text-muted">{b.detail}</p></div>
                <Btn variant="ghost" onClick={() => navigate(b.page)}>{b.action}</Btn>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sheet mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm"><b>Practise the real thing.</b> {d.target.kind === "general" ? "A mixed session of core questions and your claims." : "A session built for this interview stage: core questions, your claims and the role gaps, with a matching interviewer."}</p>
        <Btn onClick={() => navigate("practice:stage")}>Start a matched mock</Btn>
      </div>

      {r.due_count > 0 && (
        <div className="sheet mb-6 flex flex-wrap items-center justify-between gap-3 border-l-[3px] border-l-shaky p-4">
          <p className="text-sm"><b>{r.due_count} item{r.due_count > 1 ? "s" : ""} due for review.</b> Weak answers resurface until they hold.</p>
          <Btn onClick={() => navigate("board")}>Review them</Btn>
        </div>
      )}

      <div className="sheet p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div><p className="label">Study plan</p><p className="font-display text-xl font-extrabold">{doneN} done · {today.length} for today</p></div>
          {d.plan.triage && <p className="max-w-sm text-sm text-shaky">Not enough days for everything. Highest-impact tasks are scheduled; {d.plan.later_count} are marked “if time allows”.</p>}
        </div>
        {today.length === 0 && upcoming.length === 0 && later.length === 0 && <p className="text-sm text-muted">Nothing outstanding. Run a mock interview to confirm.</p>}
        <TaskGroup title="Today" tasks={today} toggle={toggle} navigate={navigate} when={when} />
        <TaskGroup title="Coming up" tasks={upcoming} toggle={toggle} navigate={navigate} when={when} />
        <TaskGroup title="If time allows" tasks={later} toggle={toggle} navigate={navigate} when={when} />
        {doneN > 0 && <TaskGroup title="Done" tasks={d.plan.tasks.filter((t) => t.done)} toggle={toggle} navigate={navigate} when={when} muted />}
      </div>
    </section>
  );
}

function TaskGroup({ title, tasks, toggle, navigate, when, muted }: {
  title: string; tasks: PlanTask[]; toggle: (t: PlanTask) => void; navigate: (s: string) => void; when: (t: PlanTask) => string; muted?: boolean;
}) {
  if (!tasks.length) return null;
  return (
    <div className="mb-4 last:mb-0">
      <p className="label mb-2">{title}</p>
      <ul className="divide-y divide-line">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-start gap-3 py-2.5">
            <button aria-label={t.done ? "Mark not done" : "Mark done"} onClick={() => toggle(t)}
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border text-xs ${t.done ? "border-solid bg-solid text-white" : "border-line bg-card hover:border-ink"}`}>{t.done ? "✓" : ""}</button>
            <div className={`min-w-0 flex-1 ${muted ? "text-muted line-through" : ""}`}>
              <p className="text-[15px]">{t.title}</p>
              <p className="label">{when(t)} · {t.minutes} min{t.detail ? ` · ${t.detail}` : ""}</p>
            </div>
            {!t.done && <Btn variant="ghost" className="shrink-0 !py-1.5" onClick={() => navigate(t.page)}>Open</Btn>}
          </li>
        ))}
      </ul>
    </div>
  );
}
