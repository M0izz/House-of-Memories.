import { NextResponse } from "next/server";

// Cache geocode results in-memory for 1 hour to prevent redundant requests
interface CachedResult {
  timestamp: number;
  data: GeocodeResult[];
}
const geocodeCache = new Map<string, CachedResult>();
const CACHE_TTL_MS = 60 * 60 * 1000;

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
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();

    if (!query || query.length < 2) {
      return NextResponse.json(
        { results: [] },
        { status: 200 }
      );
    }

    const cacheKey = query.toLowerCase();
    const cached = geocodeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({
        results: cached.data,
        cached: true,
      });
    }

    // Call OpenStreetMap Nominatim with compliant User-Agent and format
    const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
    nominatimUrl.searchParams.set("q", query);
    nominatimUrl.searchParams.set("format", "json");
    nominatimUrl.searchParams.set("addressdetails", "1");
    nominatimUrl.searchParams.set("limit", "5");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    let rawResults: any[] = [];
    try {
      const res = await fetch(nominatimUrl.toString(), {
        headers: {
          "User-Agent": "HouseOfMemories/1.0 (https://houseofmemories.app; contact: hello@houseofmemories.app)",
          "Accept-Language": "en",
        },
        signal: controller.signal,
      });

      if (res.ok) {
        rawResults = await res.json();
      }
    } catch {
      // Fallback to Photon geocoding service if Nominatim fails or times out
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
        }
      } catch (fallbackErr) {
        console.warn("Geocoding services unavailable:", fallbackErr);
      }
    } finally {
      clearTimeout(timeout);
    }

    const formatted: GeocodeResult[] = (rawResults || []).map((item: any) => {
      const addr = item.address || {};
      const cityName = addr.city || addr.town || addr.village || addr.suburb || addr.municipality || "";
      const regionName = addr.state || addr.region || addr.county || "";
      const countryName = addr.country || "";

      // Derive clean place name
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
    }).filter((r: GeocodeResult) => !Number.isNaN(r.latitude) && !Number.isNaN(r.longitude));

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
      { error: error?.message || "Failed to search location" },
      { status: 500 }
    );
  }
}
