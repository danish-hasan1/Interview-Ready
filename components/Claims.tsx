"use client";
import { post } from "@/lib/api";
import { OWNERSHIP, type Analysis, type Claim } from "@/lib/types";
import { Empty, PageTitle } from "./ui";

const TYPE_STYLE = { metric: "bg-cobalt/10 text-cobalt", action: "bg-ink/10 text-ink", title: "bg-amber/15 text-amber" } as const;

export default function Claims({ analysis, setAnalysis, goInputs, next }: {
  analysis: Analysis | null; setAnalysis: (a: Analysis) => void; goInputs: () => void; next: () => void;
}) {
  if (!analysis) return <Empty text="No CV analysed yet. Upload your CV first." action={<button className="btn btn-primary" onClick={goInputs}>Go to inputs</button>} />;

  async function setOwnership(i: number, ownership: Claim["ownership"]) {
    if (!analysis) return;
    const claims = analysis.claims.map((c, j) => (j === i ? { ...c, ownership } : c));
    const res = await post<{ claims: Claim[] }>("/claims/questions", { claims });
    setAnalysis({ ...analysis, claims: res.claims });
  }

  const metrics = analysis.claims.filter((c) => c.type === "metric").length;

  return (
    <section>
      <PageTitle eyebrow="Step 2 · CV claims" title={`${analysis.claims.length} claims. Can you defend each one?`}>
        {metrics} carry a number — those get pressed hardest. Set how much you truly owned each one; the questions change with it.
      </PageTitle>
      <div className="space-y-3">
        {analysis.claims.map((c, i) => (
          <details key={i} className="card rise group overflow-hidden" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
            <summary className="flex cursor-pointer list-none items-start gap-3 p-4 hover:bg-paper/60">
              <span className={`label mt-0.5 shrink-0 rounded px-1.5 py-0.5 ${TYPE_STYLE[c.type]}`}>{c.type}</span>
              <span className="flex-1">{c.text}</span>
              <span className="label mt-0.5 shrink-0">{c.ownership}</span>
              <span aria-hidden className="mt-0.5 text-muted transition-transform group-open:rotate-90">›</span>
            </summary>
            <div className="space-y-4 border-t border-line bg-paper/40 p-4">
              <div>
                <p className="label mb-2">Your ownership</p>
                <div role="radiogroup" aria-label="Ownership" className="flex flex-wrap gap-1.5">
                  {OWNERSHIP.map((o) => (
                    <button key={o} role="radio" aria-checked={c.ownership === o} onClick={() => setOwnership(i, o)}
                      className={`rounded-full border px-3 py-1 text-sm transition-colors ${c.ownership === o ? "border-ink bg-ink text-white" : "border-line bg-card hover:border-ink"}`}>{o}</button>
                  ))}
                </div>
              </div>
              {c.numbers.length > 0 && <p className="label">Numbers to defend: <span className="text-ink">{c.numbers.join(" · ")}</span></p>}
              <div>
                <p className="label mb-2">They will ask</p>
                <ul className="space-y-1.5 text-sm">
                  {c.questions.map((q, k) => <li key={k} className="border-l-2 border-pen/60 pl-3">{q}</li>)}
                </ul>
              </div>
            </div>
          </details>
        ))}
      </div>
      <div className="mt-6"><button className="btn btn-primary" onClick={next}>See gaps against the role <span aria-hidden>→</span></button></div>
    </section>
  );
}
