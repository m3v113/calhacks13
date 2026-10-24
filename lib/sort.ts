import { db, categoryByName, ensureSeed } from "./db";
import { chatJSON, ollamaUp, visionModel } from "./ollama";
import { firstUrl, readLink } from "./link";
import { asBase64 } from "./files";

// A Wordle share is exact, so it never needs the AI.
const WORDLE = /wordle\s*([\d,]+)\s*([1-6x])\/6/i;

// Quick rules used when Ollama is off. The AI re-sorts these items later.
const RULES: [string, RegExp][] = [
  ["Wordle", /🟩|🟨/],
  ["Recipes", /recipe|ingredients?|\b(tbsp|tsp|cups?)\b|\bbake\b|allrecipes|nytcooking|seriouseats|bonappetit/i],
  ["Events", /\b(party|meetup|rsvp|concert|tickets?|festival|wedding|birthday|eventbrite|lu\.ma|partiful)\b|\b\d{1,2}(:\d\d)?\s?(am|pm)\b|\b(tonight|tomorrow)\b/i],
];

function byRules(text: string) {
  return RULES.find(([, re]) => re.test(text))?.[0] ?? "Other";
}

type Answer = { category: string; title: string };
const isAnswer = (v: unknown): v is Answer =>
  typeof v === "object" && v !== null &&
  typeof (v as Answer).category === "string" && (v as Answer).category.trim().length > 0 &&
  typeof (v as Answer).title === "string";

const SCHEMA = {
  type: "object",
  properties: { category: { type: "string" }, title: { type: "string" } },
  required: ["category", "title"],
};

const SYSTEM = `You sort items in a personal inbox into categories and give each a short title.
category: pick the single best category from the existing list when one fits.
If none fits, invent a new category: 1 or 2 words, Title Case, plural when natural (e.g. "Books", "Travel", "Home Repairs").
Use "Other" only when the item is meaningless. Wordle scores always go in "Wordle".
title: 2 to 6 words that say what the item is, in Title Case, no quotes or trailing punctuation (e.g. "Grandma's Banana Bread", "Maya's Birthday Party").
Answer with JSON: {"category": "...", "title": "..."}`;

const cleanTitle = (t: string) => t.replace(/^["'\s]+|["'.\s]+$/g, "").replace(/\s+/g, " ").slice(0, 80);

// Reads the link or file, then sorts the item and titles it with AI, falling back to rules.
export async function sortItem(id: string) {
  await ensureSeed();
  const item = await db.item.findUnique({ where: { id } });
  if (!item) return;
  const userSorted = item.sortedBy === "user";

  let { title, summary } = item;
  let pageTitle = false;
  const url = item.url ?? (item.kind === "note" || item.kind === "link" ? firstUrl(item.text) : null);
  if (url && !title) {
    const page = await readLink(url);
    if (page.title) { title = page.title; pageTitle = true; }
    summary = page.summary;
  }

  const content = [
    item.kind === "image" ? `Image file: ${item.fileName}` : item.kind === "document" ? `Document file: ${item.fileName}` : item.text,
    title && `Page title: ${title}`,
    summary && `Page summary: ${summary}`,
    item.extracted && `Document text:\n${item.extracted.slice(0, 3000)}`,
  ].filter(Boolean).join("\n");

  let name: string | null = null;
  let aiTitle: string | null = null;
  let sortedBy = "rules";
  const wordle = item.text.match(WORDLE);
  if (wordle) {
    name = "Wordle";
    aiTitle = `Wordle ${wordle[1]} · ${wordle[2].toUpperCase()}/6`;
    sortedBy = "sure";
  } else if (await ollamaUp()) {
    try {
      const existing = (await db.category.findMany({ orderBy: { createdAt: "asc" } })).map((c) => c.name);
      const user = `Existing categories: ${existing.join(", ")}\n\nItem:\n${content.slice(0, 4000)}`;
      const vision = item.kind === "image" && item.filePath ? await visionModel() : null;
      const opts = vision ? { model: vision, images: [await asBase64(item.filePath!)] } : {};
      const a = await chatJSON(SYSTEM, vision ? `${user}\n(The image is attached; look at it.)` : user, SCHEMA, isAnswer, opts);
      name = a.category;
      aiTitle = cleanTitle(a.title) || null;
      sortedBy = "ai";
    } catch (e) {
      console.warn("[sort] AI failed, using rules:", (e as Error).message);
    }
  }

  // A real page title wins over one the AI wrote.
  const finalTitle = pageTitle ? title : title ?? aiTitle ?? (item.kind === "image" || item.kind === "document" ? item.fileName : null);

  if (userSorted) {
    // You picked the category; only fill in the title.
    await db.item.update({ where: { id }, data: { url, title: finalTitle, summary } });
    return;
  }
  const category = (await categoryByName(name ?? byRules(content), sortedBy === "ai")) ?? (await categoryByName("Other", false));
  // Don't overwrite a choice you made while this was running.
  await db.item.updateMany({
    where: { id, sortedBy: { not: "user" } },
    data: { url, title: finalTitle, summary, categoryId: category!.id, sortedBy },
  });
}

let sweeping = false;
let lastSweep = 0;

// Once Ollama is back, re-sorts items that were sorted by rules (or got stuck) and titles untitled ones.
export async function sweep() {
  if (sweeping || Date.now() - lastSweep < 10_000) return;
  sweeping = true;
  lastSweep = Date.now();
  try {
    const up = await ollamaUp();
    const stuck = await db.item.findMany({
      where: {
        archived: false,
        OR: [
          { sortedBy: "pending", createdAt: { lt: new Date(Date.now() - 60_000) } },
          ...(up ? [{ sortedBy: "rules" }, { title: null }] : []),
        ],
      },
      take: 5,
      orderBy: { createdAt: "desc" },
    });
    for (const i of stuck) await sortItem(i.id);
  } finally {
    sweeping = false;
  }
}
