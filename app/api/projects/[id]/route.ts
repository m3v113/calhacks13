import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { COLORS } from "@/lib/colors";
import { planning, upgradeSections } from "@/lib/projects";

type Ctx = { params: Promise<{ id: string }> };
const ITEM = { where: { archived: false }, orderBy: { createdAt: "desc" as const }, omit: { extracted: true } };
const BRIEF = { id: true, title: true, color: true };

// A project with its sections, tasks, and sources, plus the sources of projects linked to it.
export async function GET(_req: Request, { params }: Ctx) {
  await upgradeSections();
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    omit: { overview: true, overviewBy: true },
    include: {
      sections: { orderBy: { order: "asc" }, include: { tasks: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } } },
      items: ITEM,
      linksOut: { include: { to: { select: { ...BRIEF, items: ITEM } } } },
      linksIn: { include: { from: { select: { ...BRIEF, items: ITEM } } } },
    },
  });
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { linksOut, linksIn, ...rest } = project;
  const linked = [...linksOut.map((l) => l.to), ...linksIn.map((l) => l.from)];
  return NextResponse.json({ ...rest, linked, planning: planning.has(id) });
}

// Edit a project: title, color, position and size on the Hub. Its kind is set when it's made.
// { order: [sectionId, ...] } reorders its sections.
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim().slice(0, 60);
  if (typeof body.color === "string" && COLORS.includes(body.color)) data.color = body.color;
  for (const k of ["canvasX", "canvasY"]) if (Number.isFinite(body[k])) data[k] = body[k];
  if (Number.isFinite(body.cardW)) data.cardW = Math.min(800, Math.max(180, body.cardW));
  if (Number.isFinite(body.cardH)) data.cardH = Math.min(600, Math.max(72, body.cardH));
  try {
    const project = await db.project.update({ where: { id }, data, omit: { overview: true, overviewBy: true } });
    if (Array.isArray(body.order)) {
      await db.$transaction(body.order.filter((s: unknown) => typeof s === "string").map((sid: string, order: number) =>
        db.section.updateMany({ where: { id: sid, projectId: id }, data: { order } })));
    }
    return NextResponse.json(project);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

// Delete a project and its sections. Its sources stay in the inbox.
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await db.project.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
