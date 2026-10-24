import { NextResponse } from "next/server";
import { ollamaUp } from "@/lib/ollama";

export async function GET() {
  return NextResponse.json({ ai: await ollamaUp() });
}
