import { useCallback, useState } from 'react';
import { Camera } from 'react-native-vision-camera';

export type PermissionState = 'unknown' | 'granted' | 'denied';

export function useCameraPermission() {
  const [state, setState] = useState<PermissionState>('unknown');

  const request = useCallback(async (): Promise<PermissionState> => {
    const status = await Camera.requestCameraPermission();
    const next: PermissionState = status === 'granted' ? 'granted' : 'denied';
    setState(next);
    return next;
  }, []);

  const check = useCallback(async (): Promise<PermissionState> => {
    const status = await Camera.getCameraPermissionStatus();
    const next: PermissionState = status === 'granted' ? 'granted' : 'denied';
    setState(next);
    return next;
  }, []);

  return { state, request, check };
}
