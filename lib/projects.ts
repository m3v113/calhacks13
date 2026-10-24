import { after } from "next/server";
import { db } from "./db";
import { PALETTE } from "./colors";
import { chatJSON, ollamaUp } from "./ollama";

export const SECTION_TYPES = ["writing", "tasks", "sources"] as const;
export type SectionType = (typeof SECTION_TYPES)[number];
export const KINDS = ["space", "auto"] as const;
export type Kind = (typeof KINDS)[number];
type Sec = { type: SectionType; title: string };
export type Suggestion = { title: string; kind: Kind; sections: Sec[]; by: "ai" | "template" };

const w = (title: string): Sec => ({ type: "writing", title });
const SOURCES: Sec = { type: "sources", title: "Sources" };

// Built-in shapes: used when the AI is off or its answer doesn't fit, and shown to the AI as examples.
const TEMPLATES: { name: string; kind: Kind; match: RegExp; sections: Sec[] }[] = [
  {
    name: "Research Paper", kind: "space", match: /\b(paper|essay|research|thesis|report|study|article|review|literature)\b/i,
    sections: [w("Outline"), w("Introduction"), w("Body"), w("Conclusion"), { type: "tasks", title: "To do" }, SOURCES],
  },
  {
    name: "Class", kind: "space", match: /\b(class|course|lecture|semester|cs ?\d+|exam|midterm|final)\b/i,
    sections: [{ type: "tasks", title: "Assignments" }, w("Lecture Notes"), w("Topics to Explore"), SOURCES],
  },
  {
    name: "Event", kind: "auto", match: /\b(party|birthday|wedding|event|trip|vacation|dinner|meetup|celebration|shower|reunion)\b/i,
    sections: [{ type: "tasks", title: "Steps" }, SOURCES, w("Details")],
  },
  {
    name: "Learning", kind: "space", match: /\b(learn|learning|practice|language|skill|study for)\b/i,
    sections: [{ type: "tasks", title: "Lessons" }, w("Notes"), w("Questions"), SOURCES],
  },
  {
    name: "Utility Task", kind: "auto", match: /\b(fix|repair|install|replace|broken|leak|clean|move|renovate|paint|buy)\b/i,
    sections: [{ type: "tasks", title: "Steps" }, SOURCES, w("Notes")],
  },
];

const cleanTitle = (t: string) => t.replace(/^["'\s]+|["'.\s]+$/g, "").replace(/\s+/g, " ").slice(0, 60);
const capitalize = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

function fromTemplate(goal: string): Suggestion {
  const t = TEMPLATES.find((x) => x.match.test(goal)) ?? TEMPLATES[4];
  return { title: capitalize(cleanTitle(goal)).slice(0, 40), kind: t.kind, sections: t.sections, by: "template" };
}

// Keeps known types, caps the count, and makes sure there's exactly one Sources section.
export function tidySections(list: { type: string; title: string }[]): Sec[] {
  const out: Sec[] = [];
  for (const s of list) {
    if (!(SECTION_TYPES as readonly string[]).includes(s.type)) continue;
    if (s.type === "sources" && out.some((x) => x.type === "sources")) continue;
    out.push({ type: s.type as SectionType, title: capitalize(cleanTitle(s.title)).slice(0, 40) || capitalize(s.type) });
  }
  const capped = out.slice(0, 10);
  if (!capped.some((s) => s.type === "sources")) capped.push(SOURCES);
  return capped;
}

type Answer = { title: string; kind: string; sections: { type: string; title: string }[] };
const isAnswer = (v: unknown): v is Answer =>
  typeof v === "object" && v !== null && typeof (v as Answer).title === "string" && Array.isArray((v as Answer).sections) &&
  (v as Answer).sections.every((s) => typeof s?.type === "string" && typeof s?.title === "string");

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    kind: { type: "string", enum: [...KINDS] },
    sections: { type: "array", items: { type: "object", properties: { type: { type: "string", enum: [...SECTION_TYPES] }, title: { type: "string" } }, required: ["type", "title"] } },
  },
  required: ["title", "kind", "sections"],
};

const SYSTEM = `You set up a personal project from one sentence.
title: 2 to 5 words, Title Case, no quotes (e.g. "Bedroom Ceiling Fan", "CS 147 Class").
kind:
- "auto" for a job to get done with clear steps: fix, install, replace, buy, move, plan a trip or party.
- "space" for ongoing work you do yourself: a paper, an essay, studying, a class's materials, a creative project.
sections: 3 to 8, each with a type and a short title (1 to 3 words) that fits this project. Types:
- writing: formatted text. Space projects use several, each named for a part of the work (a paper: "Outline", "Introduction", "Literature Review", "Methods", "Discussion"; a class: "Lecture Notes", "Topics to Explore").
- tasks: a checklist. Auto projects start with one called "Steps".
- sources: links, files, and notes for the project. Exactly one.
Only give structure: no facts or names that weren't in the sentence.
Examples:
${TEMPLATES.map((t) => `- ${t.name} (${t.kind}): ${t.sections.map((s) => `${s.type} "${s.title}"`).join(", ")}`).join("\n")}
Answer with JSON: {"title": "...", "kind": "space", "sections": [{"type": "writing", "title": "..."}]}`;

// Suggests a title, kind, and sections for a new project. Falls back to the closest template.
export async function suggest(goal: string): Promise<Suggestion> {
  if (!(await ollamaUp())) return fromTemplate(goal);
  try {
    const a = await chatJSON(SYSTEM, `Project: ${goal}`, SCHEMA, isAnswer);
    const sections = tidySections(a.sections);
    const title = cleanTitle(a.title);
    if (!title || sections.length < 2) return fromTemplate(goal);
    return { title, kind: a.kind === "auto" ? "auto" : "space", sections, by: "ai" };
  } catch (e) {
    console.warn("[project] AI failed, using a template:", (e as Error).message);
    return fromTemplate(goal);
  }
}

export async function nextProjectColor() {
  const used = new Set((await db.project.findMany({ select: { color: true } })).map((p) => p.color));
  return PALETTE.find((c) => !used.has(c)) ?? PALETTE[(await db.project.count()) % PALETTE.length];
}

// Projects whose steps the AI is writing (or is about to). Marked before the work starts,
// so a page that loads right after asking already sees it.
export const planning = new Set<string>();
const running = new Set<string>();
export function queuePlan(id: string, force = false) {
  planning.add(id);
  after(() => planSteps(id, force));
}

type Steps = { steps: { text: string; detail: string }[] };
const isSteps = (v: unknown): v is Steps =>
  Array.isArray((v as Steps)?.steps) && (v as Steps).steps.every((s) => typeof s?.text === "string" && typeof s?.detail === "string");
const STEPS_SCHEMA = {
  type: "object",
  properties: { steps: { type: "array", items: { type: "object", properties: { text: { type: "string" }, detail: { type: "string" } }, required: ["text", "detail"] } } },
  required: ["steps"],
};

// Auto projects: the AI proposes steps, which you approve or remove. They go in the first tasks section.
// Without force, it skips a project that already has tasks.
async function planSteps(id: string, force: boolean) {
  if (running.has(id)) return;
  running.add(id);
  try {
    const p = await db.project.findUnique({ where: { id }, include: { sections: { orderBy: { order: "asc" }, include: { _count: { select: { tasks: true } } } } } });
    if (!p || p.kind !== "auto" || !(await ollamaUp())) return;
    if (!force && p.sections.some((s) => s._count.tasks > 0)) return;
    const a = await chatJSON(
      `Break a personal project into 4 to 8 practical steps, in order. Each step has:
- text: what to do, under 10 words, starting with a verb
- detail: one or two sentences on how to do it and what to watch out for (safety first)
Include a step for getting help from a professional when that makes sense. Answer with JSON: {"steps": [{"text": "...", "detail": "..."}]}`,
      `Project: ${p.title}${p.goal ? `\nGoal: ${p.goal}` : ""}`, STEPS_SCHEMA, isSteps,
    );
    const section = p.sections.find((s) => s.type === "tasks")
      ?? await db.section.create({ data: { projectId: id, type: "tasks", title: "Steps", order: -1 } });
    const steps = a.steps.map((s) => ({ text: cleanTitle(s.text).slice(0, 200), detail: s.detail.replace(/\s+/g, " ").trim().slice(0, 600) })).filter((s) => s.text).slice(0, 10);
    await db.task.createMany({ data: steps.map((s, i) => ({ sectionId: section.id, text: s.text, detail: s.detail || null, proposed: true, order: 1000 + i })) });
  } catch (e) {
    console.warn("[project] couldn't plan steps:", (e as Error).message);
  } finally {
    running.delete(id);
    planning.delete(id);
  }
}

// Databases from the first version of projects: notes → writing, items → sources, and
// "help nearby" sections go away (Scouts replace them). Every project gets a Sources section.
let upgraded = false;
export async function upgradeSections() {
  if (upgraded) return;
  upgraded = true;
  await db.section.updateMany({ where: { type: "notes" }, data: { type: "writing" } });
  await db.section.updateMany({ where: { type: "items" }, data: { type: "sources" } });
  await db.section.deleteMany({ where: { type: "providers" } });
  const missing = await db.project.findMany({ where: { sections: { none: { type: "sources" } } }, select: { id: true } });
  for (const { id } of missing) {
    const last = await db.section.findFirst({ where: { projectId: id }, orderBy: { order: "desc" }, select: { order: true } });
    await db.section.create({ data: { projectId: id, type: "sources", title: "Sources", order: (last?.order ?? -1) + 1 } });
  }
}
