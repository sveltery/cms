import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, stringify } from 'devalue';
import { createTrashRestoreFieldsServer } from '../helpers/trash-restore-fields-server.mjs';

test('isolated built native restore form uses direct Kit field spreads', { timeout: 90_000 }, async (t) => {
  const fixture = await createTrashRestoreFieldsServer();
  const headers = { cookie: 'trash-fields-session=author' };
  const input = fixture.inputs.native;
  const query = async (name: string, id = input.id) => {
    const url = new URL(`_app/remote/${fixture.ids.get(name)}`, fixture.baseURL);
    url.searchParams.set('payload', Buffer.from(stringify({ collection: 'post', id })).toString('base64url'));
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
    assert.equal(response.status, 200);
    return response.json();
  };
  try {
    const response = await fetch(fixture.baseURL, { headers, signal: AbortSignal.timeout(10_000) });
    assert.equal(response.status, 200);
    const html = await response.text();
    const form = html.match(/<form\b[^>]*>/)?.[0];
    assert.ok(form);
    assert.match(form, /method="POST"/);
    const action = new URL(form.match(/action="([^"]+)"/)![1].replaceAll('&amp;', '&'), fixture.baseURL);
    assert.equal(action.searchParams.get('/remote'), fixture.ids.get('restoreContent'));
    const submit = (body: Record<string, string>) => fetch(action, {
      method: 'POST', headers: { ...headers, origin: new URL(fixture.baseURL).origin, accept: 'text/html' },
      body: new URLSearchParams(body), signal: AbortSignal.timeout(10_000)
    });

    await t.test('registered direct form spreads render collection, ID, locale and revision values', () => {
      for (const field of ['collection', 'id', 'locale', '_rev'] as const) {
        const control = html.match(/<input\b[^>]*>/g)?.find(tag => tag.includes(`name="${field}"`));
        assert.ok(control, `generated ${field} field`);
        assert.match(control, /type="hidden"/);
        assert.ok(control.includes(`value="${input[field]}"`), `bound ${field} value`);
      }
    });
    await t.test('unenhanced invalid submission renders Kit field issues and preserves the trash token', async () => {
      const invalid = await submit({ ...input, _rev: '' });
      assert.equal(invalid.status, 200);
      const failed = await invalid.text();
      assert.match(failed, /role="alert" data-path="_rev"/);
      assert.doesNotMatch(failed, /<output>/);
      const remote = await fetch(new URL(`_app/remote/${fixture.ids.get('restoreContent')}`, fixture.baseURL), {
        method: 'POST', headers: { ...headers, origin: new URL(fixture.baseURL).origin },
        body: new URLSearchParams({ ...input, collection: '' }), signal: AbortSignal.timeout(10_000)
      });
      assert.equal(remote.status, 200);
      const envelope = await remote.json();
      assert.equal(envelope.type, 'result');
      const validation = parse(envelope.data)._;
      assert.deepEqual(validation.input, { collection: '', id: input.id, locale: 'en' });
      assert.equal(Object.hasOwn(validation.input, '_rev'), false, 'Kit redacts underscore-prefixed fields from returned input');
      assert.deepEqual(validation.issues.map((issue: { path: string[] }) => issue.path), [['collection'], ['collection']]);
      assert.equal(validation.result, undefined);
      assert.equal(parse((await query('getTrashedContent')).data)._._rev, input._rev);
    });
    await t.test('unenhanced submission defaults omitted locale, restores atomically and returns a fresh token', async () => {
      const { locale, ...omittedLocale } = input;
      assert.equal(locale, 'en');
      const restored = await submit(omittedLocale);
      assert.equal(restored.status, 200);
      const output = (await restored.text()).match(/<output>([^<]+)<\/output>/)?.[1];
      assert.ok(output);
      const receipt = JSON.parse(output);
      assert.deepEqual(Object.keys(receipt).sort(), ['_rev', 'id', 'locale', 'type']);
      assert.equal(receipt.id, input.id);
      assert.equal(receipt.type, 'post');
      assert.equal(receipt.locale, 'en');
      assert.notEqual(receipt._rev, input._rev);
      assert.equal(parse((await query('getContent')).data)._._rev, receipt._rev);
      assert.deepEqual(await query('getTrashedContent'), {
        type: 'error', status: 404, error: { message: 'not-found', code: 'NOT_FOUND' }
      });
      const stale = await submit(input);
      assert.equal(stale.status, 409);
      assert.equal(parse((await query('getContent')).data)._._rev, receipt._rev);
    });
    await t.test('one-argument hidden fields omit values after fields.set and fail native validation', async () => {
      const url = new URL('?case=missing&missing', fixture.baseURL);
      const probe = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
      assert.equal(probe.status, 200);
      const probeHtml = await probe.text();
      for (const field of ['collection', 'id', 'locale', '_rev']) {
        const control = probeHtml.match(/<input\b[^>]*>/g)?.find(tag => tag.includes(`name="${field}"`));
        assert.ok(control);
        assert.doesNotMatch(control, /\bvalue=/);
      }
      url.searchParams.set('/remote', fixture.ids.get('restoreContent'));
      const rejected = await fetch(url, {
        method: 'POST', headers: { ...headers, origin: new URL(fixture.baseURL).origin, accept: 'text/html' },
        body: new URLSearchParams({ collection: '', id: '', locale: '', _rev: '' }), signal: AbortSignal.timeout(10_000)
      });
      assert.equal(rejected.status, 200);
      const rejectedHtml = await rejected.text();
      for (const field of ['collection', 'id', 'locale', '_rev']) {
        assert.ok(rejectedHtml.includes(`role="alert" data-path="${field}"`));
      }
      assert.equal(parse((await query('getTrashedContent', fixture.inputs.missing.id)).data)._._rev, fixture.inputs.missing._rev);
    });
  } finally {
    await fixture.close();
  }
});
