"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DIM } from "@/lib/dims";
import type { BriefData } from "@/lib/types";
import { Btn, PageHeader, Stamp } from "./ui";

export default function InterviewBrief({ goBoard }: { goBoard: () => void }) {
  const [b, setB] = useState<BriefData | null>(null);
  useEffect(() => { api<BriefData>("/interview-brief").then(setB); }, []);
  if (!b) return null;
  if (!b.has_cv)
    return (<><PageHeader title="Interview brief" /><div className="sheet p-8"><p className="text-muted">Upload your CV and the role to generate a one-page brief.</p><Btn className="mt-4" onClick={goBoard}>Go to the board</Btn></div></>);

  return (
    <section>
      <PageHeader title="Interview brief" action={<div className="no-print flex gap-2"><Btn variant="ghost" onClick={goBoard}>Back to board</Btn><Btn onClick={() => window.print()}>Print or save as PDF</Btn></div>}>
        Read this the night before and again an hour before. Built from your CV, the role and your practice.
      </PageHeader>
      <div className="space-y-5">
        <div className="sheet grid gap-4 p-5 md:grid-cols-3">
          <div><p className="label">Role fit</p><p className="font-display text-3xl font-extrabold">{b.role_fit.percent === null ? "—" : `${b.role_fit.percent}%`}</p><p className="text-sm text-muted">{b.role_fit.total ? `${b.role_fit.covered} of ${b.role_fit.total} requirements evidenced` : "Add a job description to measure fit"}</p></div>
          <div><p className="label">Weakest areas</p><p className="text-sm">{b.focus.weakest.length ? b.focus.weakest.map(([d, v]) => `${DIM[d]?.label ?? d} ${v}/10`).join(" · ") : "No practice data yet"}</p></div>
          <div><p className="label">Due for review</p><p className="font-display text-3xl font-extrabold">{b.focus.due_now}</p></div>
        </div>

        <div className="sheet p-5">
          <p className="label mb-3">Your 60-second pitch</p>
          <ol className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">{b.pitch.structure.map((s, i) => <li key={s}>{i + 1}. {s}</li>)}</ol>
          <p className="rounded-md bg-paper/70 p-3">{b.pitch.draft}</p>
        </div>

        <div className="sheet p-5">
          <p className="label mb-3">Claims to defend</p>
          <ul className="space-y-3">{b.claims_to_defend.map((c) => (
            <li key={c.text} className="flex items-start gap-3"><span className="w-20 shrink-0"><Stamp state={c.state} /></span><div><p>{c.text}</p>{c.numbers.length > 0 && <p className="label">Defend: {c.numbers.join(" · ")} · you {c.ownership.toLowerCase()} this</p>}</div></li>
          ))}</ul>
        </div>

        {b.gaps.length > 0 && (
          <div className="sheet p-5"><p className="label mb-3">Where the role asks for more than your CV shows</p>
            <ul className="space-y-1 text-sm">{b.gaps.map((g) => <li key={g.requirement}><span className={`label mr-2 ${g.status === "missing" ? "!text-pen" : "!text-shaky"}`}>{g.status}</span>{g.requirement}</li>)}</ul></div>
        )}

        <div className="sheet p-5">
          <p className="label mb-3">Questions you are likely to get</p>
          <ul className="space-y-2 text-sm">{b.likely_questions.map((q) => <li key={q.question} className="border-l-2 border-pen/60 pl-3">{q.question}</li>)}</ul>
        </div>

        <div className="sheet p-5">
          <p className="label mb-3">Questions to ask them</p>
          <ul className="space-y-1.5 text-sm">{b.ask_them.map((q) => <li key={q}>– {q}</li>)}</ul>
        </div>
      </div>
    </section>
  );
}
