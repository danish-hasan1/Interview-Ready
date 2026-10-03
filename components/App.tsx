"use client";
import { useState } from "react";
import type { Analysis } from "@/lib/types";
import Claims from "./Claims";
import Gaps from "./Gaps";
import Inputs from "./Inputs";
import Interview from "./Interview";
import Profile from "./Profile";

const TABS = ["Inputs", "CV claims", "Gaps", "Mock interview", "Profile"] as const;

export default function App() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Inputs");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [notes, setNotes] = useState("");

  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Interview Ready</h1>
      </header>
      <nav className="mb-6 flex flex-wrap gap-2 border-b pb-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded px-3 py-1 text-sm ${tab === t ? "bg-black text-white" : "hover:bg-neutral-100"}`}>{t}</button>
        ))}
      </nav>
      {tab === "Inputs" && <Inputs onDone={(a, n) => { setAnalysis(a); setNotes(n); setTab("CV claims"); }} />}
      {tab === "CV claims" && <Claims analysis={analysis} setAnalysis={setAnalysis} />}
      {tab === "Gaps" && <Gaps analysis={analysis} />}
      {tab === "Mock interview" && <Interview analysis={analysis} notes={notes} />}
      {tab === "Profile" && <Profile onDeleted={() => setAnalysis(null)} />}
    </div>
  );
}
