import test from 'node:test';
import assert from 'node:assert/strict';
import { registeredComments } from '../helpers/comments/registered.ts';

// Original native SSR product integration. Reuse the existing single persisted
// administrator fixture and real Node/raw D1 host; no new identity/auth probes,
// no new startup DDL, and no copied Source/whole-domain completion credit.
for (const target of ['Node SQLite', 'raw D1'] as const) {
  test(`${target}: every installed admin page shares one real management navigation`, async () => {
    const host = await registeredComments(target);
    try {
      for (const path of ['/', '/content/post', '/schema', '/comments', '/comments/settings/post', '/sections', '/sections/hero', '/widgets']) {
        const response = await host.request(path, 'GET', undefined, true);
        assert.equal(response.status, 200, `real page ${path}`);
        const html = await response.text();
        const navigation = html.match(/<nav[^>]*aria-label="Workspace"[^>]*>([^]*?)<\/nav>/)?.[1];
        assert.ok(navigation, `common landmark on ${path}`);
        for (const route of ['comments', 'menus', 'redirects', 'widgets', 'sections']) {
          const matches: RegExpExecArray[] = Array.from(navigation.matchAll(new RegExp(`href="[^\"]*/${route}"`, 'g')));
          assert.equal(matches.length, 1, `one real ${route} destination on ${path}`);
        }
        const activeRoute = path.startsWith('/comments') ? 'comments' : path.startsWith('/sections') ? 'sections' : path === '/widgets' ? 'widgets' : undefined;
        if (activeRoute) assert.match(navigation, new RegExp(`href="[^\"]*/${activeRoute}"[^>]*aria-current="page"`));
        assert.doesNotMatch(navigation, /href="\/(settings|media|blocks|users|plugins|bylines|calendar)"/);
      }
    } finally { await host.close(); }
  });
}
