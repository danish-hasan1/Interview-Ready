import type { Analysis } from "@/lib/types";

const icon = { missing: "🔴", weak: "🟡", evidenced: "🟢" } as const;

export default function Gaps({ analysis }: { analysis: Analysis | null }) {
  if (!analysis || analysis.gaps.length === 0) return <p className="text-neutral-500">Paste a JD and run Analyse first.</p>;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">CV vs JD gaps</h2>
      {analysis.gaps.map((g, i) => (
        <details key={i} className="rounded border p-3">
          <summary className="cursor-pointer">{icon[g.status]} <b>{g.status.toUpperCase()}</b> — {g.requirement}</summary>
          <div className="mt-2 space-y-1 text-sm text-neutral-600">
            <p>Keyword coverage {Math.round(g.coverage * 100)}%</p>
            {g.evidence.map((e, k) => <p key={k}>CV evidence: {e}</p>)}
          </div>
        </details>
      ))}
    </section>
  );
}
