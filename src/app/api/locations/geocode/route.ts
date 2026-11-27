import { NextResponse } from "next/server";

// Cache geocode results in-memory for 1 hour to prevent redundant external calls
interface CachedResult {
  timestamp: number;
  data: GeocodeResult[];
}
const geocodeCache = new Map<string, CachedResult>();
const CACHE_TTL_MS = 60 * 60 * 1000;

// Rate limiting: Token bucket per IP (max 20 requests per minute)
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitBucket>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  const bucket = rateLimitMap.get(clientIp);

  if (!bucket || now > bucket.resetAt) {
    rateLimitMap.set(clientIp, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  if (bucket.count >= RATE_LIMIT_MAX) {
    return false;
  }

  bucket.count++;
  return true;
}

export interface GeocodeResult {
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  country?: string;
}

export async function GET(request: Request) {
  try {
    // 1. IP extraction & rate limiting
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "anonymous-client";

    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please wait a minute before making more geocoding requests.",
          results: [],
        },
        { status: 429 }
      );
    }

    // 2. Query extraction and length boundaries
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();

    if (!query || query.length < 2) {
      return NextResponse.json(
        { results: [] },
        { status: 200 }
      );
    }

    if (query.length > 100) {
      return NextResponse.json(
        { error: "Search query exceeds maximum length of 100 characters.", results: [] },
        { status: 400 }
      );
    }

    // 3. Cache lookup
    const cacheKey = query.toLowerCase();
    const cached = geocodeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({
        results: cached.data,
        cached: true,
      });
    }

    // 4. Compliant OpenStreetMap Nominatim request
    const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
    nominatimUrl.searchParams.set("q", query);
    nominatimUrl.searchParams.set("format", "json");
    nominatimUrl.searchParams.set("addressdetails", "1");
    nominatimUrl.searchParams.set("limit", "5");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    let rawResults: any[] = [];
    let providerSuccess = false;

    try {
      const res = await fetch(nominatimUrl.toString(), {
        headers: {
          "User-Agent": "HouseOfMemories/1.0 (https://houseofmemories.app; contact: support@houseofmemories.app)",
          "Accept-Language": "en",
        },
        signal: controller.signal,
      });

      if (res.ok) {
        rawResults = await res.json();
        providerSuccess = true;
      }
    } catch {
      // Secondary fallback to Photon geocoding service
      try {
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;
        const photonRes = await fetch(photonUrl, {
          headers: { "User-Agent": "HouseOfMemories/1.0" },
        });
        if (photonRes.ok) {
          const photonData = await photonRes.json();
          rawResults = (photonData.features || []).map((f: any) => ({
            display_name: [
              f.properties.name,
              f.properties.city,
              f.properties.state,
              f.properties.country,
            ].filter(Boolean).join(", "),
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0],
            address: {
              city: f.properties.city || f.properties.town,
              state: f.properties.state,
              country: f.properties.country,
            },
            name: f.properties.name,
          }));
          providerSuccess = true;
        }
      } catch (fallbackErr) {
        console.warn("Both Nominatim and Photon providers failed:", fallbackErr);
      }
    } finally {
      clearTimeout(timeout);
    }

    if (!providerSuccess && rawResults.length === 0) {
      return NextResponse.json(
        {
          error: "Geocoding service is temporarily unreachable. You can still drop pins manually on the map canvas.",
          results: [],
        },
        { status: 503 }
      );
    }

    const formatted: GeocodeResult[] = (rawResults || [])
      .map((item: any) => {
        const addr = item.address || {};
        const cityName = addr.city || addr.town || addr.village || addr.suburb || addr.municipality || "";
        const regionName = addr.state || addr.region || addr.county || "";
        const countryName = addr.country || "";

        let name = item.name || "";
        if (!name) {
          const parts = (item.display_name || "").split(",");
          name = parts[0]?.trim() || "Selected Location";
        }

        return {
          name,
          displayName: item.display_name || name,
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
          city: cityName || undefined,
          region: regionName || undefined,
          country: countryName || undefined,
        };
      })
      .filter((r: GeocodeResult) => !Number.isNaN(r.latitude) && !Number.isNaN(r.longitude));

    // Save in cache
    geocodeCache.set(cacheKey, {
      timestamp: Date.now(),
      data: formatted,
    });

    return NextResponse.json({
      results: formatted,
      cached: false,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to search location." },
      { status: 500 }
    );
  }
}
