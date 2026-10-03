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

export type RefStat = { attempts: number; last: number; best: number; last_at?: string };
export type Due = { ref: string; state: "shaky" | "solid"; last: number; attempts: number; overdue_days: number };
export type Profile = {
  sessions: { id: number; created: string; n: number; avg_total: number; dims: Record<string, number> }[];
  weaknesses: [string, number][];
  dims: Record<string, number>;
  answers: number;
  refs: Record<string, RefStat>;
  due?: Due[];
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
export type CvReview = { has_cv: false } | { has_cv: true; review: CvReviewData; plan: PlanItem[]; versions: CvVersion[] };

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
  rewrite_bullets: BulletReview[]; claim: string; metric: string; resources: Resource[];
};

export type Coach = { text: string; source: "library" | "model" } | null;
export type LibraryItem = { id: number; kind: string; question: string; text: string; approved: boolean };

export type Resource = { title: string; author: string; format: string; level: string; skills: string[]; why: string; matched: string[] };
export type Persona = { id: string; label: string; blurb: string };

export type Theme = { id: string; label: string; core: boolean; prompt: string; cues: string[] };
export type StoryField = { key: string; label: string; hint: string; joiner: string };
export type Story = { id: number; theme: string; title: string; fields: Record<string, string>; composed: string; score: number };
export type StoriesData = { themes: { themes: Theme[]; fields: StoryField[] }; stories: Story[]; coverage: { core_total: number; core_ready: number; missing_core: string[] } };
export type StoryCheck = { fields: { key: string; ok: boolean; msg: string }[]; composed: string; score: number; dims: Record<string, number>; fixes: string[]; framework: string; ready: boolean };

export type DebriefQ = { question: string; struggled: boolean; notes?: string };
export type Debrief = { id: number; company: string; role: string; interview_date: string | null; outcome: "pending" | "offer" | "rejected" | "withdrawn"; notes: string; questions: DebriefQ[]; created: string };
export type DebriefsData = { items: Debrief[]; stats: { interviews: number; offers: number; decided: number } };

export type BriefData = {
  has_cv: boolean;
  role_fit: { covered: number; total: number; percent: number | null };
  claims_to_defend: { text: string; numbers: string[]; state: "untested" | "shaky" | "solid"; ownership: string }[];
  gaps: { requirement: string; status: string }[];
  likely_questions: { question: string; about: string; state: string }[];
  ask_them: string[];
  pitch: { structure: string[]; draft: string };
  focus: { weakest: [string, number][]; due_now: number };
};

export type AiStatus = { configured: boolean; enabled: boolean; consent: boolean; features: Record<string, boolean>; used_today: number; cap: number | null; provider: string; model: string };
export type AiRewrite = { original: string; rewrite: string; why: string; before: number; after: number; needs_figure: boolean };
export type AiReview = { seniority: string; summary: string; risks: string[]; rewrites: AiRewrite[]; hard_questions: string[]; missing_evidence: string[]; redacted: Record<string, number>; dropped: number };
export type CvVersion = { id: number; name: string; created: string; score: number };

export type Target = {
  id: number; kind: "general" | "interview"; company: string; role: string; stage: string; interview_date: string;
  jd_text: string; interviewer_notes: string; research: Record<string, string>; days_left: number | null;
  readiness?: { score: number; label: string };
};
export type TargetsData = {
  targets: Target[]; active_id: number; stages: Record<string, { label: string; core: string[]; persona: string }>;
  research_fields: { key: string; label: string; hint: string }[];
};
export type Criterion = { id: string; label: string; weight: number; value: number; detail: string; page: string; action: string };
export type PlanTask = { id: string; title: string; minutes: number; page: string; priority: number; detail: string; day: number | null; due: string | null; done: boolean };
export type TodayData = {
  target: Target; has_cv: boolean;
  readiness: { score: number; label: string; cap_note: string; criteria: Criterion[]; blockers: Criterion[]; days_left: number | null; due_count: number };
  plan: { tasks: PlanTask[]; horizon: number; triage: boolean; later_count: number };
};
export type CoreQ = { id: string; label: string; question: string; words: number[]; guidance: string[]; prepared: { text: string; score: number } | null };
export type CoreData = { target: Target; stage_label: string; questions: CoreQ[] };
export type CoreCheck = { score: number; checks: { ok: boolean; weight: number; msg: string }[]; ready: boolean; words: number; fixes: string[] };
export type Attempt = { id: number; question: string; kind: string; answer: string; dims: Record<string, number>; total: number; created: string };
