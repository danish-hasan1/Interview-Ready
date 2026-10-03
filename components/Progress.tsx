"use client";
import { motion } from "motion/react";
import { DIM, DIM_ORDER } from "@/lib/dims";
import type { Profile } from "@/lib/types";
import { Radar, Trend } from "./charts";
import { Btn, Empty, PageHeader, RatingBar, itemV, listV } from "./ui";

export default function Progress({ profile, goPractice }: { profile: Profile | null; goPractice: () => void }) {
  const has = !!profile && profile.sessions.length > 0;
  return (
    <section>
      <PageHeader eyebrow="Progress" title="Are you getting better?">Scores are averaged per session. Dimensions show where answers still break.</PageHeader>
      {!has && <Empty title="No interviews scored yet" text="Finish a mock interview and your trend, skill radar and weakest areas show up here." action={<Btn onClick={goPractice}>Start practice</Btn>} />}
      {has && profile && (
        <motion.div variants={listV} initial="hidden" animate="show" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-5">
            <motion.div variants={itemV} className="card p-6 lg:col-span-3">
              <p className="label mb-4">Average score per session</p>
              <Trend points={profile.sessions.map((s) => ({ x: String(s.id), y: s.avg_total }))} />
            </motion.div>
            <motion.div variants={itemV} className="card flex flex-col items-center p-6 lg:col-span-2">
              <p className="label mb-2 self-start">Skill radar</p>
              <Radar data={profile.dims} />
            </motion.div>
          </div>
          <motion.div variants={itemV} className="card p-6">
            <p className="label mb-4">Weakest first, with what to do about it</p>
            <div className="space-y-5">
              {[...DIM_ORDER].sort((a, b) => (profile.dims[a] ?? 0) - (profile.dims[b] ?? 0)).map((d) => (
                <div key={d}>
                  <RatingBar label={DIM[d].label} value={profile.dims[d] ?? 0} />
                  <p className="mt-1.5 pl-[7.75rem] text-sm text-muted">{DIM[d].tip}</p>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div variants={itemV} className="card overflow-hidden">
            <p className="label p-5 pb-3">Sessions</p>
            <table className="w-full text-sm">
              <thead className="label border-b border-line text-left"><tr><th className="px-5 py-2">#</th><th>Date</th><th>Answers</th><th className="pr-5 text-right">Avg</th></tr></thead>
              <tbody>
                {[...profile.sessions].reverse().map((s) => (
                  <tr key={s.id} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-3 font-mono">{s.id}</td>
                    <td>{new Date(s.created).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td>{s.n}</td>
                    <td className={`pr-5 text-right font-display text-lg font-bold ${s.avg_total >= 7 ? "text-pass" : s.avg_total >= 4 ? "text-amber" : "text-pen"}`}>{s.avg_total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </motion.div>
      )}
    </section>
  );
}
