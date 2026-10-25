import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SCOUT_KINDS, guessKind, queueScout, view } from "@/lib/scouts";

type Ctx = { params: Promise<{ id: string }> };

// The project's Scouts, newest first.
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const scouts = await db.scout.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(scouts.map(view));
}

// A new Scout, run right away: { brief, kind?, taskId? }. Without a kind, it's guessed from the brief.
// A Scout sent from a task checks that task off when it finishes.
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const brief = typeof body.brief === "string" ? body.brief.trim().slice(0, 2000) : "";
  if (!brief) return NextResponse.json({ error: "empty brief" }, { status: 400 });
  const kind = SCOUT_KINDS.includes(body.kind) ? body.kind : guessKind(brief);
  try {
    const task = typeof body.taskId === "string" ? await db.task.findFirst({ where: { id: body.taskId, section: { projectId: id } }, select: { id: true } }) : null;
    const scout = await db.scout.create({ data: { projectId: id, brief, kind, taskId: task?.id, status: "searching", note: "Starting" } });
    queueScout(scout.id);
    return NextResponse.json(view(scout));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
