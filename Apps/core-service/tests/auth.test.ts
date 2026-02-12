import { authenticator } from 'otplib';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { buildServer } from '../src/server.js';
import { TEST_USER_ID, TEST_USER_USERNAME, TEST_TENANT_ID, MANAGER_USER_ID } from './mocks/db.js';
import { buildAuthHeader } from './utils/auth.js';
import { configureTenantAuthMock } from './mocks/db.js';

const VALID_PASSWORD = 'Password123!';

describe('Authentication Routes', () => {
  let app: FastifyInstance;
  let accessToken: string;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        username: TEST_USER_USERNAME,
        password: VALID_PASSWORD,
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    accessToken = payload.access_token;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /v1/auth/login', () => {
    it('returns access token for valid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          username: TEST_USER_USERNAME,
          password: VALID_PASSWORD,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.access_token).toBeDefined();
      expect(payload.token_type).toBe('Bearer');
      expect(payload.expires_in).toBeGreaterThan(0);
      expect(payload.id).toBe(TEST_USER_ID);
      expect(payload.memberships).toBeInstanceOf(Array);
      expect(payload.must_change_password).toBe(false);
    });

    it('returns 401 for invalid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          username: TEST_USER_USERNAME,
          password: 'WrongPassword!',
        },
      });

      expect(response.statusCode).toBe(401);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Invalid credentials');
    });

    it('returns 423 when account is locked', async () => {
      configureTenantAuthMock({ lockedUntil: new Date(Date.now() + 5 * 60 * 1000) });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          username: TEST_USER_USERNAME,
          password: VALID_PASSWORD,
        },
      });

      expect(response.statusCode).toBe(423);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('ACCOUNT_LOCKED');
      expect(payload.lock_expires_at).toBeDefined();
    });

    it('requires MFA code when user has MFA enabled', async () => {
      configureTenantAuthMock({ mfaEnabled: true });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          username: TEST_USER_USERNAME,
          password: VALID_PASSWORD,
        },
      });

      expect(response.statusCode).toBe(401);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('MFA_REQUIRED');
    });

    it('accepts valid MFA code when provided', async () => {
      configureTenantAuthMock({ mfaEnabled: true });
      vi.spyOn(authenticator, 'check').mockReturnValue(true);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          username: TEST_USER_USERNAME,
          password: VALID_PASSWORD,
          mfa_code: '123456',
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.access_token).toBeDefined();
    });

    it('flags password rotation when password age exceeds policy', async () => {
      const ninetyOneDaysAgo = new Date(Date.now() - 181 * 24 * 60 * 60 * 1000);
      configureTenantAuthMock({ passwordRotatedAt: ninetyOneDaysAgo });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          username: TEST_USER_USERNAME,
          password: VALID_PASSWORD,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.must_change_password).toBe(true);
    });
  });

  describe('GET /v1/auth/context', () => {
    it('returns unauthenticated context without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/context',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.is_authenticated).toBe(false);
      expect(payload.user_id).toBeNull();
      expect(payload.memberships).toEqual([]);
      expect(payload.authorized_tenants).toEqual([]);
      expect(payload.header_hint.header).toBe('Authorization');
    });

    it('returns authenticated context with valid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/context',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.is_authenticated).toBe(true);
      expect(payload.user_id).toBe(TEST_USER_ID);
      expect(Array.isArray(payload.memberships)).toBe(true);
    });

    it('includes tenant memberships when present', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/context',
        headers: buildAuthHeader(TEST_USER_ID),
      });

      const payload = JSON.parse(response.payload);
      if (payload.memberships.length > 0) {
        const membership = payload.memberships[0];
        expect(membership).toHaveProperty('tenant_id');
        expect(membership).toHaveProperty('role');
        expect(membership).toHaveProperty('is_active');
        expect(membership).toHaveProperty('permissions');
      }
    });

    it('handles tokens for users without memberships', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/context',
        headers: buildAuthHeader(MANAGER_USER_ID),
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.is_authenticated).toBe(true);
      expect(payload.user_id).toBe(MANAGER_USER_ID);
      expect(Array.isArray(payload.memberships)).toBe(true);
    });

    it('returns empty authorized_tenants before guards run', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/context',
        headers: buildAuthHeader(TEST_USER_ID),
      });

      const payload = JSON.parse(response.payload);
      expect(payload.authorized_tenants).toEqual([]);
    });

    it('includes header hint for bearer authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/context',
      });

      const payload = JSON.parse(response.payload);
      expect(payload.header_hint.header).toBe('Authorization');
      expect(payload.header_hint.description).toContain('Bearer');
    });

    it('treats invalid bearer tokens as unauthenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/context',
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.is_authenticated).toBe(false);
    });
  });

  describe('Tenant authorization guard', () => {
    it('rejects requests without valid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tenants',
      });

      expect(response.statusCode).toBe(401);
      const payload = JSON.parse(response.payload);
      expect(payload.message).toBe('You must be logged in to access this resource.');
    });

    it('allows access with valid tenant scope', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/tenants?limit=10',
        headers: buildAuthHeader(TEST_USER_ID),
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty('tenants');
      expect(Array.isArray(payload.tenants)).toBe(true);
    });

    it('forbids access when role is insufficient', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/dashboard/stats?tenant_id=${TEST_TENANT_ID}`,
        headers: buildAuthHeader(MANAGER_USER_ID),
      });

      expect(response.statusCode).toBe(403);
      const payload = JSON.parse(response.payload);
      expect(payload.message).toBe(
        "You don't have permission to access this resource. Admin role is required.",
      );
    });
  });

  describe('Tenant MFA enrollment', () => {
    it('enrolls, verifies, and rotates MFA', async () => {
      const enrollResponse = await app.inject({
        method: 'POST',
        url: '/v1/auth/mfa/enroll',
        headers: buildAuthHeader(TEST_USER_ID),
      });

      expect(enrollResponse.statusCode).toBe(200);
      const enrollPayload = JSON.parse(enrollResponse.payload);
      expect(enrollPayload.secret).toBeDefined();
      expect(enrollPayload.otpauth_url).toContain('otpauth://');

      const firstCode = authenticator.generate(enrollPayload.secret);
      const verifyResponse = await app.inject({
        method: 'POST',
        url: '/v1/auth/mfa/verify',
        headers: buildAuthHeader(TEST_USER_ID),
        payload: {
          mfa_code: firstCode,
        },
      });

      expect(verifyResponse.statusCode).toBe(200);

      const rotateCode = authenticator.generate(enrollPayload.secret);
      const rotateResponse = await app.inject({
        method: 'POST',
        url: '/v1/auth/mfa/rotate',
        headers: buildAuthHeader(TEST_USER_ID),
        payload: {
          mfa_code: rotateCode,
        },
      });

      expect(rotateResponse.statusCode).toBe(200);
      const rotatePayload = JSON.parse(rotateResponse.payload);
      expect(rotatePayload.secret).toBeDefined();
      expect(rotatePayload.otpauth_url).toContain('otpauth://');

      const newCode = authenticator.generate(rotatePayload.secret);
      const verifyNewResponse = await app.inject({
        method: 'POST',
        url: '/v1/auth/mfa/verify',
        headers: buildAuthHeader(TEST_USER_ID),
        payload: {
          mfa_code: newCode,
        },
      });

      expect(verifyNewResponse.statusCode).toBe(200);
    });

    it('rejects invalid MFA codes', async () => {
      vi.spyOn(authenticator, 'check').mockReturnValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/mfa/verify',
        headers: buildAuthHeader(TEST_USER_ID),
        payload: {
          mfa_code: '123456',
        },
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.message).toBe('The provided MFA code is invalid.');
    });
  });

  describe('POST /v1/auth/change-password', () => {
    const NEW_PASSWORD = 'Password456!';

    afterAll(async () => {
      const revertResponse = await app.inject({
        method: 'POST',
        url: '/v1/auth/change-password',
        headers: buildAuthHeader(TEST_USER_ID),
        payload: {
          current_password: NEW_PASSWORD,
          new_password: VALID_PASSWORD,
        },
      });

      if (revertResponse.statusCode !== 200) {
        console.warn('⚠ Password revert after tests did not succeed');
      }
    });

    it('updates password and returns new token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/change-password',
        headers: buildAuthHeader(TEST_USER_ID),
        payload: {
          current_password: VALID_PASSWORD,
          new_password: NEW_PASSWORD,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.access_token).toBeDefined();
      expect(payload.must_change_password).toBe(false);
    });

    it('rejects invalid current password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/change-password',
        headers: buildAuthHeader(TEST_USER_ID),
        payload: {
          current_password: 'IncorrectPassword!',
          new_password: NEW_PASSWORD,
        },
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.message).toBe('Invalid credentials');
    });
  });
});
