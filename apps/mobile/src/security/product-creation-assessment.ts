import { Platform } from 'react-native';
import Config from 'react-native-config';
import { Recaptcha, RecaptchaAction, type RecaptchaClient } from '@google-cloud/recaptcha-enterprise-react-native';

// Thin wrapper around the reCAPTCHA Enterprise Mobile SDK bridge so the rest
// of the app (the submit flow) never imports the third-party library
// directly. If the user's native proof build finds this library
// incompatible, the blast radius of swapping it is contained to this file.
//
// Action name must match the server's exact-action check in
// `api/src/services/abuse/product-creation-assessment.ts`
// (`PRODUCT_CREATION_ASSESSMENT_ACTION`); mobile and API packages aren't
// shared, so this is a literal, deliberately named the same for grep-ability.
export const PRODUCT_CREATION_ASSESSMENT_ACTION = 'submit_product';

export type SubmitAssessmentPlatform = 'android' | 'ios';

export interface SubmitAssessmentResult {
  token: string;
  platform: SubmitAssessmentPlatform;
}

/** Thrown when this platform's site key isn't configured. Real Android/iOS
 * site keys are provisioned by the user in the Google Cloud console (each
 * key is bound to a package name / bundle ID only the console owner can
 * register) — see the Phase 5 native verification checklist. Until then this
 * throws instead of silently minting against an empty key. */
export class RecaptchaSiteKeyMissingError extends Error {
  constructor(platform: SubmitAssessmentPlatform) {
    super(`RECAPTCHA_SITE_KEY_${platform.toUpperCase()} is not configured`);
    this.name = 'RecaptchaSiteKeyMissingError';
  }
}

function siteKeyForPlatform(platform: SubmitAssessmentPlatform): string {
  const key = platform === 'android' ? Config.RECAPTCHA_SITE_KEY_ANDROID : Config.RECAPTCHA_SITE_KEY_IOS;
  if (!key) throw new RecaptchaSiteKeyMissingError(platform);
  return key;
}

let _client: RecaptchaClient | undefined;
let _clientPlatform: SubmitAssessmentPlatform | undefined;

/** The SDK requires initializing the client only once per app lifetime.
 * Cached per-platform (rather than globally) purely so a platform switch in
 * tests doesn't reuse a stale client — in a real app `Platform.OS` never
 * changes at runtime. */
async function client(platform: SubmitAssessmentPlatform): Promise<RecaptchaClient> {
  if (_client && _clientPlatform === platform) return _client;
  _client = await Recaptcha.fetchClient(siteKeyForPlatform(platform));
  _clientPlatform = platform;
  return _client;
}

/** Exported for tests only — clears the cached client singleton. */
export function resetProductCreationAssessmentClientForTests(): void {
  _client = undefined;
  _clientPlatform = undefined;
}

/**
 * Executes the reCAPTCHA Enterprise `submit_product` action and returns a
 * fresh, single-use token plus the platform it was minted for. The caller
 * must request a new token immediately before each submit attempt (tokens
 * are short-lived) — never cache or reuse a token across retries. The server
 * independently re-verifies the token, exact action, and site key; a
 * client-reported "success" here is never itself trusted for anything beyond
 * producing the token to send.
 */
export async function executeProductSubmitAssessment(): Promise<SubmitAssessmentResult> {
  const platform: SubmitAssessmentPlatform = Platform.OS === 'ios' ? 'ios' : 'android';
  const c = await client(platform);
  const token = await c.execute(RecaptchaAction.custom(PRODUCT_CREATION_ASSESSMENT_ACTION));
  return { token, platform };
}
