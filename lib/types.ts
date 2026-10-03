export const OWNERSHIP = ["Owned", "Led", "Contributed", "Supported", "Exposure"] as const;

export type Claim = {
  text: string;
  type: "metric" | "title" | "action";
  numbers: string[];
  ownership: (typeof OWNERSHIP)[number];
  questions: string[];
  keywords: string[];
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

export type Finding = { severity: "high" | "med" | "low"; title: string; detail: string; fix: string; evidence: string[]; lesson: string | null };
export type BulletReview = { text: string; score: number; issues: string[] };
export type CvReviewData = {
  score: number; band: string; categories: Record<string, number>; findings: Finding[]; strengths: string[];
  bullets_to_fix: BulletReview[];
  stats: { lines: number; quantified: number; strong_verbs: number; weak_phrases: number; words: number; impact_terms: string[]; sections: Record<string, boolean> };
};
export type PlanItem = { lesson_id: string; reason: string; priority: number; title: string; minutes: number };
export type CvReview = { has_cv: false } | { has_cv: true; review: CvReviewData; plan: PlanItem[] };

export type DrillField = { key: string; label: string; hint: string; max_words?: number; min_words?: number; needs_number?: boolean; rows?: number };
export type Drill =
  | { type: "build"; title: string; prompt: string; fields: DrillField[]; joiners: Record<string, string> }
  | { type: "rewrite"; title: string; prompt: string; count: number }
  | { type: "quiz"; title: string; quiz: string };
export type Lesson = { id: string; title: string; skill: string; minutes: number; why: string; steps: { title: string; body: string }[]; weak: string; strong: string; drill: Drill };
export type QuizQ = { q: string; options: string[]; answer: number; why: string };
export type TrainingOverview = {
  has_cv: boolean; lessons: Lesson[]; quizzes: Record<string, QuizQ[]>; plan: PlanItem[];
  progress: Record<string, { attempts: number; best: number; last: number }>;
  rewrite_bullets: BulletReview[]; claim: string; metric: string;
};

export type Coach = { text: string; source: "library" | "model" } | null;
export type LibraryItem = { id: number; kind: string; question: string; text: string; approved: boolean };
