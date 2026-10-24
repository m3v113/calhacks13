import { db, categoryByName, ensureSeed } from "./db";
import { chatJSON, chatText, markBroken, ollamaUp, visionModel } from "./ollama";
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

type Answer = { category: string; title: string; summary: string };
const isAnswer = (v: unknown): v is Answer =>
  typeof v === "object" && v !== null &&
  typeof (v as Answer).category === "string" && (v as Answer).category.trim().length > 0 &&
  typeof (v as Answer).title === "string" && typeof (v as Answer).summary === "string";

const SCHEMA = {
  type: "object",
  properties: { category: { type: "string" }, title: { type: "string" }, summary: { type: "string" } },
  required: ["category", "title", "summary"],
};

const SYSTEM = `You organize items in a personal inbox. For each item, give a category, a short title, and a summary.
category: pick the single best category from the existing list when one fits. Check every existing category, including empty ones and ones the user made; their names and the items already in them show what belongs there.
If none fits, invent a new category: 1 or 2 words, Title Case, plural when natural (e.g. "Books", "Travel", "Home Repairs").
Use "Other" only when the item is meaningless. Wordle scores always go in "Wordle".
If the user moved similar items to a category, use that category.
title: 2 to 6 words that say what the item is, in Title Case, no quotes or trailing punctuation (e.g. "Grandma's Banana Bread", "Maya's Birthday Party").
summary: 1 to 3 plain sentences on what the item is and the key details (dates, amounts, steps, findings).
Only use facts that appear in the item. If there is little to go on, write one short sentence. Never invent details.
Answer with JSON: {"category": "...", "title": "...", "summary": "..."}`;

const VISION_PROMPT = `Describe this image in 2 to 4 sentences for someone who can't see it.
Say what kind of image it is (photo, screenshot, receipt, game, chart...). Copy any important visible text exactly.`;

const cleanTitle = (t: string) => t.replace(/^["'\s]+|["'.\s]+$/g, "").replace(/\s+/g, " ").slice(0, 80);
const cleanSummary = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, 1200) || null;

// Every category, including ones you made, with a few of the items already in it, so the AI knows what each one holds.
async function existingCategories(exceptId: string) {
  const cats = await db.category.findMany({
    orderBy: { createdAt: "asc" },
    select: { name: true, items: { where: { archived: false, NOT: { id: exceptId } }, orderBy: { updatedAt: "desc" }, take: 4, select: { title: true, text: true, fileName: true } } },
  });
  const lines = cats.map((c) => {
    const examples = c.items.map((i) => `"${(i.title ?? i.fileName ?? i.text).replace(/\s+/g, " ").slice(0, 60)}"`);
    return `- ${c.name}${examples.length ? `: ${examples.join(", ")}` : " (empty)"}`;
  });
  return `Existing categories, with items already in them:\n${lines.join("\n")}\n`;
}

// Items you moved to a category yourself, most recent first, so the AI puts similar items in the same place.
async function yourMoves(exceptId: string) {
  const moved = await db.item.findMany({
    where: { sortedBy: "user", archived: false, NOT: [{ id: exceptId }, { categoryId: null }] },
    orderBy: { updatedAt: "desc" }, take: 30,
    select: { title: true, text: true, fileName: true, category: { select: { name: true } } },
  });
  if (!moved.length) return "";
  const lines = moved.map((m) => `- "${(m.title ?? m.fileName ?? m.text).replace(/\s+/g, " ").slice(0, 80)}" → ${m.category!.name}`);
  return `\nThe user moved these items to these categories. Put similar items in the same category:\n${lines.join("\n")}\n`;
}

// Reads the link or file, then sorts, titles, and summarizes the item with AI, falling back to rules.
// The category is only chosen once (by AI, or by you); later runs just fill in the title and summary.
export async function sortItem(id: string) {
  await ensureSeed();
  const item = await db.item.findUnique({ where: { id } });
  if (!item) return;
  const chooseCategory = item.sortedBy === "pending" || item.sortedBy === "rules";
  const keepSummary = item.overviewBy === "user";

  let { summary } = item;
  // Notes keep a title once they have one. Links only ever use their page's own title (cached),
  // and files are re-titled each time (e.g. once a vision model can see the image).
  let title = item.kind === "note" || item.titleBy === "user" ? item.title : null;
  let pageTitle = false;
  let pageText: string | null = null;
  const url = item.url ?? (item.kind === "note" || item.kind === "link" ? firstUrl(item.text) : null);
  if (url && (!title || !item.overview)) {
    const page = await readLink(url);
    if (page.title && !title) { title = page.title; pageTitle = true; }
    else if (page.title) pageTitle = item.kind === "link";
    summary = page.summary;
    pageText = page.text || null;
  }
  const unreadLink = item.kind === "link" && !pageTitle;

  let name: string | null = null;
  let aiTitle: string | null = null;
  let aiSummary: string | null = null;
  let sortedBy = chooseCategory ? "rules" : item.sortedBy;
  let seen = false; // an image was actually looked at

  const wordle = item.text.match(WORDLE);
  if (wordle) {
    name = "Wordle";
    aiTitle = `Wordle ${wordle[1]} · ${wordle[2].toUpperCase()}/6`;
    aiSummary = wordle[2].toUpperCase() === "X" ? "Not solved this time." : `Solved in ${wordle[2]} of 6 guesses.`;
    sortedBy = "sure";
  } else if (await ollamaUp()) {
    try {
      // Images: a vision model describes the picture first, then the usual model works from that description.
      let description: string | null = null;
      if (item.kind === "image" && item.filePath) {
        const image = await asBase64(item.filePath);
        // Try each image model in turn; one that can't load on this Ollama is skipped from now on.
        for (let vision = await visionModel(); vision && !seen; vision = await visionModel()) {
          try {
            description = await chatText(vision, VISION_PROMPT, [image]);
            seen = true;
          } catch (e) {
            const msg = (e as Error).message;
            console.warn(`[sort] image model ${vision} failed:`, msg);
            if (!/architecture|not supported|unsupported|error loading model|does not support/i.test(msg)) throw e;
            markBroken(vision);
          }
        }
      }
      const content = [
        item.kind === "image" ? `Image file: ${item.fileName}` : item.kind === "document" ? `Document file: ${item.fileName}` : item.text,
        description && `What the image shows: ${description}`,
        title && `Page title: ${title}`,
        summary && `Page description: ${summary}`,
        pageText && `Page text:\n${pageText.slice(0, 6000)}`,
        item.extracted && `Document text:\n${item.extracted.slice(0, 6000)}`,
      ].filter(Boolean).join("\n");
      const a = await chatJSON(SYSTEM, `${await existingCategories(id)}\n${await yourMoves(id)}\nItem:\n${content.slice(0, 14000)}`, SCHEMA, isAnswer);
      // Without a vision model, an image is only known by its file name: sort it, but don't title or summarize it yet.
      const blind = item.kind === "image" && !seen;
      name = a.category;
      aiTitle = blind ? null : cleanTitle(a.title) || null;
      aiSummary = blind || unreadLink ? null : cleanSummary(a.summary);
      if (chooseCategory) sortedBy = blind ? "rules" : "ai";
    } catch (e) {
      console.warn(`[sort] AI failed for "${item.fileName ?? item.text.slice(0, 40)}", using rules:`, (e as Error).message);
    }
  }

  // A real page title wins over one the AI wrote. A link whose page couldn't be read gets no AI title
  // or summary: the AI would only be guessing from the URL. It's retried later, and the URL shows meanwhile.
  const finalTitle = pageTitle ? title : title ?? (unreadLink ? null : aiTitle) ?? (item.kind === "image" || item.kind === "document" ? item.fileName : null);
  const data: Record<string, unknown> = { url, summary };
  if (item.titleBy !== "user") data.title = finalTitle;
  if (!keepSummary && aiSummary) Object.assign(data, { overview: aiSummary, overviewBy: "ai" });

  if (chooseCategory) {
    const fallback = item.kind === "image" ? "Other" : byRules([item.text, title, summary].filter(Boolean).join("\n"));
    const category = (await categoryByName(name ?? fallback, sortedBy === "ai")) ?? (await categoryByName("Other", false));
    Object.assign(data, { categoryId: category!.id, sortedBy });
  }
  // Don't overwrite a category or summary you set while this was running.
  await db.item.updateMany({
    where: { id, ...(chooseCategory ? { sortedBy: { not: "user" } } : {}), ...(data.overview ? { OR: [{ overviewBy: null }, { overviewBy: "ai" }] } : {}) },
    data,
  });
}

let sweeping = false;
let lastSweep = 0;
let linksChecked = false;

// Older versions let the AI guess titles for links it couldn't read. Clear those once, so they get a real one.
async function clearGuessedLinkTitles() {
  linksChecked = true;
  // Forget failed page reads too, so the new readers (like Crossref) get a chance right away.
  // (Pages already tried with Bright Data keep their row, so its try count isn't reset.)
  await db.pageCache.deleteMany({ where: { title: null, unlockTries: 0 } });
  await db.item.updateMany({ where: { kind: "link", title: null }, data: { updatedAt: new Date(0) } });
  const links = await db.item.findMany({ where: { kind: "link", NOT: { title: null } }, select: { id: true, url: true, title: true } });
  for (const l of links) {
    const page = l.url ? await db.pageCache.findUnique({ where: { url: l.url } }) : null;
    if (page?.title !== l.title) await db.item.update({ where: { id: l.id }, data: { title: null, updatedAt: new Date(0) } });
  }
}

// Once Ollama is back, re-sorts items that were sorted by rules (or got stuck) and titles untitled ones.
export async function sweep() {
  if (sweeping || Date.now() - lastSweep < 10_000) return;
  sweeping = true;
  lastSweep = Date.now();
  try {
    if (!linksChecked) await clearGuessedLinkTitles();
    const up = await ollamaUp();
    // Images sorted by name only wait for a vision model.
    const canSee = up && (await visionModel()) !== null;
    const stuck = await db.item.findMany({
      where: {
        archived: false,
        OR: [
          { sortedBy: "pending", createdAt: { lt: new Date(Date.now() - 60_000) } },
          ...(up ? [
            { sortedBy: "rules", updatedAt: { lt: new Date(Date.now() - 60_000) }, ...(canSee ? {} : { kind: { not: "image" } }) },
            // Missing title or summary: try again every couple of minutes, not on every refresh.
            { OR: [{ title: null }, { overview: null }], kind: { in: canSee ? ["note", "document", "image"] : ["note", "document"] }, updatedAt: { lt: new Date(Date.now() - 120_000) } },
            { overview: null, kind: "link", NOT: { title: null }, updatedAt: { lt: new Date(Date.now() - 120_000) } },
          ] : []),
          // A link whose page couldn't be read is tried again after an hour.
          { title: null, kind: "link", updatedAt: { lt: new Date(Date.now() - 3600_000) } },
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
