"use client";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { api, post } from "@/lib/api";
import { DIM, DIM_ORDER } from "@/lib/dims";
import { useAi } from "@/lib/useAi";
import type { StoriesData, Story, StoryCheck } from "@/lib/types";
import { Btn, PageHeader, RatingBar, Stamp, itemV, listV } from "./ui";

export default function Stories() {
  const [d, setD] = useState<StoriesData | null>(null);
  const [theme, setTheme] = useState<string | null>(null);
  const [editing, setEditing] = useState<Story | null>(null);
  const load = useCallback(() => api<StoriesData>("/stories").then(setD), []);
  useEffect(() => { load(); }, [load]);
  if (!d) return null;

  const themes = d.themes.themes;
  const byTheme = (id: string) => d.stories.filter((s) => s.theme === id);
  const open = (id: string, s: Story | null = null) => { setTheme(id); setEditing(s); window.scrollTo({ top: 0, behavior: "smooth" }); };

  if (theme)
    return <Editor key={`${theme}-${editing?.id ?? "new"}`} d={d} theme={theme} story={editing} back={() => { setTheme(null); setEditing(null); load(); }} />;

  const c = d.coverage;
  return (
    <section>
      <PageHeader title="Story bank">Real stories you can reuse across interviews. Each is built as context, problem, your action, result and impact, then scored. Get the five core themes ready first.</PageHeader>
      <div className="sheet mb-6 p-5">
        <div className="flex items-end justify-between">
          <div><p className="label">Core themes ready</p><p className="font-display text-3xl font-extrabold">{c.core_ready} <span className="text-lg text-muted">of {c.core_total}</span></p></div>
          <div className="h-2 w-48 overflow-hidden rounded-full bg-line"><motion.div className="h-full bg-solid" initial={{ width: 0 }} animate={{ width: `${(c.core_ready / c.core_total) * 100}%` }} transition={{ duration: 0.7 }} /></div>
        </div>
        <p className="mt-2 text-sm text-muted">A story counts as ready when every field passes and it scores 6 or more.</p>
      </div>

      <motion.ul variants={listV} initial="hidden" animate="show" className="space-y-3">
        {themes.map((t) => {
          const list = byTheme(t.id);
          const best = list.reduce((m, s) => Math.max(m, s.score), 0);
          return (
            <motion.li key={t.id} variants={itemV} className="sheet p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="label">{t.core ? "Core theme" : "Extra theme"}</p>
                  <h3 className="font-display text-lg font-bold">{t.label}</h3>
                  <p className="text-sm text-muted">{t.prompt}</p>
                </div>
                <div className="flex items-center gap-3">
                  {list.length > 0 ? <Stamp state={best >= 6 ? "solid" : "shaky"} /> : <Stamp state="untested" />}
                  <Btn variant={list.length ? "ghost" : "primary"} onClick={() => open(t.id)}>{list.length ? "Add another" : "Write story"}</Btn>
                </div>
              </div>
              {list.map((s) => (
                <button key={s.id} onClick={() => open(t.id, s)} className="mt-3 flex w-full items-center gap-3 rounded-md border border-line bg-paper/50 p-3 text-left hover:border-ink">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded font-display font-bold text-white ${s.score >= 7 ? "bg-solid" : s.score >= 4 ? "bg-shaky" : "bg-pen"}`}>{s.score}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{s.title || s.composed}</span>
                </button>
              ))}
            </motion.li>
          );
        })}
      </motion.ul>
    </section>
  );
}

function Editor({ d, theme, story, back }: { d: StoriesData; theme: string; story: Story | null; back: () => void }) {
  const t = d.themes.themes.find((x) => x.id === theme)!;
  const [title, setTitle] = useState(story?.title ?? "");
  const [vals, setVals] = useState<Record<string, string>>(story?.fields ?? {});
  const [res, setRes] = useState<StoryCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const { on } = useAi();
  const [sugg, setSugg] = useState<{ fields: Record<string, string>; note: string; before: number; after: number; better: boolean } | null>(null);

  async function tighten() {
    setBusy(true); setErr("");
    try { setSugg(await post("/ai/story-tighten", { theme, fields: vals })); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function save() {
    setBusy(true); setErr("");
    try {
      const r = await post<{ id: number; check: StoryCheck }>("/stories", { id: story?.id, theme, title, fields: vals });
      setRes(r.check);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function check() {
    setBusy(true); setErr("");
    try { setRes(await post<StoryCheck>("/stories/check", { theme, fields: vals })); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function remove() { if (story) { await api(`/stories/${story.id}`, { method: "DELETE" }); back(); } }

  return (
    <section>
      <button onClick={back} className="label mb-4 hover:text-ink">← Back to story bank</button>
      <PageHeader title={t.label}>{t.prompt} Use a real situation with you in it.</PageHeader>
      <div className="sheet space-y-4 p-5">
        <div>
          <label htmlFor="title" className="label mb-1 block">Title (for you)</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Agency consolidation 2023"
            className="w-full rounded-md border border-line bg-paper/60 p-3 text-sm outline-none focus:border-blue" />
        </div>
        {d.themes.fields.map((f) => {
          const note = res?.fields.find((x) => x.key === f.key);
          return (
            <div key={f.key}>
              <label htmlFor={f.key} className="label mb-1 block">{f.label}</label>
              <textarea id={f.key} rows={2} value={vals[f.key] ?? ""} placeholder={f.hint} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
                className={`w-full resize-y rounded-md border bg-paper/60 p-3 text-sm outline-none focus:border-blue ${note ? (note.ok ? "border-solid" : "border-pen") : "border-line"}`} />
              {note && !note.ok && <p className="mt-1 text-sm font-medium text-pen">{note.msg}</p>}
            </div>
          );
        })}
        <div className="flex flex-wrap items-center gap-3">
          <Btn disabled={busy} variant="ghost" onClick={check}>Check</Btn>
          {on("story") && <Btn disabled={busy} variant="ghost" onClick={tighten}>Tighten with AI</Btn>}
          <Btn disabled={busy} onClick={save}>{story ? "Save changes" : "Save to story bank"}</Btn>
          {story && <button onClick={remove} className="label underline hover:text-pen">Delete story</button>}
          {err && <p role="alert" className="text-sm font-medium text-pen">{err}</p>}
        </div>
        {sugg && (
          <div className="rounded-md border-l-[3px] border-blue bg-blue/5 p-4 text-sm">
            <p className="label mb-2 !text-blue">AI suggestion · score {sugg.before} → {sugg.after}{sugg.better ? "" : " (not better, so ignore it)"}</p>
            <p className="mb-2 text-muted">{sugg.note}</p>
            <ul className="space-y-1.5">{d.themes.fields.map((f) => <li key={f.key}><span className="label mr-2">{f.label}</span>{sugg.fields[f.key]}</li>)}</ul>
            <div className="mt-3 flex gap-3"><Btn onClick={() => { setVals({ ...vals, ...sugg.fields }); setSugg(null); setRes(null); }}>Use this version</Btn><Btn variant="ghost" onClick={() => setSugg(null)}>Dismiss</Btn></div>
          </div>
        )}
        {res && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 border-t border-line pt-4">
            <div className="flex items-center justify-between"><p className="label">Assessment of the story as you would tell it</p>
              <span className="flex items-center gap-3"><Stamp state={res.ready ? "solid" : "shaky"} /><span className="font-display text-2xl font-extrabold">{res.score}<span className="text-sm text-muted">/10</span></span></span></div>
            <div className="grid gap-x-8 gap-y-1.5 md:grid-cols-2">{DIM_ORDER.map((k) => <RatingBar key={k} compact label={DIM[k].label} value={res.dims[k]} />)}</div>
            {res.framework && <p className="label !text-solid">Framework detected: {res.framework}</p>}
            <ul className="space-y-1.5 text-sm">{res.fixes.map((f) => <li key={f} className="flex gap-2"><span className="label mt-0.5 shrink-0 !text-pen">Fix</span>{f}</li>)}</ul>
            <details className="text-sm"><summary className="label cursor-pointer">Read it as the interviewer hears it</summary><p className="mt-2 rounded-md bg-paper/70 p-3">{res.composed}</p></details>
          </motion.div>
        )}
      </div>
    </section>
  );
}
