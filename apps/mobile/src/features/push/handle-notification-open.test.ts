import { Linking } from 'react-native';
import Config from 'react-native-config';
import { handleModerationNotificationOpen, handleNotificationTap, registerModerationNotificationBatch } from './handle-notification-open';
import { navigate } from '../../navigation/navigationRef';

jest.mock('../../navigation/navigationRef', () => ({
  navigate: jest.fn(),
}));
jest.mock('react-native', () => ({ Linking: { openURL: jest.fn() } }));
jest.mock('react-native-config', () => ({ __esModule: true, default: { MOBILE_ADMIN_URL: 'https://admin.example.com' } }));

const navigateMock = navigate as jest.MockedFunction<typeof navigate>;

const openUrl = Linking.openURL as jest.MockedFunction<typeof Linking.openURL>;
const config = Config as unknown as { MOBILE_ADMIN_URL: string };

describe('handleModerationNotificationOpen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.MOBILE_ADMIN_URL = 'https://admin.example.com';
    openUrl.mockResolvedValue(true as never);
  });

  it('opens the canonical queue URL for a trusted moderation notification', async () => {
    await expect(handleModerationNotificationOpen({
      type: 'moderation_queue',
      url: 'https://admin.example.com/products/pending',
      batchId: 'ignored',
    })).resolves.toBe(true);
    expect(openUrl).toHaveBeenCalledWith('https://admin.example.com/products/pending');
  });

  it.each([
    [{ type: 'expiry', url: 'https://admin.example.com/products/pending' }],
    [{ type: 'moderation_queue', url: 'http://admin.example.com/products/pending' }],
    [{ type: 'moderation_queue', url: 'https://evil.example.com/products/pending' }],
    [{ type: 'moderation_queue', url: 'https://user:pass@admin.example.com/products/pending' }],
    [{ type: 'moderation_queue', url: 'https://admin.example.com/products/pending#fragment' }],
    [{ type: 'moderation_queue', url: 'https://admin.example.com/products/pending?next=https://evil.example' }],
    [{ type: 'moderation_queue', url: 'https://admin.example.com/products/other' }],
    [{ type: 'moderation_queue', url: 'not-a-url' }],
  ])('rejects an untrusted or malformed payload: %o', async (data) => {
    await expect(handleModerationNotificationOpen(data)).resolves.toBe(false);
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('deduplicates a repeated non-empty moderation batch identifier', () => {
    const opened = new Set<string>();
    expect(registerModerationNotificationBatch('batch-1', opened)).toBe(true);
    expect(registerModerationNotificationBatch('batch-1', opened)).toBe(false);
    expect(registerModerationNotificationBatch(undefined, opened)).toBe(true);
  });

  it('fails closed for unsafe configured origins', async () => {
    config.MOBILE_ADMIN_URL = 'http://admin.example.com';
    await expect(handleModerationNotificationOpen({ type: 'moderation_queue', url: 'http://admin.example.com/products/pending' })).resolves.toBe(false);
    expect(openUrl).not.toHaveBeenCalled();
  });
});

describe('handleNotificationTap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes expiry notification to Record screen', async () => {
    const handled = await handleNotificationTap({ type: 'expiry', recordId: 'rec-123' });
    expect(handled).toBe(true);
    expect(navigateMock).toHaveBeenCalledWith('Record', { id: 'rec-123' });
  });

  it('routes giveaway claim notification to GiveawayManage screen', async () => {
    const handled = await handleNotificationTap({ type: 'giveaway_new_claim', giveawayId: 'gw-456' });
    expect(handled).toBe(true);
    expect(navigateMock).toHaveBeenCalledWith('GiveawayManage', { id: 'gw-456' });
  });

  it('routes general giveaway notification to Giveaway screen', async () => {
    const handled = await handleNotificationTap({ type: 'giveaway_selected', giveawayId: 'gw-456' });
    expect(handled).toBe(true);
    expect(navigateMock).toHaveBeenCalledWith('Giveaway', { id: 'gw-456' });
  });

  it('returns false for unknown payload', async () => {
    const handled = await handleNotificationTap({ type: 'unknown_type' });
    expect(handled).toBe(false);
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
