import { db } from "./db";
import { chatJSON, ollamaUp } from "./ollama";
import { readLink } from "./link";
import { names } from "./names";
import { splitList } from "./format";

// The AI section: ask about what's already in the project (make tasks, rewrite a paragraph,
// make citations, how does this sound). It runs on the local AI only, never the web.
export type Answer = { q: string; into: "answer" | "tasks" | "citations" | "rewrite"; title: string; reply: string; items: string[]; at: string };
const INTO = ["answer", "tasks", "citations", "rewrite"] as const;
const KEEP = 10;

export function readAsks(notes: string | null): Answer[] {
  try {
    const a = JSON.parse(notes ?? "");
    return Array.isArray(a?.asks) ? a.asks : [];
  } catch {
    return [];
  }
}

const SYSTEM = `You help someone with their personal project, using only what you're given: the project's writing, tasks, and ${names.projectDump} (saved links, notes, and files), plus any text or pages in the request.
into: what the request wants.
- "tasks": things to do for the project. items: 3 to 10 short tasks, each starting with a verb, most urgent first, with due dates when what you're given has them. reply: "".
- "citations": one full citation for each source, in the style asked for (APA if none). Put *asterisks* around the parts that should be italic. items: the citations, in alphabetical order. reply: "".
- "rewrite": the text rewritten the way they ask (formal, shorter, clearer). reply: the new text, with a blank line between paragraphs. items: [].
- "answer": anything else, like feedback on how something sounds, or a question about the project. reply: 2 to 5 plain sentences. items: [] or a few short points.
title: 1 to 4 words for the result.
Don't invent facts, authors, dates, or numbers. When a citation is missing a detail, leave it out, and use "n.d." when there's no date.
Answer with JSON: {"into": "answer", "title": "...", "reply": "...", "items": []}`;

const clip = (t: string, n: number) => t.replace(/\s+/g, " ").trim().slice(0, n);
const text = (html: string) => html.replace(/<\/(p|h\d|li)>/g, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/[ \t]+/g, " ").trim();

// What the AI reads: the project's writing and tasks, its Project Dump (with page text), and links pasted in the request.
async function context(projectId: string, q: string) {
  const p = await db.project.findUnique({
    where: { id: projectId },
    include: {
      sections: { orderBy: { order: "asc" }, include: { tasks: { orderBy: { order: "asc" } } } },
      items: { where: { archived: false }, take: 15, orderBy: { createdAt: "desc" } },
    },
  });
  if (!p) return null;
  const writing = p.sections.filter((s) => (s.type === "writing" || s.type === "overview") && s.notes?.trim()).map((s) => `## ${s.title}\n${text(s.notes!).slice(0, 2500)}`);
  const tasks = p.sections.filter((s) => s.type === "tasks" && s.tasks.length).map((s) => `## ${s.title}\n${s.tasks.map((t) => `- [${t.done ? "x" : " "}] ${t.text}`).join("\n")}`);
  const items = await Promise.all(p.items.map(async (i) => {
    const page = i.url ? await db.pageCache.findUnique({ where: { url: i.url }, select: { text: true, summary: true } }) : null;
    const name = i.title ?? i.fileName ?? i.url ?? "Note";
    return `- ${name}${i.url ? ` (${i.url})` : ""}${i.overview ? `: ${clip(i.overview, 300)}` : ""}\n  ${clip(page?.text || i.extracted || i.text, 1200)}`;
  }));
  const links = [...new Set(q.match(/https?:\/\/[^\s<>"']+/g) ?? [])].slice(0, 3);
  const pages = (await Promise.all(links.map(async (l) => {
    const page = await Promise.race([readLink(l).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 20000))]);
    return page?.ok ? `- ${page.title ?? l} (${l})\n  ${clip(page.text ?? "", 3000)}` : null;
  }))).filter(Boolean);
  return [
    `Project: ${[p.title, p.goal].filter(Boolean).join(": ")}`,
    writing.length && `Writing:\n${writing.join("\n\n")}`,
    tasks.length && `Tasks:\n${tasks.join("\n\n")}`,
    items.length && `${names.projectDump}:\n${items.join("\n")}`,
    pages.length && `Pages linked in the request:\n${pages.join("\n")}`,
  ].filter(Boolean).join("\n\n").slice(0, 14000);
}

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

// Asks the AI, and saves the answer at the top of the section's list.
export async function ask(sectionId: string, q: string): Promise<{ asks: Answer[] } | { error: string; status: number }> {
  const sec = await db.section.findUnique({ where: { id: sectionId }, select: { type: true, projectId: true, notes: true } });
  if (!sec || sec.type !== "assistant") return { error: "not found", status: 404 };
  if (!(await ollamaUp())) return { error: "The local AI isn't running. Start Ollama and ask again.", status: 503 };
  const ctx = await context(sec.projectId, q);
  if (!ctx) return { error: "not found", status: 404 };
  try {
    const a = await chatJSON(SYSTEM, `${ctx}\n\nRequest: ${q}`, {
      type: "object",
      properties: { into: { type: "string", enum: [...INTO] }, title: { type: "string" }, reply: { type: "string" }, items: { type: "array", items: { type: "string" } } },
      required: ["into", "title", "reply", "items"],
    }, (v): v is Pick<Answer, "into" | "title" | "reply" | "items"> => {
      const o = v as Record<string, unknown>;
      return (INTO as readonly unknown[]).includes(o?.into) && typeof o.title === "string" && typeof o.reply === "string" && isStrings(o.items);
    }, { timeoutMs: 240_000 });
    let reply = a.reply.trim();
    let items = a.items;
    // The small model sometimes writes the list in the reply ("1. Do this. 2. Do that."). Tasks and citations are lists, so split it.
    if ((a.into === "tasks" || a.into === "citations") && !items.length && reply) {
      items = a.into === "tasks" ? splitList(reply) : reply.split(/\n+/).filter((t) => t.trim());
      reply = "";
    }
    const answer: Answer = {
      q, into: a.into, title: clip(a.title, 40) || "Answer", reply: reply.slice(0, 6000),
      items: items.map((t) => clip(t, 600)).filter(Boolean).slice(0, 30), at: new Date().toISOString(),
    };
    if (!answer.reply && !answer.items.length) return { error: "The AI didn't answer. Try asking another way.", status: 502 };
    const asks = [answer, ...readAsks(sec.notes)].slice(0, KEEP);
    await db.section.update({ where: { id: sectionId }, data: { notes: JSON.stringify({ asks }) } });
    return { asks };
  } catch (e) {
    console.warn("[assistant] failed:", (e as Error).message);
    return { error: "Something went wrong. Ask again.", status: 500 };
  }
}
