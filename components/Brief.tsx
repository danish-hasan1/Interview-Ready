"use client";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { api, post } from "@/lib/api";
import { defence, type Defence } from "@/lib/status";
import { OWNERSHIP, type Analysis, type Claim, type Profile } from "@/lib/types";
import { Btn, PageHeader, Stamp, itemV, listV } from "./ui";

export type DrillRequest = { focus?: string; weakest?: boolean };

const TYPE = { metric: "Number", action: "Action", title: "Title" } as const;
type Row = { ref: string; kind: "claim" | "gap"; label: string; claim?: Claim; index?: number; gapStatus?: string; coverage?: number; evidence?: string[] };

export default function Brief({ analysis, setAnalysis, notes, setNotes, profile, onDrill, goTo }: {
  analysis: Analysis | null; setAnalysis: (a: Analysis) => void; notes: string; setNotes: (n: string) => void;
  profile: Profile | null; onDrill: (r: DrillRequest) => void; goTo: (p: "review" | "train") => void;
}) {
  const [replacing, setReplacing] = useState(false);
  if (!analysis || replacing)
    return <Upload notes={notes} setNotes={setNotes} onCancel={analysis ? () => setReplacing(false) : undefined}
      onDone={(a) => { setAnalysis(a); setReplacing(false); }} />;
  return <Board analysis={analysis} setAnalysis={setAnalysis} profile={profile} onDrill={onDrill} goTo={goTo} onReplace={() => setReplacing(true)} />;
}

function Upload({ notes, setNotes, onDone, onCancel }: { notes: string; setNotes: (n: string) => void; onDone: (a: Analysis) => void; onCancel?: () => void }) {
  const [cv, setCv] = useState<File | null>(null);
  const [jd, setJd] = useState("");
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);

  async function run() {
    setBusy(true); setErr("");
    try {
      const fd = new FormData();
      if (cv) fd.append("cv", cv);
      fd.append("jd_text", jd);
      if (jdFile) fd.append("jd", jdFile);
      onDone(await api<Analysis>("/analyze", { method: "POST", body: fd }));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <section>
      <PageHeader title="Brief the coach.">
        Give it your CV and the role. It lists every claim you will be pressed on and every requirement your CV does not yet prove.
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <label onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); setCv(e.dataTransfer.files?.[0] ?? null); }}
          className={`sheet flex min-h-64 cursor-pointer flex-col justify-between p-5 transition-colors ${drag ? "border-blue bg-blue/5" : cv ? "border-solid" : "hover:border-ink"}`}>
          <input className="sr-only" type="file" accept=".pdf,.docx,.txt,.md" onChange={(e) => setCv(e.target.files?.[0] ?? null)} />
          <p className="label">1 · Your CV</p>
          <div>
            {cv ? (<><p className="font-display text-xl font-bold">{cv.name}</p><p className="label mt-1 !text-solid">{(cv.size / 1024).toFixed(0)} KB ready · click to replace</p></>)
              : (<><p className="font-display text-xl font-bold">Drop a file or click to choose</p><p className="label mt-1">PDF · DOCX · TXT, up to 4 MB</p></>)}
          </div>
        </label>
        <div className="sheet flex flex-col p-5">
          <label htmlFor="jd" className="label mb-2">2 · The role (paste the job description)</label>
          <textarea id="jd" className="min-h-48 flex-1 resize-y rounded-md border border-line bg-paper/60 p-3 text-sm outline-none focus:border-blue"
            placeholder="Paste requirements here…" value={jd} onChange={(e) => setJd(e.target.value)} />
          <label className="label mt-2 flex cursor-pointer items-center gap-2 hover:text-ink">
            <input className="sr-only" type="file" accept=".pdf,.docx,.txt,.md" onChange={(e) => setJdFile(e.target.files?.[0] ?? null)} />
            <span className="underline">{jdFile ? `Using file: ${jdFile.name}` : "or upload the job description (PDF, DOCX, TXT)"}</span>
          </label>
        </div>
      </div>
      <div className="sheet mt-4 p-5">
        <label htmlFor="notes" className="label mb-2 block">3 · Who is interviewing? (optional)</label>
        <textarea id="notes" className="h-16 w-full resize-y rounded-md border border-line bg-paper/60 p-3 text-sm outline-none focus:border-blue"
          placeholder="Role, seniority, anything you know about them" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="mt-5 flex items-center gap-3">
        <Btn disabled={busy} onClick={run}>{busy ? "Reading…" : "Build my defence board"}</Btn>
        {onCancel && <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>}
        {err && <p role="alert" className="text-sm font-medium text-pen">{err}</p>}
      </div>
    </section>
  );
}

function Board({ analysis, setAnalysis, profile, onDrill, goTo, onReplace }: {
  analysis: Analysis; setAnalysis: (a: Analysis) => void; profile: Profile | null; onDrill: (r: DrillRequest) => void; goTo: (p: "review" | "train") => void; onReplace: () => void;
}) {
  const [filter, setFilter] = useState<"all" | Defence>("all");
  const [open, setOpen] = useState<string | null>(null);

  const rows: Row[] = useMemo(() => [
    ...analysis.claims.map((c, i) => ({ ref: c.text, kind: "claim" as const, label: c.text, claim: c, index: i })),
    ...analysis.gaps.filter((g) => g.status !== "evidenced").map((g) => ({
      ref: g.requirement, kind: "gap" as const, label: g.requirement, gapStatus: g.status, coverage: g.coverage, evidence: g.evidence })),
  ], [analysis]);

  const stats = rows.map((r) => ({ r, d: defence(r.ref, profile?.refs) }));
  const count = (s: Defence) => stats.filter((x) => x.d.state === s).length;
  const total = rows.length || 1;
  const visible = stats.filter((x) => filter === "all" || x.d.state === filter);
  const evidenced = analysis.gaps.filter((g) => g.status === "evidenced");

  async function setOwnership(i: number, ownership: Claim["ownership"]) {
    const claims = analysis.claims.map((c, j) => (j === i ? { ...c, ownership } : c));
    const res = await post<{ claims: Claim[] }>("/claims/questions", { claims });
    setAnalysis({ ...analysis, claims: res.claims });
    post("/claims/ownership", { text: claims[i].text, ownership }).catch(() => {});
  }

  return (
    <section>
      <PageHeader title="Defence board"
        action={<div className="flex gap-2"><Btn variant="ghost" onClick={onReplace}>Replace CV or role</Btn><Btn onClick={() => onDrill({ weakest: true })}>Practise weakest first</Btn></div>}>
        Every claim and unproven requirement, and how well you have defended it so far. {analysis.cv_name && <span className="label">Source: {analysis.cv_name}</span>}
      </PageHeader>

      {!profile?.sessions.length && (
        <div className="sheet mb-4 flex flex-wrap items-center justify-between gap-3 border-l-[3px] border-l-blue p-4">
          <p className="text-sm"><b>Start before you practise.</b> Review how your CV reads, then work through a short training plan built from it.</p>
          <div className="flex gap-2"><Btn variant="ghost" onClick={() => goTo("review")}>CV review</Btn><Btn onClick={() => goTo("train")}>Training plan</Btn></div>
        </div>
      )}
      <div className="sheet mb-6 p-5">
        <div className="flex h-3 overflow-hidden rounded-full bg-line" role="img" aria-label={`${count("solid")} solid, ${count("shaky")} shaky, ${count("untested")} untested`}>
          {([["solid", "bg-solid"], ["shaky", "bg-shaky"], ["untested", "bg-transparent"]] as const).map(([s, c]) => (
            <motion.div key={s} className={c} initial={{ width: 0 }} animate={{ width: `${(count(s) / total) * 100}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          {(["all", "solid", "shaky", "untested"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
              className={`text-sm transition-colors ${filter === f ? "font-bold text-ink underline decoration-2 underline-offset-4" : "text-muted hover:text-ink"}`}>
              <span className="font-display text-xl font-extrabold">{f === "all" ? rows.length : count(f)}</span>{" "}
              <span className="label">{f === "all" ? "items" : f}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 && <p className="sheet p-6 text-muted">Nothing here yet. Practise to move items into this list.</p>}
      <motion.ul variants={listV} initial="hidden" animate="show" key={filter} className="space-y-2">
        {visible.map(({ r, d }) => {
          const isOpen = open === r.ref;
          return (
            <motion.li key={r.ref} variants={itemV} className="sheet overflow-hidden">
              <button onClick={() => setOpen(isOpen ? null : r.ref)} aria-expanded={isOpen} className="flex w-full items-start gap-4 p-4 text-left hover:bg-paper/50">
                <span className="mt-0.5 w-20 shrink-0"><Stamp state={d.state} /></span>
                <span className="min-w-0 flex-1">
                  <span className="label block">{r.kind === "claim" ? `CV · ${TYPE[r.claim!.type]}` : `Role requirement · ${r.gapStatus === "missing" ? "not on your CV" : "weak evidence"}`}</span>
                  <span className="mt-0.5 block">{r.label}</span>
                </span>
                <span className="label hidden shrink-0 text-right sm:block">
                  {d.attempts ? <>{d.attempts}× · last <span className="text-ink">{d.last}</span></> : "not practised"}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                    <div className="space-y-4 border-t border-line bg-paper/50 p-4 pl-[7.5rem]">
                      {r.kind === "claim" && r.claim && (
                        <>
                          <div>
                            <p className="label mb-2">How much did you own this?</p>
                            <div role="radiogroup" aria-label="Ownership" className="flex flex-wrap gap-1.5">
                              {OWNERSHIP.map((o) => (
                                <button key={o} role="radio" aria-checked={r.claim!.ownership === o} onClick={() => setOwnership(r.index!, o)}
                                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${r.claim!.ownership === o ? "border-ink bg-ink text-white" : "border-line bg-card hover:border-ink"}`}>{o}</button>
                              ))}
                            </div>
                          </div>
                          {r.claim.numbers.length > 0 && <p className="label">Numbers you must defend: <span className="text-ink">{r.claim.numbers.join(" · ")}</span></p>}
                          {r.claim.keywords?.length > 0 && <p className="label">Keywords they may probe: <span className="text-ink">{r.claim.keywords.join(" · ")}</span></p>}
                          <div>
                            <p className="label mb-2">They will ask</p>
                            <ul className="space-y-1.5 text-sm">{r.claim.questions.map((q) => <li key={q} className="border-l-2 border-pen/60 pl-3">{q}</li>)}</ul>
                          </div>
                        </>
                      )}
                      {r.kind === "gap" && (
                        <div className="space-y-1 text-sm text-muted">
                          <p className="label">Coverage on your CV: {Math.round((r.coverage ?? 0) * 100)}%</p>
                          {r.evidence?.length ? r.evidence.map((e) => <p key={e}><span className="label mr-2">CV</span>{e}</p>) : <p>Nothing on your CV matches this requirement.</p>}
                        </div>
                      )}
                      <Btn onClick={() => onDrill({ focus: r.ref })}>Drill this {r.kind === "claim" ? "claim" : "requirement"}</Btn>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>
          );
        })}
      </motion.ul>

      {evidenced.length > 0 && (
        <details className="sheet mt-6 p-4">
          <summary className="label cursor-pointer">{evidenced.length} role requirement{evidenced.length > 1 ? "s" : ""} already evidenced on your CV</summary>
          <ul className="mt-3 space-y-1 text-sm text-muted">{evidenced.map((g) => <li key={g.requirement}>✓ {g.requirement}</li>)}</ul>
        </details>
      )}
    </section>
  );
}
