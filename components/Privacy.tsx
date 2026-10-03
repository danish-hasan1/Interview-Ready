"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { Btn, PageHeader } from "./ui";

const POINTS = [
  ["Scoring runs on rules, not an AI service", "Your CV and answers are not sent to any model or third party."],
  ["Stored in your own database", "Everything lives in the database you configured. Nothing is shared or sold."],
  ["No content in logs or links", "CV text and answers are never written to logs or put in URLs."],
  ["You stay in control", "Export everything as JSON or delete it permanently, any time."],
];

export default function Privacy({ onDeleted }: { onDeleted: () => void }) {
  const [sure, setSure] = useState(false);
  const [msg, setMsg] = useState("");

  async function exportAll() {
    const data = await api<unknown>("/export");
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = "interview_ready_export.json"; a.click();
    URL.revokeObjectURL(url);
  }
  async function del() {
    await api("/data", { method: "DELETE" });
    setSure(false); setMsg("All data deleted."); onDeleted();
  }

  return (
    <section>
      <PageHeader title="Your data">CVs and interview answers are sensitive. This is how they are handled.</PageHeader>
      <ul className="sheet divide-y divide-line">
        {POINTS.map(([t, d]) => <li key={t} className="p-4"><p className="font-display font-bold">{t}</p><p className="text-sm text-muted">{d}</p></li>)}
      </ul>
      <div className="sheet mt-5 p-5">
        <p className="label mb-3">Manage your data</p>
        <div className="flex flex-wrap items-center gap-3">
          <Btn variant="ghost" onClick={exportAll}>Export everything (JSON)</Btn>
          <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} /> Delete permanently, I understand</label>
          <Btn disabled={!sure} onClick={del} className="!bg-pen">Delete all my data</Btn>
        </div>
        {msg && <p role="status" className="mt-3 text-sm font-medium text-solid">{msg}</p>}
      </div>
    </section>
  );
}
