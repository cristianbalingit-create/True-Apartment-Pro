import React, { useEffect, useRef, useState } from "react";
import { MapPin, Navigation } from "lucide-react";

declare global {
  interface Window {
    L: any;
  }
}

export interface MapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
}

interface PropertyMapProps {
  points?: MapPoint[];
  value?: { lat: number; lng: number } | null;
  onChange?: (point: { lat: number; lng: number; address?: string }) => void;
  height?: number | string;
  zoom?: number;
  interactive?: boolean;
  className?: string;
}

const DEFAULT_CENTER: [number, number] = [7.8257, 123.4370]; // Pagadian City

function configureLeafletIcons(L: any) {
  try {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      tooltipAnchor: [16, -28],
      shadowSize: [41, 41],
    });
  } catch (e) {
    // Ignore any icon override warnings
  }
}

export default function PropertyMap({
  points = [],
  value = null,
  onChange,
  height = 360,
  zoom = 14,
  interactive = false,
  className = "",
}: PropertyMapProps) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const pinRef = useRef<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(typeof window !== "undefined" && !!window.L);

  // Poll for Leaflet if not yet loaded
  useEffect(() => {
    if (typeof window === "undefined" || window.L) {
      setLeafletLoaded(true);
      return;
    }
    const interval = setInterval(() => {
      if (window.L) {
        setLeafletLoaded(true);
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!leafletLoaded || !mapEl.current || !window.L) return;
    const L = window.L;
    configureLeafletIcons(L);

    // If map already initialized on this container, clean it up
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const validPoints = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    const initial: [number, number] = value && Number.isFinite(value.lat) && Number.isFinite(value.lng)
      ? [value.lat, value.lng]
      : validPoints.length > 0
      ? [validPoints[0].lat, validPoints[0].lng]
      : DEFAULT_CENTER;

    const map = L.map(mapEl.current, {
      zoomControl: true,
      scrollWheelZoom: true,
      dragging: true,
    }).setView(initial, zoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    mapRef.current = map;

    // Small delay to ensure container dimension is rendered properly
    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    if (interactive && onChange) {
      map.on("click", async (e: any) => {
        const { lat, lng } = e.latlng;
        if (pinRef.current) pinRef.current.remove();
        pinRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);

        const update = async (p: { lat: number; lng: number }) => {
          let address = "";
          try {
            const r = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(p.lat)}&lon=${encodeURIComponent(p.lng)}`,
              { headers: { Accept: "application/json" } }
            );
            if (r.ok) {
              const data = await r.json();
              address = String(data?.display_name || "");
            }
          } catch {
            // Address lookup is best-effort
          }
          onChange({ lat: p.lat, lng: p.lng, address });
          if (address && pinRef.current) {
            pinRef.current.bindTooltip(address, { permanent: false });
          }
        };

        await update({ lat, lng });

        pinRef.current.on("dragend", async (ev: any) => {
          const pos = ev.target.getLatLng();
          await update({ lat: pos.lat, lng: pos.lng });
        });
      });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [leafletLoaded, interactive]);

  // Update Points / Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.L) return;
    const L = window.L;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const validPoints = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    validPoints.forEach((p) => {
      const marker = L.marker([p.lat, p.lng]).addTo(map);
      marker.bindTooltip(p.name, {
        permanent: true,
        direction: "top",
        offset: [0, -18],
        className: "rentflow-map-label",
      });
      if (p.address) {
        marker.bindPopup(`<strong>${escapeHtml(p.name)}</strong><br/><span style="font-size:12px;color:#64748b;">${escapeHtml(p.address)}</span>`);
      }
      markersRef.current.push(marker);
    });

    if (validPoints.length > 1) {
      const bounds = L.latLngBounds(validPoints.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    } else if (validPoints.length === 1) {
      map.setView([validPoints[0].lat, validPoints[0].lng], zoom);
    }
  }, [points, zoom]);

  // Update Interactive Value Pin. Existing pins remain draggable so edits can fine-tune
  // the saved location and immediately update the parent form.
  useEffect(() => {
    if (!mapRef.current || !window.L || !interactive) return;
    const L = window.L;

    const notifyChange = async (lat: number, lng: number) => {
      if (!onChange) return;
      let address = "";
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`,
          { headers: { Accept: "application/json" } }
        );
        if (r.ok) {
          const data = await r.json();
          address = String(data?.display_name || "");
        }
      } catch {
        // Best-effort address lookup; coordinates are still saved.
      }
      onChange({ lat, lng, address });
    };

    if (value && Number.isFinite(value.lat) && Number.isFinite(value.lng)) {
      if (!pinRef.current) {
        pinRef.current = L.marker([value.lat, value.lng], { draggable: true }).addTo(mapRef.current);
        pinRef.current.on("dragend", async (ev: any) => {
          const pos = ev.target.getLatLng();
          await notifyChange(pos.lat, pos.lng);
        });
      } else {
        pinRef.current.setLatLng([value.lat, value.lng]);
      }
      mapRef.current.setView([value.lat, value.lng], Math.max(mapRef.current.getZoom(), zoom));
    }
  }, [value, interactive, zoom, onChange]);

  if (!leafletLoaded) {
    return (
      <div
        className={`w-full rounded-2xl overflow-hidden border border-slate-200 bg-[#F1E5A1]/25 flex items-center justify-center p-6 ${className}`}
        style={{ height }}
      >
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Navigation className="w-5 h-5 animate-spin text-brand-orange" />
          <span>Loading map...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mapEl}
      className={`rentflow-map-theme w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative z-0 ${className}`}
      style={{ height }}
    />
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]!));
}
