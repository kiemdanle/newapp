import { describe, it, expect } from '@jest/globals';
import { parseShadow } from './shadow';

describe('parseShadow', () => {
  it('parses "x y blur color" form', () => {
    const r = parseShadow('0 4px 12px rgba(0,0,0,0.12)');
    expect(r.shadowOffset).toEqual({ width: 0, height: 4 });
    expect(r.shadowRadius).toBe(12);
    expect(r.shadowColor).toBe('rgba(0,0,0,0.12)');
    expect(r.shadowOpacity).toBe(1);
    expect(r.elevation).toBeGreaterThanOrEqual(2);
  });

  it('handles negative y offsets', () => {
    const r = parseShadow('0 -2px 4px rgba(255,255,255,0.5)');
    expect(r.shadowOffset).toEqual({ width: 0, height: -2 });
  });

  it('handles a separate opacity in a 5-segment form (x y blur color opacity)', () => {
    const r = parseShadow('0 8px 24px #000000 0.16');
    expect(r.shadowColor).toBe('#000000');
    expect(r.shadowOpacity).toBe(0.16);
  });
});
