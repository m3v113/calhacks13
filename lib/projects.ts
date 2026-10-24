import { db } from "./db";
import { PALETTE } from "./colors";
import { chatJSON, ollamaUp } from "./ollama";

export const SECTION_TYPES = ["tasks", "notes", "items", "providers"] as const;
export type SectionType = (typeof SECTION_TYPES)[number];
export type Suggestion = { title: string; sections: { type: SectionType; title: string }[]; by: "ai" | "template" };

// Built-in shapes: used when the AI is off or its answer doesn't fit, and shown to the AI as examples.
const TEMPLATES: { name: string; match: RegExp; sections: { type: SectionType; title: string }[] }[] = [
  {
    name: "Research Paper", match: /\b(paper|essay|research|thesis|report|study|article|review|literature)\b/i,
    sections: [{ type: "tasks", title: "To do" }, { type: "items", title: "Sources" }, { type: "notes", title: "Draft notes" }],
  },
  {
    name: "Event", match: /\b(party|birthday|wedding|event|trip|vacation|dinner|meetup|celebration|shower|reunion)\b/i,
    sections: [{ type: "tasks", title: "To do" }, { type: "notes", title: "Details" }, { type: "items", title: "Ideas and links" }, { type: "providers", title: "Vendors" }],
  },
  {
    name: "Learning", match: /\b(learn|learning|course|practice|class|language|skill|study for|exam)\b/i,
    sections: [{ type: "tasks", title: "Lessons" }, { type: "items", title: "Resources" }, { type: "notes", title: "Notes" }],
  },
  {
    name: "Utility Task", match: /\b(fix|repair|install|replace|broken|leak|clean|move|renovate|paint)\b/i,
    sections: [{ type: "tasks", title: "Steps" }, { type: "providers", title: "Help nearby" }, { type: "items", title: "Links" }, { type: "notes", title: "Notes" }],
  },
];

const cleanTitle = (t: string) => t.replace(/^["'\s]+|["'.\s]+$/g, "").replace(/\s+/g, " ").slice(0, 60);
const capitalize = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

function fromTemplate(goal: string): Suggestion {
  const t = TEMPLATES.find((x) => x.match.test(goal)) ?? TEMPLATES[3];
  return { title: capitalize(cleanTitle(goal)).slice(0, 40), sections: t.sections, by: "template" };
}

type Answer = { title: string; sections: { type: string; title: string }[] };
const isAnswer = (v: unknown): v is Answer =>
  typeof v === "object" && v !== null && typeof (v as Answer).title === "string" && Array.isArray((v as Answer).sections) &&
  (v as Answer).sections.every((s) => typeof s?.type === "string" && typeof s?.title === "string");

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    sections: { type: "array", items: { type: "object", properties: { type: { type: "string", enum: [...SECTION_TYPES] }, title: { type: "string" } }, required: ["type", "title"] } },
  },
  required: ["title", "sections"],
};

const SYSTEM = `You set up a personal project from one sentence. Give it a short title and 2 to 5 sections.
title: 2 to 5 words, Title Case, no quotes (e.g. "Bedroom Ceiling Fan", "Maya's Birthday").
Each section has a type and a short title (1 to 3 words). Types:
- tasks: a checklist of steps
- notes: free text
- items: links, files, and notes saved from the inbox (sources, ideas, references)
- providers: local businesses or people to hire (only when hiring help makes sense)
Use each type at most once, and start with tasks. Only give structure: no tasks, facts, or names that weren't in the sentence.
Examples:
${TEMPLATES.map((t) => `- ${t.name}: ${t.sections.map((s) => `${s.type} "${s.title}"`).join(", ")}`).join("\n")}
Answer with JSON: {"title": "...", "sections": [{"type": "tasks", "title": "..."}]}`;

// Suggests a title and sections for a new project. Falls back to the closest template.
export async function suggest(goal: string): Promise<Suggestion> {
  if (!(await ollamaUp())) return fromTemplate(goal);
  try {
    const a = await chatJSON(SYSTEM, `Project: ${goal}`, SCHEMA, isAnswer);
    const seen = new Set<string>();
    const sections = a.sections
      .filter((s) => (SECTION_TYPES as readonly string[]).includes(s.type) && !seen.has(s.type) && seen.add(s.type))
      .map((s) => ({ type: s.type as SectionType, title: capitalize(cleanTitle(s.title)).slice(0, 30) || s.type }))
      .slice(0, 5);
    const title = cleanTitle(a.title);
    if (!title || sections.length < 2) return fromTemplate(goal);
    return { title, sections, by: "ai" };
  } catch (e) {
    console.warn("[project] AI failed, using a template:", (e as Error).message);
    return fromTemplate(goal);
  }
}

export async function nextProjectColor() {
  const used = new Set((await db.project.findMany({ select: { color: true } })).map((p) => p.color));
  return PALETTE.find((c) => !used.has(c)) ?? PALETTE[(await db.project.count()) % PALETTE.length];
}

const SUMMARY_SCHEMA = { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] };
const isSummary = (v: unknown): v is { summary: string } => typeof (v as { summary?: unknown })?.summary === "string";

// A short summary of where the project stands: its goal, tasks, notes, and linked items.
export async function summarizeProject(id: string) {
  const p = await db.project.findUnique({
    where: { id },
    include: { sections: { include: { tasks: true } }, items: { where: { archived: false }, select: { title: true, text: true, fileName: true, overview: true }, take: 20 } },
  });
  if (!p || p.overviewBy === "user" || !(await ollamaUp())) return;
  const tasks = p.sections.flatMap((s) => s.tasks);
  const lines = [
    `Project: ${p.title}`,
    p.goal && `Goal: ${p.goal}`,
    tasks.length && `Tasks (${tasks.filter((t) => t.done).length} of ${tasks.length} done):\n${tasks.map((t) => `- [${t.done ? "x" : " "}] ${t.text}`).join("\n")}`,
    ...p.sections.filter((s) => s.type === "notes" && s.notes?.trim()).map((s) => `${s.title}:\n${s.notes!.slice(0, 1500)}`),
    p.items.length && `Saved items:\n${p.items.map((i) => `- ${i.title ?? i.fileName ?? i.text.slice(0, 80)}${i.overview ? `: ${i.overview.slice(0, 200)}` : ""}`).join("\n")}`,
  ].filter(Boolean).join("\n\n");
  try {
    const a = await chatJSON(
      `Write 1 to 3 plain sentences on what this project is and where it stands (what's done, what's next). Only use facts given. If there is little, write one short sentence. Answer with JSON: {"summary": "..."}`,
      lines.slice(0, 7000), SUMMARY_SCHEMA, isSummary,
    );
    const summary = a.summary.replace(/\s+/g, " ").trim().slice(0, 1000);
    if (summary) await db.project.updateMany({ where: { id, OR: [{ overviewBy: null }, { overviewBy: "ai" }] }, data: { overview: summary, overviewBy: "ai" } });
  } catch (e) {
    console.warn("[project] summary failed:", (e as Error).message);
  }
}
