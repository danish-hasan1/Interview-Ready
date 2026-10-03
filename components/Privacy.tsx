"use client";
import { useCallback, useEffect, useState } from "react";
import { api, post } from "@/lib/api";
import { useAi } from "@/lib/useAi";
import type { LibraryItem } from "@/lib/types";
import AiConsent from "./AiConsent";
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
  const [items, setItems] = useState<LibraryItem[]>([]);
  const { ai, refresh } = useAi();
  const [setup, setSetup] = useState(false);
  const load = useCallback(() => api<{ items: LibraryItem[] }>("/library").then((r) => setItems(r.items)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

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
      <div className="mt-5">
        {ai && setup ? <AiConsent ai={ai} onDone={() => { setSetup(false); refresh(); }} onCancel={() => setSetup(false)} /> : (
          <div className="sheet p-5">
            <p className="label mb-1">AI assistance</p>
            {!ai?.configured ? <p className="text-sm text-muted">Off. No key is configured, so nothing is sent anywhere.</p> : ai.enabled && ai.consent ? (
              <div className="space-y-3 text-sm">
                <p>On. Redacted text goes to {ai.provider} ({ai.model}). Used today: <b>{ai.used_today}</b>{ai.cap ? ` of ${ai.cap}` : " (no daily cap)"}.</p>
                <p className="text-muted">Features: {Object.entries(ai.features).filter(([, v]) => v).map(([k]) => k.replace("_", " ")).join(", ") || "none"}</p>
                <div className="flex gap-2"><Btn variant="ghost" onClick={() => setSetup(true)}>Change features</Btn><Btn variant="ghost" onClick={() => post("/ai/settings", { enabled: false, consent: true }).then(refresh)}>Turn AI off</Btn></div>
              </div>
            ) : (<div className="space-y-3"><p className="text-sm text-muted">A key is configured but AI is off. Nothing is sent until you opt in.</p><Btn onClick={() => setSetup(true)}>Set up AI</Btn></div>)}
          </div>
        )}
      </div>
      <div className="sheet mt-5 p-5">
        <p className="label mb-1">Coach library</p>
        <p className="mb-3 text-sm text-muted">Notes saved from the local model. Approve the ones worth keeping: approved notes are served instantly next time the same question comes up, so the model is needed less.</p>
        {items.length === 0 ? <p className="text-sm text-muted">Nothing saved yet. Notes appear here when a local model is enabled and you save one from Practice.</p> : (
          <ul className="divide-y divide-line">
            {items.map((i) => (
              <li key={i.id} className="py-3 text-sm">
                <p className="label">{i.question}</p><p className="mt-1">{i.text}</p>
                <div className="mt-2 flex gap-3">
                  <button className="label underline hover:text-ink" onClick={() => post(`/library/${i.id}/approve`, { approved: !i.approved }).then(load)}>{i.approved ? "Approved · click to unapprove" : "Approve"}</button>
                  <button className="label underline hover:text-pen" onClick={() => api(`/library/${i.id}`, { method: "DELETE" }).then(load)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
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
