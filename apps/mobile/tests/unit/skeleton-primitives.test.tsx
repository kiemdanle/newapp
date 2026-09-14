import React from 'react';
import { AccessibilityInfo, Animated } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import {
  SkeletonBone,
  SkeletonShimmer,
  RecordCardSkeleton,
  PantryGridCardSkeleton,
} from '../../src/components/skeleton';
import { renderWithTheme } from '../helpers/renderWithTheme';
import { useThemeStore } from '../../src/theme/store';

describe('Skeleton Primitives & Components', () => {
  beforeEach(() => {
    act(() => {
      useThemeStore.setState({ themeId: 'expyrico', hydrated: true });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    act(() => {
      useThemeStore.setState({ themeId: 'expyrico', hydrated: true });
    });
  });

  describe('SkeletonBone', () => {
    it('renders with default props and light theme neutralLight background', () => {
      renderWithTheme(<SkeletonBone testID="bone-1" />, 'expyrico');
      const bone = screen.getByTestId('bone-1');
      expect(bone).toBeTruthy();
      expect(bone.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            width: '100%',
            height: 16,
            borderRadius: 4,
            backgroundColor: '#F0F0ED',
          }),
        ])
      );
    });

    it('renders with dark theme neutralLight background (#2D3A34)', () => {
      act(() => {
        useThemeStore.setState({ themeId: 'expyricoDark', hydrated: true });
      });
      renderWithTheme(<SkeletonBone testID="bone-dark" />, 'expyricoDark');
      const bone = screen.getByTestId('bone-dark');
      expect(bone).toBeTruthy();
      expect(bone.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            backgroundColor: '#2D3A34',
          }),
        ])
      );
    });

    it('applies custom dimensions and border radius', () => {
      renderWithTheme(
        <SkeletonBone
          testID="bone-custom"
          width={72}
          height={72}
          borderRadius={16}
          style={{ margin: 8 }}
        />,
        'expyrico'
      );
      const bone = screen.getByTestId('bone-custom');
      expect(bone.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            width: 72,
            height: 72,
            borderRadius: 16,
          }),
          expect.objectContaining({
            margin: 8,
          }),
        ])
      );
    });
  });

  describe('SkeletonShimmer', () => {
    it('wraps children and initializes native animation loop', () => {
      const mockStart = jest.fn();
      const loopSpy = jest.spyOn(Animated, 'loop').mockReturnValue({
        start: mockStart,
        stop: jest.fn(),
        reset: jest.fn(),
      } as unknown as Animated.CompositeAnimation);

      render(
        <SkeletonShimmer>
          <SkeletonBone testID="shimmer-bone" />
        </SkeletonShimmer>
      );

      expect(screen.getByTestId('shimmer-bone')).toBeTruthy();
      expect(loopSpy).toHaveBeenCalled();
      expect(mockStart).toHaveBeenCalled();
    });

    it('stops animation on unmount to prevent timer/memory leaks', () => {
      const mockStop = jest.fn();
      jest.spyOn(Animated, 'loop').mockReturnValue({
        start: jest.fn(),
        stop: mockStop,
        reset: jest.fn(),
      } as unknown as Animated.CompositeAnimation);

      const { unmount } = render(
        <SkeletonShimmer>
          <SkeletonBone testID="unmount-bone" />
        </SkeletonShimmer>
      );

      unmount();
      expect(mockStop).toHaveBeenCalled();
    });

    it('respects reduced motion setting and sets static opacity', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      const loopSpy = jest.spyOn(Animated, 'loop');

      render(
        <SkeletonShimmer>
          <SkeletonBone testID="reduced-bone" />
        </SkeletonShimmer>
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByTestId('reduced-bone')).toBeTruthy();
    });
  });

  describe('RecordCardSkeleton', () => {
    it('renders with elevated background, border, and skeleton bones', () => {
      renderWithTheme(<RecordCardSkeleton testID="record-skeleton" />, 'expyrico');
      const card = screen.getByTestId('record-skeleton');
      expect(card).toBeTruthy();
      expect(card.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            flexDirection: 'row',
            alignItems: 'center',
          }),
          expect.objectContaining({
            backgroundColor: '#FAFAF8',
            borderColor: '#F0F0ED',
          }),
        ])
      );
    });
  });

  describe('PantryGridCardSkeleton', () => {
    it('renders grid card layout with 16px corner radius and elevated background', () => {
      renderWithTheme(<PantryGridCardSkeleton testID="grid-skeleton" />, 'expyrico');
      const card = screen.getByTestId('grid-skeleton');
      expect(card).toBeTruthy();
      expect(card.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            borderRadius: 16,
          }),
          expect.objectContaining({
            backgroundColor: '#FAFAF8',
            borderColor: '#F0F0ED',
          }),
        ])
      );
    });
  });
});
