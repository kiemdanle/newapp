import CircuitBreaker from 'opossum';
import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';

const expo = new Expo();

async function sendChunk(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  return expo.sendPushNotificationsAsync(messages);
}

export const expoPushBreaker = new CircuitBreaker(sendChunk, {
  name: 'expo-push',
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,
  volumeThreshold: 5,
});

// Default fallback returns empty tickets so the worker can write per-token
// failure rows without throwing through the queue.
expoPushBreaker.fallback(() => [] as ExpoPushTicket[]);

export async function sendPush(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  const valid = messages.filter((m) => Expo.isExpoPushToken(m.to as string));
  if (valid.length === 0) return [];
  return expoPushBreaker.fire(valid) as Promise<ExpoPushTicket[]>;
}

export { Expo };
