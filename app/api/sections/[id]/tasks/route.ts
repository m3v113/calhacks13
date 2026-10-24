import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Add a task to the end of a tasks section: { text }.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 500) : "";
  if (!text) return NextResponse.json({ error: "text needed" }, { status: 400 });
  const last = await db.task.findFirst({ where: { sectionId: id }, orderBy: { order: "desc" }, select: { order: true } });
  try {
    return NextResponse.json(await db.task.create({ data: { sectionId: id, text, order: (last?.order ?? -1) + 1 } }));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
