import { NextRequest, NextResponse } from 'next/server';

/**
 * Geocodifica una dirección con Nominatim (OpenStreetMap) — gratis, sin API key.
 * Lo hacemos server-side para poder mandar el User-Agent que exige su política de
 * uso y evitar problemas de CORS. Devuelve lat/lng + las áreas administrativas
 * (ciudad/municipio/partido) para validar la zona de reparto.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q');
  if (!q) return NextResponse.json({ error: 'Falta la dirección (q)' }, { status: 400 });

  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1` +
    `&countrycodes=ar&q=${encodeURIComponent(q)}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'PizzeriaCambalache/1.0 (pedidos)',
        'Accept-Language': 'es',
      },
      // Nominatim puede tardar; cortamos a 6s.
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return NextResponse.json({ result: null });
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return NextResponse.json({ result: null });

    const hit = data[0];
    const a = hit.address || {};
    // Distintos niveles que puede devolver OSM para "San Vicente".
    const areas = [
      a.city, a.town, a.village, a.hamlet, a.suburb,
      a.municipality, a.city_district, a.county, a.state_district,
    ].filter(Boolean) as string[];

    return NextResponse.json({
      result: {
        lat: parseFloat(hit.lat),
        lng: parseFloat(hit.lon),
        label: hit.display_name as string,
        areas,
      },
    });
  } catch {
    return NextResponse.json({ result: null });
  }
}
