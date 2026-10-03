"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Profile as P } from "@/lib/types";

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
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Progress</h2>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {p && p.sessions.length === 0 && <p className="text-neutral-500">No sessions yet.</p>}
      {p && p.sessions.length > 0 && (
        <>
          <div className="flex h-32 items-end gap-2">
            {p.sessions.map((s) => (
              <div key={s.id} title={`${s.avg_total}/10`} className="flex flex-1 flex-col items-center">
                <div className="w-full rounded-t bg-black" style={{ height: `${s.avg_total * 10}%` }} />
                <span className="text-xs">{s.avg_total}</span>
              </div>
            ))}
          </div>
          <h3 className="font-medium">Weakest dimensions</h3>
          <ul className="list-disc pl-5">{p.weaknesses.map(([d, v]) => <li key={d}><b>{d}</b>: {v}/10</li>)}</ul>
        </>
      )}
      <hr />
      <h3 className="font-medium">Your data</h3>
      <button onClick={exportAll} className="rounded border px-3 py-1">Export all my data (JSON)</button>
      <div className="space-x-2">
        <label className="text-sm"><input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} /> I understand this deletes everything permanently</label>
        <button disabled={!sure} onClick={del} className="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-40">Delete all my data</button>
      </div>
    </section>
  );
}
