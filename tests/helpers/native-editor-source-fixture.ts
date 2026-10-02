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
}
export const test = base.extend<{ admin: NativeAdmin }>({
  admin: async ({ page }, use) => {
    const h = await schemaAdminRemotes('Node');
    try {
      await h.registry.createCollection({ slug: 'posts', label: 'Posts', supports: ['drafts', 'revisions'] });
      await h.registry.createField('posts', { slug: 'title', label: 'Title', type: 'string', required: true });
      await use(new NativeAdmin(page, h.origin, h.tokens.admin));
    } finally { await h.close(); }
  }
});
export { expect } from '@playwright/test';
