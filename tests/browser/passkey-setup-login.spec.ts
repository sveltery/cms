// Actual configured runtime; real CDP WebAuthn registration/assertion, no seeded identity.
// Native presentation adaptation of EmDash 1.1.0
// e2e/tests/passkey-full-setup-virtual-auth.spec.ts:48 and original login/session supplements.
// Site-title/seed wizard, source headings and Astro navigation are not claimed as a port.
import { expect, test } from '@playwright/test';
import { passkeyRuntime } from '../helpers/passkey-runtime';
import { addVirtualWebAuthnAuthenticator } from '../helpers/virtual-authenticator';

test('real passkey setup then login persists role/session across process restart and logout', async ({ page }) => {
  test.setTimeout(90_000);
  const h = await passkeyRuntime('Node');
  const removeAuth = await addVirtualWebAuthnAuthenticator(page);
  try {
    await page.goto(`${h.origin}/setup`);
    await expect(page.getByLabel('Email')).toBeVisible({ timeout: 3_000 });
    await page.getByLabel('Email').fill('virtual-auth@example.com');
    await page.getByLabel('Name', { exact: true }).fill('Virtual Auth User');
    await page.getByRole('button', { name: 'Create administrator and passkey' }).click();
    await expect(page).toHaveURL(`${h.origin}/login`, { timeout: 30_000 });
    const db = await h.database();
    expect((await db.db.selectFrom('_cms_auth_users').selectAll().execute())).toHaveLength(1);
    expect((await db.db.selectFrom('_cms_auth_sessions').selectAll().execute())).toHaveLength(0);
    expect((await page.context().cookies()).some(cookie => cookie.name === 'emdash_setup_nonce')).toBe(false);
    await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
    await expect(page).toHaveURL(`${h.origin}/`, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Content', exact: true })).toBeVisible();
    await expect(page.getByText('Content is unavailable until authentication and storage are configured.')).toHaveCount(0);
    const cookie = (await page.context().cookies()).find(cookie => cookie.name === 'cms-session');
    expect(cookie).toBeDefined(); expect(cookie!.httpOnly).toBe(true); expect(cookie!.secure).toBe(true);
    expect(cookie!.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await h.restart();
    await page.reload();
    await expect(page.getByText('Content is unavailable until authentication and storage are configured.')).toHaveCount(0);
    await page.goto(`${h.origin}/login`);
    await expect(page.getByText('Signed in as Virtual Auth User.')).toBeVisible();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Sign in with a passkey' })).toBeVisible();
    await page.goto(`${h.origin}/`);
    await expect(page.getByText('Content is unavailable until authentication and storage are configured.')).toBeVisible();
    expect((await page.context().cookies()).some(cookie => cookie.name === 'cms-session')).toBe(false);
    expect((await (await h.database()).db.selectFrom('_cms_auth_sessions').selectAll().execute())).toHaveLength(0);
    await expect(page.locator('text=Registration was cancelled or timed out')).toHaveCount(0);
    await expect(page.locator('text=Invalid origin')).toHaveCount(0);
  } finally { await removeAuth(); await h.close(); }
});
