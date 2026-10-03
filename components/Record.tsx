"use client";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DIM, DIM_ORDER } from "@/lib/dims";
import type { DebriefsData, Profile } from "@/lib/types";
import { Sparkline } from "./charts";
import { Btn, CountUp, PageHeader, RatingBar, itemV, listV } from "./ui";

export default function Record({ profile, goPractice }: { profile: Profile | null; goPractice: () => void }) {
  const [deb, setDeb] = useState<DebriefsData | null>(null);
  useEffect(() => { api<DebriefsData>("/debriefs").then(setDeb).catch(() => {}); }, []);
  const has = !!profile && profile.sessions.length > 0;
  if (!has || !profile)
    return (
      <>
        <PageHeader title="Your record" />
        <div className="sheet p-8"><p className="max-w-md text-muted">No scored answers yet. Finish a practice session and your trend per dimension shows up here.</p>
          <Btn className="mt-4" onClick={goPractice}>Start practising</Btn></div>
      </>
    );

  const s = profile.sessions;
  const last = s[s.length - 1], prev = s.length > 1 ? s[s.length - 2] : null;
  const delta = prev ? +(last.avg_total - prev.avg_total).toFixed(1) : null;
  const ranked = [...DIM_ORDER].sort((a, b) => (profile.dims[a] ?? 0) - (profile.dims[b] ?? 0));

  return (
    <section>
      <PageHeader title="Your record">Where your answers still break, and whether practice is moving it.</PageHeader>
      <motion.div variants={listV} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={itemV} className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[["Sessions", s.length, 0, ""], ["Answers scored", profile.answers, 0, ""], ["Latest session", last.avg_total, 1, "/10"]].map(([l, v, d, u]) => (
            <div key={l as string} className="sheet p-4"><p className="label">{l}</p><p className="mt-1 font-display text-3xl font-extrabold"><CountUp value={v as number} decimals={d as number} />{u}</p></div>
          ))}
          <div className="sheet p-4"><p className="label">Change vs previous</p>
            <p className={`mt-1 font-display text-3xl font-extrabold ${delta === null ? "" : delta >= 0 ? "text-solid" : "text-pen"}`}>{delta === null ? "—" : `${delta >= 0 ? "+" : ""}${delta}`}</p></div>
        </motion.div>

        {deb && deb.stats.interviews > 0 && (
          <motion.div variants={itemV} className="sheet flex flex-wrap items-center gap-8 p-5">
            <div><p className="label">Real interviews</p><p className="font-display text-3xl font-extrabold">{deb.stats.interviews}</p></div>
            <div><p className="label">Offers</p><p className="font-display text-3xl font-extrabold text-solid">{deb.stats.offers}</p></div>
            <div><p className="label">Offer rate</p><p className="font-display text-3xl font-extrabold">{deb.stats.decided ? `${Math.round((deb.stats.offers / deb.stats.decided) * 100)}%` : "—"}</p></div>
            <p className="max-w-xs text-sm text-muted">The metric that proves training works: interviews turning into offers.</p>
          </motion.div>
        )}

        <motion.div variants={itemV} className="sheet overflow-hidden">
          <p className="label p-4 pb-2">Dimensions, weakest first</p>
          {ranked.map((d) => {
            const series = s.map((x) => x.dims?.[d]).filter((v): v is number => typeof v === "number");
            const change = series.length > 1 ? +(series[series.length - 1] - series[series.length - 2]).toFixed(1) : null;
            return (
              <div key={d} className="grid items-center gap-x-6 gap-y-1 border-t border-line p-4 md:grid-cols-[minmax(0,1.2fr)_130px_60px]">
                <div><RatingBar label={DIM[d].label} value={profile.dims[d] ?? 0} /><p className="mt-1.5 text-sm text-muted md:pl-[7.25rem]">{DIM[d].tip}</p></div>
                <Sparkline values={series} />
                <span className={`label text-right ${change === null ? "" : change >= 0 ? "!text-solid" : "!text-pen"}`}>{change === null ? "" : `${change >= 0 ? "+" : ""}${change}`}</span>
              </div>
            );
          })}
        </motion.div>

        <motion.div variants={itemV} className="sheet overflow-hidden">
          <p className="label p-4 pb-2">Sessions</p>
          <table className="w-full text-sm">
            <thead className="label border-b border-line text-left"><tr><th className="px-4 py-2">#</th><th>Date</th><th>Answers</th><th className="pr-4 text-right">Average</th></tr></thead>
            <tbody>{[...s].reverse().map((x) => (
              <tr key={x.id} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-2.5 font-mono">{x.id}</td>
                <td>{new Date(x.created).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</td>
                <td>{x.n}</td>
                <td className={`pr-4 text-right font-display text-lg font-bold ${x.avg_total >= 7 ? "text-solid" : x.avg_total >= 4 ? "text-shaky" : "text-pen"}`}>{x.avg_total}</td>
              </tr>))}</tbody>
          </table>
        </motion.div>
      </motion.div>
    </section>
  );
}
