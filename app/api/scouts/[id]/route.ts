import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SCOUT_KINDS, queueScout, view } from "@/lib/scouts";

type Ctx = { params: Promise<{ id: string }> };

// Change a Scout's brief or kind, and run it again ({ run: true }).
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.brief === "string" && body.brief.trim()) data.brief = body.brief.trim().slice(0, 2000);
  if (SCOUT_KINDS.includes(body.kind)) data.kind = body.kind;
  if (body.run === true) Object.assign(data, { status: "searching", note: "Starting" });
  try {
    const scout = await db.scout.update({ where: { id }, data });
    if (body.run === true) queueScout(id);
    return NextResponse.json(view(scout));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await db.scout.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
