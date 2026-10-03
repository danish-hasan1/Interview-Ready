"use client";
import { motion } from "motion/react";

export function Sparkline({ values, w = 120, h = 32 }: { values: number[]; w?: number; h?: number }) {
  if (values.length === 0) return <span className="label">no data</span>;
  const x = (i: number) => (values.length === 1 ? w / 2 : 3 + (i * (w - 6)) / (values.length - 1));
  const y = (v: number) => h - 3 - (v / 10) * (h - 6);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("");
  const up = values[values.length - 1] >= values[0];
  const color = values.length < 2 ? "#5d6a7a" : up ? "#157a58" : "#cf3a2e";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Trend: ${values.join(", ")}`}>
      {values.length > 1 && <motion.path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />}
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="3" fill={color} />
    </svg>
  );
}
