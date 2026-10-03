"use client";
import { post } from "@/lib/api";
import { OWNERSHIP, type Analysis, type Claim } from "@/lib/types";

export default function Claims({ analysis, setAnalysis }: { analysis: Analysis | null; setAnalysis: (a: Analysis) => void }) {
  if (!analysis) return <p className="text-neutral-500">Run Analyse on the Inputs tab first.</p>;

  async function setOwnership(i: number, ownership: Claim["ownership"]) {
    if (!analysis) return;
    const claims = analysis.claims.map((c, j) => (j === i ? { ...c, ownership } : c));
    const res = await post<{ claims: Claim[] }>("/claims/questions", { claims });
    setAnalysis({ ...analysis, claims: res.claims });
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">CV claim inventory ({analysis.claims.length})</h2>
      {analysis.claims.map((c, i) => (
        <details key={i} className="rounded border p-3">
          <summary className="cursor-pointer"><span className="mr-2 rounded bg-neutral-100 px-1 text-xs">{c.type}</span>{c.text}</summary>
          <div className="mt-3 space-y-2 text-sm">
            <label>Your ownership{" "}
              <select className="rounded border p-1" value={c.ownership} onChange={(e) => setOwnership(i, e.target.value as Claim["ownership"])}>
                {OWNERSHIP.map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
            {c.numbers.length > 0 && <p className="text-neutral-500">Numbers: {c.numbers.join(", ")}</p>}
            <ul className="list-disc pl-5">{c.questions.map((q, k) => <li key={k}>{q}</li>)}</ul>
          </div>
        </details>
      ))}
    </section>
  );
}
