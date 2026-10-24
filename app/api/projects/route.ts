import { NextResponse } from "next/server";
import { db } from "@/lib/db";
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
export async function POST(req: Request) {
  await upgradeSections();
  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 60) : "";
  if (!title) return NextResponse.json({ error: "title needed" }, { status: 400 });
  const kind = body.kind === "auto" ? "auto" : "space";
  const sections = tidySections((Array.isArray(body.sections) ? body.sections : []).filter(
    (s: { type?: unknown; title?: unknown }) => typeof s?.type === "string" && typeof s?.title === "string"));
  const project = await db.project.create({
    data: {
      title, kind,
      goal: typeof body.goal === "string" ? body.goal.slice(0, 500) : null,
      color: await nextProjectColor(),
      canvasX: Number.isFinite(body.x) ? body.x : 0,
      canvasY: Number.isFinite(body.y) ? body.y : 0,
      sections: { create: sections.map((s, order) => ({ type: s.type, title: s.title, order, span: s.type === "writing" ? 2 : 1 })) },
    },
  });
  if (kind === "auto") queuePlan(project.id);
  return NextResponse.json(project);
}
