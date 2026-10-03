"use client";
import { motion, type Variants } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CountUp } from "./charts";
import { PUSHBACKS } from "@/lib/dims";

export const ease = [0.22, 1, 0.36, 1] as const;
export { CountUp };

export const listV: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } };
export const itemV: Variants = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease } } };

export function RatingBar({ value, label }: { value: number; label?: string }) {
  const color = value >= 7 ? "bg-pass" : value >= 4 ? "bg-amber" : "bg-pen";
  return (
    <div className="flex items-center gap-3" role="img" aria-label={`${label ?? "score"} ${value} out of 10`}>
      {label && <span className="label w-28 shrink-0">{label}</span>}
      <div className="flex flex-1 gap-[3px]">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="relative h-2.5 flex-1 overflow-hidden rounded-[3px] bg-line">
            {i < Math.round(value) && (
              <motion.span className={`absolute inset-0 origin-left ${color}`} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                transition={{ delay: 0.15 + i * 0.045, duration: 0.3, ease }} />
            )}
          </span>
        ))}
      </div>
      <CountUp value={value} decimals={Number.isInteger(value) ? 0 : 1} className="w-7 text-right font-mono text-sm font-semibold" />
    </div>
  );
}

export function PageHeader({ eyebrow, title, children, action }: { eyebrow: string; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <motion.header className="mb-8 flex flex-wrap items-end justify-between gap-4" initial="hidden" animate="show" variants={listV}>
      <div>
        <motion.p variants={itemV} className="label mb-3 inline-block rounded-full bg-brand/10 px-2.5 py-1 !text-brand">{eyebrow}</motion.p>
        <motion.h1 variants={itemV} className="font-display text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-4xl">{title}</motion.h1>
        {children && <motion.p variants={itemV} className="mt-2 max-w-xl text-muted">{children}</motion.p>}
      </div>
      {action && <motion.div variants={itemV}>{action}</motion.div>}
    </motion.header>
  );
}

export function Empty({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <motion.div variants={itemV} initial="hidden" animate="show" className="card flex flex-col items-start gap-3 p-8">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <p className="max-w-md text-muted">{text}</p>
      {action}
    </motion.div>
  );
}

export function Btn({ variant = "primary", className = "", ...p }: React.ComponentProps<typeof motion.button> & { variant?: "primary" | "ghost" | "light" }) {
  return (
    <motion.button
      whileHover={p.disabled ? undefined : { y: -2 }}
      whileTap={p.disabled ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`btn btn-${variant} ${className}`}
      {...p}
    />
  );
}

/** Slow-drifting colour blobs for dark hero panels. */
export function Aurora() {
  const blob = (cls: string, x: number[], y: number[], d: number) => (
    <motion.div aria-hidden className={`absolute rounded-full blur-3xl ${cls}`} animate={{ x, y }} transition={{ duration: d, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }} />
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {blob("-left-10 -top-16 h-72 w-72 bg-brand/60", [0, 60, -20], [0, 40, 10], 11)}
      {blob("right-0 top-10 h-80 w-80 bg-pink/35", [0, -50, 20], [0, 30, -10], 13)}
      {blob("bottom-[-5rem] left-1/3 h-72 w-72 bg-cyan/30", [0, 40, -30], [0, -30, 10], 15)}
      <div className="grid-bg absolute inset-0" />
    </div>
  );
}

/** Scrolling interviewer pushback lines. */
export function Marquee() {
  const row = [...PUSHBACKS, ...PUSHBACKS];
  return (
    <div className="relative overflow-hidden" aria-label="Examples of interviewer pushback">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-paper to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-paper to-transparent" />
      <div className="marquee flex w-max gap-3">
        {row.map((t, i) => (
          <span key={i} className="whitespace-nowrap rounded-full border border-pen/25 bg-pen/[.06] px-4 py-1.5 font-mono text-xs text-pen">“{t}”</span>
        ))}
      </div>
    </div>
  );
}

/** Typewriter reveal. Shows full text at once for reduced motion. */
export function TypeText({ text, onDone }: { text: string; onDone?: () => void }) {
  const [n, setN] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setN(text.length); return; }
    setN(0);
    const id = setInterval(() => setN((v) => Math.min(text.length, v + 2)), 16);
    return () => clearInterval(id);
  }, [text]);
  useEffect(() => { if (text && n >= text.length) done.current?.(); }, [n, text]);
  return <>{text.slice(0, n)}<span className={n < text.length ? "ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-current" : "hidden"} /></>;
}

export function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex h-6 items-center gap-[3px]" aria-hidden>
      {[0.5, 1, 0.7, 0.9, 0.55, 0.8, 0.4].map((h, i) => (
        <motion.span key={i} className="w-[3px] rounded-full bg-white" style={{ height: 24 }}
          animate={active ? { scaleY: [0.2, h, 0.25, h * 0.8, 0.2] } : { scaleY: 0.2 }}
          transition={active ? { duration: 0.9 + i * 0.07, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }} />
      ))}
    </div>
  );
}
