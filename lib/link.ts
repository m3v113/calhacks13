import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { db } from "./db";

export function firstUrl(text: string) {
  return text.match(/https?:\/\/[^\s<>"']+/i)?.[0].replace(/[.,;)]+$/, "") ?? null;
}

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/\s+/g, " ").trim();

function meta(html: string, key: string) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decode(content) : null;
}

// The page's preview picture, as a full https address.
function picture(html: string, base: string) {
  const src = meta(html, "og:image") ?? meta(html, "twitter:image");
  if (!src) return null;
  try {
    const u = new URL(src, base);
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

// Sites whose pages hide the title from simple fetches but offer it through oEmbed.
const OEMBED: [RegExp, string][] = [
  [/(^|\.)(youtube\.com|youtu\.be)$/, "https://www.youtube.com/oembed?format=json&url="],
  [/(^|\.)vimeo\.com$/, "https://vimeo.com/api/oembed.json?url="],
  [/(^|\.)tiktok\.com$/, "https://www.tiktok.com/oembed?url="], // the title is the video's caption
];

async function oembed(url: string) {
  let host = "";
  try { host = new URL(url).hostname; } catch { return null; }
  const base = OEMBED.find(([re]) => re.test(host))?.[1];
  if (!base) return null;
  try {
    const r = await fetch(base + encodeURIComponent(url), { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j.title === "string"
      ? { title: j.title as string, summary: j.author_name ? `Video by ${j.author_name}` : null, text: null, image: typeof j.thumbnail_url === "string" ? j.thumbnail_url as string : null, via: "oembed" }
      : null;
  } catch {
    return null;
  }
}

// Research papers: publisher pages (ScienceDirect and others) often block simple fetches,
// so look the paper up by its DOI or ScienceDirect PII in Crossref's free API instead.
async function paper(url: string) {
  const doi = decodeURIComponent(url).match(/\b10\.\d{4,9}\/[^\s?#&]+/)?.[0];
  const pii = url.match(/sciencedirect\.com\/science\/article\/(?:abs\/)?pii\/(S?[\dX]+)/i)?.[1];
  if (!doi && !pii) return null;
  const api = doi
    ? `https://api.crossref.org/works/${encodeURIComponent(doi)}`
    : `https://api.crossref.org/works?rows=1&filter=alternative-id:${pii}`;
  try {
    const r = await fetch(api, { headers: { "user-agent": "ProjectScaffold/0.1" }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const m = (await r.json()).message;
    const work = doi ? m : m?.items?.[0];
    const title = work?.title?.[0];
    if (typeof title !== "string") return null;
    const journal = work["container-title"]?.[0];
    const year = work.issued?.["date-parts"]?.[0]?.[0];
    // Many papers include their abstract (with JATS markup); it's the best text to summarize from.
    const abstract = typeof work.abstract === "string" ? decode(work.abstract.replace(/<[^>]+>/g, " ")) : null;
    return { title: decode(title.replace(/<[^>]+>/g, "")), summary: [journal, year].filter(Boolean).join(", ") || null, text: abstract, image: null, via: "crossref" };
  } catch {
    return null;
  }
}

// The readable text of an article page (menus, ads, and footers removed), done locally.
function readable(html: string) {
  try {
    const { document } = parseHTML(html);
    const article = new Readability(document as unknown as Document).parse()?.content ?? "";
    // Keep paragraph breaks: end each block with a new line before dropping the tags.
    const text = article.replace(/<\/(p|h[1-6]|li|div|blockquote|pre|tr)>|<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    return text.split("\n").map((l) => decode(l)).filter(Boolean).join("\n").slice(0, 20_000) || null;
  } catch {
    return null;
  }
}

const BROWSER = {
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};

// Fetches a page's HTML ourselves. Some sites (like allrecipes) turn away requests that don't look like a
// browser, and their pages are big and slow, so ask like a browser and allow time to download it all.
async function direct(url: string) {
  try {
    const r = await fetch(url, { headers: BROWSER, redirect: "follow", signal: AbortSignal.timeout(12000) });
    if (!r.ok) console.warn(`[link] couldn't read ${url}: HTTP ${r.status}`);
    if (r.ok && (r.headers.get("content-type") ?? "").includes("html")) return (await r.text()).slice(0, 1_500_000);
  } catch (e) {
    console.warn(`[link] couldn't read ${url}:`, (e as Error).message);
  }
  return null;
}

// Optional backup for sites that block us (HTTP 403 and the like): Bright Data's Web Unlocker fetches the
// page the way a real browser would. Only used when BRIGHTDATA_API_KEY is set, and only after a direct read fails.
async function unlocked(url: string) {
  const key = process.env.BRIGHTDATA_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch("https://api.brightdata.com/request", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ zone: process.env.BRIGHTDATA_ZONE || "web_unlocker1", url, format: "raw" }),
      signal: AbortSignal.timeout(45000),
    });
    const body = await r.text();
    if (r.ok && /<html|<head|<title/i.test(body.slice(0, 20000))) return body.slice(0, 1_500_000);
    console.warn(`[link] Bright Data couldn't read ${url}: HTTP ${r.status} ${body.slice(0, 200)}`);
  } catch (e) {
    console.warn(`[link] Bright Data couldn't read ${url}:`, (e as Error).message);
  }
  return null;
}

// Bright Data is paid, so each page gets at most this many tries with it, ever.
const UNLOCK_TRIES = 2;
const reading = new Map<string, ReturnType<typeof read>>();

// Reads a page's title, description, and text once, then serves it from the cache: a page that was read
// is never fetched again. Reads that failed are retried after an hour (e.g. when you were offline).
export function readLink(url: string) {
  // Two sorts asking for the same page at once share one read.
  let r = reading.get(url);
  if (!r) {
    r = read(url).finally(() => reading.delete(url));
    reading.set(url, r);
  }
  return r;
}

async function read(url: string) {
  const cached = await db.pageCache.findUnique({ where: { url } });
  // Pages cached by older versions (no text, or no record of how they were read, so no preview picture)
  // are read once more.
  if (cached && ((cached.title && cached.text !== null && cached.via) || (!cached.title && Date.now() - cached.fetchedAt.getTime() < 3600_000))) return cached;

  let title: string | null = null;
  let summary: string | null = null;
  let text: string | null = null;
  let ok = false;
  let via: string | null = null;
  let image: string | null = null;
  let unlockTries = cached?.unlockTries ?? 0;
  const embed = (await oembed(url)) ?? (await paper(url));
  if (embed) {
    ({ title, summary, text, image, via } = embed);
    ok = true;
  } else {
    // Bright Data only as a last resort: after our own read fails, and only a couple of times per page.
    let html = await direct(url);
    if (html) via = "direct";
    else if (process.env.BRIGHTDATA_API_KEY && unlockTries < UNLOCK_TRIES) {
      unlockTries++;
      html = await unlocked(url);
      if (html) { via = "brightdata"; console.log(`[link] read ${url} with Bright Data`); }
    }
    if (html) {
      title = meta(html, "og:title") ?? (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ? decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)![1]) : null);
      summary = meta(html, "og:description") ?? meta(html, "description");
      image = picture(html, url);
      text = readable(html);
      ok = true;
    }
  }
  const data = { title: title?.slice(0, 200) ?? null, summary: summary?.slice(0, 500) ?? null, text: text ?? "", ok, image, via, unlockTries, fetchedAt: new Date() };
  return db.pageCache.upsert({ where: { url }, create: { url, ...data }, update: data });
}
