"use client";
import { useCallback, useEffect, useState } from "react";
import { api, post } from "@/lib/api";
import type { Target, TargetsData } from "@/lib/types";
import { Btn, PageHeader } from "./ui";

const blank = { company: "", role: "", stage: "hiring_manager", interview_date: "", jd_text: "", interviewer_notes: "", research: {} as Record<string, string> };

export default function Targets({ onChanged, navigate }: { onChanged: () => void; navigate: (s: string) => void }) {
  const [d, setD] = useState<TargetsData | null>(null);
  const [editing, setEditing] = useState<Target | "new" | null>(null);
  const load = useCallback(() => api<TargetsData>("/targets").then(setD), []);
  useEffect(() => { load(); }, [load]);
  if (!d) return null;
  if (editing) return <Editor d={d} t={editing === "new" ? null : editing} done={() => { setEditing(null); load(); onChanged(); }} />;

  const act = async (t: Target) => { await post(`/targets/${t.id}/activate`, {}); load(); onChanged(); };
  return (
    <section>
      <PageHeader title="Interviews" action={<Btn onClick={() => setEditing("new")}>Add an interview</Btn>}>
        Each interview has its own role, date, stage and research, and its own readiness. General preparation covers skills that apply to every interview.
      </PageHeader>
      <ul className="space-y-3">
        {d.targets.map((t) => {
          const active = t.id === d.active_id;
          const s = t.readiness?.score ?? 0;
          return (
            <li key={t.id} className={`sheet p-5 ${active ? "border-l-[3px] border-l-blue" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="label">{t.kind === "general" ? "Always on" : d.stages[t.stage]?.label}{active ? " · active" : ""}</p>
                  <h3 className="font-display text-xl font-bold">{t.kind === "general" ? "General preparation" : [t.role || "Interview", t.company].filter(Boolean).join(" · ")}</h3>
                  {t.kind !== "general" && <p className="text-sm text-muted">{t.interview_date ? `${new Date(t.interview_date + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}${t.days_left !== null ? ` · ${t.days_left >= 0 ? `${t.days_left} days to go` : "date passed"}` : ""}` : "No date set"}{t.jd_text ? "" : " · no job description yet"}</p>}
                </div>
                <div className="text-right"><p className="label">Readiness</p><p className="font-display text-3xl font-extrabold">{s}<span className="text-sm text-muted">/100</span></p></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {!active && <Btn onClick={() => act(t)}>Make active</Btn>}
                {active && <Btn onClick={() => navigate("today")}>Open Today</Btn>}
                <Btn variant="ghost" onClick={() => setEditing(t)}>Edit</Btn>
                {t.kind !== "general" && <button className="label underline hover:text-pen" onClick={() => { if (confirm("Delete this interview and its prepared answers?")) api(`/targets/${t.id}`, { method: "DELETE" }).then(() => { load(); onChanged(); }); }}>Delete</button>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Editor({ d, t, done }: { d: TargetsData; t: Target | null; done: () => void }) {
  const [f, setF] = useState(t ? { company: t.company, role: t.role, stage: t.stage, interview_date: t.interview_date, jd_text: t.jd_text, interviewer_notes: t.interviewer_notes, research: t.research || {} } : blank);
  const [err, setErr] = useState("");
  const general = t?.kind === "general";
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  const input = "w-full rounded-md border border-line bg-paper/60 p-3 text-sm outline-none focus:border-blue";

  async function save() {
    setErr("");
    try { await (t ? api(`/targets/${t.id}`, { method: "PUT", body: JSON.stringify(f) }) : post("/targets", f)); done(); }
    catch (e) { setErr((e as Error).message); }
  }

  return (
    <section>
      <button onClick={done} className="label mb-4 hover:text-ink">← Back to interviews</button>
      <PageHeader title={general ? "General preparation" : t ? "Edit interview" : "Add an interview"} />
      <div className="sheet space-y-4 p-5">
        {!general && (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <div><label className="label mb-1 block" htmlFor="co">Company</label><input id="co" className={input} value={f.company} onChange={(e) => set("company", e.target.value)} /></div>
              <div><label className="label mb-1 block" htmlFor="ro">Role</label><input id="ro" className={input} value={f.role} onChange={(e) => set("role", e.target.value)} /></div>
              <div><label className="label mb-1 block" htmlFor="st">Interview stage</label>
                <select id="st" className={input} value={f.stage} onChange={(e) => set("stage", e.target.value)}>
                  {Object.entries(d.stages).filter(([k]) => k !== "general").map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select></div>
              <div><label className="label mb-1 block" htmlFor="dt">Interview date</label><input id="dt" type="date" className={input} value={f.interview_date} onChange={(e) => set("interview_date", e.target.value)} /></div>
            </div>
            <div><label className="label mb-1 block" htmlFor="jd">Job description</label><textarea id="jd" rows={7} className={input} value={f.jd_text} onChange={(e) => set("jd_text", e.target.value)} placeholder="Paste the requirements. Gaps against your CV are measured from this." /></div>
            <div><label className="label mb-1 block" htmlFor="in">What you know about the interviewers</label><textarea id="in" rows={2} className={input} value={f.interviewer_notes} onChange={(e) => set("interviewer_notes", e.target.value)} placeholder="Roles, seniority, style. Words like CEO, finance, technical or tough shape the mock." /></div>
            <div>
              <p className="label mb-1">Company research checklist</p>
              <p className="mb-3 text-sm text-muted">Do this yourself from their site, announcements and the interviewers&apos; public profiles. Nothing here is fetched for you.</p>
              <div className="space-y-3">{d.research_fields.map((r) => (
                <div key={r.key}><label className="label mb-1 block" htmlFor={`r-${r.key}`}>{r.label}</label>
                  <textarea id={`r-${r.key}`} rows={2} className={input} placeholder={r.hint} value={f.research[r.key] ?? ""} onChange={(e) => setF({ ...f, research: { ...f.research, [r.key]: e.target.value } })} /></div>
              ))}</div>
            </div>
          </>
        )}
        {general && <p className="text-sm text-muted">General preparation has no company or date. It covers the core questions, stories and skills you need for any interview. Add a specific interview when you have one.</p>}
        <div className="flex items-center gap-3"><Btn onClick={save}>Save</Btn>{err && <p role="alert" className="text-sm text-pen">{err}</p>}</div>
      </div>
    </section>
  );
}
