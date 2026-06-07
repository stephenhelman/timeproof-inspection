import { NextResponse } from "next/server";

// Deprecated — use GET /api/photo/presign → PUT → POST /api/photo/confirm
// See: presigned URL migration for Vercel 4.5MB body limit bypass
export async function POST() {
  return NextResponse.json(
    { error: "Deprecated. Use GET /api/photo/presign → PUT → POST /api/photo/confirm" },
    { status: 410 },
  );
}
