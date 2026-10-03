import { test as base, expect, type Page } from '@playwright/test';
import { schemaAdminRemotes } from './schema-admin-remotes';

/** Initial native transport fixture only; final evidence must use setup/passkey login. */
class NativeAdmin {
  constructor(readonly page: Page, readonly origin: string, readonly token: string) {}
  async devBypassAuth() {
    await this.page.context().addCookies([{ name: 'cms-session', value: this.token, url: this.origin }]);
  }
  async goToNewContent(collection: string) {
    await this.page.goto(`${this.origin}/content/${collection}/new`);
  }
  async goToContent(collection: string) {
    await this.page.goto(`${this.origin}/content/${collection}`);
  }
  async waitForShell() {
    await expect(this.page.getByRole('navigation', { name: 'Workspace' })).toBeVisible();
  }
  async expectPageTitle(title: string) {
    await expect(this.page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
  async waitForLoading() {
    await expect(this.page.getByRole('navigation', { name: 'Workspace' })).toBeVisible();
  }
  async fillField(slug: string, value: string) {
    const input = this.page.locator(`#field-${slug}`);
    // Supplemental native fixture precondition makes the absent/disabled editor
    // baseline an explicit assertion failure before filling the source field.
    await expect(input).toBeEditable();
    await input.fill(value);
  }
  async clickSave() {
    await this.page.locator('form button[type="submit"]').first().click();
  }
  async waitForSaveComplete() {
    await expect(this.page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  }
}
export const test = base.extend<{ admin: NativeAdmin }>({
  admin: async ({ page }, use) => {
    page.setDefaultTimeout(5_000);
    const h = await schemaAdminRemotes('Node');
    try {
      await h.registry.createCollection({ slug: 'posts', label: 'Posts', supports: ['drafts', 'revisions'] });
      await h.registry.createField('posts', { slug: 'title', label: 'Title', type: 'string', required: true });
      // Actual lifecycle operations produce the source's published fixtures.
      // No raw row, status or revision-pointer fabrication is permitted.
      for (const title of ['First Post', 'Second Post', 'Draft Post']) {
        const created = await h.mutate('createLifecycleContent', { collection: 'posts', data: JSON.stringify({ title }) });
        if (title !== 'Draft Post') {
          await h.mutate('publishContent', { collection: 'posts', id: created._.result.id, _rev: created._.result._rev });
        }
      }
      await use(new NativeAdmin(page, h.origin, h.tokens.admin));
    } finally { await h.close(); }
  }
});
export { expect } from '@playwright/test';
