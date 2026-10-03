export const DIM_ORDER = ["structure", "specificity", "length", "filler", "business_impact"] as const;

export const DIM: Record<string, { label: string; tip: string }> = {
  structure: { label: "Structure", tip: "Open with a one-line headline, give three points, one example, then the result." },
  specificity: { label: "Specificity", tip: "Put a number in every answer and say “I” for what you personally did." },
  length: { label: "Concision", tip: "Land answers in about 150 words. If they run long, cut the context first." },
  filler: { label: "Clean delivery", tip: "Replace “basically”, “you know”, “kind of” with a pause." },
  business_impact: { label: "Business impact", tip: "End on revenue, cost or margin. Interviewers remember the number." },
};
