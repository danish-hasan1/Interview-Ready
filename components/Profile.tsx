"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Profile as P } from "@/lib/types";
import { motion } from "motion/react";
import { Btn, CountUp, Empty, PageTitle, RatingBar, ease } from "./ui";

export default function Profile({ onDeleted }: { onDeleted: () => void }) {
  const [p, setP] = useState<P | null>(null);
  const [sure, setSure] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { api<P>("/profile").then(setP).catch((e) => setErr(e.message)); }, []);

  async function exportAll() {
    const data = await api<unknown>("/export");
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = "interview_ready_export.json"; a.click();
    URL.revokeObjectURL(url);
  }

  async function del() {
    await api("/data", { method: "DELETE" });
    setP({ sessions: [], weaknesses: [] }); setSure(false); onDeleted();
  }

  return (
    <section>
      <PageTitle eyebrow="Step 5 · Profile" title="Are you getting better?" />
      {err && <p role="alert" className="mb-4 text-sm font-medium text-pen">{err}</p>}
      {p && p.sessions.length === 0 && <Empty text="No interviews scored yet. Finish a mock interview and your progress shows up here." />}
      {p && p.sessions.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="card card-accent p-5">
            <p className="label mb-4">Average score per session</p>
            <div className="flex h-40 items-end gap-2">
              {p.sessions.map((s) => (
                <div key={s.id} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`Session ${s.id}: ${s.avg_total}/10`}>
                  <CountUp value={s.avg_total} className="font-mono text-xs" />
                  <motion.div className="w-full origin-bottom rounded-t bg-gradient-to-t from-teal to-cobalt" style={{ height: `${s.avg_total * 10}%` }}
                    initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.1 + s.id * 0.02, duration: 0.6, ease }} />
                </div>
              ))}
            </div>
          </div>
          <div className="card card-accent p-5">
            <p className="label mb-4">Weakest dimensions — work on these first</p>
            <div className="space-y-3">{p.weaknesses.map(([d, v]) => <RatingBar key={d} label={d} value={v} />)}</div>
          </div>
        </div>
      )}

      <div className="card mt-8 p-5">
        <p className="label mb-3">Your data</p>
        <div className="flex flex-wrap items-center gap-3">
          <Btn variant="ghost" onClick={exportAll}>Export everything (JSON)</Btn>
          <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} /> Delete permanently, I understand</label>
          <Btn disabled={!sure} onClick={del} className="!bg-pen">Delete all my data</Btn>
        </div>
      </div>
    </section>
  );
}
