import { apiClient } from './client';
import type { PushToken, PushTokenRegister } from '@expyrico/shared';

export async function registerPushTokenApi(input: PushTokenRegister): Promise<PushToken> {
  return await apiClient.post<PushToken>('/me/push-token', input);
}
