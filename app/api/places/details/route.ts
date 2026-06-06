import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/src/lib/require-permission";

type AddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

function getComponent(
  components: AddressComponent[],
  type: string,
  useShort = false,
): string {
  const c = components.find((c) => c.types.includes(type));
  return useShort ? (c?.short_name ?? "") : (c?.long_name ?? "");
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const placeId = searchParams.get("place_id");

  if (!placeId) {
    return NextResponse.json({ error: "place_id required" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY not set" }, { status: 500 });
  }

  try {
    const params = new URLSearchParams({
      place_id: placeId,
      key: apiKey,
      fields: "address_components,formatted_address",
    });
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params}`,
    );
    const data = (await res.json()) as {
      result?: { address_components: AddressComponent[]; formatted_address: string };
    };

    if (!data.result) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    const components = data.result.address_components;
    const streetNumber = getComponent(components, "street_number");
    const route = getComponent(components, "route");
    const city =
      getComponent(components, "locality") ||
      getComponent(components, "sublocality") ||
      getComponent(components, "administrative_area_level_2");
    const state = getComponent(components, "administrative_area_level_1", true);
    const zip = getComponent(components, "postal_code");

    return NextResponse.json({
      formattedAddress: data.result.formatted_address,
      streetAddress: [streetNumber, route].filter(Boolean).join(" "),
      city,
      state,
      zip,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch place details" }, { status: 500 });
  }
}
