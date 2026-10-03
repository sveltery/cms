import { test, expect } from '@playwright/test';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes';

// Original native UI/registered transport regression. Existing isolated stored
// sessions exercise the trusted boundary; this earns no authentication/source credit.
test('saving persisted collection metadata refreshes the mounted workspace navigation', async ({ page, context }) => {
  const fixture = await schemaAdminRemotes('Node');
  try {
    await fixture.registry.createCollection({ slug: 'articles', label: 'Articles' });
    await context.addCookies([{ name: 'cms-session', value: fixture.tokens.admin, url: fixture.origin }]);
    await page.goto(`${fixture.origin}/schema/articles`);
    const navigation = page.getByRole('navigation', { name: 'Workspace' });
    await expect(navigation.getByRole('link', { name: 'Articles', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save metadata' })).toBeEnabled();
    await page.evaluate(() => { (window as Window & { navigationRefreshProbe?: boolean }).navigationRefreshProbe = true; });
    await page.getByLabel('Collection label', { exact: true }).fill('Editorial articles');
    await page.getByRole('button', { name: 'Save metadata' }).click();
    await expect(page.getByRole('heading', { name: 'Editorial articles', exact: true })).toBeVisible();
    expect((await fixture.query('getSchemaCollection', 'articles')).label).toBe('Editorial articles');
    await expect(navigation.getByRole('link', { name: 'Editorial articles', exact: true })).toBeVisible();
    await expect(navigation.getByRole('link', { name: 'Articles', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => (window as Window & { navigationRefreshProbe?: boolean }).navigationRefreshProbe)).toBe(true);
  } finally { await fixture.close(); }
});
