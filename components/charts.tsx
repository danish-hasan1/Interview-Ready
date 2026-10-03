"use client";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect, useId } from "react";
import { DIM, DIM_ORDER } from "@/lib/dims";

const ease = [0.22, 1, 0.36, 1] as const;

export function CountUp({ value, className, decimals = 0 }: { value: number; className?: string; decimals?: number }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => v.toFixed(decimals));
  useEffect(() => {
    const c = animate(mv, value, { duration: 1, ease });
    return () => c.stop();
  }, [value, mv]);
  return <motion.span className={className}>{text}</motion.span>;
}

/** Readiness gauge: gradient arc draws in, centre number counts up. value 0-100. */
export function Ring({ value, size = 180, stroke = 14, label, dark = false }: { value: number; size?: number; stroke?: number; label?: string; dark?: boolean }) {
  const id = useId();
  const r = (size - stroke) / 2;
  const c = size / 2;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${label ?? "Score"} ${Math.round(value)} percent`}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#19c3e6" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#ff5c9d" />
          </linearGradient>
        </defs>
        <circle cx={c} cy={c} r={r} fill="none" stroke={dark ? "rgba(255,255,255,.12)" : "#e4e7f0"} strokeWidth={stroke} />
        <motion.circle cx={c} cy={c} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: Math.max(0.001, value / 100) }} transition={{ duration: 1.4, ease }} />
      </svg>
      <div className="absolute text-center">
        <div className={`font-display font-extrabold leading-none ${dark ? "text-white" : "text-ink"}`} style={{ fontSize: size * 0.28 }}>
          <CountUp value={value} />
          <span className="text-[0.45em] opacity-60">%</span>
        </div>
        {label && <div className={`label mt-1 ${dark ? "!text-white/60" : ""}`}>{label}</div>}
      </div>
    </div>
  );
}

/** Five-axis skill radar. data: dimension -> 0-10. */
export function Radar({ data, size = 280 }: { data: Record<string, number>; size?: number }) {
  const id = useId();
  const n = DIM_ORDER.length;
  const c = size / 2;
  const R = size / 2 - 46;
  const pt = (i: number, f: number) => {
    const a = (-90 + (360 / n) * i) * (Math.PI / 180);
    return [c + Math.cos(a) * R * f, c + Math.sin(a) * R * f] as const;
  };
  const poly = (f: (i: number) => number) => DIM_ORDER.map((_, i) => pt(i, f(i)).join(",")).join(" ");
  const path = (f: (i: number) => number) => "M" + DIM_ORDER.map((_, i) => pt(i, f(i)).join(",")).join("L") + "Z";
  const target = (i: number) => Math.max(0.04, ((data ?? {})[DIM_ORDER[i]] ?? 0) / 10);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[320px]" role="img" aria-label="Skill radar">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5b4bff" stopOpacity=".55" />
          <stop offset="100%" stopColor="#ff5c9d" stopOpacity=".45" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={poly(() => f)} fill="none" stroke="#e4e7f0" strokeWidth="1" />)}
      {DIM_ORDER.map((_, i) => <line key={i} x1={c} y1={c} x2={pt(i, 1)[0]} y2={pt(i, 1)[1]} stroke="#e4e7f0" />)}
      <motion.path fill={`url(#${id})`} stroke="#5b4bff" strokeWidth="2" strokeLinejoin="round"
        initial={{ d: path(() => 0.04) }} animate={{ d: path(target) }} transition={{ duration: 1, ease }} />
      {DIM_ORDER.map((d, i) => {
        const [x, y] = pt(i, 1.2);
        const [dx, dy] = pt(i, target(i));
        return (
          <g key={d}>
            <motion.circle r="4" fill="#5b4bff" stroke="#fff" strokeWidth="2" initial={{ cx: c, cy: c }} animate={{ cx: dx, cy: dy }} transition={{ duration: 1, ease }} />
            <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-[#667085]" style={{ fontSize: 11, fontFamily: "var(--font-jetbrains)" }}>{DIM[d].short}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Score-over-sessions line with area fill. */
export function Trend({ points }: { points: { x: string; y: number }[] }) {
  const id = useId();
  const W = 520, H = 190, P = 28;
  if (points.length === 0) return null;
  const xs = (i: number) => (points.length === 1 ? W / 2 : P + (i * (W - P * 2)) / (points.length - 1));
  const ys = (v: number) => H - P - (v / 10) * (H - P * 2);
  const line = points.map((p, i) => `${i ? "L" : "M"}${xs(i)},${ys(p.y)}`).join("");
  const area = `${line}L${xs(points.length - 1)},${H - P}L${xs(0)},${H - P}Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Score trend">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5b4bff" stopOpacity=".28" />
          <stop offset="100%" stopColor="#5b4bff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 5, 10].map((v) => (
        <g key={v}>
          <line x1={P} x2={W - P} y1={ys(v)} y2={ys(v)} stroke="#e4e7f0" strokeDasharray="3 5" />
          <text x={4} y={ys(v) + 4} className="fill-[#667085]" style={{ fontSize: 10, fontFamily: "var(--font-jetbrains)" }}>{v}</text>
        </g>
      ))}
      {points.length > 1 && <motion.path d={area} fill={`url(#${id})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.6 }} />}
      {points.length > 1 && <motion.path d={line} fill="none" stroke="#5b4bff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease }} />}
      {points.map((p, i) => (
        <motion.circle key={i} cx={xs(i)} cy={ys(p.y)} r="5" fill="#fff" stroke="#5b4bff" strokeWidth="3"
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 + i * 0.12, type: "spring", stiffness: 400, damping: 14 }} />
      ))}
    </svg>
  );
}
