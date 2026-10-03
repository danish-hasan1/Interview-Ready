"use client";
import { motion } from "motion/react";
import { useState } from "react";
import { api } from "@/lib/api";
import Icon from "./Icon";
import { Btn, PageHeader, itemV, listV } from "./ui";

const POINTS = [
  ["Your CV never trains a model", "Scoring runs on built-in rules. No CV or answer text is sent to an AI service."],
  ["Stored in your own database", "Everything lives in the database you configured. Nothing is shared or sold."],
  ["No content in logs or URLs", "CV text and answers are never written to logs or put in links."],
  ["You are in control", "Export everything as JSON or delete it permanently, any time."],
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
      <PageHeader eyebrow="Privacy and data" title="Your career data stays yours." />
      <motion.div variants={listV} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2">
        {POINTS.map(([t, d]) => (
          <motion.div key={t} variants={itemV} className="card flex gap-4 p-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-pass/10 text-pass"><Icon name="lock" /></span>
            <div><h3 className="font-display font-bold">{t}</h3><p className="text-sm text-muted">{d}</p></div>
          </motion.div>
        ))}
      </motion.div>
      <motion.div variants={itemV} initial="hidden" animate="show" className="card mt-6 p-6">
        <p className="label mb-4">Manage your data</p>
        <div className="flex flex-wrap items-center gap-3">
          <Btn variant="ghost" onClick={exportAll}>Export everything (JSON)</Btn>
          <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} /> Delete permanently, I understand</label>
          <Btn disabled={!sure} onClick={del} className="!bg-none !bg-pen !shadow-none">Delete all my data</Btn>
        </div>
        {msg && <p role="status" className="mt-3 text-sm font-medium text-pass">{msg}</p>}
      </motion.div>
    </section>
  );
}
