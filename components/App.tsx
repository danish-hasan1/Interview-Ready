"use client";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Analysis } from "@/lib/types";
import Claims from "./Claims";
import Gaps from "./Gaps";
import Inputs from "./Inputs";
import Interview from "./Interview";
import Login from "./Login";
import Profile from "./Profile";

const TABS = ["Inputs", "CV claims", "Gaps", "Mock interview", "Profile"] as const;

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Inputs");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!ready) return null;
  if (supabase && !session) return <Login />;

  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Interview Ready</h1>
        {supabase && <button className="text-sm underline" onClick={() => supabase!.auth.signOut()}>Sign out</button>}
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
