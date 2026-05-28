import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mapOffProduct, mapUpcitemdbProduct } from '../../src/services/products/mappers.js';

const off = JSON.parse(readFileSync(resolve('tests/helpers/fixtures/off-cola.json'), 'utf8'));
const upc = JSON.parse(readFileSync(resolve('tests/helpers/fixtures/upcitemdb-soap.json'), 'utf8'));

describe('product mappers', () => {
  it('maps an OFF product', () => {
    const mapped = mapOffProduct('5449000000996', off);
    expect(mapped).not.toBeNull();
    expect(mapped!.barcode).toBe('5449000000996');
    expect(mapped!.name).toBe('Coca-Cola');
    expect(mapped!.brand).toBe('Coca-Cola');
    expect(mapped!.source).toBe('off');
    expect(mapped!.sourceId).toBe('5449000000996');
    expect(mapped!.imageUrl).toContain('openfoodfacts');
  });

  it('returns null when OFF status != 1', () => {
    expect(mapOffProduct('x', { status: 0 })).toBeNull();
  });

  it('maps a UPCitemdb item', () => {
    const mapped = mapUpcitemdbProduct('0012345678905', upc);
    expect(mapped).not.toBeNull();
    expect(mapped!.name).toBe('Lemon Dish Soap 16oz');
    expect(mapped!.brand).toBe('SudsCo');
    expect(mapped!.source).toBe('upcitemdb');
    expect(mapped!.imageUrl).toBe('https://example.com/soap.jpg');
  });

  it('returns null when UPCitemdb items array empty', () => {
    expect(mapUpcitemdbProduct('x', { code: 'OK', total: 0, items: [] })).toBeNull();
  });
});
