import { NextResponse } from "next/server";
import { suggest } from "@/lib/projects";

// A suggested title and sections for a project goal, to review before creating it.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const goal = typeof body.goal === "string" ? body.goal.trim().slice(0, 500) : "";
  if (!goal) return NextResponse.json({ error: "goal needed" }, { status: 400 });
  return NextResponse.json(await suggest(goal));
}
