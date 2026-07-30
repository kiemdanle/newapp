import { Platform } from 'react-native';
import { Recaptcha, RecaptchaAction } from '@google-cloud/recaptcha-enterprise-react-native';
import Config from 'react-native-config';
import {
  executeProductSubmitAssessment,
  resetProductCreationAssessmentClientForTests,
  RecaptchaSiteKeyMissingError,
} from './product-creation-assessment';

jest.mock('@google-cloud/recaptcha-enterprise-react-native', () => ({
  Recaptcha: { fetchClient: jest.fn() },
  RecaptchaAction: { custom: jest.fn((name: string) => ({ action: name })) },
}));

const fetchClientMock = Recaptcha.fetchClient as jest.MockedFunction<typeof Recaptcha.fetchClient>;
const customActionMock = RecaptchaAction.custom as jest.MockedFunction<typeof RecaptchaAction.custom>;

describe('executeProductSubmitAssessment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetProductCreationAssessmentClientForTests();
    (Config as { RECAPTCHA_SITE_KEY_ANDROID?: string; RECAPTCHA_SITE_KEY_IOS?: string }).RECAPTCHA_SITE_KEY_ANDROID =
      'android-site-key';
    (Config as { RECAPTCHA_SITE_KEY_ANDROID?: string; RECAPTCHA_SITE_KEY_IOS?: string }).RECAPTCHA_SITE_KEY_IOS =
      'ios-site-key';
  });

  it('mints a token for the submit_product action against the Android site key', async () => {
    Platform.OS = 'android';
    const execute = jest.fn().mockResolvedValue('android-token');
    fetchClientMock.mockResolvedValue({ execute } as never);

    const result = await executeProductSubmitAssessment();

    expect(fetchClientMock).toHaveBeenCalledWith('android-site-key');
    expect(customActionMock).toHaveBeenCalledWith('submit_product');
    expect(result).toEqual({ token: 'android-token', platform: 'android' });
  });

  it('mints a token against the iOS site key on iOS', async () => {
    Platform.OS = 'ios';
    const execute = jest.fn().mockResolvedValue('ios-token');
    fetchClientMock.mockResolvedValue({ execute } as never);

    const result = await executeProductSubmitAssessment();

    expect(fetchClientMock).toHaveBeenCalledWith('ios-site-key');
    expect(result).toEqual({ token: 'ios-token', platform: 'ios' });
  });

  it('initializes the client only once across repeated calls on the same platform', async () => {
    Platform.OS = 'android';
    const execute = jest.fn().mockResolvedValue('token-1').mockResolvedValueOnce('token-1').mockResolvedValueOnce('token-2');
    fetchClientMock.mockResolvedValue({ execute } as never);

    await executeProductSubmitAssessment();
    await executeProductSubmitAssessment();

    expect(fetchClientMock).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('throws RecaptchaSiteKeyMissingError instead of minting against an empty key', async () => {
    Platform.OS = 'android';
    (Config as { RECAPTCHA_SITE_KEY_ANDROID?: string }).RECAPTCHA_SITE_KEY_ANDROID = '';

    await expect(executeProductSubmitAssessment()).rejects.toBeInstanceOf(RecaptchaSiteKeyMissingError);
    expect(fetchClientMock).not.toHaveBeenCalled();
  });
});
