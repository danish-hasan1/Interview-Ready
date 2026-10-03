export const DIM_ORDER = ["structure", "specificity", "length", "filler", "business_impact"] as const;

export const DIM: Record<string, { label: string; short: string; tip: string }> = {
  structure: { label: "Structure", short: "Struct.", tip: "Open with a one-line headline, give three points, one example, then the result." },
  specificity: { label: "Specificity", short: "Specific", tip: "Put a number in every answer and say “I” for what you personally did." },
  length: { label: "Concision", short: "Concise", tip: "Land answers in about 150 words. If they run long, cut the context first." },
  filler: { label: "Clean delivery", short: "Delivery", tip: "Replace “basically”, “you know”, “kind of” with a pause." },
  business_impact: { label: "Business impact", short: "Impact", tip: "End on revenue, cost or margin. Interviewers remember the number." },
};

export const PUSHBACKS = [
  "I'm not following.",
  "What exactly did YOU do?",
  "Give me a number.",
  "That's operational. Answer strategically.",
  "How was that measured?",
  "What was the baseline?",
  "Land that in 30 seconds.",
  "What was the business impact?",
];
