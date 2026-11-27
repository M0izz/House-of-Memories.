"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  MapPin,
  Heart,
  Navigation,
  Sparkles,
  Search,
  Plus,
  Maximize2,
  Calendar,
  X,
  Compass,
  Trash2,
  Edit2,
  ExternalLink,
  Check,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
} from "lucide-react";
import type { MemoryLocationRecord } from "@/lib/repositories/location-repository";
import type { GeocodeResult } from "@/app/api/locations/geocode/route";

// Carto Voyager warm pastel tile style
const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "carto-voyager": {
      type: "raster",
      tiles: [
        "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    },
  },
  layers: [
    {
      id: "carto-voyager-layer",
      type: "raster",
      source: "carto-voyager",
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

// Explicit dev/demo sample locations isolated for preview mode only
const SAMPLE_DEMO_PLACES: MemoryLocationRecord[] = [
  {
    id: "sample-1",
    spaceId: "demo-space",
    name: "Old Town Corner Café",
    city: "Montmartre, Paris",
    country: "France",
    latitude: 48.8867,
    longitude: 2.3429,
    description: "The tiny café where we stayed for 3 hours drinking café au lait under the rain awning.",
    coverImageUrl: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=600&q=80",
    memoryCount: 8,
    createdAt: "2024-04-12T10:00:00Z",
    updatedAt: "2024-04-12T10:00:00Z",
    memories: [
      {
        id: "demo-m1",
        title: "Morning Croissant",
        caption: "Warm flaky pastry and street accordion music.",
        date: "Apr 2024",
        imageUrl: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=600&q=80",
      },
    ],
  },
  {
    id: "sample-2",
    spaceId: "demo-space",
    name: "Sunny Ridge Lookout",
    city: "Positano",
    country: "Italy",
    latitude: 40.6281,
    longitude: 14.485,
    description: "Winding coastal cliffs, golden hour gelato, and the sound of waves hitting the rocks below.",
    coverImageUrl: "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=600&q=80",
    memoryCount: 14,
    createdAt: "2024-06-20T18:00:00Z",
    updatedAt: "2024-06-20T18:00:00Z",
  },
  {
    id: "sample-3",
    spaceId: "demo-space",
    name: "Midnight Ramen & Jazz Bar",
    city: "Shinjuku, Tokyo",
    country: "Japan",
    latitude: 35.6895,
    longitude: 139.7006,
    description: "Tucked inside an alleyway behind glowing lanterns, listening to vintage vinyl records.",
    coverImageUrl: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80",
    memoryCount: 9,
    createdAt: "2024-08-15T23:00:00Z",
    updatedAt: "2024-08-15T23:00:00Z",
  },
];

/**
 * Strict image URL sanitizer to prevent protocol abuse (e.g. javascript:)
 */
function sanitizeImageUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }
  return null;
}

/**
 * Tests WebGL hardware acceleration availability
 */
function isWebGLSupported(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl") ||
          canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

export default function InteractiveMemoryMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const activePopupRef = useRef<maplibregl.Popup | null>(null);
  const previewMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Mutable refs for event listeners (prevents stale closures)
  const isAddingPinRef = useRef<boolean>(false);
  const onMapClickRef = useRef<(coords: [number, number]) => void>(() => {});

  // State
  const [locations, setLocations] = useState<MemoryLocationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [activeDrawerLocation, setActiveDrawerLocation] = useState<MemoryLocationRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [webGlAvailable, setWebGlAvailable] = useState(true);

  // Pin creation / editing state
  const [isAddingPin, setIsAddingPin] = useState(false);
  const [newPinCoords, setNewPinCoords] = useState<[number, number] | null>(null);
  const [newPlaceName, setNewPlaceName] = useState("");
  const [newPlaceAddress, setNewPlaceAddress] = useState("");
  const [newPlaceCity, setNewPlaceCity] = useState("");
  const [newPlaceCountry, setNewPlaceCountry] = useState("");
  const [newPlaceDesc, setNewPlaceDesc] = useState("");
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<string[]>([]);
  const [isSavingPin, setIsSavingPin] = useState(false);

  // Available memories for linking
  const [availableMemories, setAvailableMemories] = useState<
    { id: string; title: string; date: string; imageUrl?: string }[]
  >([]);

  // Geocoding search state
  const [geocodeQuery, setGeocodeQuery] = useState("");
  const [geocodeResults, setGeocodeResults] = useState<GeocodeResult[]>([]);
  const [isSearchingGeocode, setIsSearchingGeocode] = useState(false);
  const [showGeocodeDropdown, setShowGeocodeDropdown] = useState(false);

  // Update ref
  useEffect(() => {
    isAddingPinRef.current = isAddingPin;
  }, [isAddingPin]);

  // Load locations from database API
  const loadLocations = useCallback(async (previewDemo = false) => {
    setIsLoading(true);
    try {
      if (previewDemo) {
        setLocations(SAMPLE_DEMO_PLACES);
        setIsDemoMode(true);
        if (SAMPLE_DEMO_PLACES[0]) {
          setSelectedLocationId(SAMPLE_DEMO_PLACES[0].id);
        }
        return;
      }

      const res = await fetch("/api/locations");
      if (!res.ok) throw new Error("Failed to load locations");
      const data = await res.json();

      const loaded = data.locations || [];
      setLocations(loaded);
      setIsDemoMode(Boolean(data.isDemoMode));

      if (loaded.length > 0) {
        setSelectedLocationId(loaded[0].id);
      } else {
        setSelectedLocationId(null);
      }
    } catch (err) {
      console.error("Failed to load locations:", err);
      setLocations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch available memories for association
  const loadAvailableMemories = useCallback(async () => {
    try {
      const res = await fetch("/api/memories/available");
      if (res.ok) {
        const data = await res.json();
        setAvailableMemories(data.items || []);
      }
    } catch (err) {
      console.error("Failed to fetch memories for linking:", err);
    }
  }, []);

  useEffect(() => {
    loadLocations();
    loadAvailableMemories();
  }, [loadLocations, loadAvailableMemories]);

  // Safe DOM-based popup generation eliminating .setHTML() injection vulnerabilities
  const showSecurePopup = useCallback((place: MemoryLocationRecord) => {
    if (!mapInstance.current) return;

    if (activePopupRef.current) {
      activePopupRef.current.remove();
      activePopupRef.current = null;
    }

    const container = document.createElement("div");
    container.className = "hom-memory-popup-inner p-2 max-w-[250px]";
    container.style.fontFamily = "var(--font-dmsans, sans-serif)";

    // Sanitize image URL
    const safeCover = sanitizeImageUrl(place.coverImageUrl);
    if (safeCover) {
      const imgWrapper = document.createElement("div");
      imgWrapper.className = "w-full h-28 rounded-xl overflow-hidden mb-2 bg-cream-200";
      const img = document.createElement("img");
      img.src = safeCover;
      img.alt = place.name;
      img.className = "w-full h-full object-cover";
      imgWrapper.appendChild(img);
      container.appendChild(imgWrapper);
    }

    // Place location label
    const locWrapper = document.createElement("div");
    locWrapper.className = "flex items-center gap-1.5 mb-1";
    const dot = document.createElement("span");
    dot.className = "w-2 h-2 rounded-full bg-plum";
    locWrapper.appendChild(dot);

    const locLabel = document.createElement("span");
    locLabel.className = "text-[10px] font-bold uppercase tracking-wider text-plum/60";
    const locText = [place.city, place.country].filter(Boolean).join(", ") || place.address || "Memory Landmark";
    locLabel.textContent = locText;
    locWrapper.appendChild(locLabel);
    container.appendChild(locWrapper);

    // Place title
    const title = document.createElement("h4");
    title.className = "font-serif text-sm font-bold text-plum leading-snug mb-1";
    title.textContent = place.name;
    container.appendChild(title);

    // Place description
    if (place.description) {
      const desc = document.createElement("p");
      desc.className = "text-[11px] text-plum/75 leading-relaxed mb-2 line-clamp-3";
      desc.textContent = place.description;
      container.appendChild(desc);
    }

    // Footer with count and action button
    const footer = document.createElement("div");
    footer.className = "flex items-center justify-between pt-2 border-t border-plum/10 text-xs";

    const countBadge = document.createElement("span");
    countBadge.className = "font-handwriting text-sm font-bold text-plum";
    countBadge.textContent = `${place.memoryCount || 0} memories`;
    footer.appendChild(countBadge);

    const viewBtn = document.createElement("button");
    viewBtn.className = "px-2 py-1 rounded-lg bg-plum text-white text-[11px] font-medium hover:bg-plum/90 transition-all";
    viewBtn.textContent = "View Moments";
    viewBtn.addEventListener("click", () => {
      setActiveDrawerLocation(place);
    });
    footer.appendChild(viewBtn);

    container.appendChild(footer);

    const popup = new maplibregl.Popup({
      offset: 25,
      closeButton: true,
      closeOnClick: false,
      className: "hom-memory-popup",
    })
      .setLngLat([place.longitude, place.latitude])
      .setDOMContent(container)
      .addTo(mapInstance.current);

    activePopupRef.current = popup;
  }, []);

  // Update map click handler ref
  onMapClickRef.current = (coords: [number, number]) => {
    if (!isAddingPinRef.current) return;
    setNewPinCoords(coords);

    if (mapInstance.current) {
      if (!previewMarkerRef.current) {
        // Create custom draggable preview marker
        const el = document.createElement("div");
        el.className = "hom-preview-marker";
        el.innerHTML = `
          <div style="
            width: 36px;
            height: 36px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            background: #493C46;
            border: 2px solid #FDF6E2;
            box-shadow: 0 4px 16px rgba(73, 60, 70, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: grab;
            animation: bounce 1s infinite alternate;
          ">
            <svg style="transform: rotate(45deg); width: 16px; height: 16px; color: #FFF8F5;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
        `;

        const marker = new maplibregl.Marker({ element: el, draggable: true })
          .setLngLat(coords)
          .addTo(mapInstance.current);

        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          setNewPinCoords([lngLat.lng, lngLat.lat]);
        });

        previewMarkerRef.current = marker;
      } else {
        previewMarkerRef.current.setLngLat(coords);
      }
    }
  };

  // Initialize MapLibre GL once
  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    if (!isWebGLSupported()) {
      setWebGlAvailable(false);
      return;
    }

    try {
      const map = new maplibregl.Map({
        container: mapContainer.current,
        style: process.env.NEXT_PUBLIC_MAP_STYLE_URL || MAP_STYLE,
        center: [15, 30],
        zoom: 2.2,
        attributionControl: false,
      });

      map.addControl(
        new maplibregl.NavigationControl({
          showCompass: true,
          showZoom: true,
          visualizePitch: true,
        }),
        "top-right"
      );

      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-right"
      );

      map.on("load", () => {
        map.resize();
      });

      map.on("click", (e) => {
        onMapClickRef.current([e.lngLat.lng, e.lngLat.lat]);
      });

      // Resize observer to ensure responsive map layout
      const resizeObserver = new ResizeObserver(() => {
        map.resize();
      });
      if (mapContainer.current) {
        resizeObserver.observe(mapContainer.current);
      }

      mapInstance.current = map;

      return () => {
        resizeObserver.disconnect();
        if (mapInstance.current) {
          mapInstance.current.remove();
          mapInstance.current = null;
        }
      };
    } catch (err) {
      console.error("MapLibre GL initialization error:", err);
      setWebGlAvailable(false);
    }
  }, []);

  // Sync Markers when locations change (without reinitializing the map canvas)
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Clear existing location markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    locations.forEach((place) => {
      const isSelected = place.id === selectedLocationId;

      const el = document.createElement("div");
      el.className = "hom-custom-marker";
      el.style.cursor = "pointer";
      el.style.transform = "translate(-50%, -100%)";

      el.innerHTML = `
        <div style="
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: ${isSelected ? "40px" : "32px"};
          height: ${isSelected ? "40px" : "32px"};
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          background: ${isSelected ? "#493C46" : "#F6E4EC"};
          border: 2px solid ${isSelected ? "#FFF8F5" : "#493C46"};
          box-shadow: 0 4px 12px rgba(73, 60, 70, 0.25);
          transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        ">
          <svg style="transform: rotate(45deg); width: 14px; height: 14px; color: ${isSelected ? "#FFF8F5" : "#493C46"}; fill: ${isSelected ? "#F6E4EC" : "#493C46"};" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          ${(place.memoryCount || 0) > 1 ? `
            <span style="
              position: absolute;
              top: -6px;
              right: -6px;
              transform: rotate(45deg);
              background: #E4F0E8;
              color: #493C46;
              font-family: sans-serif;
              font-size: 10px;
              font-weight: 700;
              width: 18px;
              height: 18px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 1.5px solid #493C46;
            ">${place.memoryCount}</span>
          ` : ""}
        </div>
      `;

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelectedLocationId(place.id);
        map.flyTo({
          center: [place.longitude, place.latitude],
          zoom: Math.max(map.getZoom(), 9),
          speed: 1.2,
          essential: true,
        });
        showSecurePopup(place);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([place.longitude, place.latitude])
        .addTo(map);

      markersRef.current.set(place.id, marker);
    });
  }, [locations, selectedLocationId, showSecurePopup]);

  // Clean up preview pin when exiting pin mode
  const handleCancelPinMode = () => {
    setIsAddingPin(false);
    setNewPinCoords(null);
    setNewPlaceName("");
    setNewPlaceAddress("");
    setNewPlaceCity("");
    setNewPlaceCountry("");
    setNewPlaceDesc("");
    setSelectedMemoryIds([]);
    setGeocodeQuery("");
    setGeocodeResults([]);
    setShowGeocodeDropdown(false);

    if (previewMarkerRef.current) {
      previewMarkerRef.current.remove();
      previewMarkerRef.current = null;
    }
  };

  // Select place from list
  const handleSelectLocation = (place: MemoryLocationRecord) => {
    setSelectedLocationId(place.id);
    if (mapInstance.current) {
      mapInstance.current.flyTo({
        center: [place.longitude, place.latitude],
        zoom: 12,
        speed: 1.3,
        curve: 1.4,
        essential: true,
      });
      showSecurePopup(place);
    }
  };

  // Fit bounds to all places
  const fitAllPlaces = () => {
    if (!mapInstance.current || locations.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    locations.forEach((p) => bounds.extend([p.longitude, p.latitude]));
    mapInstance.current.fitBounds(bounds, { padding: 60, maxZoom: 14, speed: 1.2 });
  };

  // Perform geocode search
  const handleGeocodeSearch = async (val: string) => {
    setGeocodeQuery(val);
    if (val.trim().length < 2) {
      setGeocodeResults([]);
      setShowGeocodeDropdown(false);
      return;
    }

    setIsSearchingGeocode(true);
    try {
      const res = await fetch(`/api/locations/geocode?q=${encodeURIComponent(val)}`);
      if (res.ok) {
        const data = await res.json();
        setGeocodeResults(data.results || []);
        setShowGeocodeDropdown(true);
      }
    } catch (err) {
      console.error("Geocoding failed:", err);
    } finally {
      setIsSearchingGeocode(false);
    }
  };

  // Choose geocoded result
  const handleSelectGeocodeResult = (item: GeocodeResult) => {
    setNewPinCoords([item.longitude, item.latitude]);
    setNewPlaceName(item.name || item.displayName.split(",")[0]);
    setNewPlaceAddress(item.displayName);
    if (item.city) setNewPlaceCity(item.city);
    if (item.country) setNewPlaceCountry(item.country);
    setShowGeocodeDropdown(false);

    if (mapInstance.current) {
      mapInstance.current.flyTo({
        center: [item.longitude, item.latitude],
        zoom: 13,
        speed: 1.4,
      });

      if (!previewMarkerRef.current) {
        onMapClickRef.current([item.longitude, item.latitude]);
      } else {
        previewMarkerRef.current.setLngLat([item.longitude, item.latitude]);
      }
    }
  };

  // Save new pin
  const handleSavePin = async () => {
    if (!newPinCoords || !newPlaceName.trim()) return;

    setIsSavingPin(true);
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPlaceName.trim(),
          latitude: newPinCoords[1],
          longitude: newPinCoords[0],
          address: newPlaceAddress.trim() || undefined,
          city: newPlaceCity.trim() || undefined,
          country: newPlaceCountry.trim() || undefined,
          description: newPlaceDesc.trim() || undefined,
          memoryIds: selectedMemoryIds,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save location");
      }

      const data = await res.json();
      const savedLoc = data.location;

      setLocations((prev) => [savedLoc, ...prev]);
      setSelectedLocationId(savedLoc.id);
      handleCancelPinMode();

      if (mapInstance.current) {
        mapInstance.current.flyTo({
          center: [savedLoc.longitude, savedLoc.latitude],
          zoom: 12,
          speed: 1.2,
        });
        showSecurePopup(savedLoc);
      }
    } catch (err: any) {
      alert(err?.message || "Failed to save pin.");
    } finally {
      setIsSavingPin(false);
    }
  };

  // Delete location pin (confirmation preserves memories)
  const handleDeleteLocation = async (id: string) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to remove this location pin? All attached memories will remain completely safe and preserved in your archive."
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/locations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete location");

      setLocations((prev) => prev.filter((l) => l.id !== id));
      if (selectedLocationId === id) {
        setSelectedLocationId(null);
      }
      if (activeDrawerLocation?.id === id) {
        setActiveDrawerLocation(null);
      }
      if (activePopupRef.current) {
        activePopupRef.current.remove();
        activePopupRef.current = null;
      }
    } catch (err: any) {
      alert(err?.message || "Failed to delete location pin.");
    }
  };

  const filteredPlaces = locations.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.city && p.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.country && p.country.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/70 backdrop-blur-md p-3.5 rounded-2xl border border-plum/10 shadow-paper">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-plum/50 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter memory footprints by name, city, or country..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs font-sans rounded-xl bg-cream-100/80 border border-plum/15 text-plum placeholder:text-plum/40 focus:outline-none focus:border-plum/40 focus:bg-white transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {locations.length > 0 && webGlAvailable && (
            <button
              onClick={fitAllPlaces}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-plum bg-sage/60 hover:bg-sage border border-plum/10 transition-all shadow-sm"
              title="Fit map view to all pinned locations"
            >
              <Maximize2 className="w-3.5 h-3.5 text-plum/80" />
              <span>Fit All Places</span>
            </button>
          )}

          {/* Explicit demo toggle for previewing sample footprints */}
          {locations.length === 0 && (
            <button
              onClick={() => loadLocations(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-plum bg-butter/80 hover:bg-butter border border-plum/15 transition-all shadow-sm"
              title="Preview demo places"
            >
              <Sparkles className="w-3.5 h-3.5 text-plum/70" />
              <span>Preview Demo Footprints</span>
            </button>
          )}

          <button
            onClick={() => {
              if (isAddingPin) {
                handleCancelPinMode();
              } else {
                setIsAddingPin(true);
              }
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all shadow-sm ${
              isAddingPin
                ? "bg-plum text-white border border-plum"
                : "bg-blush hover:bg-blush/80 text-plum border border-plum/15"
            }`}
          >
            {isAddingPin ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{isAddingPin ? "Cancel Pin Mode" : "Drop New Pin"}</span>
          </button>
        </div>
      </div>

      {/* Pin Mode Creator Panel */}
      {isAddingPin && (
        <div className="p-4 rounded-3xl bg-cream-100 border border-plum/20 shadow-float animate-fade-in space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-plum/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-plum text-white flex items-center justify-center shrink-0 shadow-sm">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-serif text-sm font-bold text-plum">
                  Pin a New Memory Landmark
                </h4>
                <p className="text-[11px] text-plum/70">
                  {newPinCoords
                    ? `Pinned at: [${newPinCoords[1].toFixed(5)}, ${newPinCoords[0].toFixed(5)}] — drag marker to refine`
                    : "Search a place below or click anywhere on the map to drop a pin"}
                </p>
              </div>
            </div>

            <button
              onClick={handleCancelPinMode}
              className="self-end sm:self-auto text-xs text-plum/60 hover:text-plum flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          </div>

          {/* Place Search (OpenStreetMap Geocoding) */}
          <div className="relative">
            <label className="block text-[11px] font-semibold text-plum/80 mb-1">
              Search Address, Landmark, or City (Automatic Placement)
            </label>
            <div className="relative">
              <Compass className="w-4 h-4 text-plum/50 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Type e.g. Eiffel Tower, Amalfi Coast, Kyoto Station..."
                value={geocodeQuery}
                onChange={(e) => handleGeocodeSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-plum/20 bg-white text-plum focus:outline-none focus:border-plum"
              />
              {isSearchingGeocode && (
                <Loader2 className="w-4 h-4 text-plum/50 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
              )}
            </div>

            {/* Geocode Results Dropdown */}
            {showGeocodeDropdown && geocodeResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl border border-plum/15 shadow-float z-30 overflow-hidden divide-y divide-plum/5 max-h-48 overflow-y-auto">
                {geocodeResults.map((result, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectGeocodeResult(result)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-cream-100 transition-colors flex items-start gap-2.5"
                  >
                    <MapPin className="w-3.5 h-3.5 text-plum/60 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-plum">{result.name}</p>
                      <p className="text-[10px] text-plum/60 truncate">{result.displayName}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-plum/70 mb-1">
                Landmark / Place Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Cozy Corner Bookstore"
                value={newPlaceName}
                onChange={(e) => setNewPlaceName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-plum/20 bg-white text-plum focus:outline-none focus:border-plum"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-plum/70 mb-1">
                City / Region
              </label>
              <input
                type="text"
                placeholder="e.g. Kyoto, Japan"
                value={newPlaceCity}
                onChange={(e) => setNewPlaceCity(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-plum/20 bg-white text-plum focus:outline-none focus:border-plum"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-plum/70 mb-1">
                Country
              </label>
              <input
                type="text"
                placeholder="e.g. Japan"
                value={newPlaceCountry}
                onChange={(e) => setNewPlaceCountry(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-plum/20 bg-white text-plum focus:outline-none focus:border-plum"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-plum/70 mb-1">
              Personal Story / Note
            </label>
            <textarea
              placeholder="What made this place so special to both of us?"
              value={newPlaceDesc}
              onChange={(e) => setNewPlaceDesc(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-xs rounded-xl border border-plum/20 bg-white text-plum focus:outline-none focus:border-plum"
            />
          </div>

          {/* Link Existing Memories */}
          {availableMemories.length > 0 && (
            <div>
              <label className="block text-[10px] font-semibold text-plum/70 mb-1.5">
                Attach Existing Memories to this Place ({selectedMemoryIds.length} selected)
              </label>
              <div className="flex gap-2 overflow-x-auto pb-1 max-h-24">
                {availableMemories.map((mem) => {
                  const isChecked = selectedMemoryIds.includes(mem.id);
                  return (
                    <button
                      key={mem.id}
                      type="button"
                      onClick={() => {
                        setSelectedMemoryIds((prev) =>
                          isChecked
                            ? prev.filter((id) => id !== mem.id)
                            : [...prev, mem.id]
                        );
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-2 border shrink-0 transition-all ${
                        isChecked
                          ? "bg-plum text-white border-plum"
                          : "bg-white text-plum/80 border-plum/15 hover:bg-cream-200"
                      }`}
                    >
                      {isChecked ? (
                        <Check className="w-3 h-3 text-white" />
                      ) : (
                        <ImageIcon className="w-3 h-3 text-plum/50" />
                      )}
                      <span className="truncate max-w-[140px]">{mem.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={handleCancelPinMode}
              className="px-4 py-2 text-xs font-medium text-plum/70 hover:text-plum"
            >
              Cancel
            </button>
            <button
              onClick={handleSavePin}
              disabled={isSavingPin || !newPinCoords || !newPlaceName.trim()}
              className="px-5 py-2 rounded-xl bg-plum text-white text-xs font-semibold hover:bg-plum/90 disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-sm"
            >
              {isSavingPin ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Footprint...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm & Save Pin</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Main Map + Locations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Canvas / WebGL Fallback (2 Columns) */}
        <div className="lg:col-span-2 relative h-[540px] rounded-3xl overflow-hidden border border-plum/15 shadow-paper bg-cream-300/40 flex flex-col">
          {webGlAvailable ? (
            <>
              <div ref={mapContainer} className="w-full h-full" />
              {/* Floating Overlay Badge */}
              <div className="absolute top-4 left-4 z-10 pointer-events-none">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-plum/10 shadow-sm text-plum text-[11px] font-medium">
                  <Navigation className="w-3 h-3 text-plum/70" />
                  <span>Interactive OpenStreetMap</span>
                </div>
              </div>
            </>
          ) : (
            /* Graceful WebGL Unavailable Fallback */
            <div className="w-full h-full p-8 flex flex-col items-center justify-center text-center bg-cream-200/60">
              <div className="w-14 h-14 rounded-full bg-blush flex items-center justify-center text-plum mb-4 shadow-sm">
                <Compass className="w-7 h-7" />
              </div>
              <h3 className="font-serif text-xl font-bold text-plum mb-2">
                Memory Map (Accessible View)
              </h3>
              <p className="text-xs text-plum/70 max-w-md mb-6 leading-relaxed">
                WebGL hardware acceleration is currently disabled or unsupported in this browser environment. Your memory locations and moments remain fully accessible and interactive in the list beside.
              </p>
              <button
                onClick={() => setIsAddingPin(true)}
                className="px-4 py-2 rounded-xl bg-plum text-white text-xs font-medium hover:bg-plum/90 transition-all shadow-sm flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Memory Location</span>
              </button>
            </div>
          )}
        </div>

        {/* Places List Panel (1 Column) */}
        <div className="space-y-3 flex flex-col h-[540px]">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-serif text-base font-bold text-plum">
              Memory Footprints ({filteredPlaces.length})
            </h3>
            <span className="text-[11px] text-plum/60 font-sans">
              Click place to view moments
            </span>
          </div>

          <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 custom-scrollbar">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-plum/40 animate-spin" />
              </div>
            ) : filteredPlaces.length === 0 ? (
              /* Polished Warm Empty State */
              <div className="h-full flex flex-col items-center justify-center p-6 text-center rounded-3xl bg-white/60 border border-dashed border-plum/20">
                <div className="w-12 h-12 rounded-full bg-blush/80 flex items-center justify-center text-plum mb-3 shadow-sm">
                  <Compass className="w-6 h-6 text-plum/80" />
                </div>
                <h4 className="font-serif text-base font-bold text-plum mb-1">
                  No Footprints Yet
                </h4>
                <p className="text-xs text-plum/60 max-w-xs leading-relaxed mb-4">
                  You haven&apos;t pinned any memory locations yet. Drop your first pin across the globe or link your special moments to a place you visited together.
                </p>
                <button
                  onClick={() => setIsAddingPin(true)}
                  className="px-4 py-2 rounded-xl bg-plum text-white text-xs font-medium hover:bg-plum/90 transition-all shadow-sm flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Drop First Pin</span>
                </button>
              </div>
            ) : (
              filteredPlaces.map((place) => {
                const isSelected = place.id === selectedLocationId;
                const safeImage = sanitizeImageUrl(place.coverImageUrl);

                return (
                  <div
                    key={place.id}
                    onClick={() => handleSelectLocation(place)}
                    className={`p-3.5 rounded-2xl transition-all cursor-pointer flex items-center justify-between border ${
                      isSelected
                        ? "bg-white border-plum/40 shadow-float ring-2 ring-plum/10"
                        : "bg-white/80 hover:bg-white border-plum/10 shadow-paper hover:shadow-float"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {safeImage ? (
                        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-plum/10 bg-cream-200">
                          <img
                            src={safeImage}
                            alt={place.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected ? "bg-plum text-white" : "bg-sage/60 text-plum/70"
                          }`}
                        >
                          <MapPin className="w-5 h-5" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <h4 className="font-serif text-sm font-semibold text-plum truncate">
                          {place.name}
                        </h4>
                        <p className="text-[11px] text-plum/60 truncate">
                          {[place.city, place.country].filter(Boolean).join(", ") || place.address || "Memory Landmark"}
                        </p>
                        <p className="text-[10px] text-plum/40 mt-0.5">
                          {new Date(place.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2 pl-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blush/70 text-plum text-[11px] font-handwriting font-bold">
                        <Heart className="w-2.5 h-2.5 fill-plum text-plum" />
                        {place.memoryCount || 0}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLocation(place.id);
                        }}
                        title="Delete this location pin"
                        className="p-1 rounded-lg text-plum/30 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Linked Memories Drawer / Modal */}
      {activeDrawerLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-plum/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-cream-100 rounded-3xl border border-plum/20 shadow-float max-w-xl w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-plum/10">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-plum/60">
                  {[activeDrawerLocation.city, activeDrawerLocation.country].filter(Boolean).join(", ") || "Pinned Landmark"}
                </span>
                <h3 className="font-serif text-xl font-bold text-plum">
                  {activeDrawerLocation.name}
                </h3>
              </div>
              <button
                onClick={() => setActiveDrawerLocation(null)}
                className="w-8 h-8 rounded-full bg-white border border-plum/15 flex items-center justify-center text-plum hover:bg-cream-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeDrawerLocation.description && (
              <p className="text-xs text-plum/80 leading-relaxed italic bg-white/60 p-3 rounded-xl border border-plum/10">
                &ldquo;{activeDrawerLocation.description}&rdquo;
              </p>
            )}

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
              <h4 className="font-serif text-sm font-bold text-plum">
                Moments Captured Here ({activeDrawerLocation.memories?.length || 0})
              </h4>

              {(!activeDrawerLocation.memories || activeDrawerLocation.memories.length === 0) ? (
                <div className="p-6 text-center rounded-2xl bg-white/50 border border-dashed border-plum/20">
                  <p className="text-xs text-plum/60">
                    No memories are linked to this spot yet.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeDrawerLocation.memories.map((m) => {
                    const safeUrl = sanitizeImageUrl(m.imageUrl);
                    return (
                      <div
                        key={m.id}
                        className="p-2.5 rounded-2xl bg-white border border-plum/10 shadow-paper space-y-2"
                      >
                        {safeUrl && (
                          <div className="w-full h-32 rounded-xl overflow-hidden bg-cream-200">
                            <img
                              src={safeUrl}
                              alt={m.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div>
                          <h5 className="font-serif text-xs font-bold text-plum truncate">
                            {m.title}
                          </h5>
                          {m.caption && (
                            <p className="text-[11px] text-plum/70 line-clamp-2">
                              {m.caption}
                            </p>
                          )}
                          <span className="text-[10px] text-plum/40 mt-1 block">
                            {m.date}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-plum/10 flex items-center justify-between">
              <button
                onClick={() => handleDeleteLocation(activeDrawerLocation.id)}
                className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Pin</span>
              </button>
              <button
                onClick={() => setActiveDrawerLocation(null)}
                className="px-4 py-2 rounded-xl bg-plum text-white text-xs font-semibold hover:bg-plum/90 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
