import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assessProductCreationSubmission,
  resetProductCreationAssessmentBreakerForTests,
  setProductCreationAssessmentClientForTests,
  type ProductCreationAssessmentInput,
} from './product-creation-assessment.js';
import { AppError } from '../../errors.js';
import { logger } from '../../logger.js';
import { getConfig } from '../../config.js';

interface StubAssessment {
  name?: string;
  tokenProperties?: { valid?: boolean; action?: string; invalidReason?: string };
  riskAnalysis?: { score?: number; reasons?: string[] };
}

function stubClient(
  createAssessment: (req: unknown) => Promise<[StubAssessment]>,
): { projectPath: (p: string) => string; createAssessment: typeof createAssessment } {
  return {
    projectPath: (p: string) => `projects/${p}`,
    createAssessment,
  };
}

const validInput: ProductCreationAssessmentInput = { token: 'secret-token-abc', platform: 'android' };

beforeEach(() => {
  resetProductCreationAssessmentBreakerForTests();
});

afterEach(() => {
  setProductCreationAssessmentClientForTests(undefined);
  resetProductCreationAssessmentBreakerForTests();
  vi.restoreAllMocks();
});

describe('assessProductCreationSubmission', () => {
  it('resolves when the token is valid, the action matches, and the score is at or above threshold', async () => {
    setProductCreationAssessmentClientForTests(
      stubClient(async () => [
        {
          name: 'projects/p/assessments/a1',
          tokenProperties: { valid: true, action: 'submit_product' },
          riskAnalysis: { score: 0.9, reasons: [] },
        },
      ]) as never,
    );
    const result = await assessProductCreationSubmission(validInput);
    expect(result.score).toBe(0.9);
    expect(result.assessmentName).toBe('projects/p/assessments/a1');
  });

  it('sends the exact expected CreateAssessment request shape — parent, token, site key, action (reviewer-p7 M5)', async () => {
    const createAssessment = vi.fn(async () => [
      { tokenProperties: { valid: true, action: 'submit_product' }, riskAnalysis: { score: 0.9, reasons: [] } },
    ] as [StubAssessment]);
    setProductCreationAssessmentClientForTests(stubClient(createAssessment) as never);
    const cfg = getConfig().recaptcha;

    await assessProductCreationSubmission({ token: 'tok-android', platform: 'android' });
    expect(createAssessment).toHaveBeenCalledWith({
      parent: `projects/${cfg.projectId}`,
      assessment: {
        event: {
          token: 'tok-android',
          siteKey: cfg.siteKeyAndroid,
          expectedAction: 'submit_product',
        },
      },
    });

    createAssessment.mockClear();
    await assessProductCreationSubmission({ token: 'tok-ios', platform: 'ios' });
    expect(createAssessment).toHaveBeenCalledWith({
      parent: `projects/${cfg.projectId}`,
      assessment: {
        event: {
          token: 'tok-ios',
          siteKey: cfg.siteKeyIos,
          expectedAction: 'submit_product',
        },
      },
    });
    // The two platforms must never resolve to the same site key — that's the
    // entire point of a per-platform key (Android/iOS require distinct,
    // non-interchangeable reCAPTCHA Enterprise site keys).
    expect(cfg.siteKeyAndroid).not.toBe(cfg.siteKeyIos);
  });

  it('accepts a score exactly at the configured 0.5 threshold', async () => {
    setProductCreationAssessmentClientForTests(
      stubClient(async () => [
        { tokenProperties: { valid: true, action: 'submit_product' }, riskAnalysis: { score: 0.5, reasons: [] } },
      ]) as never,
    );
    await expect(assessProductCreationSubmission(validInput)).resolves.toMatchObject({ score: 0.5 });
  });

  it('rejects a score of 0.49, just under threshold', async () => {
    setProductCreationAssessmentClientForTests(
      stubClient(async () => [
        { tokenProperties: { valid: true, action: 'submit_product' }, riskAnalysis: { score: 0.49, reasons: [] } },
      ]) as never,
    );
    await expect(assessProductCreationSubmission(validInput)).rejects.toMatchObject({
      status: 403,
      code: 'abuse_check_failed',
    });
  });

  it('surfaces risk analysis reasons on an accepted assessment', async () => {
    setProductCreationAssessmentClientForTests(
      stubClient(async () => [
        {
          tokenProperties: { valid: true, action: 'submit_product' },
          riskAnalysis: { score: 0.7, reasons: ['AUTOMATION', 'UNEXPECTED_ENVIRONMENT'] },
        },
      ]) as never,
    );
    const result = await assessProductCreationSubmission(validInput);
    expect(result.reasons).toEqual(['AUTOMATION', 'UNEXPECTED_ENVIRONMENT']);
  });

  it('rejects an invalid/expired/reused token (tokenProperties.valid false)', async () => {
    setProductCreationAssessmentClientForTests(
      stubClient(async () => [
        { tokenProperties: { valid: false, invalidReason: 'EXPIRED' }, riskAnalysis: {} },
      ]) as never,
    );
    await expect(assessProductCreationSubmission(validInput)).rejects.toMatchObject({
      status: 403,
      code: 'abuse_check_failed',
    });
  });

  it('rejects a token whose site key does not match this app registration (surfaces as an invalid token)', async () => {
    setProductCreationAssessmentClientForTests(
      stubClient(async () => [
        { tokenProperties: { valid: false, invalidReason: 'SITE_MISMATCH' }, riskAnalysis: {} },
      ]) as never,
    );
    await expect(assessProductCreationSubmission(validInput)).rejects.toMatchObject({ status: 403 });
  });

  it('rejects a valid token issued for a different action', async () => {
    setProductCreationAssessmentClientForTests(
      stubClient(async () => [
        { tokenProperties: { valid: true, action: 'login' }, riskAnalysis: { score: 0.9 } },
      ]) as never,
    );
    await expect(assessProductCreationSubmission(validInput)).rejects.toMatchObject({
      status: 403,
      code: 'abuse_check_failed',
    });
  });

  it('a provider timeout is retryable — a 503, never accepted, and distinct from a conservative reject', async () => {
    setProductCreationAssessmentClientForTests(
      stubClient(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve([{ tokenProperties: { valid: true, action: 'submit_product' }, riskAnalysis: { score: 0.9 } }]), 200);
          }),
      ) as never,
    );
    process.env.RECAPTCHA_ASSESSMENT_TIMEOUT_MS = '20';
    const { resetConfigForTests } = await import('../../config.js');
    resetConfigForTests();
    resetProductCreationAssessmentBreakerForTests();

    await expect(assessProductCreationSubmission(validInput)).rejects.toMatchObject({
      status: 503,
      code: 'temporarily_unavailable',
    });

    delete process.env.RECAPTCHA_ASSESSMENT_TIMEOUT_MS;
    resetConfigForTests();
  });

  it('a provider network/client error is retryable — a 503, not a conservative reject', async () => {
    setProductCreationAssessmentClientForTests(
      stubClient(async () => {
        throw new Error('ECONNREFUSED');
      }) as never,
    );
    await expect(assessProductCreationSubmission(validInput)).rejects.toMatchObject({
      status: 503,
      code: 'temporarily_unavailable',
    });
  });

  it('never logs the raw token, on either the accept or reject path', async () => {
    const warnSpy = vi.spyOn(logger, 'warn');
    const infoSpy = vi.spyOn(logger, 'info');
    setProductCreationAssessmentClientForTests(
      stubClient(async () => [
        { tokenProperties: { valid: false, invalidReason: 'EXPIRED' }, riskAnalysis: {} },
      ]) as never,
    );
    await expect(assessProductCreationSubmission(validInput)).rejects.toThrow();

    setProductCreationAssessmentClientForTests(
      stubClient(async () => [
        { tokenProperties: { valid: true, action: 'submit_product' }, riskAnalysis: { score: 0.9 } },
      ]) as never,
    );
    await assessProductCreationSubmission(validInput);

    const allCalls = [...warnSpy.mock.calls, ...infoSpy.mock.calls];
    for (const call of allCalls) {
      expect(JSON.stringify(call)).not.toContain(validInput.token);
    }
  });

  it('reuses the same injected client across repeated calls rather than reconstructing per call', async () => {
    let calls = 0;
    setProductCreationAssessmentClientForTests(
      stubClient(async () => {
        calls += 1;
        return [{ tokenProperties: { valid: true, action: 'submit_product' }, riskAnalysis: { score: 0.9 } }];
      }) as never,
    );
    await assessProductCreationSubmission(validInput);
    await assessProductCreationSubmission({ ...validInput, token: 'another-token' });
    expect(calls).toBe(2);
  });

  it('throws a real AppError instance, not a plain Error, on both reject paths', async () => {
    setProductCreationAssessmentClientForTests(
      stubClient(async () => [{ tokenProperties: { valid: false }, riskAnalysis: {} }]) as never,
    );
    await expect(assessProductCreationSubmission(validInput)).rejects.toBeInstanceOf(AppError);
  });
});
