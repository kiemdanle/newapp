import { useCallback, useState } from 'react';
import { Camera, type CameraPermissionStatus } from 'react-native-vision-camera';

export type PermissionState = 'unknown' | 'granted' | 'denied';

function toPermissionState(status: CameraPermissionStatus): PermissionState {
  if (status === 'granted') return 'granted';
  if (status === 'not-determined') return 'unknown';
  return 'denied';
}

export function useCameraPermission() {
  const [state, setState] = useState<PermissionState>('unknown');

  const request = useCallback(async (): Promise<PermissionState> => {
    const status = await Camera.requestCameraPermission();
    const next = toPermissionState(status);
    setState(next);
    return next;
  }, []);

  const check = useCallback(async (): Promise<PermissionState> => {
    const status = await Camera.getCameraPermissionStatus();
    const next = toPermissionState(status);
    setState(next);
    return next;
  }, []);

  return { state, request, check };
}
