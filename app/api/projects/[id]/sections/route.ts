import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SECTION_TYPES } from "@/lib/projects";

// Add a section to the end of a project: { type, title, notes?, tasks? }. Writing sections start full width.
// Scouts use notes and tasks to add what they found.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (!SECTION_TYPES.includes(body.type)) return NextResponse.json({ error: "bad type" }, { status: 400 });
  const last = await db.section.findFirst({ where: { projectId: id }, orderBy: { order: "desc" }, select: { order: true } });
  try {
    const section = await db.section.create({
      data: {
        projectId: id, type: body.type, order: (last?.order ?? -1) + 1, span: body.type === "writing" ? 2 : 1,
        title: typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 40) : body.type,
        notes: typeof body.notes === "string" ? body.notes.slice(0, 200_000) : null,
        tasks: Array.isArray(body.tasks)
          ? { create: body.tasks.filter((t: unknown) => typeof t === "string" && t.trim()).slice(0, 50).map((text: string, order: number) => ({ text: text.trim().slice(0, 500), order })) }
          : undefined,
      },
      include: { tasks: true },
    });
    return NextResponse.json(section);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
