import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPortableText } from '../src/lib/public-site/portable-text.ts';

// Original public-renderer regressions and controls, zero Source assertion credit.
function block(text: string, marks: string[] = [], markDefs: unknown[] = [], extra: Record<string, unknown> = {}) {
  return { _type: 'block', _key: 'b', style: 'normal', children: [{ _type: 'span', _key: 's', text, marks }], markDefs, ...extra };
}
for (const mark of ['constructor', 'toString']) {
  test(`public rendering treats prototype mark ${mark} as unknown literal text`, () => {
    assert.equal(renderPortableText([block('Public literal', [mark])]), '<p>Public literal</p>');
  });
}
test('public rendering escapes text and link attributes and preserves fragment navigation', () => {
  const href = 'https://example.com/?quote="&next=<value>';
  const result = renderPortableText([block('<script>literal</script>\nNext', ['strong', 'link'], [{ _key: 'link', _type: 'link', href, blank: true }])]);
  assert.equal(result, '<p><a href="https://example.com/?quote=&quot;&amp;next=&lt;value&gt;" target="_blank" rel="noopener noreferrer"><strong>&lt;script&gt;literal&lt;/script&gt;<br>Next</strong></a></p>');
  assert.equal(renderPortableText([block('Jump', ['link'], [{ _key: 'link', _type: 'link', href: '#section', blank: true }])]), '<p><a href="#section">Jump</a></p>');
});
test('public rendering joins quote paragraphs and preserves independent numbered list segments', () => {
  const input = [block('First', [], [], { style: 'blockquote', _key: 'q1' }), block('Second', [], [], { style: 'blockquote', _key: 'q2' }),
    block('One', [], [], { _key: 'one', listItem: 'number', level: 1, listId: 'sequence', listStart: 4 }), block('Between'),
    block('Two', [], [], { _key: 'two', listItem: 'number', level: 1, listId: 'sequence', listStart: 4 })];
  const before = structuredClone(input);
  assert.equal(renderPortableText(input), '<blockquote><p>First</p><p>Second</p></blockquote><ol start="4"><li>One</li></ol><p>Between</p><ol start="5"><li>Two</li></ol>');
  assert.deepEqual(input, before);
});
