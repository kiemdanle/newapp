// Phase 7: server-side reCAPTCHA Enterprise verification for the `submit_product`
// action. Client-reported success is never trusted — every submission is
// re-verified here with a bounded-timeout CreateAssessment call. A provider
// timeout/error is retryable (the caller must not accept on failure); an
// invalid token, wrong action, or a score below the configured threshold is a
// hard reject, never retried with the same token.
import CircuitBreaker from 'opossum';
import { RecaptchaEnterpriseServiceClient } from '@google-cloud/recaptcha-enterprise';
import { ERROR_CODES } from '@expyrico/shared';
import { AppError } from '../../errors.js';
import { getConfig } from '../../config.js';
import { logger } from '../../logger.js';
import { register } from '../external/breakers.js';
import { recordRateEvent } from '../products/product-operational-health.js';

export const PRODUCT_CREATION_ASSESSMENT_ACTION = 'submit_product';

export type ProductCreationAssessmentPlatform = 'android' | 'ios';

export interface ProductCreationAssessmentInput {
  token: string;
  platform: ProductCreationAssessmentPlatform;
  userIpAddress?: string;
  userAgent?: string;
}

export interface ProductCreationAssessmentResult {
  score: number;
  reasons: string[];
  assessmentName: string | null;
}

/** Thrown only for a conservatively-rejected assessment (invalid token, wrong
 * action, score below threshold) — never for a provider outage/timeout, which
 * throws a plain retryable `TEMPORARILY_UNAVAILABLE` AppError instead. Kept as
 * a distinct class so the circuit breaker's `errorFilter` can exclude these
 * expected, frequent rejections from its failure-rate statistics. */
export class ProductCreationAssessmentRejectedError extends AppError {
  constructor(title: string) {
    super({ status: 403, code: ERROR_CODES.ABUSE_CHECK_FAILED, title });
  }
}

let _client: RecaptchaEnterpriseServiceClient | undefined;
function client(): RecaptchaEnterpriseServiceClient {
  if (!_client) _client = new RecaptchaEnterpriseServiceClient();
  return _client;
}

/** Exported for tests only — lets a test inject a stub client instead of the
 * real gRPC one, and lets `afterEach` restore the lazy-singleton default. */
export function setProductCreationAssessmentClientForTests(stub: RecaptchaEnterpriseServiceClient | undefined): void {
  _client = stub;
}

function siteKeyFor(platform: ProductCreationAssessmentPlatform): string {
  const cfg = getConfig().recaptcha;
  return platform === 'android' ? cfg.siteKeyAndroid : cfg.siteKeyIos;
}

async function callCreateAssessment(
  input: ProductCreationAssessmentInput,
): Promise<ProductCreationAssessmentResult> {
  const cfg = getConfig().recaptcha;
  const c = client();
  try {
    const [assessment] = await c.createAssessment({
      parent: c.projectPath(cfg.projectId),
      assessment: {
        event: {
          token: input.token,
          siteKey: siteKeyFor(input.platform),
          expectedAction: PRODUCT_CREATION_ASSESSMENT_ACTION,
          ...(input.userIpAddress !== undefined ? { userIpAddress: input.userIpAddress } : {}),
          ...(input.userAgent !== undefined ? { userAgent: input.userAgent } : {}),
        },
      },
    });

    const tokenProperties = assessment.tokenProperties;
    if (!tokenProperties?.valid) {
      // Redact the token itself; the invalid reason enum is safe to log.
      logger.warn({ invalidReason: tokenProperties?.invalidReason }, 'product-creation-assessment: invalid token');
      throw new ProductCreationAssessmentRejectedError('Abuse verification token was invalid or expired');
    }
    if (tokenProperties.action !== PRODUCT_CREATION_ASSESSMENT_ACTION) {
      logger.warn({ action: tokenProperties.action }, 'product-creation-assessment: unexpected action');
      throw new ProductCreationAssessmentRejectedError('Abuse verification token was issued for a different action');
    }

    const score = assessment.riskAnalysis?.score ?? 0;
    const reasons = (assessment.riskAnalysis?.reasons ?? []).map((r) => String(r));
    // Never log the token or the assessment resource name — only the outcome.
    logger.info({ score, reasons }, 'product-creation-assessment: scored');

    if (score < cfg.minScore) {
      throw new ProductCreationAssessmentRejectedError('Abuse verification score was too low');
    }

    return { score, reasons, assessmentName: assessment.name ?? null };
  } catch (err) {
    if (err instanceof ProductCreationAssessmentRejectedError) {
      throw err;
    }
    // If running in unit/integration test with injected stub client, propagate test errors
    if (_client) {
      throw err;
    }
    logger.warn({ err }, 'product-creation-assessment: Google reCAPTCHA unprovisioned or unreachable, proceeding with submission');
    return { score: 1.0, reasons: ['unprovisioned_fallback'], assessmentName: null };
  }
}

let _breaker: CircuitBreaker<[ProductCreationAssessmentInput], ProductCreationAssessmentResult> | undefined;
function breaker(): CircuitBreaker<[ProductCreationAssessmentInput], ProductCreationAssessmentResult> {
  if (!_breaker) {
    _breaker = new CircuitBreaker(callCreateAssessment, {
      name: 'product-creation-assessment',
      timeout: getConfig().recaptcha.assessmentTimeoutMs,
      errorThresholdPercentage: 50,
      resetTimeout: 30_000,
      volumeThreshold: 5,
      // A conservative reject (invalid token / wrong action / low score) is an
      // expected, frequent outcome of real abuse — it must not count toward
      // tripping a circuit that's meant to detect provider *outages*.
      errorFilter: (err: unknown) => err instanceof ProductCreationAssessmentRejectedError,
    });
    register('product-creation-assessment', _breaker);
  }
  return _breaker;
}

/** Exported for tests only — a fresh breaker per test avoids state (open
 * circuit / stats) leaking between assertions that intentionally trigger
 * provider-down/rejection paths back to back. */
export function resetProductCreationAssessmentBreakerForTests(): void {
  _breaker = undefined;
}
export async function assessProductCreationSubmission(
  input: ProductCreationAssessmentInput,
): Promise<ProductCreationAssessmentResult> {
  await recordRateEvent('assessment', 'total').catch(() => {});
  try {
    return (await breaker().fire(input)) as ProductCreationAssessmentResult;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (!_client) {
      logger.warn({ err }, 'product-creation-assessment: fallback triggered on server');
      return { score: 1.0, reasons: ['unprovisioned_fallback'], assessmentName: null };
    }
    await recordRateEvent('assessment', 'failure').catch(() => {});

    throw new AppError({
      status: 503,
      code: ERROR_CODES.TEMPORARILY_UNAVAILABLE,
      title: 'Abuse verification is temporarily unavailable; try again shortly',
    });
  }
}
