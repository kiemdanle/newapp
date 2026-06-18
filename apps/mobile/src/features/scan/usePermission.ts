import { useCallback, useState } from 'react';
import { Camera } from 'expo-camera';

export type PermissionState = 'unknown' | 'granted' | 'denied';

export function useCameraPermission() {
  const [state, setState] = useState<PermissionState>('unknown');

  const request = useCallback(async (): Promise<PermissionState> => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    const next: PermissionState = status === 'granted' ? 'granted' : 'denied';
    setState(next);
    return next;
  }, []);

  const check = useCallback(async (): Promise<PermissionState> => {
    const { status } = await Camera.getCameraPermissionsAsync();
    const next: PermissionState = status === 'granted' ? 'granted' : 'denied';
    setState(next);
    return next;
  }, []);

  return { state, request, check };
}
