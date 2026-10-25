import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

// A few words around where the search matched, for the result row.
function around(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return null;
  const start = Math.max(0, i - 30);
  return `${start ? "…" : ""}${text.slice(start, i + q.length + 50).trim()}${i + q.length + 50 < text.length ? "…" : ""}`;
}

// Projects whose name, goal, sections, tasks, or Project Dump items mention the search. GET ?q=...
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 100);
  if (!q) return NextResponse.json([]);
  const projects = await db.project.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, title: true, goal: true, context: true, color: true,
      sections: { select: { type: true, title: true, notes: true, tasks: { select: { text: true } } } },
      items: { where: { archived: false }, select: { title: true, text: true, fileName: true, overview: true } },
    },
  });
  const found = [];
  for (const p of projects) {
    if (p.title.toLowerCase().includes(q)) { found.push({ id: p.id, title: p.title, color: p.color, hit: null }); continue; }
    const texts = [
      p.goal, p.context,
      ...p.sections.flatMap((s) => [s.title, ...s.tasks.map((t) => t.text), s.notes && (s.type === "writing" || s.type === "overview") ? plain(s.notes) : null]),
      ...p.items.flatMap((i) => [i.title, i.fileName, i.text, i.overview]),
    ];
    const hit = texts.reduce<string | null>((h, t) => h ?? (t ? around(t, q) : null), null);
    if (hit) found.push({ id: p.id, title: p.title, color: p.color, hit });
  }
  return NextResponse.json(found.slice(0, 8));
}
