import { afterEach, describe, expect, it } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import SchemaCollection from '../../../src/lib/ui/SchemaCollection.svelte';
import SchemaCollections from '../../../src/lib/ui/SchemaCollections.svelte';
import { FIELD_TYPES } from '../../../src/lib/server/schema/types.ts';

// Original native requirements; complete Source authorities and their assertions stay separate.
// Supplied controlled values only: these tests never create credentials, sessions or backend results.
const mounted: ReturnType<typeof mount>[] = [];
afterEach(async () => { for (const instance of mounted.splice(0)) await unmount(instance); document.body.replaceChildren(); });
const collection = (extra: Record<string, unknown> = {}) => ({
  id: 'col_1', slug: 'posts', label: 'Posts', labelSingular: 'Post', description: 'Blog posts',
  supports: ['drafts', 'revisions'], source: 'manual', version: 1, fields: [],
  routable: true, hasSeo: false, hidden: false, editLocking: true,
  commentsEnabled: false, commentsModeration: 'first_time', commentsClosedAfterDays: 90,
  commentsAutoApproveUsers: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  ...extra
});
async function detail(extra: Record<string, unknown> = {}) {
  const target = document.createElement('section'); document.body.append(target);
  mounted.push(mount(SchemaCollection, { target, props: { definition: collection(extra) as never, disabled: false } }));
  await tick(); return target;
}
const labels = (target: HTMLElement) => Array.from(target.querySelectorAll('label'), label => label.textContent?.trim());
describe('complete schema administration native forms', () => {
  it('offers every stored Source field type rather than only string and text', async () => {
    const target = await detail();
    const select = target.querySelector<HTMLSelectElement>('select[name="type"]');
    expect(select).not.toBeNull();
    const offered = Array.from(select!.options, option => option.value);
    for (const type of FIELD_TYPES) expect(offered).toContain(type);
  });
  it('exposes the pinned support toggles and separate SEO control', async () => {
    const target = await detail();
    const select = target.querySelector<HTMLSelectElement>('select[id$="-supports"]')!;
    select.value = 'set'; select.dispatchEvent(new Event('change', { bubbles: true })); await tick();
    const flags = ['Drafts', 'Revisions', 'Preview', 'Search', 'SEO'];
    expect(flags.map(flag => labels(target).some(text => text?.startsWith(flag))))
      .toEqual([true, true, true, true, true]);
  });
  it('exposes presentation metadata and display fields over the real collection form', async () => {
    const target = await detail();
    expect(['Icon', 'Group', 'Title field', 'Date field', 'URL pattern', 'Quick action on the dashboard', 'List columns']
      .map(label => labels(target).some(text => text?.startsWith(label)))).toEqual([true, true, true, true, true, true, true]);
  });
  it('keeps a code-defined collection visibly read only', async () => {
    const target = await detail({ source: 'code' });
    const submit = target.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(submit === null || submit.disabled || submit.closest('fieldset')?.disabled === true).toBe(true);
    expect(target.textContent).toContain('This collection is defined in code');
  });
  it('renders collection labels and slugs in the administration table', async () => {
    const target = document.createElement('section'); document.body.append(target);
    mounted.push(mount(SchemaCollections, { target, props: { collections: [
      { ...collection(), href: '/schema/posts' }, { ...collection({ slug: 'pages', label: 'Pages' }), href: '/schema/pages' }
    ] as never, disabled: false } })); await tick();
    expect(Array.from(target.querySelectorAll('tbody code'), node => node.textContent)).toEqual(['posts', 'pages']);
  });
  it('shows all six original system fields independently of custom fields', async () => {
    const target = await detail();
    expect(Array.from(target.querySelectorAll('code'), node => node.textContent).filter(text =>
      ['id', 'slug', 'status', 'created_at', 'updated_at', 'published_at'].includes(text ?? '')))
      .toEqual(['id', 'slug', 'status', 'created_at', 'updated_at', 'published_at']);
  });
  it('exposes field reorder and deletion controls', async () => {
    const target = await detail({ fields: [{ id: 'field_1', collectionId: 'col_1', slug: 'title', label: 'Title',
      type: 'string', columnType: 'TEXT', required: false, unique: false, searchable: false, indexed: false,
      translatable: true, validation: null, sortOrder: 0, createdAt: '2026-01-01T00:00:00.000Z' }] });
    expect(['Reorder Title field', 'Delete Title field'].map(name =>
      Array.from(target.querySelectorAll('button')).some(button => button.getAttribute('aria-label') === name)))
      .toEqual([true, true]);
  });
  it('displays an unsupported stored field type without erasing its identity', async () => {
    const target = await detail({ fields: [{ id: 'field_1', collectionId: 'col_1', slug: 'layout', label: 'Layout',
      type: 'string', unsupportedType: { type: 'future_blocks', path: 'type' }, columnType: 'TEXT',
      required: false, unique: false, searchable: false, indexed: false, translatable: true,
      validation: null, sortOrder: 0, createdAt: '2026-01-01T00:00:00.000Z' }] });
    expect(target.textContent).toContain('future_blocks');
    expect(target.textContent).toContain('Unsupported');
  });
});
