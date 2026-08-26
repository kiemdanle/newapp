import { describe, expect, it } from 'vitest';
import { sendVerificationEmail, sendPasswordResetCodeEmail, resetEmailTransportForTests } from '../../src/services/auth/email.js';

describe('auth email service', () => {
  it('handles verification email sending in test environment without throwing', async () => {
    resetEmailTransportForTests();
    await expect(sendVerificationEmail('test@example.com', '123456')).resolves.toBeUndefined();
  });

  it('handles password reset email sending in test environment without throwing', async () => {
    resetEmailTransportForTests();
    await expect(sendPasswordResetCodeEmail('test@example.com', '654321')).resolves.toBeUndefined();
  });
});
