import { readFileSync } from 'node:fs';
import CircuitBreaker from 'opossum';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getConfig } from '../../config.js';
import { register } from '../external/breakers.js';

export interface FcmPushBatch {
  tokens: string[];
  title: string;
  body: string;
  data: Record<string, string>;
}

export interface FcmPushResult {
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

function messaging() {
  if (getApps().length === 0) {
    const config = getConfig();
    if (config.firebase.credentialMode === 'service_account_file') {
      const path = config.firebase.credentialsPath;
      if (!path) {
        throw new Error('GOOGLE_APPLICATION_CREDENTIALS is required for service_account_file mode');
      }
      const serviceAccount = JSON.parse(readFileSync(path, 'utf8')) as {
        project_id?: string;
        client_email: string;
        private_key: string;
      };
      initializeApp({
        credential: cert({
          projectId: serviceAccount.project_id ?? config.firebase.projectId,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key,
        }),
        projectId: config.firebase.projectId,
      });
    } else {
      initializeApp({
        credential: applicationDefault(),
        projectId: config.firebase.projectId,
      });
    }
  }
  return getMessaging();
}

async function sendBatch(batch: FcmPushBatch): Promise<FcmPushResult[]> {
  if (batch.tokens.length === 0) return [];

  const response = await messaging().sendEachForMulticast({
    tokens: batch.tokens,
    notification: { title: batch.title, body: batch.body },
    data: batch.data,
    android: { priority: 'high', notification: { sound: 'default' } },
    apns: { payload: { aps: { sound: 'default' } } },
  });

  if (response.responses.length !== batch.tokens.length) {
    throw new Error(
      `FCM response count mismatch: expected ${batch.tokens.length}, got ${response.responses.length}`,
    );
  }

  return response.responses.map((item) => ({
    providerMessageId: item.success ? item.messageId ?? null : null,
    errorCode: item.success ? null : item.error?.code ?? 'messaging/unknown-error',
    errorMessage: item.success ? null : item.error?.message ?? 'FCM send failed',
  }));
}

export const fcmPushBreaker = new CircuitBreaker(sendBatch, {
  name: 'fcm-push',
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,
  volumeThreshold: 5,
});

// No silent empty fallback: an open circuit must throw so BullMQ retries the job.
register('fcm-push', fcmPushBreaker);

export async function sendFcmPush(batch: FcmPushBatch): Promise<FcmPushResult[]> {
  return fcmPushBreaker.fire(batch) as Promise<FcmPushResult[]>;
}

/** Only codes that prove the token itself is dead and should be revoked. */
export function isInvalidFcmTokenError(code: string | null): boolean {
  return (
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-registration-token'
  );
}
