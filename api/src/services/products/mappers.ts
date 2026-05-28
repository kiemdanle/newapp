export interface ExternalProductData {
  barcode: string;
  name: string;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  source: 'off' | 'upcitemdb';
  sourceId: string;
}

interface OffResponse {
  status?: number;
  product?: {
    product_name?: string;
    brands?: string;
    categories?: string;
    image_url?: string;
  };
}

export function mapOffProduct(barcode: string, raw: unknown): ExternalProductData | null {
  const r = raw as OffResponse;
  if (!r || r.status !== 1 || !r.product) return null;
  const name = r.product.product_name?.trim();
  if (!name) return null;
  const brand = r.product.brands?.split(',')[0]?.trim() || null;
  const category = r.product.categories?.split(',')[0]?.trim() || null;
  return {
    barcode,
    name,
    brand,
    category,
    imageUrl: r.product.image_url ?? null,
    source: 'off',
    sourceId: barcode,
  };
}

interface UpcResponse {
  code?: string;
  items?: Array<{
    ean?: string;
    upc?: string;
    title?: string;
    brand?: string;
    category?: string;
    images?: string[];
  }>;
}

export function mapUpcitemdbProduct(barcode: string, raw: unknown): ExternalProductData | null {
  const r = raw as UpcResponse;
  const item = r?.items?.[0];
  if (!item || !item.title) return null;
  return {
    barcode,
    name: item.title.trim(),
    brand: item.brand?.trim() || null,
    category: item.category?.split('>').pop()?.trim() || null,
    imageUrl: item.images?.[0] ?? null,
    source: 'upcitemdb',
    sourceId: item.ean ?? item.upc ?? barcode,
  };
}
