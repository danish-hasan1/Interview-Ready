"use client";
import { useCallback, useEffect, useState } from "react";
import { api, post } from "@/lib/api";
import type { Debrief as D, DebriefQ, DebriefsData } from "@/lib/types";
import { Btn, PageHeader } from "./ui";

const OUTCOMES = ["pending", "offer", "rejected", "withdrawn"] as const;
const OUT_STYLE = { pending: "text-muted", offer: "text-solid", rejected: "text-pen", withdrawn: "text-shaky" } as const;

export default function Debrief({ onPractise }: { onPractise: (qs: { question: string; ref: string }[]) => void }) {
  const [d, setD] = useState<DebriefsData | null>(null);
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => api<DebriefsData>("/debriefs").then(setD), []);
  useEffect(() => { load(); }, [load]);
  if (!d) return null;
  const rate = d.stats.decided ? Math.round((d.stats.offers / d.stats.decided) * 100) : null;

  return (
    <section>
      <PageHeader title="Real-interview debrief" action={!adding && <Btn onClick={() => setAdding(true)}>Log an interview</Btn>}>
        Within 24 hours of a real interview, log what you were asked and where you struggled. The hard ones become practice, and outcomes show whether the work pays off.
      </PageHeader>

      <div className="mb-6 grid grid-cols-3 gap-3">
        {[["Interviews", d.stats.interviews], ["Offers", d.stats.offers], ["Offer rate", rate === null ? "—" : `${rate}%`]].map(([l, v]) => (
          <div key={l as string} className="sheet p-4"><p className="label">{l}</p><p className="font-display text-3xl font-extrabold">{v}</p></div>
        ))}
      </div>

      {adding && <Form done={() => { setAdding(false); load(); }} />}

      {d.items.length === 0 && !adding && <p className="sheet p-6 text-muted">No interviews logged yet. After your next real interview, log it here while it is fresh.</p>}
      <ul className="space-y-3">
        {d.items.map((i) => <Item key={i.id} i={i} reload={load} onPractise={onPractise} />)}
      </ul>
    </section>
  );
}

function Form({ done }: { done: () => void }) {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [qs, setQs] = useState<DebriefQ[]>([{ question: "", struggled: false }]);
  const [err, setErr] = useState("");

  async function save() {
    try { await post("/debriefs", { company, role, interview_date: date, notes, questions: qs }); done(); }
    catch (e) { setErr((e as Error).message); }
  }
  const input = "w-full rounded-md border border-line bg-paper/60 p-3 text-sm outline-none focus:border-blue";
  return (
    <div className="sheet mb-6 space-y-4 p-5">
      <div className="grid gap-3 md:grid-cols-3">
        <div><label className="label mb-1 block" htmlFor="co">Company</label><input id="co" className={input} value={company} onChange={(e) => setCompany(e.target.value)} /></div>
        <div><label className="label mb-1 block" htmlFor="ro">Role</label><input id="ro" className={input} value={role} onChange={(e) => setRole(e.target.value)} /></div>
        <div><label className="label mb-1 block" htmlFor="dt">Date</label><input id="dt" type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <div>
        <p className="label mb-2">Questions you were asked</p>
        <div className="space-y-2">
          {qs.map((q, i) => (
            <div key={i} className="flex items-center gap-3">
              <input aria-label={`Question ${i + 1}`} className={input} placeholder="e.g. Walk me through how you would build the P&L case for a new hire"
                value={q.question} onChange={(e) => setQs(qs.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))} />
              <label className="flex shrink-0 items-center gap-1.5 text-sm"><input type="checkbox" checked={q.struggled} onChange={(e) => setQs(qs.map((x, j) => (j === i ? { ...x, struggled: e.target.checked } : x)))} /> Struggled</label>
            </div>
          ))}
        </div>
        <button className="label mt-2 underline hover:text-ink" onClick={() => setQs([...qs, { question: "", struggled: false }])}>+ Add question</button>
      </div>
      <div><label className="label mb-1 block" htmlFor="nt">What happened, how did it feel</label><textarea id="nt" rows={3} className={input} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <div className="flex items-center gap-3"><Btn onClick={save}>Save debrief</Btn>{err && <p role="alert" className="text-sm text-pen">{err}</p>}</div>
    </div>
  );
}

function Item({ i, reload, onPractise }: { i: D; reload: () => void; onPractise: (qs: { question: string; ref: string }[]) => void }) {
  const hard = i.questions.filter((q) => q.struggled);
  const setOutcome = (outcome: string) => post(`/debriefs/${i.id}/outcome`, { outcome, notes: i.notes }).then(reload);
  return (
    <li className="sheet p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="font-display text-lg font-bold">{i.company || "Interview"}{i.role ? ` · ${i.role}` : ""}</h3>
          <p className="label">{i.interview_date ?? new Date(i.created).toLocaleDateString()}</p></div>
        <select aria-label="Outcome" value={i.outcome} onChange={(e) => setOutcome(e.target.value)} className={`rounded-md border border-line bg-card px-2 py-1 text-sm font-semibold ${OUT_STYLE[i.outcome]}`}>
          {OUTCOMES.map((o) => <option key={o}>{o}</option>)}
        </select>
      </div>
      {i.questions.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">{i.questions.map((q, k) => <li key={k} className={q.struggled ? "border-l-2 border-pen/60 pl-3" : "pl-3 text-muted"}>{q.question}{q.struggled && <span className="label ml-2 !text-pen">struggled</span>}</li>)}</ul>
      )}
      {i.notes && <p className="mt-3 text-sm text-muted">{i.notes}</p>}
      <div className="mt-3 flex gap-3">
        {hard.length > 0 && <Btn onClick={() => onPractise(hard.map((q) => ({ question: q.question, ref: q.question })))}>Practise the {hard.length} you struggled with</Btn>}
        <button className="label underline hover:text-pen" onClick={() => api(`/debriefs/${i.id}`, { method: "DELETE" }).then(reload)}>Delete</button>
      </div>
    </li>
  );
}
