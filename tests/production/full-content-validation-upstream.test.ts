// Adapted complete declaration assertions from EmDash 1.1.0 at immutable
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e: content/validation-issues.test.ts
// lines 96/142/156/168. Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Test runner, schema seeding and REST/runtime transport become registered Kit
// HTTP forms and local mandatory-revision receipts. Source issue expectations,
// field types, values and order remain unchanged; no REST/MCP transport credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fullContentFixture, assertIssues } from '../helpers/full-content-fixture.ts';

const VALID = { title: 'Hello', starts_at: '2026-09-18T10:00:00Z', category: 'news' };
function issuesOf(error: { details?: object }): unknown {
  return error.details && 'issues' in error.details ? error.details.issues : undefined;
}

for (const target of ['Node', 'D1'] as const) {
  test(`${target}: validation-issues.test.ts:96 lists each rejected field as an issue with its code and bounds`, async () => {
    const h = await fullContentFixture(target);
    try {
      const result = await h.runtime.handleContentCreate('posts', { data: {
        excerpt: 'too long', reading_minutes: 99, website: 'not a url', related: 'missing',
        body: [{ children: [] }], stops: [{ name: '' }, null], subtitle: 'no such field'
      } });
      assert.equal(result.success, false);
      if (result.success) return;
      assert.equal(result.error.code, 'VALIDATION_ERROR');
      assertIssues(issuesOf(result.error), [
        { path: 'subtitle', code: 'unknown_field', message: "unknown field on collection 'posts'" },
        { path: 'title', code: 'required' },
        { path: 'starts_at', code: 'required' },
        { path: 'category', code: 'required' },
        { path: 'excerpt', code: 'too_big', origin: 'string', maximum: 5 },
        { path: 'reading_minutes', code: 'too_big', origin: 'number', maximum: 60 },
        { path: 'website', code: 'invalid_format', format: 'url' },
        { path: 'body.0._type', code: 'invalid_type' },
        { path: 'stops.0.name', code: 'required' },
        { path: 'stops.1', code: 'invalid_type' },
        { path: 'stops', code: 'too_big', origin: 'array', maximum: 1 },
        { path: 'related', code: 'reference_not_found', message: "target 'missing' not found in collection 'posts'" }
      ], [0, 11]);
    } finally { await h.close(); }
  });

  test(`${target}: validation-issues.test.ts:142 reports a wrong option and each failed string rule by its code`, async () => {
    const h = await fullContentFixture(target);
    try {
      const result = await h.runtime.handleContentCreate('posts', { data: { ...VALID, category: 'other', kicker: 'AB' } });
      assert.equal(result.success, false);
      if (result.success) return;
      assertIssues(issuesOf(result.error), [
        { path: 'category', code: 'invalid_value' },
        { path: 'kicker', code: 'too_small', origin: 'string', minimum: 3 },
        { path: 'kicker', code: 'invalid_format', format: 'regex' }
      ]);
    } finally { await h.close(); }
  });

  test(`${target}: validation-issues.test.ts:156 keeps naming every issue in the error message`, async () => {
    const h = await fullContentFixture(target);
    try {
      const result = await h.runtime.handleContentCreate('posts', { data: { ...VALID, excerpt: 'too long', related: 'missing' } });
      assert.equal(result.success, false);
      if (result.success) return;
      assert.equal(result.error.message, "excerpt: Too big: expected string to have <=5 characters; related: target 'missing' not found in collection 'posts'");
    } finally { await h.close(); }
  });

  test(`${target}: validation-issues.test.ts:168 reports a required field cleared on update as required`, async () => {
    const h = await fullContentFixture(target);
    try {
      const created = await h.runtime.handleContentCreate('posts', { data: VALID });
      assert.equal(created.success, true);
      if (!created.success) return;
      for (const title of ['', null]) {
        const result = await h.runtime.handleContentUpdate('posts', created.data.item.id, { data: { title } });
        assert.equal(result.success, false);
        if (result.success) return;
        assertIssues(issuesOf(result.error), [{ path: 'title', code: 'required' }]);
      }
    } finally { await h.close(); }
  });
}
