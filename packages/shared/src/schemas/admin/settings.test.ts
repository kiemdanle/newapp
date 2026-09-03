import { describe, expect, it } from 'vitest';
import { productCreationSettingsSchema } from './settings.js';

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
