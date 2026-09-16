import React from 'react';
import { screen } from '@testing-library/react-native';
import {
  ContributedCardSkeleton,
  DraftCardSkeleton,
} from '../../src/components/skeleton';
import { CommunityContributionsSkeleton } from '../../src/features/gamification/CommunityContributionsSkeleton';
import { ProductDraftsSkeleton } from '../../src/features/products/ProductDraftsSkeleton';
import { ContributedProductCard } from '../../src/features/gamification/ContributedProductCard';
import { DraftSwipeableRow } from '../../src/features/products/DraftSwipeableRow';
import { DraftGridCard } from '../../src/features/products/DraftGridCard';
import { renderWithTheme } from '../helpers/renderWithTheme';
import type { CommunityContributionRow, ProductDraftRow } from '@expyrico/shared';

const mockContribution: CommunityContributionRow = {
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  name: 'Organic Whole Milk',
  brand: 'Happy Cow',
  barcode: '8935001234567',
  status: 'pending',
  createdAt: '2026-09-10T12:00:00Z',
  updatedAt: '2026-09-10T12:00:00Z',
  packagingPhotosCount: 0,
  editsCount: 0,
  coverPhotoId: null,
  coverImageUrl: null,
};

const mockDraft: ProductDraftRow = {
  id: 'draft-1',
  name: 'Whole Grain Sourdough',
  identifier: { kind: 'barcode', value: '012345678901' },
  status: 'draft',
  version: 1,
  moderationFeedback: null,
  cover: null,
  updatedAt: '2026-09-12T10:00:00Z',
};

describe('Contributions and Templates Skeleton Loading Effects', () => {
  describe('ContributedCardSkeleton & CommunityContributionsSkeleton', () => {
    it('renders single ContributedCardSkeleton with thumbnail, title, subtitle, barcode, and status bones', () => {
      renderWithTheme(<ContributedCardSkeleton testID="test-contrib-skeleton" />, 'expyrico');

      expect(screen.getByTestId('test-contrib-skeleton')).toBeTruthy();
      expect(screen.getByTestId('contributed-card-title-skeleton')).toBeTruthy();
      expect(screen.getByTestId('contributed-card-subtitle-skeleton')).toBeTruthy();
      expect(screen.getByTestId('contributed-card-barcode-skeleton')).toBeTruthy();
      expect(screen.getByTestId('contributed-card-status-skeleton')).toBeTruthy();
    });

    it('renders CommunityContributionsSkeleton with 5 shimmering cards', () => {
      renderWithTheme(<CommunityContributionsSkeleton />, 'expyrico');

      expect(screen.getByTestId('community-contributions-skeleton')).toBeTruthy();
      expect(screen.getByTestId('contributed-card-skeleton-0')).toBeTruthy();
      expect(screen.getByTestId('contributed-card-skeleton-4')).toBeTruthy();
    });

    it('renders ContributedProductCard with skeleton effect when isLoading is true', () => {
      renderWithTheme(
        <ContributedProductCard
          item={mockContribution}
          isLoading={true}
        />,
        'expyrico',
      );

      expect(screen.getByTestId('contributed-card-thumbnail-skeleton')).toBeTruthy();
      expect(screen.getByTestId('contributed-card-title-skeleton')).toBeTruthy();
      expect(screen.getByTestId('contributed-card-subtitle-skeleton')).toBeTruthy();
      expect(screen.getByTestId('contributed-card-barcode-skeleton')).toBeTruthy();
      expect(screen.getByTestId('contributed-card-status-skeleton')).toBeTruthy();
    });
  });

  describe('DraftCardSkeleton & ProductDraftsSkeleton', () => {
    it('renders DraftCardSkeleton in list mode with thumbnail and detail bones', () => {
      renderWithTheme(
        <DraftCardSkeleton viewMode="list" testID="test-draft-list-skeleton" />,
        'expyrico',
      );

      expect(screen.getByTestId('test-draft-list-skeleton')).toBeTruthy();
      expect(screen.getByTestId('draft-list-title-skeleton')).toBeTruthy();
      expect(screen.getByTestId('draft-list-subtitle-skeleton')).toBeTruthy();
      expect(screen.getByTestId('draft-list-status-skeleton')).toBeTruthy();
    });

    it('renders DraftCardSkeleton in grid mode with center image and status bones', () => {
      renderWithTheme(
        <DraftCardSkeleton viewMode="grid" testID="test-draft-grid-skeleton" />,
        'expyrico',
      );

      expect(screen.getByTestId('test-draft-grid-skeleton')).toBeTruthy();
      expect(screen.getByTestId('draft-grid-status-skeleton')).toBeTruthy();
      expect(screen.getByTestId('draft-grid-title-skeleton')).toBeTruthy();
      expect(screen.getByTestId('draft-grid-subtitle-skeleton')).toBeTruthy();
    });

    it('renders ProductDraftsSkeleton with 5 cards in list mode', () => {
      renderWithTheme(<ProductDraftsSkeleton viewMode="list" />, 'expyrico');

      expect(screen.getByTestId('product-drafts-skeleton')).toBeTruthy();
      expect(screen.getByTestId('draft-row-skeleton-0')).toBeTruthy();
      expect(screen.getByTestId('draft-row-skeleton-4')).toBeTruthy();
    });

    it('renders ProductDraftsSkeleton with 6 cards in grid mode', () => {
      renderWithTheme(<ProductDraftsSkeleton viewMode="grid" />, 'expyrico');

      expect(screen.getByTestId('product-drafts-skeleton')).toBeTruthy();
      expect(screen.getByTestId('draft-grid-skeleton-0')).toBeTruthy();
      expect(screen.getByTestId('draft-grid-skeleton-5')).toBeTruthy();
    });

    it('renders DraftSwipeableRow with skeleton effect when isLoading is true', () => {
      renderWithTheme(
        <DraftSwipeableRow
          item={mockDraft}
          onPress={jest.fn()}
          onEdit={jest.fn()}
          isLoading={true}
        />,
        'expyrico',
      );

      expect(screen.getByTestId('draft-row-thumbnail-skeleton')).toBeTruthy();
      expect(screen.getByTestId('draft-card-title-skeleton')).toBeTruthy();
      expect(screen.getByTestId('draft-card-date-skeleton')).toBeTruthy();
      expect(screen.getByTestId('draft-card-status-skeleton')).toBeTruthy();
    });

    it('renders DraftGridCard with skeleton effect when isLoading is true', () => {
      renderWithTheme(
        <DraftGridCard
          item={mockDraft}
          onPress={jest.fn()}
          isLoading={true}
        />,
        'expyrico',
      );

      expect(screen.getByTestId('draft-grid-status-skeleton')).toBeTruthy();
      expect(screen.getByTestId('draft-grid-thumbnail-skeleton')).toBeTruthy();
      expect(screen.getByTestId('draft-grid-title-skeleton')).toBeTruthy();
    });
  });
});
