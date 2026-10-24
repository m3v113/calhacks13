import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { SECTION_TYPES, nextProjectColor, summarizeProject } from "@/lib/projects";

// Every project, for the cards on the Hub.
export async function GET() {
  const projects = await db.project.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { items: { where: { archived: false } } } } },
  });
  return NextResponse.json(projects.map(({ _count, ...p }) => ({ ...p, count: _count.items })));
}

// Make a project from the reviewed suggestion: { goal, title, sections: [{ type, title }], x, y }.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 60) : "";
  if (!title) return NextResponse.json({ error: "title needed" }, { status: 400 });
  const sections = (Array.isArray(body.sections) ? body.sections : [])
    .filter((s: { type?: unknown; title?: unknown }) => SECTION_TYPES.includes(s?.type as never) && typeof s?.title === "string")
    .slice(0, 8);
  const project = await db.project.create({
    data: {
      title,
      goal: typeof body.goal === "string" ? body.goal.slice(0, 500) : null,
      color: await nextProjectColor(),
      canvasX: Number.isFinite(body.x) ? body.x : 0,
      canvasY: Number.isFinite(body.y) ? body.y : 0,
      sections: { create: sections.map((s: { type: string; title: string }, order: number) => ({ type: s.type, title: s.title.slice(0, 40), order })) },
    },
  });
  after(() => summarizeProject(project.id));
  return NextResponse.json({ ...project, count: 0 });
}
