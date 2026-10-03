"use client";
import { useEffect, useState } from "react";
import { api, post } from "@/lib/api";
import type { AiStatus } from "@/lib/types";
import { Btn } from "./ui";

const FEATURE_LABEL: Record<string, string> = {
  cv_review: "CV review: seniority read, risks, rewrites, hard questions",
  coaching: "Answer coaching: one-line note after each practice answer",
  questions: "Custom interview questions from your CV and the role",
  story: "Story tightening in the story bank",
};

/** Opt-in dialog. Shows exactly what would be sent before AI can be enabled. */
export default function AiConsent({ ai, onDone, onCancel }: { ai: AiStatus; onDone: () => void; onCancel: () => void }) {
  const [prev, setPrev] = useState<{ text: string; removed: Record<string, number>; total: number } | null>(null);
  const [feats, setFeats] = useState(ai.features);
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { api<{ text: string; removed: Record<string, number>; total: number }>("/ai/preview").then(setPrev).catch(() => setPrev(null)); }, []);

  async function enable() {
    try { await post("/ai/settings", { enabled: true, consent: agree, features: feats }); onDone(); }
    catch (e) { setErr((e as Error).message); }
  }
  return (
    <div className="sheet space-y-4 border-l-[3px] border-l-blue p-5">
      <h3 className="font-display text-xl font-bold">Turn on AI, and know what leaves this app</h3>
      <ul className="space-y-1.5 text-sm text-muted">
        <li>• Redacted text is sent to <b className="text-ink">{ai.provider}</b> ({ai.model}) over HTTPS. Their retention and privacy terms apply.</li>
        <li>• Emails, phone numbers, links, addresses and your name line are removed first. Employers, titles and figures stay, because the review needs them.</li>
        <li>• Scoring, stamps and your plan stay rule-based. AI only adds suggestions. It must not invent figures; ones it cannot source are shown as [placeholders].</li>
        <li>• You can turn it off any time in Your data. Identical requests are cached, so they are not sent twice.</li>
      </ul>
      {prev && (
        <details className="text-sm">
          <summary className="label cursor-pointer">Preview exactly what would be sent ({prev.total} item{prev.total === 1 ? "" : "s"} removed)</summary>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-paper/70 p-3 font-mono text-xs">{prev.text}</pre>
        </details>
      )}
      <div>
        <p className="label mb-2">Use AI for</p>
        {Object.keys(FEATURE_LABEL).map((f) => (
          <label key={f} className="mb-1 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={!!feats[f]} onChange={(e) => setFeats({ ...feats, [f]: e.target.checked })} />{FEATURE_LABEL[f]}</label>
        ))}
      </div>
      <label className="flex items-start gap-2 text-sm font-medium"><input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I understand and agree to send redacted text to {ai.provider}.</label>
      <div className="flex items-center gap-3">
        <Btn disabled={!agree} onClick={enable}>Enable AI</Btn><Btn variant="ghost" onClick={onCancel}>Not now</Btn>
        {err && <p role="alert" className="text-sm text-pen">{err}</p>}
      </div>
    </div>
  );
}
