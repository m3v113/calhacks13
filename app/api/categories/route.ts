import { NextResponse } from "next/server";
import { categoryByName } from "@/lib/db";

// Make a category you named yourself (or return the one that already has that name).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const c = typeof body.name === "string" ? await categoryByName(body.name, false) : null;
  if (!c) return NextResponse.json({ error: "bad name" }, { status: 400 });
  return NextResponse.json(c);
}
