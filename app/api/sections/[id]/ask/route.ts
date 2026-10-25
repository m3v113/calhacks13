import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ask, readAsks } from "@/lib/assistant";

type Ctx = { params: Promise<{ id: string }> };

// Ask an AI section something about its project: { q }. Answers with the section's saved asks, newest first.
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const q = typeof body.q === "string" ? body.q.trim().slice(0, 4000) : "";
  if (!q) return NextResponse.json({ error: "empty" }, { status: 400 });
  const r = await ask(id, q);
  return "error" in r ? NextResponse.json({ error: r.error }, { status: r.status }) : NextResponse.json(r);
}

// Remove one saved ask: { at }.
export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const at = new URL(req.url).searchParams.get("at");
  const sec = await db.section.findUnique({ where: { id }, select: { notes: true } });
  if (!sec) return NextResponse.json({ error: "not found" }, { status: 404 });
  const asks = readAsks(sec.notes).filter((a) => a.at !== at);
  await db.section.update({ where: { id }, data: { notes: JSON.stringify({ asks }) } });
  return NextResponse.json({ asks });
}
