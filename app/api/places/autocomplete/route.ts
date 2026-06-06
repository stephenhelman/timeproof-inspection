import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/src/lib/require-permission";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const input = searchParams.get("input")?.trim();

  if (!input || input.length < 2) {
    return NextResponse.json({ predictions: [] });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ predictions: [] });
  }

  try {
    const params = new URLSearchParams({
      input,
      key: apiKey,
      types: "address",
      components: "country:us",
    });
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`,
    );
    const data = (await res.json()) as { predictions?: unknown[] };
    return NextResponse.json({ predictions: data.predictions ?? [] });
  } catch {
    return NextResponse.json({ predictions: [] });
  }
}
