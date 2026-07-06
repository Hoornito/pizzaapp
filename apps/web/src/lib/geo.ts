// Geocercado (geofence) de la zona de reparto. Se usa junto con la geocodificación
// de la dirección (ver /api/geocode) para decidir si un pedido de delivery entra
// dentro de la zona permitida.

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Polígono que delimita la zona de reparto (San Vicente, Buenos Aires).
 * Coordenadas aproximadas del ejido urbano — EDITAR acá para ajustar la zona
 * (o achicarla/agrandarla). El orden de los puntos recorre el borde.
 */
export const DELIVERY_ZONE_POLYGON: LatLng[] = [
  { lat: -34.985, lng: -58.478 }, // NO
  { lat: -34.985, lng: -58.360 }, // NE
  { lat: -35.072, lng: -58.360 }, // SE
  { lat: -35.072, lng: -58.478 }, // SO
];

/**
 * ¿El punto está dentro del polígono? Algoritmo de ray casting (punto-en-polígono).
 * Funciona con coordenadas geográficas para áreas chicas como una ciudad.
 */
export function pointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
