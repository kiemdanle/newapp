import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {
  getCurrentCoordinates,
  requestLocationPermission,
  LocationError,
} from './location';

describe('Location Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requestLocationPermission', () => {
    it('returns true on iOS when requestAuthorization is called', async () => {
      Platform.OS = 'ios';
      const granted = await requestLocationPermission();
      expect(granted).toBe(true);
      expect(Geolocation.requestAuthorization).toHaveBeenCalled();
    });

    it('returns true on Android when fine location is granted', async () => {
      Platform.OS = 'android';
      jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValueOnce({
        [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION as string]:
          PermissionsAndroid.RESULTS.GRANTED,
        [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION as string]:
          PermissionsAndroid.RESULTS.GRANTED,
      } as any);

      const granted = await requestLocationPermission();
      expect(granted).toBe(true);
    });

    it('returns false on Android when location is denied', async () => {
      Platform.OS = 'android';
      jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValueOnce({
        [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION as string]:
          PermissionsAndroid.RESULTS.DENIED,
        [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION as string]:
          PermissionsAndroid.RESULTS.DENIED,
      } as any);

      const granted = await requestLocationPermission();
      expect(granted).toBe(false);
    });
  });

  describe('getCurrentCoordinates', () => {
    it('resolves latitude and longitude on GPS success', async () => {
      Platform.OS = 'ios';
      (Geolocation.getCurrentPosition as jest.Mock).mockImplementationOnce(
        (success: (pos: any) => void) => {
          success({
            coords: {
              latitude: 10.7769,
              longitude: 106.7009,
            },
          });
        },
      );

      const coords = await getCurrentCoordinates();
      expect(coords).toEqual({
        latitude: 10.7769,
        longitude: 106.7009,
      });
    });

    it('throws LocationError when user denies permission', async () => {
      Platform.OS = 'android';
      jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValueOnce({
        [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION as string]:
          PermissionsAndroid.RESULTS.DENIED,
        [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION as string]:
          PermissionsAndroid.RESULTS.DENIED,
      } as any);

      await expect(getCurrentCoordinates()).rejects.toThrow(LocationError);
    });
  });
});
