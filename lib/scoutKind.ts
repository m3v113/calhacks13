// Scout kinds, shared by the server and the page.
export const SCOUT_KINDS = ["find", "answer", "turn"] as const;
export type ScoutKind = (typeof SCOUT_KINDS)[number];

// A first guess at the kind from the brief's wording. You can change it before running.
export function guessKind(brief: string): ScoutKind {
  const b = brief.toLowerCase();
  if (/\b(turn|make|convert|cite|citations?|apa|mla|table|outline|summari[sz]e|organi[sz]e)\b/.test(b) && /\b(my|these|this|sources?|page|syllabus|course|into)\b/.test(b)) return "turn";
  if (/\b(find|best|buy|cheap|options|near|nearby|papers?|hire|electricians?|plumbers?|under \$?\d+)\b/.test(b)) return "find";
  return "answer";
}
