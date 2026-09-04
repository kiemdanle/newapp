import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import {
  DraggableFloatingButton,
  computeSafeBounds,
  clampCoordinates,
} from '../../src/components/DraggableFloatingButton';
import { useUiPreferencesStore } from '../../src/store/uiPreferencesStore';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 30, left: 10, right: 10 }),
}));

describe('DraggableFloatingButton', () => {
  beforeEach(() => {
    useUiPreferencesStore.setState({ menuButtonPosition: null });
  });

  it('renders children with testID', () => {
    const { getByTestId, getByText } = render(
      <DraggableFloatingButton onPress={jest.fn()} testID="test-drag-btn">
        <Text>Menu</Text>
      </DraggableFloatingButton>,
    );

    expect(getByTestId('test-drag-btn')).toBeTruthy();
    expect(getByText('Menu')).toBeTruthy();
  });

  it('initializes position from saved store position when available', () => {
    useUiPreferencesStore.setState({ menuButtonPosition: { x: 150, y: 300 } });
    const handlePosChange = jest.fn();

    render(
      <DraggableFloatingButton
        onPress={jest.fn()}
        onPositionChange={handlePosChange}
      >
        <Text>Menu</Text>
      </DraggableFloatingButton>,
    );

    expect(handlePosChange).toHaveBeenCalledWith(
      expect.objectContaining({ x: 150, y: 300 }),
    );
  });

  it('updates store when setMenuButtonPosition is called', async () => {
    const store = useUiPreferencesStore.getState();
    await store.setMenuButtonPosition({ x: 200, y: 400 });

    expect(useUiPreferencesStore.getState().menuButtonPosition).toEqual({
      x: 200,
      y: 400,
    });
  });

  it('computeSafeBounds calculates correct bottom bounds allowing bottom navigation row placement', () => {
    const insets = { top: 40, bottom: 30, left: 10, right: 10 };
    const bounds = computeSafeBounds(400, 800, 48, 48, insets);

    // minX = left + 12 = 22
    expect(bounds.minX).toBe(22);
    // maxX = 400 - 48 - right(10) - 12 = 330
    expect(bounds.maxX).toBe(330);
    // minY = top + 12 = 52
    expect(bounds.minY).toBe(52);
    // maxY = 800 - 48 - Math.max(bottom(30), 16) = 722
    // Must be at the bottom navigation row (722), not restricted 70px above (< 660)
    expect(bounds.maxY).toBe(722);
    expect(bounds.maxY).toBeGreaterThan(700);
  });

  it('clampCoordinates clamps position within safe bounds without premature snap-back', () => {
    const bounds = { minX: 22, maxX: 330, minY: 52, maxY: 722 };

    // Clamps excessive downward drag to maxY (722)
    const bottomClamped = clampCoordinates(200, 900, bounds);
    expect(bottomClamped).toEqual({ x: 200, y: 722 });

    // Clamps excessive upward drag to minY (52)
    const topClamped = clampCoordinates(200, 10, bounds);
    expect(topClamped).toEqual({ x: 200, y: 52 });

    // Clamps excessive left drag to minX (22)
    const leftClamped = clampCoordinates(-50, 400, bounds);
    expect(leftClamped).toEqual({ x: 22, y: 400 });

    // Clamps excessive right drag to maxX (330)
    const rightClamped = clampCoordinates(500, 400, bounds);
    expect(rightClamped).toEqual({ x: 330, y: 400 });

    // Preserves in-bounds coordinate
    const inBounds = clampCoordinates(150, 500, bounds);
    expect(inBounds).toEqual({ x: 150, y: 500 });
  });
});
