import { test, expect, type Page } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'node:path';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const TEST_USERNAME = process.env.E2E_USERNAME ?? 'michael.jenkins774';
const DEFAULT_PASSWORD = process.env.AUTH_DEFAULT_PASSWORD ?? 'ChangeMe123!';
const NEW_PASSWORD = process.env.E2E_NEW_PASSWORD ?? `E2e!${Date.now()}Aa`;

const dbPool = new Pool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? 'tartware',
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  ssl: process.env.DB_SSL?.toLowerCase() === 'true' ? { rejectUnauthorized: false } : undefined,
});

const updateUserPassword = async (password: string) => {
  const hashed = await bcrypt.hash(password, 10);
  const result = await dbPool.query(
    `
      UPDATE public.users
         SET password_hash = $1,
             failed_login_attempts = 0,
             locked_until = NULL,
             updated_at = NOW()
       WHERE username = $2
    `,
    [hashed, TEST_USERNAME],
  );

  if (result.rowCount === 0) {
    throw new Error(
      `E2E setup failed: no user found with username "${TEST_USERNAME}". Please ensure the seed data exists.`,
    );
  }
};

test.beforeAll(async () => {
  await updateUserPassword(DEFAULT_PASSWORD);
});

test.afterAll(async () => {
  try {
    await updateUserPassword(DEFAULT_PASSWORD);
  } finally {
    await dbPool.end();
  }
});

const login = async (page: Page, password: string) => {
  await page.fill('input#username', TEST_USERNAME);
  await page.fill('input#password', password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click('button[type="submit"]'),
  ]);
};

test('user is forced to change the default password before accessing the app', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);

  // Login with the default password and expect redirect to change-password
  await login(page, DEFAULT_PASSWORD);
  await expect(page).toHaveURL(/\/change-password$/);
  await expect(page.locator('text=Update Password')).toBeVisible();

  // Complete the password change flow
  await page.fill('input#currentPassword', DEFAULT_PASSWORD);
  await page.fill('input#newPassword', NEW_PASSWORD);
  await page.fill('input#confirmPassword', NEW_PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click('button[type="submit"]'),
  ]);

  await expect(page).toHaveURL(/\/tenants$/);
  await expect(page.locator('h2:has-text("Tenants")')).toBeVisible();

  // Log out from the tenant list
  await page.click('button:has(mat-icon:has-text("logout"))');
  await expect(page).toHaveURL(/\/login$/);

  // Login with the new password and ensure no password change prompt
  await login(page, NEW_PASSWORD);
  await expect(page).toHaveURL(/\/tenants$/);
  await expect(page.locator('h2:has-text("Tenants")')).toBeVisible();
});
