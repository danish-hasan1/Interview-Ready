import type { Analysis } from "@/lib/types";
import { Empty, PageTitle } from "./ui";

const STYLE = {
  missing: { border: "border-l-pen", chip: "text-pen", text: "Missing" },
  weak: { border: "border-l-amber", chip: "text-amber", text: "Weak evidence" },
  evidenced: { border: "border-l-pass", chip: "text-pass", text: "Covered" },
} as const;

export default function Gaps({ analysis, goInputs, next }: { analysis: Analysis | null; goInputs: () => void; next: () => void }) {
  if (!analysis || analysis.gaps.length === 0)
    return <Empty text="No job description analysed. Paste one on the inputs step to see gaps." action={<button className="btn btn-primary" onClick={goInputs}>Go to inputs</button>} />;

  const count = (s: keyof typeof STYLE) => analysis.gaps.filter((g) => g.status === s).length;

  return (
    <section>
      <PageTitle eyebrow="Step 3 · Gaps" title="Where the role asks for more than your CV shows." />
      <div className="mb-6 grid grid-cols-3 gap-3">
        {(["missing", "weak", "evidenced"] as const).map((s) => (
          <div key={s} className="card rise p-4">
            <p className={`font-display text-4xl font-extrabold ${STYLE[s].chip}`}>{count(s)}</p>
            <p className="label mt-1">{STYLE[s].text}</p>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {analysis.gaps.map((g, i) => (
          <details key={i} className={`card rise group overflow-hidden border-l-[6px] ${STYLE[g.status].border}`} style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
            <summary className="flex cursor-pointer list-none items-start gap-3 p-4 hover:bg-paper/60">
              <span className="flex-1">{g.requirement}</span>
              <span className={`label shrink-0 ${STYLE[g.status].chip}`}>{STYLE[g.status].text} · {Math.round(g.coverage * 100)}%</span>
            </summary>
            <div className="space-y-1 border-t border-line bg-paper/40 p-4 text-sm text-muted">
              {g.evidence.length === 0 ? <p>Nothing on your CV matches this requirement.</p> : g.evidence.map((e, k) => <p key={k}><span className="label mr-2">CV</span>{e}</p>)}
            </div>
          </details>
        ))}
      </div>
      <div className="mt-6"><button className="btn btn-primary" onClick={next}>Start the mock interview <span aria-hidden>→</span></button></div>
    </section>
  );
}
