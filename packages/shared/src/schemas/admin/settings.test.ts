import { describe, expect, it } from 'vitest';
import {
  productCreationSettingsSchema,
  photoLimitsSettingsSchema,
  DEFAULT_PHOTO_LIMITS,
  PHOTO_COMPRESSION_CONFIG,
} from './settings.js';

describe('productCreationSettingsSchema', () => {
  it('accepts off, internal, and all modes', () => {
    for (const mode of ['off', 'internal', 'all']) {
      expect(productCreationSettingsSchema.parse({ mode })).toEqual({ mode, requireApproval: false });
    }
  });

  it('rejects an unknown mode', () => {
    expect(() => productCreationSettingsSchema.parse({ mode: 'everyone' })).toThrow();
  });

  it('rejects a missing mode', () => {
    expect(() => productCreationSettingsSchema.parse({})).toThrow();
  });

  it('matches the default-off shape inserted by the expand migration', () => {
    expect(productCreationSettingsSchema.parse({ mode: 'off' })).toEqual({ mode: 'off', requireApproval: false });
  });

  it('accepts and defaults requireApproval', () => {
    expect(productCreationSettingsSchema.parse({ mode: 'all' })).toEqual({ mode: 'all', requireApproval: false });
    expect(productCreationSettingsSchema.parse({ mode: 'all', requireApproval: true })).toEqual({
      mode: 'all',
      requireApproval: true,
    });
  });
});

describe('photoLimitsSettingsSchema & PHOTO_COMPRESSION_CONFIG', () => {
  it('applies default limits when empty object is passed', () => {
    expect(photoLimitsSettingsSchema.parse({})).toEqual({
      maxProductPhotos: 5,
      maxPantryItemPhotos: 5,
    });
    expect(DEFAULT_PHOTO_LIMITS).toEqual({
      maxProductPhotos: 5,
      maxPantryItemPhotos: 5,
    });
  });

  it('accepts valid photo limits between 1 and 20', () => {
    expect(photoLimitsSettingsSchema.parse({ maxProductPhotos: 1, maxPantryItemPhotos: 20 })).toEqual({
      maxProductPhotos: 1,
      maxPantryItemPhotos: 20,
    });
    expect(photoLimitsSettingsSchema.parse({ maxProductPhotos: 10, maxPantryItemPhotos: 8 })).toEqual({
      maxProductPhotos: 10,
      maxPantryItemPhotos: 8,
    });
  });

  it('rejects photo limits below 1 or above 20', () => {
    expect(() => photoLimitsSettingsSchema.parse({ maxProductPhotos: 0 })).toThrow(/At least 1 product photo/);
    expect(() => photoLimitsSettingsSchema.parse({ maxPantryItemPhotos: 21 })).toThrow(/Maximum allowed pantry item photos is 20/);
    expect(() => photoLimitsSettingsSchema.parse({ maxProductPhotos: -5 })).toThrow();
    expect(() => photoLimitsSettingsSchema.parse({ maxProductPhotos: 2.5 })).toThrow(/must be an integer/);
  });

  it('exports standard photo compression config with strict bounded ladder', () => {
    expect(PHOTO_COMPRESSION_CONFIG.maxDimensionPx).toBe(1920);
    expect(PHOTO_COMPRESSION_CONFIG.qualityFloor).toBe(0.7);
    expect(PHOTO_COMPRESSION_CONFIG.qualitySteps).toEqual([0.82, 0.72, 0.7]);
    expect(PHOTO_COMPRESSION_CONFIG.maxFileBytes).toBe(1024 * 1024);
  });
});
