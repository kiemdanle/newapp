import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { MultiPhotoCameraModal } from './MultiPhotoCameraModal';
import { ThemeProvider } from '../theme/ThemeProvider';
import { useCameraPermission, useCameraDevice } from 'react-native-vision-camera';

jest.mock('react-native-vision-camera', () => ({
  Camera: () => null,
  useCameraDevice: jest.fn(() => ({ id: 'back-camera', position: 'back' })),
  useCameraPermission: jest.fn(() => ({
    hasPermission: true,
    requestPermission: jest.fn().mockResolvedValue(true),
  })),
}));

const mockUseCameraPermission = useCameraPermission as jest.MockedFunction<typeof useCameraPermission>;
const mockUseCameraDevice = useCameraDevice as jest.MockedFunction<typeof useCameraDevice>;

function wrap(node: React.ReactNode) {
  return <ThemeProvider>{node}</ThemeProvider>;
}

describe('<MultiPhotoCameraModal />', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCameraPermission.mockReturnValue({
      hasPermission: true,
      requestPermission: jest.fn().mockResolvedValue(true),
    });
    mockUseCameraDevice.mockReturnValue({ id: 'back-camera', position: 'back' } as never);
  });

  it('renders modal with title, counter badge, and shutter when visible', () => {
    const onCapture = jest.fn();
    const onClose = jest.fn();
    const { getByTestId, getByText } = render(
      wrap(
        <MultiPhotoCameraModal
          visible={true}
          maxPhotos={5}
          title="Product Photos"
          onCapture={onCapture}
          onClose={onClose}
        />,
      ),
    );

    expect(getByTestId('multi-photo-camera-modal')).toBeTruthy();
    expect(getByText('Product Photos')).toBeTruthy();
    expect(getByText('0/5')).toBeTruthy();
    expect(getByTestId('multi-camera-shutter')).toBeTruthy();
    expect(getByTestId('multi-camera-done')).toBeTruthy();
  });

  it('allows taking multiple photos sequentially and updates counter and thumbnails', async () => {
    const onCapture = jest.fn();
    const onClose = jest.fn();
    const { getByTestId, getByText, findByTestId } = render(
      wrap(
        <MultiPhotoCameraModal
          visible={true}
          maxPhotos={5}
          title="Giveaway Photos"
          onCapture={onCapture}
          onClose={onClose}
        />,
      ),
    );

    // Initial state: 0/5
    expect(getByText('0/5')).toBeTruthy();

    // Snap 1st photo
    fireEvent.press(getByTestId('multi-camera-shutter'));
    expect(await findByTestId('multi-camera-thumbnails')).toBeTruthy();
    expect(getByText('1/5')).toBeTruthy();

    // Snap 2nd photo
    fireEvent.press(getByTestId('multi-camera-shutter'));
    expect(getByText('2/5')).toBeTruthy();

    // Snap 3rd photo
    fireEvent.press(getByTestId('multi-camera-shutter'));
    expect(getByText('3/5')).toBeTruthy();
    expect(getByText('Done (3)')).toBeTruthy();

    // Tap Done: returns all 3 photos at once
    fireEvent.press(getByTestId('multi-camera-done'));
    expect(onCapture).toHaveBeenCalledTimes(1);
    const captured = onCapture.mock.calls[0]![0];
    expect(captured).toHaveLength(3);
    expect(captured[0].mime).toBe('image/jpeg');
    expect(captured[1].mime).toBe('image/jpeg');
    expect(captured[2].mime).toBe('image/jpeg');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('allows removing an individual photo from the thumbnail strip', async () => {
    const onCapture = jest.fn();
    const onClose = jest.fn();
    const { getByTestId, getByText, findByTestId } = render(
      wrap(
        <MultiPhotoCameraModal
          visible={true}
          maxPhotos={5}
          onCapture={onCapture}
          onClose={onClose}
        />,
      ),
    );

    // Snap 2 photos
    fireEvent.press(getByTestId('multi-camera-shutter'));
    fireEvent.press(getByTestId('multi-camera-shutter'));
    expect(getByText('2/5')).toBeTruthy();

    // Remove photo 0
    const removeBtn0 = await findByTestId('multi-camera-remove-0');
    fireEvent.press(removeBtn0);

    // Count updates to 1/5
    expect(getByText('1/5')).toBeTruthy();
    expect(getByText('Done (1)')).toBeTruthy();
  });

  it('stops shutter capture when max limit is reached and shows limit indicator', async () => {
    const onCapture = jest.fn();
    const onClose = jest.fn();
    const { getByTestId, getByText } = render(
      wrap(
        <MultiPhotoCameraModal
          visible={true}
          maxPhotos={2}
          onCapture={onCapture}
          onClose={onClose}
        />,
      ),
    );

    fireEvent.press(getByTestId('multi-camera-shutter'));
    fireEvent.press(getByTestId('multi-camera-shutter'));

    expect(getByText('2/2')).toBeTruthy();
    expect(getByText(/Max limit reached \(2\/2\)/)).toBeTruthy();
  });

  it('allows clearing all captured photos with Clear button', async () => {
    const onCapture = jest.fn();
    const onClose = jest.fn();
    const { getByTestId, getByText, findByText } = render(
      wrap(
        <MultiPhotoCameraModal
          visible={true}
          maxPhotos={5}
          onCapture={onCapture}
          onClose={onClose}
        />,
      ),
    );

    fireEvent.press(getByTestId('multi-camera-shutter'));
    fireEvent.press(getByTestId('multi-camera-shutter'));
    expect(getByText('2/5')).toBeTruthy();

    const clearBtn = await findByText('Clear (2)');
    fireEvent.press(clearBtn);

    expect(getByText('0/5')).toBeTruthy();
  });

  it('toggles flash mode on flash button press', () => {
    const onCapture = jest.fn();
    const onClose = jest.fn();
    const { getByTestId } = render(
      wrap(
        <MultiPhotoCameraModal
          visible={true}
          onCapture={onCapture}
          onClose={onClose}
        />,
      ),
    );

    const flashBtn = getByTestId('multi-camera-flash');
    expect(flashBtn.props.accessibilityLabel).toBe('Flash mode: off');

    fireEvent.press(flashBtn);
    expect(flashBtn.props.accessibilityLabel).toBe('Flash mode: on');

    fireEvent.press(flashBtn);
    expect(flashBtn.props.accessibilityLabel).toBe('Flash mode: auto');

    fireEvent.press(flashBtn);
    expect(flashBtn.props.accessibilityLabel).toBe('Flash mode: off');
  });

  it('shows permission prompt when camera permission is not granted', () => {
    const requestMock = jest.fn().mockResolvedValue(true);
    mockUseCameraPermission.mockReturnValue({
      hasPermission: false,
      requestPermission: requestMock,
    });
    mockUseCameraDevice.mockReturnValue({ id: 'back-camera', position: 'back' } as never);

    const onCapture = jest.fn();
    const onClose = jest.fn();
    const { getByText, getByTestId } = render(
      wrap(
        <MultiPhotoCameraModal
          visible={true}
          onCapture={onCapture}
          onClose={onClose}
        />,
      ),
    );

    expect(getByText('Camera Access Required')).toBeTruthy();
    const enableBtn = getByTestId('multi-camera-request-permission');
    fireEvent.press(enableBtn);
    expect(requestMock).toHaveBeenCalled();
  });

  it('closes modal when close button is pressed without capturing', () => {
    const onCapture = jest.fn();
    const onClose = jest.fn();
    const { getByTestId } = render(
      wrap(
        <MultiPhotoCameraModal
          visible={true}
          onCapture={onCapture}
          onClose={onClose}
        />,
      ),
    );

    fireEvent.press(getByTestId('multi-camera-close'));
    expect(onClose).toHaveBeenCalled();
    expect(onCapture).not.toHaveBeenCalled();
  });
});
