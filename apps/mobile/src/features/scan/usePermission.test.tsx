import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { Camera } from 'react-native-vision-camera';
import { type PermissionState, useCameraPermission } from './usePermission';

jest.mock('react-native-vision-camera', () => ({
  Camera: {
    getCameraPermissionStatus: jest.fn(),
    requestCameraPermission: jest.fn(),
  },
}));

const mockGetCameraPermissionStatus = Camera.getCameraPermissionStatus as jest.MockedFunction<
  typeof Camera.getCameraPermissionStatus
>;
const mockRequestCameraPermission = Camera.requestCameraPermission as jest.MockedFunction<
  typeof Camera.requestCameraPermission
>;

function PermissionProbe({
  operation,
  onResult,
}: {
  operation: 'check' | 'request';
  onResult: (state: PermissionState) => void;
}) {
  const { state, check, request } = useCameraPermission();

  useEffect(() => {
    const permissionOperation = operation === 'check' ? check : request;
    void permissionOperation().then(onResult);
  }, [check, onResult, operation, request]);

  return <Text testID="permission-state">{state}</Text>;
}

describe('useCameraPermission', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('maps a not-determined check to unknown', async () => {
    mockGetCameraPermissionStatus.mockReturnValue('not-determined');
    const onResult = jest.fn();
    const { getByTestId } = render(<PermissionProbe operation="check" onResult={onResult} />);

    await waitFor(() => expect(onResult).toHaveBeenCalledWith('unknown'));

    expect(getByTestId('permission-state').props.children).toBe('unknown');
  });

  it('maps a not-determined request to unknown', async () => {
    mockRequestCameraPermission.mockResolvedValue('not-determined' as never);
    const onResult = jest.fn();
    const { getByTestId } = render(<PermissionProbe operation="request" onResult={onResult} />);

    await waitFor(() => expect(onResult).toHaveBeenCalledWith('unknown'));

    expect(getByTestId('permission-state').props.children).toBe('unknown');
  });

  it('maps a restricted check to denied', async () => {
    mockGetCameraPermissionStatus.mockReturnValue('restricted');
    const onResult = jest.fn();
    const { getByTestId } = render(<PermissionProbe operation="check" onResult={onResult} />);

    await waitFor(() => expect(onResult).toHaveBeenCalledWith('denied'));

    expect(getByTestId('permission-state').props.children).toBe('denied');
  });

  it('maps a denied request to denied', async () => {
    mockRequestCameraPermission.mockResolvedValue('denied');
    const onResult = jest.fn();
    const { getByTestId } = render(<PermissionProbe operation="request" onResult={onResult} />);

    await waitFor(() => expect(onResult).toHaveBeenCalledWith('denied'));

    expect(getByTestId('permission-state').props.children).toBe('denied');
  });
});
