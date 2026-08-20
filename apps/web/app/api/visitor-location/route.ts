import {NextResponse, type NextRequest} from "next/server";

export type VisitorLocationResponse = {
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  region: string | null;
};

export function GET(request: NextRequest) {
  const latitude = parseCoordinate(request.headers.get("x-vercel-ip-latitude"), -90, 90);
  const longitude = parseCoordinate(request.headers.get("x-vercel-ip-longitude"), -180, 180);
  const body: VisitorLocationResponse = {
    city: request.headers.get("x-vercel-ip-city"),
    country: request.headers.get("x-vercel-ip-country"),
    latitude,
    longitude,
    region: request.headers.get("x-vercel-ip-country-region")
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function parseCoordinate(value: string | null, min: number, max: number) {
  if (value === null) {
    return null;
  }
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate) || coordinate < min || coordinate > max) {
    return null;
  }
  return coordinate;
}
