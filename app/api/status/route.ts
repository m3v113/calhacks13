import { NextResponse } from "next/server";
import { ollamaUp, visionModel, warm } from "@/lib/ollama";

export async function GET() {
  const ai = await ollamaUp();
  // The app is open, so get the model ready before it's needed.
  if (ai) warm();
  return NextResponse.json({ ai, vision: ai ? (await visionModel()) !== null : false });
}
