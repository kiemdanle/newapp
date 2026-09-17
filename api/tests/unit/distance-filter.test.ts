import { describe, it, expect } from 'vitest';
import {
  calculateHaversineDistanceKm,
  computeBoundingBox,
} from '../../src/services/geo/distance.js';

describe('Distance & Bounding Box Utilities', () => {
  describe('calculateHaversineDistanceKm', () => {
    it('returns 0 for identical coordinates', () => {
      const d = calculateHaversineDistanceKm(10.7769, 106.7009, 10.7769, 106.7009);
      expect(d).toBe(0);
    });

    it('accurately calculates local distance (~5.3 km)', () => {
      // D1 to D7 in Ho Chi Minh City
      const d = calculateHaversineDistanceKm(10.7769, 106.7009, 10.7300, 106.7100);
      expect(d).toBeGreaterThanOrEqual(5.0);
      expect(d).toBeLessThanOrEqual(5.6);
    });

    it('accurately calculates long-distance flights (London to Paris ~344 km)', () => {
      const d = calculateHaversineDistanceKm(51.5074, -0.1278, 48.8566, 2.3522);
      expect(d).toBeGreaterThanOrEqual(340);
      expect(d).toBeLessThanOrEqual(350);
    });
  });

  describe('computeBoundingBox', () => {
    it('creates a symmetrical bounding box around the origin', () => {
      const lat = 10.7769;
      const lon = 106.7009;
      const radiusKm = 25;

      const box = computeBoundingBox(lat, lon, radiusKm);
      expect(box.minLat).toBeLessThan(lat);
      expect(box.maxLat).toBeGreaterThan(lat);
      expect(box.minLon).toBeLessThan(lon);
      expect(box.maxLon).toBeGreaterThan(lon);

      // Verify that a point at exactly radiusKm is inside or on the bounding box boundary
      const deltaLat = 25 / 111.045;
      expect(box.maxLat - lat).toBeCloseTo(deltaLat, 3);
    });

    it('clamps latitude at the poles', () => {
      const boxNorth = computeBoundingBox(89.5, 0, 100);
      expect(boxNorth.maxLat).toBe(90);

      const boxSouth = computeBoundingBox(-89.5, 0, 100);
      expect(boxSouth.minLat).toBe(-90);
    });
  });
});
