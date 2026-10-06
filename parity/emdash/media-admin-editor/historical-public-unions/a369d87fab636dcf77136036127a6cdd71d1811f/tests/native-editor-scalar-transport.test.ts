// Supplemental native input-sanitization/partial-save boundaries; zero source credit.
import { it } from 'node:test';
import assert from 'node:assert/strict';
const { changedNativeScalars } = await import(new URL('../src/lib/ui/native-scalar-data.ts', import.meta.url).href).catch(cause => {
  if (cause.code !== 'ERR_MODULE_NOT_FOUND') throw cause;
  return { changedNativeScalars: (..._args: unknown[]) => undefined };
});
const fields = [{ slug: 'title', type: 'string' }, { slug: 'body', type: 'text' }, { slug: 'payload', type: 'json' }];
it('omits unchanged native controls while retaining an actual edited scalar', () => {
  assert.deepEqual(changedNativeScalars({ title: 'Old', body: 'Edited' }, { title: 'Old', body: 'Old' }, fields), { body: 'Edited' });
});
it('preserves untouched null or legacy non-string scalar values represented by blank controls', () => {
  assert.deepEqual(changedNativeScalars({ title: '', body: '' }, { title: null, body: 7 }, fields), {});
});
it('preserves exact existing textarea bytes when native CRLF submission is unchanged', () => {
  for (const body of ['cat\ndog', 'cat\r\ndog', 'cat\rdog']) {
    assert.deepEqual(changedNativeScalars({ body: 'cat\r\ndog' }, { body }, fields), {});
  }
});
it('accounts for native text inputs stripping existing line breaks', () => {
  assert.deepEqual(changedNativeScalars({ title: 'catdog' }, { title: 'cat\ndog' }, fields), {});
});
it('keeps edited native textarea bytes and explicit changed empty strings', () => {
  assert.deepEqual(changedNativeScalars({ title: '', body: 'new\r\ntext' }, { title: 'Old', body: 'Old' }, fields), { title: '', body: 'new\r\ntext' });
});
it('leaves non-scalar and unknown fields for the authoritative domain validator', () => {
  const submitted = JSON.parse('{"payload":{"__proto__":{"safe":true}},"unknown":""}');
  const result = changedNativeScalars(submitted, { payload: submitted.payload }, fields);
  assert.deepEqual(result, submitted); assert.ok(Object.hasOwn(result.payload, '__proto__'));
});
