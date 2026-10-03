"use client";
import { animate, motion, useMotionValue, useTransform, type Variants } from "motion/react";
import { useEffect } from "react";

export const ease = [0.22, 1, 0.36, 1] as const;

/** Parent + child variants for staggered lists. */
export const listV: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } } };
export const itemV: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease } },
};

/** Assessment-sheet rating bar: 10 segments fill in sequence, colour by band. */
export function RatingBar({ value, label }: { value: number; label?: string }) {
  const color = value >= 7 ? "bg-pass" : value >= 4 ? "bg-amber" : "bg-pen";
  return (
    <div className="flex items-center gap-3" role="img" aria-label={`${label ?? "score"} ${value} out of 10`}>
      {label && <span className="label w-32 shrink-0">{label.replace("_", " ")}</span>}
      <div className="flex flex-1 gap-[3px]">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="relative h-2.5 flex-1 overflow-hidden rounded-[2px] bg-line">
            {i < Math.round(value) && (
              <motion.span
                className={`absolute inset-0 origin-left ${color}`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.15 + i * 0.045, duration: 0.3, ease }}
              />
            )}
          </span>
        ))}
      </div>
      <CountUp value={value} className="w-6 text-right font-mono text-sm font-semibold" />
    </div>
  );
}

export function CountUp({ value, className, decimals = 1 }: { value: number; className?: string; decimals?: number }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => (Number.isInteger(value) ? Math.round(v).toString() : v.toFixed(decimals)));
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.8, ease });
    return () => c.stop();
  }, [value, mv]);
  return <motion.span className={className}>{text}</motion.span>;
}

export function PageTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <motion.header className="mb-8" initial="hidden" animate="show" variants={listV}>
      <motion.p variants={itemV} className="label mb-3 inline-block rounded-full bg-accent/10 px-2.5 py-1 !text-accent">{eyebrow}</motion.p>
      <motion.h2 variants={itemV} className="block font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">{title}</motion.h2>
      {children && <motion.p variants={itemV} className="mt-3 max-w-xl text-muted">{children}</motion.p>}
    </motion.header>
  );
}

export function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <motion.div variants={itemV} initial="hidden" animate="show" className="card flex flex-col items-start gap-3 p-8">
      <p className="text-muted">{text}</p>
      {action}
    </motion.div>
  );
}

/** Button with a physical press. */
export function Btn({ variant = "primary", className = "", ...p }: React.ComponentProps<typeof motion.button> & { variant?: "primary" | "ghost" }) {
  return (
    <motion.button
      whileHover={p.disabled ? undefined : { y: -1 }}
      whileTap={p.disabled ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`btn ${variant === "primary" ? "btn-primary" : "btn-ghost"} ${className}`}
      {...p}
    />
  );
}
