import type { Profile } from "./types";

export type Defence = "untested" | "shaky" | "solid";
export const SOLID_AT = 6;

export function defence(ref: string, refs: Profile["refs"] | undefined): { state: Defence; attempts: number; last: number } {
  const r = refs?.[ref];
  if (!r) return { state: "untested", attempts: 0, last: 0 };
  return { state: r.last >= SOLID_AT ? "solid" : "shaky", attempts: r.attempts, last: r.last };
}

export const STAMP: Record<Defence, { text: string; cls: string }> = {
  untested: { text: "Untested", cls: "text-muted" },
  shaky: { text: "Shaky", cls: "text-shaky" },
  solid: { text: "Solid", cls: "text-solid" },
};
