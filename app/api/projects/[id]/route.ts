import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { COLORS } from "@/lib/colors";
import { summarizeProject } from "@/lib/projects";

type Ctx = { params: Promise<{ id: string }> };

// A project with its sections, tasks, and linked inbox items.
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    include: {
      sections: { orderBy: { order: "asc" }, include: { tasks: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } } },
      items: { where: { archived: false }, orderBy: { createdAt: "desc" }, omit: { extracted: true } },
    },
  });
  return project ? NextResponse.json(project) : NextResponse.json({ error: "not found" }, { status: 404 });
}

// Edit a project: title, color, position on the Hub, summary, or { summarize: true } for a fresh one.
// { order: [sectionId, ...] } reorders its sections.
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim().slice(0, 60);
  if (typeof body.color === "string" && COLORS.includes(body.color)) data.color = body.color;
  if (Number.isFinite(body.canvasX)) data.canvasX = body.canvasX;
  if (Number.isFinite(body.canvasY)) data.canvasY = body.canvasY;
  if (typeof body.overview === "string") Object.assign(data, body.overview.trim() ? { overview: body.overview.slice(0, 5000), overviewBy: "user" } : { overview: null, overviewBy: null });
  if (body.summarize === true) Object.assign(data, { overview: null, overviewBy: null });
  try {
    const project = await db.project.update({ where: { id }, data });
    if (Array.isArray(body.order)) {
      await db.$transaction(body.order.filter((s: unknown) => typeof s === "string").map((sid: string, order: number) =>
        db.section.updateMany({ where: { id: sid, projectId: id }, data: { order } })));
    }
    if (body.summarize === true) after(() => summarizeProject(id));
    return NextResponse.json(project);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

// Delete a project and its sections. Linked inbox items stay in the inbox.
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await db.project.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
