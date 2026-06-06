import { NextResponse } from "next/server";

// Structure model was removed in Sprint 1 schema cleanup
export async function POST() {
  return NextResponse.json({ error: "Not available" }, { status: 410 });
}
