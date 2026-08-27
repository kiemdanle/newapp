import { describe, expect, it } from 'vitest';
import {
  giveawaySchema,
  giveawayCreateSchema,
  giveawayPatchSchema,
} from './giveaway';

describe('giveaway schemas', () => {
  describe('giveawayCreateSchema', () => {
    it('applies default quantity: 1 and unit: pcs when omitted', () => {
      const parsed = giveawayCreateSchema.parse({
        title: 'Organic Milk',
        locationText: 'District 1',
      });
      expect(parsed.quantity).toBe(1);
      expect(parsed.unit).toBe('pcs');
    });

    it('accepts positive integer and decimal quantities and custom units', () => {
      const parsed = giveawayCreateSchema.parse({
        title: 'Rice Bag',
        locationText: 'District 3',
        quantity: 2.5,
        unit: 'kg',
      });
      expect(parsed.quantity).toBe(2.5);
      expect(parsed.unit).toBe('kg');
    });

    it('rejects zero or negative quantities', () => {
      expect(() =>
        giveawayCreateSchema.parse({
          title: 'Juice',
          locationText: 'Downtown',
          quantity: 0,
        }),
      ).toThrow();

      expect(() =>
        giveawayCreateSchema.parse({
          title: 'Juice',
          locationText: 'Downtown',
          quantity: -1,
        }),
      ).toThrow();
    });
  });

  describe('giveawayPatchSchema', () => {
    it('allows updating quantity and unit', () => {
      const parsed = giveawayPatchSchema.parse({
        quantity: 3,
        unit: 'bottles',
      });
      expect(parsed.quantity).toBe(3);
      expect(parsed.unit).toBe('bottles');
    });
  });

  describe('giveawaySchema', () => {
    it('validates complete giveaway entity with quantity and unit', () => {
      const sample = {
        id: '11111111-1111-4111-8111-111111111111',
        giverUserId: '22222222-2222-4222-8222-222222222222',
        productId: null,
        recordId: '33333333-3333-4333-8333-333333333333',
        title: 'Canned Tomatoes',
        description: 'Unopened can',
        photoUrl: 'https://cdn.expyrico.app/photo1.webp',
        locationText: 'Downtown',
        country: 'VN',
        status: 'open',
        selectedRecipientId: null,
        quantity: 4,
        unit: 'cans',
        expiryDate: '2026-08-30',
        claimExpiresAt: '2026-08-30T12:00:00.000Z',
        createdAt: '2026-08-26T08:00:00.000Z',
        updatedAt: '2026-08-26T08:00:00.000Z',
        handedOffAt: null,
        confirmedAt: null,
        completedAt: null,
      };

      const parsed = giveawaySchema.parse(sample);
      expect(parsed.quantity).toBe(4);
      expect(parsed.unit).toBe('cans');
    });
  });
});
