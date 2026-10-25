import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { sortItem } from "@/lib/sort";
import { nextProjectColor, queuePlan, tidySections, upgradeSections } from "@/lib/projects";

// Every project and the lines between them, for the Hub.
export async function GET() {
  await upgradeSections();
  const [projects, links] = await Promise.all([
    db.project.findMany({ orderBy: { createdAt: "asc" }, omit: { overview: true, overviewBy: true } }),
    db.projectLink.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  return NextResponse.json({ projects, links });
}

// Make a project from the reviewed suggestion: { goal, title, kind, sections: [{ type, title }], x, y }.
// Auto projects take { context, itemIds } instead of sections: the AI builds their sections from the goal,
// the context (links in it are added as sources, and to the inbox), and the inbox items you picked.
export async function POST(req: Request) {
  await upgradeSections();
  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 60) : "";
  if (!title) return NextResponse.json({ error: "title needed" }, { status: 400 });
  const kind = body.kind === "auto" ? "auto" : "space";
  const sections = kind === "auto" ? tidySections([]) : tidySections((Array.isArray(body.sections) ? body.sections : []).filter(
    (s: { type?: unknown; title?: unknown }) => typeof s?.type === "string" && typeof s?.title === "string" && s.type !== "step"));
  const context = kind === "auto" && typeof body.context === "string" ? body.context.trim().slice(0, 4000) : "";
  const project = await db.project.create({
    data: {
      title, kind, context: context || null,
      goal: typeof body.goal === "string" ? body.goal.slice(0, 500) : null,
      color: await nextProjectColor(),
      canvasX: Number.isFinite(body.x) ? body.x : 0,
      canvasY: Number.isFinite(body.y) ? body.y : 0,
      sections: { create: sections.map((s, order) => ({ type: s.type, title: s.title, order, span: s.type === "writing" ? 2 : 1 })) },
    },
  });
  if (kind === "auto") {
    const ids = (Array.isArray(body.itemIds) ? body.itemIds : []).filter((x: unknown) => typeof x === "string").slice(0, 30);
    if (ids.length) await db.item.updateMany({ where: { id: { in: ids } }, data: { projectId: project.id } });
    const urls = [...new Set<string>(context.match(/https?:\/\/[^\s<>"']+/gi) ?? [])].map((u: string) => u.replace(/[.,;)]+$/, "")).slice(0, 5);
    for (const url of urls) {
      const item = await db.item.create({ data: { kind: "link", text: url, url, projectId: project.id } });
      after(() => sortItem(item.id));
    }
    queuePlan(project.id);
  }
  return NextResponse.json(project);
}
