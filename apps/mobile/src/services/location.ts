import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export class LocationError extends Error {
  code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.name = 'LocationError';
    this.code = code;
  }
}

/**
 * Requests location permissions from the user on Android/iOS.
 */
export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    Geolocation.requestAuthorization();
    return true;
  }

  if (Platform.OS === 'android') {
    try {
      const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
      const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
      if (!fine || !coarse) return false;

      const hasFine = await PermissionsAndroid.check(fine);
      const hasCoarse = await PermissionsAndroid.check(coarse);
      if (hasFine || hasCoarse) return true;

      const granted = await PermissionsAndroid.requestMultiple([fine, coarse]);

      const fineGranted = granted[fine] === PermissionsAndroid.RESULTS.GRANTED;
      const coarseGranted = granted[coarse] === PermissionsAndroid.RESULTS.GRANTED;

      return fineGranted || coarseGranted;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Helper to get a promise with resolvers in a runtime-agnostic way.
 */
function createDeferred<T>() {
  if (typeof (Promise as unknown as { withResolvers?: unknown }).withResolvers === 'function') {
    return (Promise as unknown as { withResolvers: <U>() => { promise: Promise<U>; resolve: (v: U) => void; reject: (e: unknown) => void } }).withResolvers<T>();
  }
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Retrieves device coordinates with high accuracy and a fallback to network/cell location
 * if high accuracy GPS times out (e.g. indoors).
 */
export async function getCurrentCoordinates(): Promise<LocationCoordinates> {
  const hasPermission = await requestLocationPermission();
  if (!hasPermission) {
    throw new LocationError(
      'Location permission was denied. Please enable location access in your device settings to auto-fill your address.',
      1,
    );
  }

  const { promise, resolve, reject } = createDeferred<LocationCoordinates>();

  // Attempt high-accuracy GPS first
  Geolocation.getCurrentPosition(
    (position) => {
      resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    },
    (error) => {
      // Fall back to coarse / network location on timeout or unavailability
      if (error.code === 3 || error.code === 2) {
        Geolocation.getCurrentPosition(
          (netPos) => {
            resolve({
              latitude: netPos.coords.latitude,
              longitude: netPos.coords.longitude,
            });
          },
          (netErr) => {
            let message = 'Unable to determine your location. Please ensure GPS is enabled.';
            if (netErr.code === 1) {
              message = 'Location permission was denied. Please enable location access in system settings.';
            } else if (netErr.code === 3) {
              message = 'Location request timed out. Please try again or type your address manually.';
            }
            reject(new LocationError(message, netErr.code));
          },
          {
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 60000,
          },
        );
        return;
      }

      let message = 'Unable to determine your location. Please ensure GPS is enabled.';
      if (error.code === 1) {
        message = 'Location permission was denied. Please enable location access in system settings.';
      }
      reject(new LocationError(message, error.code));
    },
    {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 30000,
    },
  );

  return promise;
}
