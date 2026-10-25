import { after } from "next/server";
import { db } from "./db";
import { PALETTE } from "./colors";
import { names } from "./names";
import { chatJSON, ollamaUp } from "./ollama";
import { search, searchReady, type Hit } from "./scouts";

export const SECTION_TYPES = ["writing", "tasks", "sources", "step"] as const;
export type SectionType = (typeof SECTION_TYPES)[number];
export const KINDS = ["space", "auto"] as const;
export type Kind = (typeof KINDS)[number];
type Sec = { type: SectionType; title: string };
export type Suggestion = { title: string; kind: Kind; sections: Sec[]; by: "ai" | "template" };

const w = (title: string): Sec => ({ type: "writing", title });
// The project's own Brain Dump: its links, files, and notes (type "sources").
const SOURCES: Sec = { type: "sources", title: names.inbox };

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
    out.push(s.type === "sources" ? SOURCES : { type: s.type as SectionType, title: capitalize(cleanTitle(s.title)).slice(0, 40) || capitalize(s.type) });
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
sections (always give them, whatever the kind): 3 to 8, each with a type and a short title (1 to 3 words) that fits this project. Types:
- writing: formatted text. Use several, each named for a part of the work (a paper: "Outline", "Introduction", "Literature Review", "Methods", "Discussion"; a class: "Lecture Notes", "Topics to Explore").
- tasks: a checklist ("To do", "Assignments").
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

// Auto projects the AI is building right now (or is about to). Marked before the work starts,
// so a page that loads right after asking already sees it. Kept on globalThis: in development each
// route can get its own copy of this file, and they must all see the same set.
const g = globalThis as unknown as { planning?: Set<string>; planRunning?: Set<string> };
export const planning = (g.planning ??= new Set<string>());
const running = (g.planRunning ??= new Set<string>());
export function queuePlan(id: string) {
  planning.add(id);
  after(() => planAuto(id));
}

// The AI picks each section's shape to fit what it holds: a short explanation, a list of points,
// key facts, or a checklist of things to do.
const FORMS = ["text", "points", "facts", "checklist"] as const;
type PlanSection = { title: string; form: string; text: string; items: string[] };
type Plan = { sections: PlanSection[] };
const isPlan = (v: unknown): v is Plan =>
  Array.isArray((v as Plan)?.sections) && (v as Plan).sections.every((s) =>
    typeof s?.title === "string" && typeof s?.form === "string" && typeof s?.text === "string" && Array.isArray(s?.items) && s.items.every((t) => typeof t === "string"));
const PLAN_SCHEMA = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, form: { type: "string", enum: [...FORMS] }, text: { type: "string" }, items: { type: "array", items: { type: "string" } } },
        required: ["title", "form", "text", "items"],
      },
    },
  },
  required: ["sections"],
};
const PLAN_SYSTEM = `You lay out a personal project so someone can understand it and get it done, without feeling overwhelmed.
Give 3 to 6 sections, in a sensible order. Pick each section's title and form to best fit what it holds:
- "text": a short explanation (text: 1 to 3 sentences; items: []). For what this is, how it works, or safety notes.
- "points": key things to know (items: 2 to 5 short points; text: "").
- "facts": specs, sizes, or numbers to look for (items: 2 to 5, each "Label: value"; text: "").
- "checklist": things to do or get (items: 2 to 6 short actions, each starting with a verb; text: "").
Use at most 2 checklists. Keep every item under 15 words, and plain.
Titles are 1 to 4 words and fit this project (e.g. "How it works", "What to buy", "Install", "If it wobbles").
Include a section for common problems and fixes. When hiring help makes sense, say who to call.
RESOURCES
Use the context you're given (pages, notes, saved items) when it helps, and don't invent facts like prices, names, or dates.
Answer with JSON: {"sections": [{"title": "...", "form": "text", "text": "...", "items": []}]}`;

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clean = (t: string) => t.replace(/^[-•*\d.)\s]+/, "").replace(/\s+/g, " ").trim();

// The small model sometimes writes Markdown (**bold**, "* " bullets) and long paragraphs. Bold becomes
// <strong>, bullets inside the text become list items, and the text keeps its first 4 sentences.
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
// Markdown links ([name](url), or [url](url)) and bare addresses become real links.
const linkify = (h: string) => h
  .replace(/\[([^\]]+)\]\s*\((https?:\/\/[^)\s]+)\)/g, (_, name: string, url: string) => `<a href="${url}">${/^https?:/.test(name) ? host(name) : name}</a>`)
  .replace(/(^|[\s(])(https?:\/\/[^\s<)\]]+[^\s<)\].,;])/g, (_, pre: string, url: string) => `${pre}<a href="${url}">${host(url)}</a>`);
const inline = (t: string) => linkify(esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*\*/g, ""));
function splitText(text: string) {
  const [intro, ...bullets] = text.split(/\s+\*\s+(?=\S)/);
  // Sentences end with . ! or ? and a space, so the dots in a web address don't count.
  const sentences = intro.split(/(?<=[.!?])\s+/);
  return { intro: sentences.slice(0, 4).join(" ").trim(), bullets: bullets.map(clean).filter(Boolean) };
}

// A planned section as one of ours: text, points, and facts are Writing (formatted); checklists are Tasks.
function toSection(s: PlanSection) {
  const raw = s.text.replace(/\s+/g, " ").trim().slice(0, 1500);
  const { intro, bullets } = splitText(raw);
  const items = [...bullets, ...s.items.map(clean)].filter(Boolean).slice(0, 8)
    .map((t) => t.replace(/^label:\s*/i, "").replace(/\*\*/g, "").slice(0, 300));
  const title = cleanTitle(s.title).slice(0, 40);
  if (s.form === "checklist" && items.length) return { title, type: "tasks", notes: null, tasks: items };
  const fact = (t: string) => { const m = t.match(/^([^:]{1,40}):\s+(.+)$/); return m ? `<strong>${esc(m[1])}:</strong> ${inline(m[2])}` : inline(t); };
  const list = items.length ? `<ul>${items.map((t) => `<li><p>${s.form === "facts" || bullets.length ? fact(t) : inline(t)}</p></li>`).join("")}</ul>` : "";
  const notes = `${intro ? `<p>${inline(intro)}</p>` : ""}${list}`;
  return notes ? { title, type: "writing", notes, tasks: [] } : null;
}

// Links the AI wrote can be made up. A link whose page doesn't load is turned back into plain text.
async function alive(url: string) {
  const u = url.replace(/&amp;/g, "&");
  try {
    if (/(^|\.)(youtube\.com|youtu\.be)$/.test(new URL(u).hostname)) {
      return (await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`, { signal: AbortSignal.timeout(6000) })).ok;
    }
    const r = await fetch(u, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(6000) });
    return r.status < 400 || r.status === 403; // 403: the site blocks apps, but the page is there
  } catch {
    return false;
  }
}
async function checkLinks(html: string) {
  const urls = [...new Set([...html.matchAll(/<a href="([^"]+)">/g)].map((m) => m[1]))].slice(0, 12);
  const dead = new Set((await Promise.all(urls.map(async (u) => ((await alive(u)) ? null : u)))).filter(Boolean));
  return dead.size ? html.replace(/<a href="([^"]+)">(.*?)<\/a>/g, (all, u: string, name: string) => (dead.has(u) ? name : all)) : html;
}

// Every Auto project gets a Resources section: real pages from one web search when Bright Data's
// SERP API is set up. That search also gives the AI fresh context to plan from.
async function resourcesFor(title: string, goal: string | null) {
  if (!searchReady()) return null;
  const hits = await search(`${goal ?? title} guide`.slice(0, 120));
  return Array.isArray(hits) && hits.length ? hits.slice(0, 6) : null;
}
const resourcesHtml = (hits: Hit[]) =>
  `<ul>${hits.map((h) => `<li><p><a href="${esc(h.link)}">${esc(h.title)}</a>${h.description ? ` · ${esc(h.description.slice(0, 160))}` : ""}</p></li>`).join("")}</ul>`;

// What the AI reads for an Auto project: the goal, the context you gave, and the project's sources (with their page text).
async function planContext(id: string) {
  const p = await db.project.findUnique({ where: { id }, include: { items: { where: { archived: false }, take: 12 } } });
  if (!p) return null;
  const items = await Promise.all(p.items.map(async (i) => {
    const page = i.url ? await db.pageCache.findUnique({ where: { url: i.url }, select: { text: true } }) : null;
    const body = page?.text ?? i.extracted ?? i.text;
    return `- ${i.title ?? i.fileName ?? i.url ?? "Note"}: ${(i.overview ?? "").slice(0, 300)}\n  ${body.replace(/\s+/g, " ").slice(0, 1200)}`;
  }));
  return [
    `Project: ${p.title}`,
    p.goal && `Goal: ${p.goal}`,
    p.context && `What I know or want:\n${p.context.slice(0, 2000)}`,
    items.length && `Saved for this project:\n${items.join("\n")}`,
  ].filter(Boolean).join("\n\n").slice(0, 9000);
}

// Auto projects: the AI writes the sections, each in the shape that fits it. You delete the ones you don't want.
async function planAuto(id: string) {
  if (running.has(id)) return;
  running.add(id);
  try {
    const p = await db.project.findUnique({ where: { id }, select: { kind: true, title: true, goal: true } });
    if (!p || p.kind !== "auto" || !(await ollamaUp())) return;
    const found = await resourcesFor(p.title, p.goal);
    // Give the project's links a moment to be read, so their text is there to use.
    for (let i = 0; i < 20 && (await db.item.count({ where: { projectId: id, sortedBy: "pending" } })); i++) await new Promise((r) => setTimeout(r, 1500));
    const context = await planContext(id);
    if (!context) return;
    const web = found ? `\n\nFrom a web search:\n${found.map((h) => `- ${h.title}: ${h.description}`).join("\n")}` : "";
    // With a web search, Resources comes from it. Without one, the AI suggests well-known sites (checked below).
    const system = PLAN_SYSTEM.replace("RESOURCES", found
      ? "Don't write a resources or links section: one is added from a web search."
      : `End with a "Resources" section (form "points") listing 2 to 4 well-known sites or guides, each "Name: https://...".`);
    const a = await chatJSON(system, context + web, PLAN_SCHEMA, isPlan, { timeoutMs: 240_000 });
    const sections = (a.sections.map(toSection).filter((s) => s && s.title && !(found && /^(resources?|links?)$/i.test(s.title))) as NonNullable<ReturnType<typeof toSection>>[]).slice(0, 7);
    for (const s of sections) if (s.notes) s.notes = await checkLinks(s.notes);
    if (found) sections.push({ title: "Resources", type: "writing", notes: resourcesHtml(found), tasks: [] });
    // The new sections go before Sources and anything you added.
    await db.section.updateMany({ where: { projectId: id }, data: { order: { increment: sections.length } } });
    for (const [order, s] of sections.entries()) {
      await db.section.create({
        data: {
          projectId: id, type: s.type, title: s.title, order, span: 1, notes: s.notes,
          tasks: { create: s.tasks.map((text, i) => ({ text, order: i })) },
        },
      });
    }
  } catch (e) {
    console.warn("[project] couldn't plan the project:", (e as Error).message);
  } finally {
    running.delete(id);
    planning.delete(id);
  }
}

// Databases from the first version of projects: notes → writing, items → sources, and
// "help nearby" sections go away (Scouts replace them). Every project gets a Sources section.
export async function upgradeSections() {
  const gu = globalThis as unknown as { upgraded?: boolean };
  if (gu.upgraded) return;
  gu.upgraded = true;
  await db.section.updateMany({ where: { type: "notes" }, data: { type: "writing" } });
  await db.section.updateMany({ where: { type: "items" }, data: { type: "sources" } });
  await db.section.deleteMany({ where: { type: "providers" } });
  // The Sources section is now called Brain Dump, like the inbox it belongs to.
  await db.section.updateMany({ where: { type: "sources", title: "Sources" }, data: { title: names.inbox } });
  // AI sections used to wait for you to keep them. Now they're just there.
  await db.section.updateMany({ where: { proposed: true }, data: { proposed: false } });
  await db.task.updateMany({ where: { proposed: true }, data: { proposed: false } });
  const missing = await db.project.findMany({ where: { sections: { none: { type: "sources" } } }, select: { id: true } });
  for (const { id } of missing) {
    const last = await db.section.findFirst({ where: { projectId: id }, orderBy: { order: "desc" }, select: { order: true } });
    await db.section.create({ data: { projectId: id, type: "sources", title: names.inbox, order: (last?.order ?? -1) + 1 } });
  }
}
