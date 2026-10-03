"use client";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { api, post } from "@/lib/api";
import { OWNERSHIP, type Analysis, type Claim } from "@/lib/types";
import Icon from "./Icon";
import { Btn, PageHeader, itemV, listV } from "./ui";

const STEPS = ["Upload", "Claims", "Gaps"] as const;
const TYPE_STYLE = { metric: "bg-brand/10 text-brand", action: "bg-cyan/15 text-[#0a8aa6]", title: "bg-pink/12 text-pink" } as const;
const GAP = {
  missing: { border: "border-l-pen", chip: "text-pen", text: "Missing", tint: "bg-pen/[.07]" },
  weak: { border: "border-l-amber", chip: "text-amber", text: "Weak evidence", tint: "bg-amber/10" },
  evidenced: { border: "border-l-pass", chip: "text-pass", text: "Covered", tint: "bg-pass/[.07]" },
} as const;

export default function Prepare({ analysis, setAnalysis, notes, setNotes, goPractice }: {
  analysis: Analysis | null; setAnalysis: (a: Analysis) => void; notes: string; setNotes: (n: string) => void; goPractice: () => void;
}) {
  const [step, setStep] = useState(analysis ? 1 : 0);

  return (
    <section>
      <PageHeader eyebrow="Prepare" title="Turn your CV into a training plan.">
        Three steps: upload, review the claims you will be pressed on, then see where the role asks for more.
      </PageHeader>
      <Stepper step={step} done={analysis ? 3 : 0} setStep={(i) => (analysis || i === 0) && setStep(i)} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
          {step === 0 && <Upload notes={notes} setNotes={setNotes} onDone={(a) => { setAnalysis(a); setStep(1); }} />}
          {step === 1 && analysis && <Claims analysis={analysis} setAnalysis={setAnalysis} next={() => setStep(2)} />}
          {step === 2 && analysis && <Gaps analysis={analysis} back={() => setStep(0)} next={goPractice} />}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function Stepper({ step, done, setStep }: { step: number; done: number; setStep: (i: number) => void }) {
  return (
    <div className="mb-8 flex items-center">
      {STEPS.map((s, i) => (
        <div key={s} className="flex flex-1 items-center last:flex-none">
          <button onClick={() => setStep(i)} className="flex items-center gap-2.5" aria-current={step === i ? "step" : undefined}>
            <motion.span
              animate={{ backgroundColor: i < done || i < step ? "#12a67a" : step === i ? "#5b4bff" : "#e4e7f0", color: i <= step || i < done ? "#fff" : "#667085", scale: step === i ? 1.1 : 1 }}
              className="grid h-8 w-8 place-items-center rounded-full font-mono text-xs font-semibold"
            >
              {i < step || i < done ? <Icon name="check" className="h-4 w-4" /> : i + 1}
            </motion.span>
            <span className={`text-sm font-semibold ${step === i ? "text-ink" : "text-muted"}`}>{s}</span>
          </button>
          {i < STEPS.length - 1 && (
            <div className="relative mx-3 h-0.5 flex-1 overflow-hidden rounded bg-line">
              <motion.div className="absolute inset-0 origin-left bg-pass" animate={{ scaleX: i < step || i < done - 1 ? 1 : 0 }} transition={{ duration: 0.5 }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Upload({ notes, setNotes, onDone }: { notes: string; setNotes: (n: string) => void; onDone: (a: Analysis) => void }) {
  const [cv, setCv] = useState<File | null>(null);
  const [jd, setJd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);

  async function run() {
    setBusy(true); setErr("");
    try {
      const fd = new FormData();
      if (cv) fd.append("cv", cv);
      fd.append("jd_text", jd);
      onDone(await api<Analysis>("/analyze", { method: "POST", body: fd }));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <motion.div variants={listV} initial="hidden" animate="show">
      <div className="grid gap-5 lg:grid-cols-2">
        <motion.label variants={itemV}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); setCv(e.dataTransfer.files?.[0] ?? null); }}
          className={`card flex min-h-72 cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed p-8 text-center transition-all ${
            drag ? "scale-[1.02] border-brand bg-brand/5" : cv ? "border-pass bg-pass/5" : "border-line hover:border-brand"}`}>
          <input className="sr-only" type="file" accept=".pdf,.docx,.txt,.md" onChange={(e) => setCv(e.target.files?.[0] ?? null)} />
          <motion.span key={cv ? "ok" : "up"} initial={{ scale: 0.5, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand2 text-white shadow-lg"><Icon name={cv ? "check" : "upload"} className="h-6 w-6" /></motion.span>
          {cv ? (<><span className="font-display text-lg font-bold">{cv.name}</span><span className="label">{(cv.size / 1024).toFixed(0)} KB · click to replace</span></>)
            : (<><span className="font-display text-lg font-bold">Drop your CV here</span><span className="label">PDF · DOCX · TXT, up to 4 MB</span></>)}
        </motion.label>
        <motion.div variants={itemV} className="card flex flex-col p-5">
          <label htmlFor="jd" className="label mb-2">Job description</label>
          <textarea id="jd" className="min-h-52 flex-1 resize-y rounded-xl border border-line bg-paper/60 p-3 text-sm outline-none focus:border-brand"
            placeholder="Paste the requirements here…" value={jd} onChange={(e) => setJd(e.target.value)} />
        </motion.div>
      </div>
      <motion.div variants={itemV} className="card mt-5 p-5">
        <label htmlFor="notes" className="label mb-2 block">Interviewer or company notes <span className="normal-case tracking-normal">(optional)</span></label>
        <textarea id="notes" className="h-20 w-full resize-y rounded-xl border border-line bg-paper/60 p-3 text-sm outline-none focus:border-brand"
          placeholder="Who is interviewing? What do you know about them?" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </motion.div>
      <motion.div variants={itemV} className="mt-6 flex items-center gap-4">
        <Btn disabled={busy} onClick={run}>{busy ? "Reading your CV…" : "Find my weak spots"} <Icon name="arrow" className="h-4 w-4" /></Btn>
        {err && <p role="alert" className="text-sm font-medium text-pen">{err}</p>}
      </motion.div>
    </motion.div>
  );
}

function Claims({ analysis, setAnalysis, next }: { analysis: Analysis; setAnalysis: (a: Analysis) => void; next: () => void }) {
  async function setOwnership(i: number, ownership: Claim["ownership"]) {
    const claims = analysis.claims.map((c, j) => (j === i ? { ...c, ownership } : c));
    const res = await post<{ claims: Claim[] }>("/claims/questions", { claims });
    setAnalysis({ ...analysis, claims: res.claims });
  }
  const metrics = analysis.claims.filter((c) => c.type === "metric").length;
  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-3">
        <span className="card px-4 py-2 text-sm"><b className="font-display text-lg">{analysis.claims.length}</b> claims found</span>
        <span className="card px-4 py-2 text-sm"><b className="font-display text-lg text-brand">{metrics}</b> carry a number, pressed hardest</span>
      </div>
      <motion.div className="space-y-3" variants={listV} initial="hidden" animate="show">
        {analysis.claims.map((c, i) => (
          <motion.details key={i} variants={itemV} className="card group overflow-hidden">
            <summary className="flex cursor-pointer list-none items-start gap-3 p-4 hover:bg-paper/60">
              <span className={`label mt-0.5 shrink-0 rounded px-1.5 py-0.5 ${TYPE_STYLE[c.type]}`}>{c.type}</span>
              <span className="flex-1">{c.text}</span>
              <span className="label mt-0.5 shrink-0">{c.ownership}</span>
              <span aria-hidden className="mt-0.5 text-muted transition-transform group-open:rotate-90">›</span>
            </summary>
            <div className="space-y-4 border-t border-line bg-paper/50 p-4">
              <div>
                <p className="label mb-2">How much did you own this?</p>
                <div role="radiogroup" aria-label="Ownership" className="flex flex-wrap gap-1.5">
                  {OWNERSHIP.map((o) => (
                    <motion.button key={o} role="radio" aria-checked={c.ownership === o} onClick={() => setOwnership(i, o)} whileTap={{ scale: 0.93 }}
                      className={`relative rounded-full border px-3 py-1 text-sm transition-colors ${c.ownership === o ? "border-brand text-white" : "border-line bg-card hover:border-brand"}`}>
                      {c.ownership === o && <motion.span layoutId={`own-${i}`} className="absolute inset-0 rounded-full bg-gradient-to-r from-brand to-brand2" transition={{ type: "spring", stiffness: 500, damping: 32 }} />}
                      <span className="relative">{o}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
              {c.numbers.length > 0 && <p className="label">Numbers to defend: <span className="text-ink">{c.numbers.join(" · ")}</span></p>}
              <div>
                <p className="label mb-2">They will ask</p>
                <ul className="space-y-1.5 text-sm">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {c.questions.map((q, k) => (
                      <motion.li key={q} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: k * 0.04 }} className="border-l-2 border-brand/50 pl-3">{q}</motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
            </div>
          </motion.details>
        ))}
      </motion.div>
      <div className="mt-6"><Btn onClick={next}>See gaps against the role <Icon name="arrow" className="h-4 w-4" /></Btn></div>
    </div>
  );
}

function Gaps({ analysis, back, next }: { analysis: Analysis; back: () => void; next: () => void }) {
  const count = (s: keyof typeof GAP) => analysis.gaps.filter((g) => g.status === s).length;
  if (analysis.gaps.length === 0)
    return (
      <div className="card flex flex-col items-start gap-3 p-8">
        <h2 className="font-display text-xl font-bold">No job description yet</h2>
        <p className="max-w-md text-muted">Add a job description to see which requirements your CV does not evidence. You can still practise on your CV claims.</p>
        <div className="flex gap-3"><Btn variant="ghost" onClick={back}>Add a job description</Btn><Btn onClick={next}>Start practice <Icon name="arrow" className="h-4 w-4" /></Btn></div>
      </div>
    );
  return (
    <div>
      <motion.div className="mb-6 grid grid-cols-3 gap-3" variants={listV} initial="hidden" animate="show">
        {(["missing", "weak", "evidenced"] as const).map((s) => (
          <motion.div key={s} variants={itemV} className={`card p-4 ${GAP[s].tint}`}>
            <p className={`block font-display text-4xl font-extrabold ${GAP[s].chip}`}>{count(s)}</p>
            <p className="label mt-1">{GAP[s].text}</p>
          </motion.div>
        ))}
      </motion.div>
      <motion.div className="space-y-3" variants={listV} initial="hidden" animate="show">
        {analysis.gaps.map((g, i) => (
          <motion.details key={i} variants={itemV} className={`card group overflow-hidden border-l-[6px] ${GAP[g.status].border}`}>
            <summary className="flex cursor-pointer list-none items-start gap-3 p-4 hover:bg-paper/60">
              <span className="flex-1">{g.requirement}</span>
              <span className={`label shrink-0 ${GAP[g.status].chip}`}>{GAP[g.status].text} · {Math.round(g.coverage * 100)}%</span>
            </summary>
            <div className="space-y-1 border-t border-line bg-paper/50 p-4 text-sm text-muted">
              {g.evidence.length === 0 ? <p>Nothing on your CV matches this requirement.</p> : g.evidence.map((e, k) => <p key={k}><span className="label mr-2">CV</span>{e}</p>)}
            </div>
          </motion.details>
        ))}
      </motion.div>
      <div className="mt-6"><Btn onClick={next}>Start the mock interview <Icon name="arrow" className="h-4 w-4" /></Btn></div>
    </div>
  );
}
