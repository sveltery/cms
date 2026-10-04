// Original Native framework characterization; zero copied Source test credit.
// Reads built HTML for the fixture's existing stored principal; no credential ceremony.
import { it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { setupTestDatabase, teardownTestDatabase, UserRepository, builtLoginPage }
  from '../helpers/setup-api/welcome-source-http.ts';

it('login HTML preserves the intended setup import destination', async () => {
  const db = await setupTestDatabase();
  try {
    await new UserRepository(db).create({
      email: 'scott@example.com', name: 'Scott', role: 'admin'
    });
    const target = '/settings/transfer?start=import';
    const response = await builtLoginPage(db, target);
    expect(response.status).toBe(200);
    const dom = new JSDOM(await response.text());
    try {
      const link = [...dom.window.document.querySelectorAll('a')]
        .find(anchor => anchor.textContent === 'Open your workspace');
      expect(link?.getAttribute('href')).toBe(target);
    } finally { dom.window.close(); }
  } finally { await teardownTestDatabase(db); }
});
