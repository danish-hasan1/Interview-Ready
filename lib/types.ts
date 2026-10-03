export const OWNERSHIP = ["Owned", "Led", "Contributed", "Supported", "Exposure"] as const;

export type Claim = {
  text: string;
  type: "metric" | "title" | "action";
  numbers: string[];
  ownership: (typeof OWNERSHIP)[number];
  questions: string[];
};

export type Gap = {
  requirement: string;
  status: "missing" | "weak" | "evidenced";
  coverage: number;
  evidence: string[];
};

export type Analysis = { claims: Claim[]; gaps: Gap[]; gap_questions: string[] };

export type Score = {
  dims: Record<string, number>;
  fixes: string[];
  total: number;
  framework: string;
};

export type InterviewState = {
  queue: { question: string; kind: string }[];
  asked: number;
  followups_used: number;
  current: { question: string; kind: string } | null;
};

export type Profile = {
  sessions: { id: number; created: string; n: number; avg_total: number }[];
  weaknesses: [string, number][];
};
