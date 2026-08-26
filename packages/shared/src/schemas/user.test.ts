import { describe, it, expect } from 'vitest';
import { userSchema, updateProfileSchema } from './user.js';
import { changePasswordSchema } from './auth.js';

describe('userSchema & updateProfileSchema', () => {
  it('parses valid user with address and hasPassword', () => {
    const validUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'user@example.com',
      emailVerified: true,
      firstName: 'John',
      lastName: 'Doe',
      address: '123 Main Street, Apt 4B',
      country: 'US',
      avatarUrl: 'https://cdn.example.com/avatar.webp',
      hasPassword: true,
      role: 'user' as const,
      status: 'active' as const,
      themePreference: 'expyrico' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const parsed = userSchema.parse(validUser);
    expect(parsed.address).toBe('123 Main Street, Apt 4B');
    expect(parsed.hasPassword).toBe(true);
  });

  it('validates updateProfileSchema address bounds', () => {
    expect(updateProfileSchema.parse({ address: '456 Oak Avenue' })).toEqual({
      address: '456 Oak Avenue',
    });
    expect(updateProfileSchema.parse({ address: null })).toEqual({
      address: null,
    });
  });

  it('validates changePasswordSchema matching rules', () => {
    expect(
      changePasswordSchema.parse({
        currentPassword: 'oldPassword123!',
        newPassword: 'newSecretPassword123!',
        confirmPassword: 'newSecretPassword123!',
      }),
    ).toBeDefined();

    expect(() =>
      changePasswordSchema.parse({
        currentPassword: 'oldPassword123!',
        newPassword: 'newSecretPassword123!',
        confirmPassword: 'differentPassword123!',
      }),
    ).toThrow('New passwords do not match');

    // Too short password
    expect(() =>
      changePasswordSchema.parse({
        newPassword: 'short',
        confirmPassword: 'short',
      }),
    ).toThrow();
  });
});
