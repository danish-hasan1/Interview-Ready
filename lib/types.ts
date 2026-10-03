export const OWNERSHIP = ["Owned", "Led", "Contributed", "Supported", "Exposure"] as const;

export type Claim = {
  text: string;
  type: "metric" | "title" | "action";
  numbers: string[];
  ownership: (typeof OWNERSHIP)[number];
  questions: string[];
};

export type Gap = { requirement: string; status: "missing" | "weak" | "evidenced"; coverage: number; evidence: string[] };
export type GapItem = { question: string; ref: string };
export type Analysis = { claims: Claim[]; gaps: Gap[]; gap_items: GapItem[]; cv_name?: string };

export type Score = { dims: Record<string, number>; fixes: string[]; total: number; framework: string };

export type Turn = { question: string; kind: string; ref?: string };
export type InterviewState = { queue: Turn[]; asked: number; followups_used: number; current: Turn | null };

export type RefStat = { attempts: number; last: number; best: number };
export type Profile = {
  sessions: { id: number; created: string; n: number; avg_total: number; dims: Record<string, number> }[];
  weaknesses: [string, number][];
  dims: Record<string, number>;
  answers: number;
  refs: Record<string, RefStat>;
};

export type Workspace = { has_cv: false } | ({ has_cv: true; cv_name: string; has_jd: boolean } & Analysis);
