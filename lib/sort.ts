import { db, categoryByName, ensureSeed } from "./db";
import { chatJSON, ollamaUp } from "./ollama";
import { firstUrl, readLink } from "./link";

// Quick rules used when Ollama is off. The AI re-sorts these items later.
const WORDLE = /wordle\s*[\d,]+\s*[1-6x]\/6/i;
const RULES: [string, RegExp][] = [
  ["Wordle", /🟩|🟨/],
  ["Recipes", /recipe|ingredients?|\b(tbsp|tsp|cups?)\b|\bbake\b|allrecipes|nytcooking|seriouseats|bonappetit/i],
  ["Events", /\b(party|meetup|rsvp|concert|tickets?|festival|wedding|birthday|eventbrite|lu\.ma|partiful)\b|\b\d{1,2}(:\d\d)?\s?(am|pm)\b|\b(tonight|tomorrow)\b/i],
];

function byRules(text: string) {
  return RULES.find(([, re]) => re.test(text))?.[0] ?? "Other";
}

type Answer = { category: string };
const isAnswer = (v: unknown): v is Answer =>
  typeof v === "object" && v !== null && typeof (v as Answer).category === "string" && (v as Answer).category.trim().length > 0;

const SCHEMA = {
  type: "object",
  properties: { category: { type: "string" } },
  required: ["category"],
};

const SYSTEM = `You sort items in a personal inbox into categories.
Pick the single best category from the existing list when one fits.
If none fits, invent a new category: 1 or 2 words, Title Case, plural when natural (e.g. "Books", "Travel", "Home Repairs").
Use "Other" only when the item is meaningless.
Wordle scores always go in "Wordle". Answer with JSON: {"category": "..."}`;

async function byAI(content: string, existing: string[]) {
  const user = `Existing categories: ${existing.join(", ")}\n\nItem:\n${content.slice(0, 2000)}`;
  const a = await chatJSON(SYSTEM, user, SCHEMA, isAnswer);
  return a.category;
}

// Reads the link (if any), then sorts the item with AI, falling back to rules.
export async function sortItem(id: string) {
  await ensureSeed();
  const item = await db.item.findUnique({ where: { id } });
  if (!item || item.sortedBy === "user") return;

  let { title, summary } = item;
  const url = item.url ?? firstUrl(item.text);
  if (url && !title) {
    const page = await readLink(url);
    title = page.title;
    summary = page.summary;
  }
  const content = [item.text, title && `Page title: ${title}`, summary && `Page summary: ${summary}`].filter(Boolean).join("\n");

  let name: string | null = null;
  let sortedBy = "rules";
  if (WORDLE.test(content)) {
    // A Wordle score is always Wordle; no need to ask the AI.
    name = "Wordle";
    sortedBy = "sure";
  } else if (await ollamaUp()) {
    try {
      const existing = (await db.category.findMany({ orderBy: { createdAt: "asc" } })).map((c) => c.name);
      name = await byAI(content, existing);
      sortedBy = "ai";
    } catch (e) {
      console.warn("[sort] AI failed, using rules:", (e as Error).message);
    }
  }
  const category = (await categoryByName(name ?? byRules(content), sortedBy === "ai")) ?? (await categoryByName("Other", false));

  // Don't overwrite a choice you made while this was running.
  await db.item.updateMany({
    where: { id, sortedBy: { not: "user" } },
    data: { url, title, summary, categoryId: category!.id, sortedBy },
  });
}

let sweeping = false;
let lastSweep = 0;

// Re-sorts items that were sorted by rules (or got stuck) once Ollama is back.
export async function sweep() {
  if (sweeping || Date.now() - lastSweep < 10_000) return;
  sweeping = true;
  lastSweep = Date.now();
  try {
    const stuck = await db.item.findMany({
      where: { archived: false, OR: [{ sortedBy: "pending", createdAt: { lt: new Date(Date.now() - 60_000) } }, { sortedBy: "rules" }] },
      take: 5,
      orderBy: { createdAt: "desc" },
    });
    const up = await ollamaUp();
    for (const i of stuck) {
      if (i.sortedBy === "rules" && !up) continue;
      await sortItem(i.id);
    }
  } finally {
    sweeping = false;
  }
}
