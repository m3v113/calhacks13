import { NextResponse } from "next/server";
import { moreResources } from "@/lib/projects";

// More pages for a Resources section. Only runs when you press its refresh button (searches are paid).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await moreResources(id);
  return r ? NextResponse.json(r) : NextResponse.json({ error: "not found" }, { status: 404 });
}
