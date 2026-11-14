import { pool } from '../config.js';

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Returns the closest known campus spot, or null if none is within maxMeters.
export async function nearestLocation(lat, lng, maxMeters = 150) {
  const { rows } = await pool.query('SELECT label, lat, lng FROM locations');
  let best = null;
  for (const l of rows) {
    const d = haversineKm(lat, lng, l.lat, l.lng) * 1000;
    if (!best || d < best.distance_m) best = { label: l.label, lat: l.lat, lng: l.lng, distance_m: Math.round(d) };
  }
  return best && best.distance_m <= maxMeters ? best : null;
}
