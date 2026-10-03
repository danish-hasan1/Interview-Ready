"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setMsg("");
    const { error } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    if (error) setMsg(error.message);
    else if (mode === "up") setMsg("Check your email to confirm, then sign in.");
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-24 w-full max-w-sm space-y-4 rounded-xl border border-neutral-200 p-6">
      <h1 className="text-xl font-semibold">Interview Ready</h1>
      <p className="text-sm text-neutral-500">Your CV and answers are private to your account.</p>
      <input className="w-full rounded border p-2" type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="w-full rounded border p-2" type="password" required minLength={8} placeholder="Password (8+ chars)" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button className="w-full rounded bg-black p-2 text-white">{mode === "in" ? "Sign in" : "Create account"}</button>
      <button type="button" className="text-sm underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
        {mode === "in" ? "Need an account? Sign up" : "Have an account? Sign in"}
      </button>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
    </form>
  );
}
