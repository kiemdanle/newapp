// Spherical distance calculation and bounding-box geometry helpers
const EARTH_RADIUS_KM = 6371.0;
const KM_PER_LAT_DEGREE = 111.045;

/**
 * Calculates the great-circle distance between two coordinate pairs using
 * the Haversine formula, returned in kilometres.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  return Math.round(distance * 10) / 10;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/**
 * Computes a bounding box surrounding a center coordinate for a given radius in km.
 * Used for database B-tree index pre-filtering before applying precise Haversine math.
 */
export function computeBoundingBox(lat0: number, lon0: number, radiusKm: number): BoundingBox {
  const deltaLat = radiusKm / KM_PER_LAT_DEGREE;
  const minLat = Math.max(-90, lat0 - deltaLat);
  const maxLat = Math.min(90, lat0 + deltaLat);

  // Avoid division by zero at the poles
  const latRad = (lat0 * Math.PI) / 180;
  const cosLat = Math.max(0.01, Math.cos(latRad));
  const deltaLon = radiusKm / (KM_PER_LAT_DEGREE * cosLat);

  const minLon = lon0 - deltaLon;
  const maxLon = lon0 + deltaLon;

  return {
    minLat,
    maxLat,
    minLon,
    maxLon,
  };
}
