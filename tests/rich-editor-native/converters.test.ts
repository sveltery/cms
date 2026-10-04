// Supplemental Native ordinary-value requirements. Source whole families are
// retained separately; these tests never stand in for their assertion credit.
import { describe, expect, it } from 'vitest';
type Value = Record<string, unknown>;
interface Converters {
  portableTextToProsemirror(blocks: Value[], options?: { preserveIdentity?: boolean }): Value;
  prosemirrorToPortableText(doc: Value): Value[];
  portableTextToMarkdown(blocks: Value[]): string;
  markdownToPortableText(markdown: string): Value[];
  buildPortableTextListTree(blocks: Value[], mode: 'html' | 'direct'): Value[];
}
const modulePath = '../../src/lib/editor/portable-text/index.ts';
async function converters(): Promise<Converters> {
  const result = await import(modulePath).then(module => ({ ready: true, module }),
    () => ({ ready: false, module: undefined }));
  // A missing product module is an observed readiness value failure. Every
  // subsequent value assertion remains unreached until the real module exists.
  expect(result.ready).toBe(true);
  return result.module as Converters;
}
const text = (key: string, value: string): Value => ({ _type: 'block', _key: key,
  style: 'normal', children: [{ _type: 'span', _key: `${key}-span`, text: value }] });
describe('Native Portable Text ordinary value contracts', () => {
  it('keeps stored block, span, annotation and custom identities in an editing round trip', async () => {
    const api = await converters();
    const blocks = [{ ...text('body', 'Read'), markDefs: [{ _type: 'link', _key: 'link', href: '/guide' }],
      children: [{ _type: 'span', _key: 'word', text: 'Read', marks: ['link'] }] },
      { _type: 'feature.callout', _key: 'callout', title: 'A useful note', legacy: { retained: true } }];
    expect(api.prosemirrorToPortableText(api.portableTextToProsemirror(blocks, { preserveIdentity: true }))).toEqual(blocks);
  });
  it('continues a numbered identity across a paragraph without flattening nested list levels', async () => {
    const api = await converters();
    const blocks = [{ ...text('one', 'One'), listItem: 'number', level: 1, listId: 'same', listStart: 2 },
      { ...text('nested', 'Nested'), listItem: 'bullet', level: 2 }, text('between', 'Between'),
      { ...text('two', 'Two'), listItem: 'number', level: 1, listId: 'same', listStart: 2 }];
    const before = structuredClone(blocks);
    const tree = api.buildPortableTextListTree(blocks, 'direct');
    const lists = tree.filter(node => node._type === '@list');
    expect(lists.map(node => node.start)).toEqual([2, 3]);
    expect(blocks).toEqual(before);
    const edited = api.prosemirrorToPortableText(api.portableTextToProsemirror(blocks));
    expect(edited.filter(node => node.listItem).map(node => [node.listItem, node.level])).toEqual([
      ['number', 1], ['bullet', 2], ['number', 1]
    ]);
  });
  it('retains table keys, merged-cell dimensions, column widths and linked cell text', async () => {
    const api = await converters();
    const table = { _type: 'table', _key: 'table', rows: [
      { _type: 'tableRow', _key: 'row', cells: [{ _type: 'tableCell', _key: 'cell', colspan: 2, colwidth: [140, 180],
        content: [{ _type: 'span', _key: 'span', text: 'Guide', marks: ['link'] }],
        markDefs: [{ _type: 'link', _key: 'link', href: '/guide' }] }] }
    ] };
    const result = api.prosemirrorToPortableText(api.portableTextToProsemirror([table], { preserveIdentity: true }));
    expect(result[0]).toMatchObject(table);
  });
  it('preserves author HTML fields and iframe attributes through conversion', async () => {
    const api = await converters();
    const blocks = [{ _type: 'htmlBlock', _key: 'html', html: '<p>Hi</p>', css: 'p{color:red}', js: 'console.log(1)', isolated: true },
      { _type: 'iframe', _key: 'iframe', src: 'https://www.youtube.com/embed/example', title: 'Example', width: 640, height: 360 }];
    const proseMirror = api.portableTextToProsemirror(blocks, { preserveIdentity: true });
    expect((proseMirror.content as Value[])[0]?.type).toBe('htmlBlock');
    const result = api.prosemirrorToPortableText(proseMirror);
    expect(result).toEqual(blocks);
  });
  it('keeps unsupported stored string code languages and linked inline code', async () => {
    const api = await converters();
    const blocks = [{ _type: 'code', _key: 'code', language: 'astro', code: 'const x = 1;' },
      { ...text('text', 'example'), children: [{ _type: 'span', _key: 'code-span', text: 'example', marks: ['code', 'link'] }],
        markDefs: [{ _type: 'link', _key: 'link', href: '/example' }] }];
    const result = api.prosemirrorToPortableText(api.portableTextToProsemirror(blocks, { preserveIdentity: true }));
    expect(result).toEqual(blocks);
  });
  it('rejects unsupported marks before losing stored content', async () => {
    const api = await converters();
    const blocks = [{ ...text('text', 'Retain'), children: [{ _type: 'span', _key: 'span', text: 'Retain', marks: ['unrecognized'] }] }];
    const before = structuredClone(blocks);
    expect(() => api.portableTextToProsemirror(blocks)).toThrow();
    expect(blocks).toEqual(before);
  });
  it('keeps unknown blocks opaque through a Markdown client round trip', async () => {
    const api = await converters();
    const blocks = [{ _type: 'feature.banner', _key: 'banner', nested: { value: 42 } }];
    expect(api.markdownToPortableText(api.portableTextToMarkdown(blocks))).toEqual(blocks);
  });
  it('preserves stored image/gallery values without claiming media-provider execution', async () => {
    const api = await converters();
    const blocks = [{ _type: 'image', _key: 'image', asset: { _ref: 'media', url: '/photo.jpg' }, alt: 'Photo', alignment: 'wide' },
      { _type: 'gallery', _key: 'gallery', images: [{ _type: 'image', _key: 'item', asset: { _type: 'reference', _ref: 'media', url: '/photo.jpg' }, alt: 'Photo' }] }];
    const result = api.prosemirrorToPortableText(api.portableTextToProsemirror(blocks, { preserveIdentity: true }));
    expect(result).toMatchObject(blocks);
  });
});
