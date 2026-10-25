import { after } from "next/server";
import { db } from "./db";
import { chatJSON, ollamaUp } from "./ollama";
import { readLink } from "./link";
import { names } from "./names";
export { guessKind } from "./scoutKind";

export { SCOUT_KINDS, type ScoutKind } from "./scoutKind";

// Bright Data is paid, so each run is capped. Repeat searches come from the cache.
export const MAX_SEARCHES = 3;
export const MAX_PAGES = 6;
const SEARCH_DAYS = 7;

export type Page = { n: number; title: string; link: string };
export type FindResult = { kind: "find"; fields: string[]; options: { name: string; link: string; values: string[]; why: string }[]; pages: Page[]; skipped: number; queries: string[] };
export type AnswerResult = { kind: "answer"; points: { text: string; sources: number[] }[]; pages: Page[]; skipped: number; queries: string[]; local?: boolean };
export type TurnResult = { kind: "turn"; into: string; title: string; items: string[]; columns: string[]; rows: string[][]; pages: Page[]; skipped: number };
export type ScoutResult = FindResult | AnswerResult | TurnResult;

export const searchReady = () => !!(process.env.BRIGHTDATA_API_KEY && process.env.BRIGHTDATA_SERP_ZONE);
export type Hit = { title: string; link: string; description: string };

// One Google search through the Bright Data SERP API, as light JSON (title, link, description).
// `start` skips that many results, for the next page of the same search.
export async function search(query: string, start = 0): Promise<Hit[] | string> {
  const key = start ? `${query}#${start}` : query;
  const cached = await db.searchCache.findUnique({ where: { query: key } });
  if (cached && Date.now() - cached.fetchedAt.getTime() < SEARCH_DAYS * 86400_000) return JSON.parse(cached.results);
  // Bright Data is sometimes slow: a search that times out or hits a server error is tried once more.
  // When the answer isn't JSON, the second try asks for Bright Data's wrapped JSON instead.
  const first = await searchOnce(query, start, "light");
  const hits = typeof first === "string" && /too long|HTTP 5|wasn't JSON|empty/.test(first) ? await searchOnce(query, start, "wrapped") : first;
  if (Array.isArray(hits) && hits.length) {
    await db.searchCache.upsert({ where: { query: key }, create: { query: key, results: JSON.stringify(hits) }, update: { results: JSON.stringify(hits), fetchedAt: new Date() } });
  }
  return hits;
}

// When Bright Data sends Google's page instead of JSON, pull the results out of the page itself:
// each result is a link around an <h3> title.
function fromHtml(html: string): Hit[] {
  const hits: Hit[] = [];
  const strip = (t: string) => t.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
  for (const m of html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>((?:(?!<\/a>)[\s\S]){0,2000}?)<h3[^>]*>([\s\S]*?)<\/h3>/g)) {
    let link = m[1].replace(/&amp;/g, "&");
    if (link.startsWith("/url?")) link = new URLSearchParams(link.slice(5)).get("q") ?? "";
    const title = strip(m[3]);
    if (!/^https?:\/\//.test(link) || /(^|\.)google\./.test(new URL(link).hostname) || !title || hits.some((h) => h.link === link)) continue;
    hits.push({ title, link, description: "" });
  }
  return hits.slice(0, 10);
}

async function searchOnce(query: string, start: number, style: "light" | "wrapped"): Promise<Hit[] | string> {
  try {
    const r = await fetch("https://api.brightdata.com/request", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        zone: process.env.BRIGHTDATA_SERP_ZONE,
        ...(style === "light" ? { format: "raw", data_format: "parsed_light" } : { format: "json" }),
        // brd_json asks for parsed JSON too, in case the zone ignores data_format.
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en&gl=us${start ? `&start=${start}` : ""}&brd_json=1`,
      }),
      signal: AbortSignal.timeout(60000),
    });
    const body = await r.text();
    if (!r.ok) {
      console.warn(`[scout] search failed: HTTP ${r.status} ${r.headers.get("x-brd-error") ?? ""} ${body.slice(0, 300)}`);
      return `HTTP ${r.status}${r.status === 401 ? ", the API key was refused" : r.status === 403 || r.status === 400 ? `, ${(r.headers.get("x-brd-error") ?? body).slice(0, 120)}` : ""}`;
    }
    if (!body.trim()) {
      console.warn(`[scout] search gave back nothing: ${r.headers.get("x-brd-error") ?? ""}`);
      return `the answer was empty${r.headers.get("x-brd-error") ? `: ${r.headers.get("x-brd-error")!.slice(0, 100)}` : ""}`;
    }
    let j;
    let hits: Hit[];
    try {
      j = JSON.parse(body);
      // Some Bright Data replies wrap the results: { status_code, body: "<json>" }.
      if (typeof j?.body === "string") {
        const inner = j.body as string;
        try { j = JSON.parse(inner); } catch { j = { organic: fromHtml(inner) }; }
      }
      const organic: Record<string, unknown>[] = j?.organic ?? j?.results ?? [];
      hits = organic.map((o) => ({
        title: String(o.title ?? ""), link: String(o.link ?? o.url ?? ""), description: String(o.description ?? o.snippet ?? ""),
      })).filter((h) => /^https?:\/\//.test(h.link) && h.title).slice(0, 10);
    } catch {
      hits = /<html|<div/i.test(body) ? fromHtml(body) : [];
      if (!hits.length) {
        console.warn(`[scout] search gave back something that isn't JSON: ${body.slice(0, 300)}`);
        // The start of the answer usually says what went wrong (a Bright Data error message).
        return `the answer wasn't JSON: "${body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80)}"`;
      }
      console.log(`[scout] search gave back Google's page; read ${hits.length} results from it`);
    }
    console.log(`[scout] searched "${query}" with Bright Data: ${hits.length} results`);
    if (!hits.length) console.warn(`[scout] no results in: ${body.slice(0, 300)}`);
    return hits;
  } catch (e) {
    console.warn("[scout] search failed:", (e as Error).message);
    return (e as Error).name === "TimeoutError" ? "it took too long" : (e as Error).message.slice(0, 120);
  }
}

// Reads a page (direct first, Web Unlocker only if blocked; cached), giving up after a while.
async function readPage(link: string) {
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), 25000));
  try {
    const page = await Promise.race([readLink(link), timeout]);
    return page?.ok ? page : null;
  } catch {
    return null;
  }
}

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const strArr = { type: "array", items: { type: "string" } };

const QUERY_SYSTEM = `You turn a request into 1 to ${MAX_SEARCHES} Google searches that would find the best pages for it.
Each search is 3 to 8 words. Use the project only to add useful detail. Fewer is better: give 1 when one search is enough.
Answer with JSON: {"queries": ["..."]}`;

async function queries(brief: string, project: string) {
  if (!(await ollamaUp())) return [brief];
  try {
    const a = await chatJSON(QUERY_SYSTEM, `Project: ${project}\nRequest: ${brief}`,
      { type: "object", properties: { queries: strArr }, required: ["queries"] },
      (v): v is { queries: string[] } => isStrings((v as { queries: unknown })?.queries));
    const qs = [...new Set(a.queries.map((q) => q.replace(/\s+/g, " ").trim()).filter(Boolean))].slice(0, MAX_SEARCHES);
    return qs.length ? qs : [brief];
  } catch {
    return [brief];
  }
}

const FIND_SYSTEM = `You compare options for someone, using only the numbered pages you're given.
fields: 2 to 4 short column names that matter for this request (products: "Price", "Size", "Rating"; services: "Area", "Reviews"; papers: "Authors", "Year", "Journal").
options: up to 6 real options found in the pages. Each has:
- name: the product, business, or paper name
- page: the number of the page it came from
- values: the option's actual value for each field, in the same order, copied from the page: a price like "$199", a size like "220 x 220 mm", a rating like "4.5/5", a year like "2023". Use "" when the page doesn't give that exact value. Never put a description or opinion in a value.
- why: one short sentence on why it fits the request
Never invent options, prices, or numbers that aren't in the pages.
Answer with JSON: {"fields": ["..."], "options": [{"name": "...", "page": 1, "values": ["..."], "why": "..."}]}`;

const ANSWER_SYSTEM = `You answer a question for someone, using the numbered pages you're given.
Give 3 to 6 points. Each point is 1 or 2 plain sentences, and lists the numbers of the pages it came from.
Lead with the direct answer. Include safety warnings when they matter. If the pages don't answer it, say so in the first point.
Answer with JSON: {"points": [{"text": "...", "sources": [1]}]}`;

const LOCAL_ANSWER_SYSTEM = `You answer a question for someone from what you know. Give 3 to 5 points, each 1 or 2 plain sentences.
Lead with the direct answer. Include safety warnings when they matter. Say when they should check a source or ask a professional.
Answer with JSON: {"points": [{"text": "...", "sources": []}]}`;

const TURN_SYSTEM = `You reshape the numbered pages and notes you're given into what the person asks for.
into: one of "tasks" (things to do, with due dates in the text when the pages give them, most urgent first), "citations" (one full citation per source, in the style asked for, APA if none), "table" (a comparison), or "outline" (headings and points).
title: 1 to 4 words for the result.
items: the tasks, citations, or outline lines (for a table, []).
columns and rows: only for a table (each row has one value per column). Otherwise [].
Only use what's in the pages and notes. Don't invent dates, authors, or numbers.
Answer with JSON: {"into": "tasks", "title": "...", "items": ["..."], "columns": [], "rows": []}`;

const clip = (t: string, n: number) => t.replace(/\s+/g, " ").trim().slice(0, n);

// Runs a Scout: plan searches → search → read pages → pull out results. Status is saved at each step,
// so the page can show progress. Only ever started by pressing Run.
const gs = globalThis as unknown as { scoutRunning?: Set<string> };
const running = (gs.scoutRunning ??= new Set<string>());
export function queueScout(id: string) {
  after(() => runScout(id));
}

async function runScout(id: string) {
  if (running.has(id)) return;
  running.add(id);
  const status = (status: string, note: string | null = null) => db.scout.update({ where: { id }, data: { status, note } });
  try {
    const s = await db.scout.findUnique({
      where: { id },
      include: { project: { include: { items: { where: { archived: false }, take: 20, orderBy: { createdAt: "desc" } } } } },
    });
    if (!s) return;
    const project = [s.project.title, s.project.goal].filter(Boolean).join(": ");
    // Find and Answer also know what's in the project's Sources, so results fit what you've saved.
    const saved = s.project.items.slice(0, 8).map((i) => `- ${i.title ?? i.fileName ?? i.url ?? "Note"}${i.overview ? `: ${clip(i.overview, 200)}` : ""}`).join("\n");
    const known = saved ? `\nSaved in the project's Sources:\n${saved}` : "";
    const aiUp = await ollamaUp();
    if (!aiUp) { await status("failed", "The local AI isn't running. Start Ollama and run it again."); return; }
    let result: ScoutResult;

    if (s.kind === "turn") {
      await status("reading", `Reading your ${names.inbox}`);
      const links = [...new Set(s.brief.match(/https?:\/\/[^\s<>"']+/g) ?? [])].slice(0, MAX_PAGES);
      const pages: Page[] = [];
      const parts: string[] = [];
      let skipped = 0;
      for (const link of links) {
        const page = await readPage(link);
        if (!page) { skipped++; continue; }
        pages.push({ n: pages.length + 1, title: page.title ?? link, link });
        parts.push(`[${pages.length}] ${page.title ?? link} (${link})\n${page.summary ?? ""}\n${clip(page.text ?? "", 3000)}`);
      }
      for (const i of s.project.items.slice(0, 12)) {
        const page = i.url ? await db.pageCache.findUnique({ where: { url: i.url } }) : null;
        const name = i.title ?? i.fileName ?? i.url ?? "Note";
        pages.push({ n: pages.length + 1, title: name, link: i.url ?? "" });
        parts.push(`[${pages.length}] ${name}${i.url ? ` (${i.url})` : ""}\n${[page?.summary, i.overview].filter(Boolean).join(" ")}\n${clip(page?.text || i.extracted || i.text, 1500)}`);
      }
      if (!parts.length) { await status("failed", `Nothing to read. Add things to the ${names.inbox}, or paste links in the brief.`); return; }
      await status("thinking", "Putting it together");
      const a = await chatJSON(TURN_SYSTEM, `Request: ${s.brief}\n\nPages and notes:\n${parts.join("\n\n").slice(0, 14000)}`, {
        type: "object",
        properties: { into: { type: "string", enum: ["tasks", "citations", "table", "outline"] }, title: { type: "string" }, items: strArr, columns: strArr, rows: { type: "array", items: strArr } },
        required: ["into", "title", "items", "columns", "rows"],
      }, (v): v is { into: string; title: string; items: string[]; columns: string[]; rows: string[][] } => {
        const o = v as Record<string, unknown>;
        return typeof o?.into === "string" && typeof o.title === "string" && isStrings(o.items) && isStrings(o.columns) && Array.isArray(o.rows) && o.rows.every(isStrings);
      }, { timeoutMs: 240_000 });
      result = {
        kind: "turn", into: a.into, title: clip(a.title, 40) || "Result", items: a.items.map((t) => clip(t, 400)).filter(Boolean).slice(0, 30),
        columns: a.columns.map((c) => clip(c, 40)).slice(0, 6), rows: a.rows.slice(0, 20).map((r) => r.slice(0, 6).map((c) => clip(c, 120))), pages, skipped,
      };
    } else {
      if (!searchReady()) {
        if (s.kind === "find") { await status("failed", "Web search isn't set up. Add BRIGHTDATA_SERP_ZONE to .env."); return; }
        // Answer still works without the web, from the local AI alone (and says so).
        await status("thinking", "Writing it up");
        const a = await chatJSON(LOCAL_ANSWER_SYSTEM, `Project: ${project}${known}\nQuestion: ${s.brief}`, ANSWER_SCHEMA, isPoints, { timeoutMs: 240_000 });
        result = { kind: "answer", points: a.points.map((p) => ({ text: clip(p.text, 600), sources: [] })).slice(0, 6), pages: [], skipped: 0, queries: [], local: true };
      } else {
        await status("searching", "Searching");
        const qs = await queries(s.brief, project);
        const got = await Promise.all(qs.map(search));
        const lists = got.filter((l): l is Hit[] => Array.isArray(l));
        if (!lists.length) { await status("failed", `The search didn't work (${got.find((l) => typeof l === "string")}). Check the Bright Data settings, then run it again.`); return; }
        // Take the top results of each search in turn, without repeats.
        const hits: Hit[] = [];
        for (let i = 0; i < 10 && hits.length < MAX_PAGES; i++) {
          for (const l of lists) if (l[i] && !hits.some((h) => h.link === l[i].link) && hits.length < MAX_PAGES) hits.push(l[i]);
        }
        if (!hits.length) { await status("failed", "Nothing found. Try a broader brief."); return; }
        await status("reading", `Reading ${hits.length} pages`);
        const read = await Promise.all(hits.map((h) => readPage(h.link)));
        const skipped = read.filter((p) => !p).length;
        const pages: Page[] = hits.map((h, i) => ({ n: i + 1, title: read[i]?.title ?? h.title, link: h.link }));
        // A page that couldn't be read still counts with its search snippet.
        const text = hits.map((h, i) => `[${i + 1}] ${pages[i].title} (${h.link})\n${h.description}\n${clip(read[i]?.text ?? "", 2500)}`).join("\n\n");
        await status("thinking", s.kind === "find" ? "Picking the best" : "Writing it up");
        const user = `Project: ${project}${known}\nRequest: ${s.brief}\n\nPages:\n${text}`.slice(0, 16000);
        if (s.kind === "find") {
          const a = await chatJSON(FIND_SYSTEM, user, {
            type: "object",
            properties: {
              fields: strArr,
              options: { type: "array", items: { type: "object", properties: { name: { type: "string" }, page: { type: "integer" }, values: strArr, why: { type: "string" } }, required: ["name", "page", "values", "why"] } },
            },
            required: ["fields", "options"],
          }, (v): v is { fields: string[]; options: { name: string; page: number; values: string[]; why: string }[] } => {
            const o = v as { fields: unknown; options: unknown };
            return isStrings(o?.fields) && Array.isArray(o.options) && o.options.every((x) => typeof x?.name === "string" && typeof x?.page === "number" && isStrings(x?.values) && typeof x?.why === "string");
          }, { timeoutMs: 240_000 });
          // A value has to look like one: short, and with a number for fields that are numbers (price, size...).
          const numeric = (f: string) => /price|cost|size|rating|weight|year|dimension|speed|volume|capacity|distance|length|width|height|stars?/i.test(f);
          const fit = (f: string, v: string) => (v.length <= 30 && (!numeric(f) || /\d/.test(v)) ? v : "");
          const allFields = a.fields.map((f) => clip(f, 24)).filter(Boolean).slice(0, 4);
          let options = a.options.filter((o) => pages[o.page - 1] && clip(o.name, 120)).slice(0, 6).map((o) => ({
            name: clip(o.name, 120), link: pages[o.page - 1].link, values: allFields.map((f, i) => fit(f, clip(o.values[i] ?? "", 60))), why: clip(o.why, 300),
          }));
          // Fields that no option has a value for are dropped.
          const keep = allFields.map((_, i) => options.some((o) => o.values[i]));
          const fields = allFields.filter((_, i) => keep[i]);
          options = options.map((o) => ({ ...o, values: o.values.filter((_, i) => keep[i]) }));
          if (!options.length) { await status("failed", "Nothing that fits was found. Try a broader brief."); return; }
          result = { kind: "find", fields, options, pages, skipped, queries: qs };
        } else {
          const a = await chatJSON(ANSWER_SYSTEM, user, ANSWER_SCHEMA, isPoints, { timeoutMs: 240_000 });
          const points = a.points.map((p) => ({ text: clip(p.text, 600), sources: [...new Set(p.sources)].filter((n) => pages[n - 1]).slice(0, 4) })).filter((p) => p.text).slice(0, 6);
          if (!points.length) { await status("failed", "Couldn't write an answer. Try rewording it."); return; }
          result = { kind: "answer", points, pages, skipped, queries: qs };
        }
      }
    }
    await db.scout.update({ where: { id }, data: { status: "done", note: null, result: JSON.stringify(result) } });
    if (s.taskId) await db.task.updateMany({ where: { id: s.taskId }, data: { done: true } });
  } catch (e) {
    console.warn("[scout] run failed:", (e as Error).message);
    await status("failed", "Something went wrong. Run it again.").catch(() => {});
  } finally {
    running.delete(id);
  }
}

const ANSWER_SCHEMA = {
  type: "object",
  properties: { points: { type: "array", items: { type: "object", properties: { text: { type: "string" }, sources: { type: "array", items: { type: "integer" } } }, required: ["text", "sources"] } } },
  required: ["points"],
};
const isPoints = (v: unknown): v is { points: { text: string; sources: number[] }[] } =>
  Array.isArray((v as { points: unknown })?.points) &&
  (v as { points: { text: unknown; sources: unknown }[] }).points.every((p) => typeof p?.text === "string" && Array.isArray(p?.sources) && p.sources.every((n) => typeof n === "number"));

// A Scout as the page sees it.
export const view = (s: { id: string; kind: string; brief: string; status: string; note: string | null; result: string | null; taskId: string | null; updatedAt: Date }) => ({
  id: s.id, kind: s.kind, brief: s.brief, status: s.status, note: s.note, taskId: s.taskId, updatedAt: s.updatedAt,
  result: s.result ? (JSON.parse(s.result) as ScoutResult) : null,
});
