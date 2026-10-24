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

// Reads a page's title and description once, then serves it from the cache.
// Failed reads are retried after an hour (e.g. when you were offline).
export async function readLink(url: string) {
  const cached = await db.pageCache.findUnique({ where: { url } });
  if (cached && (cached.ok || Date.now() - cached.fetchedAt.getTime() < 3600_000)) return cached;

  let title: string | null = null;
  let summary: string | null = null;
  let ok = false;
  try {
    const r = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (Macintosh) ProjectScaffold/0.1", accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });
    if (r.ok && (r.headers.get("content-type") ?? "").includes("html")) {
      const html = (await r.text()).slice(0, 300_000);
      title = meta(html, "og:title") ?? (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ? decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)![1]) : null);
      summary = meta(html, "og:description") ?? meta(html, "description");
      ok = true;
    }
  } catch {}
  const data = { title: title?.slice(0, 200) ?? null, summary: summary?.slice(0, 500) ?? null, ok, fetchedAt: new Date() };
  return db.pageCache.upsert({ where: { url }, create: { url, ...data }, update: data });
}
