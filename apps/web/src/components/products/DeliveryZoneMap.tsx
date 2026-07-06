'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap } from 'leaflet';
import { DELIVERY_ZONE_POLYGON } from '@/lib/geo';

/**
 * Mapa aproximado de la zona de reparto. Dibuja el polígono de la zona sobre
 * tiles de OpenStreetMap. Leaflet se importa dinámicamente (usa `window`), por
 * eso todo ocurre dentro del efecto en el cliente.
 */
export function DeliveryZoneMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const latlngs = DELIVERY_ZONE_POLYGON.map((p) => [p.lat, p.lng] as [number, number]);
      const map = L.map(containerRef.current, { scrollWheelZoom: false, attributionControl: true });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(map);

      const poly = L.polygon(latlngs, {
        color: '#C62828',
        weight: 2,
        fillColor: '#C62828',
        fillOpacity: 0.15,
      }).addTo(map);

      map.fitBounds(poly.getBounds(), { padding: [12, 12] });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ height: 220, width: '100%', borderRadius: 8, overflow: 'hidden', zIndex: 0 }}
    />
  );
}
