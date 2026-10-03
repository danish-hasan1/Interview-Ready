"use client";
import { animate, motion, useMotionValue, useTransform, type Variants } from "motion/react";
import { useEffect } from "react";
import { STAMP, type Defence } from "@/lib/status";

export const ease = [0.22, 1, 0.36, 1] as const;
export const listV: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.03 } } };
export const itemV: Variants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease } } };

export function CountUp({ value, decimals = 0, className }: { value: number; decimals?: number; className?: string }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => v.toFixed(decimals));
  useEffect(() => { const c = animate(mv, value, { duration: 0.7, ease }); return () => c.stop(); }, [value, mv]);
  return <motion.span className={className}>{text}</motion.span>;
}

/** Rubber stamp. Thumps in whenever the defence state changes. */
export function Stamp({ state }: { state: Defence }) {
  return (
    <motion.span key={state} className={`stamp ${STAMP[state].cls}`}
      initial={{ scale: 1.7, opacity: 0, rotate: -9 }} animate={{ scale: 1, opacity: 1, rotate: -2.5 }}
      transition={{ type: "spring", stiffness: 520, damping: 22 }}>{STAMP[state].text}</motion.span>
  );
}

export function RatingBar({ value, label, compact }: { value: number; label?: string; compact?: boolean }) {
  const color = value >= 7 ? "bg-solid" : value >= 4 ? "bg-shaky" : "bg-pen";
  return (
    <div className="flex items-center gap-2.5" role="img" aria-label={`${label ?? "score"} ${value} out of 10`}>
      {label && <span className={`label shrink-0 ${compact ? "w-24" : "w-28"}`}>{label}</span>}
      <div className="flex flex-1 gap-[2px]">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="relative h-2 flex-1 overflow-hidden rounded-[2px] bg-line">
            {i < Math.round(value) && (
              <motion.span className={`absolute inset-0 origin-left ${color}`} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                transition={{ delay: 0.1 + i * 0.04, duration: 0.25, ease }} />
            )}
          </span>
        ))}
      </div>
      <span className="w-7 text-right font-mono text-sm font-semibold">{value}</span>
    </div>
  );
}

export function PageHeader({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{title}</h1>
        {children && <p className="mt-1.5 max-w-2xl text-muted">{children}</p>}
      </div>
      {action}
    </header>
  );
}

export function Btn({ variant = "primary", className = "", ...p }: React.ComponentProps<typeof motion.button> & { variant?: "primary" | "ghost" }) {
  return (
    <motion.button whileTap={p.disabled ? undefined : { scale: 0.97 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`btn btn-${variant} ${className}`} {...p} />
  );
}
