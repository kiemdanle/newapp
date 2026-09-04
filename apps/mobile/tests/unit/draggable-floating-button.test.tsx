import React from 'react';
import { Text, View } from 'react-native';
import { render } from '@testing-library/react-native';
import { DraggableFloatingButton } from '../../src/components/DraggableFloatingButton';
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
});
