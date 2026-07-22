import { ensurePushTokenRegistered, PUSH_REGISTERED_FLAG_KEY } from './registerPushToken';
import { getItem, setItem } from '../../auth/secure-store';
import { registerPushTokenApi } from '../../api/push';
import messaging from '@react-native-firebase/messaging';

jest.mock('../../auth/secure-store', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('../../api/push', () => ({
  registerPushTokenApi: jest.fn(),
}));
jest.mock('@react-native-firebase/messaging', () => {
  const AuthorizationStatus = { AUTHORIZED: 1, PROVISIONAL: 2, DENIED: 0 };
  const instance = {
    requestPermission: jest.fn(),
    getToken: jest.fn(),
    AuthorizationStatus,
  };
  const messagingFn = Object.assign(jest.fn(() => instance), { AuthorizationStatus });
  return { __esModule: true, default: messagingFn };
});

const getItemMock = getItem as jest.MockedFunction<typeof getItem>;
const setItemMock = setItem as jest.MockedFunction<typeof setItem>;
const registerMock = registerPushTokenApi as jest.MockedFunction<typeof registerPushTokenApi>;

describe('ensurePushTokenRegistered', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (messaging().requestPermission as jest.Mock).mockResolvedValue(messaging.AuthorizationStatus.AUTHORIZED);
    (messaging().getToken as jest.Mock).mockResolvedValue('fcm-token-current');
  });

  it('registers when no prior token is stored', async () => {
    getItemMock.mockResolvedValue(null);
    registerMock.mockResolvedValue({
      id: '1',
      deviceToken: 'fcm-token-current',
      platform: 'ios',
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
    });

    await ensurePushTokenRegistered();

    expect(registerMock).toHaveBeenCalledWith(
      expect.objectContaining({ deviceToken: 'fcm-token-current' }),
    );
    expect(setItemMock).toHaveBeenCalledWith(PUSH_REGISTERED_FLAG_KEY, 'fcm-token-current');
  });

  it('re-registers after hard revoke when stored value is stale boolean or old token', async () => {
    getItemMock.mockResolvedValue('1');
    registerMock.mockResolvedValue({
      id: '1',
      deviceToken: 'fcm-token-current',
      platform: 'ios',
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
    });

    await ensurePushTokenRegistered();

    expect(registerMock).toHaveBeenCalledTimes(1);
    expect(setItemMock).toHaveBeenCalledWith(PUSH_REGISTERED_FLAG_KEY, 'fcm-token-current');
  });

  it('skips when the current FCM token was already registered', async () => {
    getItemMock.mockResolvedValue('fcm-token-current');

    await ensurePushTokenRegistered();

    expect(registerMock).not.toHaveBeenCalled();
  });
});
