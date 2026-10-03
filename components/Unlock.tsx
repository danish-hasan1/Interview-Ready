"use client";
import { useState } from "react";
import { KEY_STORE } from "@/lib/api";
import { Btn } from "./ui";

/** Shown only when the server has APP_ACCESS_KEY set and this browser does not hold the key yet. */
export default function Unlock({ onUnlocked }: { onUnlocked: () => void }) {
  const [key, setKey] = useState("");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/access", { headers: { "x-access-key": key } }).then((x) => x.json()).catch(() => null);
    if (r?.ok) { try { localStorage.setItem(KEY_STORE, key); } catch {} onUnlocked(); }
    else setErr("That key is not right.");
  }
  return (
    <form onSubmit={submit} className="sheet mx-auto mt-24 w-full max-w-sm space-y-4 p-6">
      <h1 className="font-display text-2xl font-extrabold">Interview Ready</h1>
      <p className="text-sm text-muted">This deployment is private. Enter your access key. It is stored in this browser only.</p>
      <input type="password" autoFocus aria-label="Access key" value={key} onChange={(e) => setKey(e.target.value)} className="w-full rounded-md border border-line bg-paper/60 p-3 text-sm outline-none focus:border-blue" />
      <Btn type="submit" disabled={!key}>Unlock</Btn>
      {err && <p role="alert" className="text-sm font-medium text-pen">{err}</p>}
    </form>
  );
}
