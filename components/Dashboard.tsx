"use client";
import { motion } from "motion/react";
import { DIM } from "@/lib/dims";
import type { Analysis, Profile } from "@/lib/types";
import { Radar, Ring, Trend } from "./charts";
import Icon from "./Icon";
import { Aurora, Btn, CountUp, Marquee, RatingBar, itemV, listV } from "./ui";

type Props = {
  profile: Profile | null;
  analysis: Analysis | null;
  greeting: string;
  go: (page: "prepare" | "practice" | "progress") => void;
};

const FEATURES = [
  { icon: "target", color: "from-brand to-brand2", title: "Defend every CV claim", text: "Every number and title on your CV becomes a hard follow-up: how measured, what baseline, what did you personally do." },
  { icon: "bolt", color: "from-pink to-amber", title: "Pressure that feels real", text: "The interviewer interrupts, asks for numbers and calls out vague answers, the way a real panel does." },
  { icon: "progress", color: "from-cyan to-brand", title: "Fix what actually breaks", text: "Five scored dimensions and concrete fixes per answer, then proof you improved over sessions." },
];

export default function Dashboard({ profile, analysis, greeting, go }: Props) {
  const hasSessions = !!profile && profile.sessions.length > 0;
  if (!hasSessions) return <Welcome analysis={analysis} go={go} />;

  const p = profile!;
  const avg = p.sessions.reduce((s, x) => s + x.avg_total, 0) / p.sessions.length;
  const readiness = Math.round(avg * 10);
  const last = p.sessions[p.sessions.length - 1];
  const prev = p.sessions.length > 1 ? p.sessions[p.sessions.length - 2] : null;
  const delta = prev ? +(last.avg_total - prev.avg_total).toFixed(1) : null;
  const weakest = p.weaknesses[0];

  return (
    <motion.div variants={listV} initial="hidden" animate="show" className="space-y-6">
      <motion.section variants={itemV} className="relative overflow-hidden rounded-[28px] bg-side p-8 text-white sm:p-10">
        <Aurora />
        <div className="relative flex flex-col items-center gap-8 md:flex-row md:justify-between">
          <div className="max-w-lg text-center md:text-left">
            <p className="label !text-white/60">{greeting}</p>
            <h1 className="mt-3 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              You are {readiness}% interview ready.
            </h1>
            <p className="mt-3 text-white/70">
              {weakest ? <>Weakest area right now: <b className="text-white">{DIM[weakest[0]]?.label ?? weakest[0]}</b> at {weakest[1]}/10. One focused session moves it.</> : "Keep practising."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3 md:justify-start">
              <Btn variant="light" onClick={() => go(analysis ? "practice" : "prepare")}>{analysis ? "Start practice" : "Upload a CV"} <Icon name="arrow" className="h-4 w-4" /></Btn>
              <Btn variant="ghost" className="!border-white/25 !bg-white/10 !text-white hover:!border-white" onClick={() => go("progress")}>See progress</Btn>
            </div>
          </div>
          <Ring value={readiness} size={200} label="readiness" dark />
        </div>
      </motion.section>

      <motion.div variants={listV} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Sessions", v: p.sessions.length, d: 0, suffix: "" },
          { label: "Answers scored", v: p.answers, d: 0, suffix: "" },
          { label: "Latest session", v: last.avg_total, d: 1, suffix: "/10" },
          { label: "Change vs previous", v: delta ?? 0, d: 1, suffix: delta === null ? "" : delta >= 0 ? " ▲" : " ▼", tone: delta === null ? "" : delta >= 0 ? "text-pass" : "text-pen" },
        ].map((s) => (
          <motion.div key={s.label} variants={itemV} whileHover={{ y: -3 }} className="card p-5">
            <p className="label">{s.label}</p>
            <p className={`mt-2 font-display text-4xl font-extrabold ${s.tone ?? ""}`}>
              {s.label === "Change vs previous" && delta === null ? "—" : <><CountUp value={s.v} decimals={s.d} />{s.suffix}</>}
            </p>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-5">
        <motion.div variants={itemV} className="card p-6 lg:col-span-3">
          <p className="label mb-4">Score by session</p>
          <Trend points={p.sessions.map((s) => ({ x: String(s.id), y: s.avg_total }))} />
        </motion.div>
        <motion.div variants={itemV} className="card flex flex-col items-center p-6 lg:col-span-2">
          <p className="label mb-2 self-start">Skill profile</p>
          <Radar data={p.dims} />
        </motion.div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={itemV} className="card p-6">
          <p className="label mb-4">Dimension averages</p>
          <div className="space-y-3">{Object.entries(p.dims ?? {}).map(([d, v]) => <RatingBar key={d} label={DIM[d]?.label ?? d} value={v} />)}</div>
        </motion.div>
        {weakest && (
          <motion.div variants={itemV} className="relative overflow-hidden rounded-[18px] bg-gradient-to-br from-brand to-brand2 p-6 text-white">
            <p className="label !text-white/70">Next best action</p>
            <h3 className="mt-2 font-display text-2xl font-extrabold">Work on {DIM[weakest[0]]?.label ?? weakest[0]}</h3>
            <p className="mt-2 text-white/80">{DIM[weakest[0]]?.tip}</p>
            <Btn variant="light" className="mt-5" onClick={() => go(analysis ? "practice" : "prepare")}>Practise it now <Icon name="arrow" className="h-4 w-4" /></Btn>
          </motion.div>
        )}
      </div>

      <motion.div variants={itemV}><p className="label mb-3">Be ready for these</p><Marquee /></motion.div>
    </motion.div>
  );
}

function Welcome({ analysis, go }: { analysis: Analysis | null; go: Props["go"] }) {
  return (
    <motion.div variants={listV} initial="hidden" animate="show" className="space-y-10">
      <motion.section variants={itemV} className="relative overflow-hidden rounded-[28px] bg-side p-8 text-white sm:p-12">
        <Aurora />
        <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div>
            <span className="label inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 !text-white/80"><Icon name="spark" className="h-3.5 w-3.5" /> Built from your real CV</span>
            <h1 className="mt-5 font-display text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
              Stop rehearsing generic answers.
            </h1>
            <p className="mt-4 max-w-lg text-lg text-white/70">
              Interview Ready reads your CV and the job description, finds the claims you cannot yet defend, then trains you under pressure until you can.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Btn variant="light" onClick={() => go(analysis ? "practice" : "prepare")}>{analysis ? "Start practice" : "Upload your CV"} <Icon name="arrow" className="h-4 w-4" /></Btn>
              <span className="label inline-flex items-center gap-2 !text-white/60"><Icon name="lock" className="h-4 w-4" /> Private. No external AI.</span>
            </div>
          </div>

          <motion.div className="glass relative p-5" initial={{ opacity: 0, y: 30, rotate: 2 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
              <p className="label !text-white/60">Interviewer</p>
              <div className="mt-2 rounded-xl border-l-[3px] border-pen bg-pen/15 p-3 text-sm">You say “reduced time to hire from 62 to 38 days”. What was the baseline, and what did <b>you</b> do?</div>
              <p className="label mt-4 !text-white/60">Assessment</p>
              <div className="mt-2 space-y-2 [&_.label]:!text-white/60 [&_span.bg-line]:!bg-white/15 [&_span:last-child]:!text-white">
                <RatingBar label="Structure" value={7} />
                <RatingBar label="Specificity" value={9} />
                <RatingBar label="Impact" value={5} />
              </div>
              <div className="mt-4 rounded-xl bg-white/10 p-3 text-sm"><span className="label mr-2 !text-pen">Fix</span>Say the revenue or cost impact in numbers.</div>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      <motion.div variants={listV} className="grid gap-5 md:grid-cols-3">
        {FEATURES.map((f) => (
          <motion.div key={f.title} variants={itemV} whileHover={{ y: -4 }} className="card p-6">
            <span className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${f.color} text-white shadow-lg`}><Icon name={f.icon} /></span>
            <h3 className="mt-4 font-display text-lg font-bold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted">{f.text}</p>
          </motion.div>
        ))}
      </motion.div>

      <motion.section variants={itemV} className="card p-8">
        <p className="label mb-5">How it works</p>
        <ol className="grid gap-6 md:grid-cols-4">
          {[["Upload", "Your CV and the job description."], ["Review", "See every claim and what the role is missing."], ["Practise", "Answer under pressure in a mock interview."], ["Improve", "Fix weak dimensions and watch the score climb."]].map(([t, d], i) => (
            <li key={t} className="relative">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand/10 font-mono text-sm font-semibold text-brand">{i + 1}</span>
              <h4 className="mt-3 font-display font-bold">{t}</h4>
              <p className="text-sm text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </motion.section>

      <motion.div variants={itemV}><Marquee /></motion.div>
    </motion.div>
  );
}
