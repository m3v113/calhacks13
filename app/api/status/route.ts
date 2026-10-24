import { NextResponse } from "next/server";
import { ollamaUp, visionModel } from "@/lib/ollama";

export async function GET() {
  const ai = await ollamaUp();
  return NextResponse.json({ ai, vision: ai ? (await visionModel()) !== null : false });
}
