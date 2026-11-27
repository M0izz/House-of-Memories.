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
  Layers,
  X,
} from "lucide-react";

export interface MemoryLocation {
  id: string;
  name: string;
  location: string;
  date: string;
  count: number;
  coordinates: [number, number]; // [lng, lat]
  description?: string;
  coverImage?: string;
}

const INITIAL_PLACES: MemoryLocation[] = [
  {
    id: "place-1",
    name: "Old Town Corner Café",
    location: "Montmartre, Paris",
    date: "April 2024",
    count: 8,
    coordinates: [2.3429, 48.8867],
    description: "The tiny café where we stayed for 3 hours drinking café au lait under the rain awning.",
    coverImage: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "place-2",
    name: "Sunny Ridge Lookout",
    location: "Positano, Amalfi Coast",
    date: "June 2024",
    count: 14,
    coordinates: [14.485, 40.6281],
    description: "Winding coastal cliffs, golden hour gelato, and the sound of waves hitting the rocks below.",
    coverImage: "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "place-3",
    name: "Midnight Ramen & Jazz Bar",
    location: "Shinjuku, Tokyo",
    date: "August 2024",
    count: 9,
    coordinates: [139.7006, 35.6895],
    description: "Tucked inside an alleyway behind glowing lanterns, listening to vintage vinyl records.",
    coverImage: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "place-4",
    name: "Lakefront Sunset Cabin",
    location: "Bellagio, Lake Como",
    date: "October 2024",
    count: 22,
    coordinates: [9.2572, 45.9934],
    description: "Wooden dock, evening tea, and autumn leaves reflecting on calm crystal clear water.",
    coverImage: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "place-5",
    name: "Sunset Cliffs Ocean Walk",
    location: "San Diego, California",
    date: "January 2025",
    count: 11,
    coordinates: [-117.2567, 32.7196],
    description: "Watching the sun melt into the Pacific Ocean wrapped together in a fleece blanket.",
    coverImage: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80",
  },
];

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
      attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors &copy; <a href=\"https://carto.com/\">CARTO</a>",
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

export default function InteractiveMemoryMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const activePopupRef = useRef<maplibregl.Popup | null>(null);

  const [places, setPlaces] = useState<MemoryLocation[]>(INITIAL_PLACES);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>(INITIAL_PLACES[0].id);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingPin, setIsAddingPin] = useState(false);
  const [newPinCoords, setNewPinCoords] = useState<[number, number] | null>(null);
  const [newPlaceName, setNewPlaceName] = useState("");
  const [newPlaceLocation, setNewPlaceLocation] = useState("");
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainer.current,
        style: process.env.NEXT_PUBLIC_MAP_STYLE_URL || MAP_STYLE,
        center: [10, 40], // European/global view
        zoom: 2.5,
        attributionControl: false,
      });

      // Add navigation controls
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
        setIsMapLoaded(true);
        map.resize();
      });

      // Click on map to drop custom pin when in adding mode
      map.on("click", (e) => {
        if (isAddingPin) {
          setNewPinCoords([e.lngLat.lng, e.lngLat.lat]);
        }
      });

      mapInstance.current = map;
    } catch (err) {
      console.error("Failed to initialize MapLibre GL map:", err);
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [isAddingPin]);

  // Open Popup for place
  const showPopup = useCallback((place: MemoryLocation) => {
    if (!mapInstance.current) return;

    if (activePopupRef.current) {
      activePopupRef.current.remove();
      activePopupRef.current = null;
    }

    const popupHtml = `
      <div style="font-family: var(--font-dmsans, sans-serif); max-width: 240px; padding: 2px;">
        ${place.coverImage ? `
          <div style="width: 100%; height: 110px; border-radius: 12px; overflow: hidden; margin-bottom: 8px;">
            <img src="${place.coverImage}" alt="${place.name}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
        ` : ""}
        <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #493C46;"></span>
          <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(73, 60, 70, 0.6);">${place.location}</span>
        </div>
        <h4 style="font-family: var(--font-playfair, serif); font-size: 15px; font-weight: 700; color: #493C46; margin: 0 0 4px 0; line-height: 1.2;">
          ${place.name}
        </h4>
        ${place.description ? `
          <p style="font-size: 11px; color: rgba(73, 60, 70, 0.75); line-height: 1.4; margin: 0 0 6px 0;">
            ${place.description}
          </p>
        ` : ""}
        <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 6px; border-top: 1px solid rgba(73, 60, 70, 0.1); font-size: 11px;">
          <span style="color: rgba(73, 60, 70, 0.6);">${place.date}</span>
          <span style="font-family: var(--font-caveat, cursive); font-size: 14px; font-weight: 700; color: #493C46;">
            ${place.count} memories
          </span>
        </div>
      </div>
    `;

    const popup = new maplibregl.Popup({
      offset: 25,
      closeButton: true,
      closeOnClick: false,
      className: "hom-memory-popup",
    })
      .setLngLat(place.coordinates)
      .setHTML(popupHtml)
      .addTo(mapInstance.current);

    activePopupRef.current = popup;
  }, []);

  // Update Markers whenever places change
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !isMapLoaded) return;

    // Remove existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    // Create markers for each place
    places.forEach((place) => {
      const isSelected = place.id === selectedPlaceId;

      // Custom marker DOM element
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
          width: ${isSelected ? "38px" : "32px"};
          height: ${isSelected ? "38px" : "32px"};
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          background: ${isSelected ? "#493C46" : "#F6E4EC"};
          border: 2px solid ${isSelected ? "#FFF8F5" : "#493C46"};
          box-shadow: 0 4px 12px rgba(73, 60, 70, 0.25);
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        ">
          <svg style="transform: rotate(45deg); width: 14px; height: 14px; color: ${isSelected ? "#FFF8F5" : "#493C46"}; fill: ${isSelected ? "#F6E4EC" : "#493C46"};" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          ${place.count > 1 ? `
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
            ">${place.count}</span>
          ` : ""}
        </div>
      `;

      el.addEventListener("click", () => {
        setSelectedPlaceId(place.id);
        map.flyTo({
          center: place.coordinates,
          zoom: Math.max(map.getZoom(), 8),
          speed: 1.2,
          essential: true,
        });
        showPopup(place);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(place.coordinates)
        .addTo(map);

      markersRef.current.set(place.id, marker);
    });
  }, [places, selectedPlaceId, isMapLoaded, showPopup]);

  // Fly to selected place
  const selectPlace = (place: MemoryLocation) => {
    setSelectedPlaceId(place.id);
    const map = mapInstance.current;
    if (map) {
      map.flyTo({
        center: place.coordinates,
        zoom: 12,
        speed: 1.4,
        curve: 1.5,
        essential: true,
      });
      showPopup(place);
    }
  };

  // Fit bounds to all places
  const fitAllPlaces = () => {
    const map = mapInstance.current;
    if (!map || places.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();
    places.forEach((p) => bounds.extend(p.coordinates));
    map.fitBounds(bounds, { padding: 60, maxZoom: 14, speed: 1.2 });
  };

  // Handle saving new custom pin
  const handleSavePin = () => {
    if (!newPinCoords || !newPlaceName.trim()) return;

    const newPlace: MemoryLocation = {
      id: `place-${Date.now()}`,
      name: newPlaceName.trim(),
      location: newPlaceLocation.trim() || "Shared Sanctuary",
      date: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      count: 1,
      coordinates: newPinCoords,
      description: "A newly pinned memory location from our journey together.",
    };

    setPlaces((prev) => [newPlace, ...prev]);
    setSelectedPlaceId(newPlace.id);
    setIsAddingPin(false);
    setNewPinCoords(null);
    setNewPlaceName("");
    setNewPlaceLocation("");

    if (mapInstance.current) {
      mapInstance.current.flyTo({
        center: newPlace.coordinates,
        zoom: 12,
        speed: 1.2,
      });
      showPopup(newPlace);
    }
  };

  const filteredPlaces = places.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.location.toLowerCase().includes(searchQuery.toLowerCase())
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
              placeholder="Search cities, cafés, lookouts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs font-sans rounded-xl bg-cream-100/80 border border-plum/15 text-plum placeholder:text-plum/40 focus:outline-none focus:border-plum/40 focus:bg-white transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fitAllPlaces}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-plum bg-sage/60 hover:bg-sage border border-plum/10 transition-all shadow-sm"
            title="Fit view to all locations"
          >
            <Maximize2 className="w-3.5 h-3.5 text-plum/80" />
            <span>Fit All Places</span>
          </button>

          <button
            onClick={() => {
              setIsAddingPin(!isAddingPin);
              setNewPinCoords(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all shadow-sm ${
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

      {/* Pin Mode Banner */}
      {isAddingPin && (
        <div className="p-3.5 rounded-2xl bg-butter/60 border border-plum/15 flex items-center justify-between animate-fade-in shadow-paper">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-plum text-white flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-plum">
                {newPinCoords
                  ? `Selected Location: [${newPinCoords[1].toFixed(4)}, ${newPinCoords[0].toFixed(4)}]`
                  : "Click anywhere on the map to place a memory marker"}
              </p>
              <p className="text-[11px] text-plum/70">
                Pick the exact spot where this special moment happened.
              </p>
            </div>
          </div>

          {newPinCoords && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Place name (e.g. Sunset Point)"
                value={newPlaceName}
                onChange={(e) => setNewPlaceName(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-plum/20 bg-white text-plum focus:outline-none"
              />
              <input
                type="text"
                placeholder="City / Region"
                value={newPlaceLocation}
                onChange={(e) => setNewPlaceLocation(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-plum/20 bg-white text-plum focus:outline-none"
              />
              <button
                onClick={handleSavePin}
                disabled={!newPlaceName.trim()}
                className="px-3 py-1.5 text-xs rounded-lg bg-plum text-white font-medium disabled:opacity-50 hover:bg-plum/90 transition-all shadow-sm"
              >
                Save Pin
              </button>
            </div>
          )}
        </div>
      )}

      {/* Grid: Map (2 Cols) + Places List (1 Col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Map Canvas Container */}
        <div className="lg:col-span-2 relative h-[520px] rounded-3xl overflow-hidden border border-plum/15 shadow-paper bg-cream-300/40">
          <div ref={mapContainer} className="w-full h-full" />

          {/* Map Floating Indicator */}
          <div className="absolute top-4 left-4 z-10 pointer-events-none">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-plum/10 shadow-sm text-plum text-[11px] font-medium">
              <Navigation className="w-3 h-3 text-plum/70 animate-pulse" />
              <span>Interactive OpenStreetMap Canvas</span>
            </div>
          </div>
        </div>

        {/* Places List Panel */}
        <div className="space-y-3 flex flex-col h-[520px]">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-serif text-base font-bold text-plum">
              Memory Footprints ({filteredPlaces.length})
            </h3>
            <span className="text-[11px] text-plum/60 font-sans">
              Click a place to fly
            </span>
          </div>

          <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 custom-scrollbar">
            {filteredPlaces.length === 0 ? (
              <div className="text-center py-12 p-6 rounded-2xl bg-white/50 border border-dashed border-plum/20">
                <p className="text-xs text-plum/70">No places matched your search.</p>
              </div>
            ) : (
              filteredPlaces.map((place) => {
                const isSelected = place.id === selectedPlaceId;
                return (
                  <div
                    key={place.id}
                    onClick={() => selectPlace(place)}
                    className={`p-3.5 rounded-2xl transition-all cursor-pointer flex items-center justify-between border ${
                      isSelected
                        ? "bg-white border-plum/40 shadow-float ring-2 ring-plum/10"
                        : "bg-white/80 hover:bg-white border-plum/10 shadow-paper hover:shadow-float"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {place.coverImage ? (
                        <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-plum/10">
                          <img
                            src={place.coverImage}
                            alt={place.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
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
                          {place.location}
                        </p>
                        <p className="text-[10px] text-plum/40 mt-0.5">
                          {place.date}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right pl-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blush/70 text-plum text-[11px] font-handwriting font-bold">
                        <Heart className="w-2.5 h-2.5 fill-plum text-plum" />
                        {place.count}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
