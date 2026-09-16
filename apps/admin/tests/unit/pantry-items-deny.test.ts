import { describe, expect, it } from 'vitest';
import PantryItemsPage from '@/app/(admin)/pantry-items/page';
import PantryItemDetailPage from '@/app/(admin)/pantry-items/[id]/page';

describe('Pantry Items Admin Denial', () => {
  it('PantryItemsPage triggers notFound() (404) immediately without data fetching', async () => {
    await expect(
      PantryItemsPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  });

  it('PantryItemDetailPage triggers notFound() (404) immediately without data fetching', async () => {
    await expect(
      PantryItemDetailPage({
        params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000000' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  });
});
