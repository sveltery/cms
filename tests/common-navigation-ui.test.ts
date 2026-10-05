import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import type { Component } from 'svelte';

// Original native whole-shell SSR regressions, directed by the complete pinned
// Sidebar manageItems and role floors. Explicit display props exercise no auth
// ceremony, identity resolution or mutation authorization; Source credit is zero.
let directory: string;
let Shell: Component<any>;
const adminPermissions = ['content:read', 'content:read_drafts', 'schema:manage',
  'comments:moderate', 'menus:read', 'menus:manage', 'redirects:read', 'redirects:manage',
  'widgets:read', 'widgets:manage', 'sections:read', 'sections:manage'];
const navigation = { authenticated: true, permissions: adminPermissions,
  collections: { posts: { label: 'Posts' }, internal: { label: 'Internal', hidden: true } } };

before(async () => {
  directory = await mkdtemp(fileURLToPath(new URL('.common-navigation-display-', import.meta.url)));
  const source = await readFile(new URL('../src/lib/ui/WorkspaceShell.svelte', import.meta.url), 'utf8');
  const compiled = compile(source, { filename: 'WorkspaceShell.svelte', generate: 'server', experimental: { async: true } }).js.code;
  await mkdir(`${directory}/card`);
  for (const name of ['Card', 'CardHeader', 'CardTitle', 'CardDescription', 'CardAction', 'CardContent', 'CardFooter']) {
    const card = await readFile(new URL(`../src/lib/ui/vendor/sveltery/card/${name}.svelte`, import.meta.url), 'utf8');
    await writeFile(`${directory}/card/${name}.js`, compile(card, { filename: `${name}.svelte`, generate: 'server' }).js.code
      .replace('../shared/classes.js', '../classes.js'));
  }
  await cp(new URL('../src/lib/ui/vendor/sveltery/shared/classes.js', import.meta.url), `${directory}/classes.js`);
  await writeFile(`${directory}/card/index.js`, "export {default as Card} from './Card.js';");
  await writeFile(`${directory}/display-state.js`, "export const page = {url: new URL('https://display.example/')};");
  await writeFile(`${directory}/display-remote.js`, "export function getWorkspaceNavigation() { throw new Error('Display fixture never calls a remote transport'); }");
  await writeFile(`${directory}/WorkspaceShell.js`, compiled
    .replace('$app/state', './display-state.js')
    .replace('$lib/workspace.remote', './display-remote.js')
    .replace('./nav/navigation', new URL('../src/lib/ui/nav/navigation.ts', import.meta.url).href)
    .replace('./nav/admin-version', new URL('../src/lib/ui/nav/admin-version.ts', import.meta.url).href)
    .replace('./vendor/sveltery/card/index', './card/index.js')
    .replace("import './vendor/sveltery/themes-native.css';", ''));
  ({ default: Shell } = await import(`${directory}/WorkspaceShell.js`));
});
after(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });

async function links(extra: Record<string, unknown> = {}) {
  const html = (await render(Shell, { props: { children: () => {}, navigation, ...extra } })).body;
  const landmark = html.match(/<nav[^>]*aria-label="Workspace"[^>]*>([^]*?)<\/nav>/)?.[1];
  assert.ok(landmark, 'actual common navigation landmark');
  return landmark;
}

test('ordinary content workspace exposes the real Comments inbox', async () => {
  assert.match(await links(), /href="\/comments"[^>]*>[^<]*Comments/);
});
test('ordinary content workspace exposes both installed Sections and Widgets', async () => {
  const html = await links();
  assert.match(html, /href="\/sections"[^>]*>[^<]*Sections/);
  assert.match(html, /href="\/widgets"[^>]*>[^<]*Widgets/);
});
test('common management links retain the pinned Comments Menus Redirects Widgets Sections order', async () => {
  const html = await links();
  assert.match(html, /<h2[^>]*>Manage<\/h2>/);
  const actual = Array.from(html.matchAll(/href="\/(comments|menus|redirects|widgets|sections)"/g), match => match[1]);
  assert.deepEqual(actual, ['comments', 'menus', 'redirects', 'widgets', 'sections']);
});
test('Comments remains selected while editing actual collection comment settings', async () => {
  assert.match(await links({ currentPath: '/comments/settings/posts' }), /href="\/comments"[^>]*aria-current="page"/);
});
test('Sections remains selected on its actual section editor route', async () => {
  assert.match(await links({ currentPath: '/sections/footer' }), /href="\/sections"[^>]*aria-current="page"/);
});
test('all installed management links resolve the application base with the current descendant selected', async () => {
  const html = await links({ homeHref: '/cms/', currentPath: '/cms/comments/settings/posts' });
  for (const route of ['comments', 'menus', 'redirects', 'widgets', 'sections']) {
    assert.match(html, new RegExp(`href="/cms/${route}"`));
  }
  assert.match(html, /href="\/cms\/comments"[^>]*aria-current="page"/);
  assert.doesNotMatch(html, /href="\/(comments|menus|redirects|widgets|sections)"/);
});
test('the pinned editor-level navigation hides administrator Redirects even when read capability is present', async () => {
  const html = await links({ navigation: { ...navigation,
    permissions: adminPermissions.filter(permission => permission !== 'redirects:manage' && permission !== 'schema:manage') } });
  assert.doesNotMatch(html, /href="\/redirects"/);
  for (const route of ['comments', 'menus', 'widgets', 'sections']) assert.match(html, new RegExp(`href="/${route}"`));
});
test('read capabilities below the pinned editor display floor expose no management links', async () => {
  const html = await links({ navigation: { ...navigation,
    permissions: ['content:read', 'menus:read', 'redirects:read', 'widgets:read', 'sections:read'] } });
  assert.doesNotMatch(html, /href="\/(comments|menus|redirects|widgets|sections)"/);
});
test('Redirects selection follows the current real route without requiring an activePage override', async () => {
  assert.match(await links({ currentPath: '/redirects' }), /href="\/redirects"[^>]*aria-current="page"/);
});
test('missing feature routes remain absent even for an administrator', async () => {
  assert.doesNotMatch(await links(), /href="\/(settings|media|blocks|users|plugins|bylines)"/);
});
test('installed Calendar is discoverable at the pinned contributor draft-read floor', async () => {
  const html = await links({ navigation: { ...navigation, permissions: ['content:read', 'content:read_drafts'] } });
  assert.match(html, /href="\/calendar"[^>]*>[^<]*Calendar/);
});
test('installed Calendar resolves the application base and remains selected on its real route', async () => {
  const html = await links({ homeHref: '/cms/', currentPath: '/cms/calendar' });
  assert.match(html, /href="\/cms\/calendar"[^>]*aria-current="page"/);
  assert.doesNotMatch(html, /href="\/calendar"/);
});
test('installed Calendar is absent below the pinned contributor display floor', async () => {
  for (const presentation of [
    { authenticated: true, permissions: ['content:read'], collections: {} },
    { authenticated: false, permissions: [], collections: {} },
  ]) assert.doesNotMatch(await links({ navigation: presentation }), /href="\/calendar"/);
});
test('schema administration and visible collections remain reachable alongside common navigation', async () => {
  const html = await links();
  assert.match(html, /href="\/schema"[^>]*>[^<]*Schema/);
  assert.match(html, /href="\/content\/posts"[^>]*>[^<]*Posts/);
  assert.doesNotMatch(html, /Internal|\/content\/internal/);
});
test('anonymous presentation has no management links', async () => {
  const html = await links({ navigation: { authenticated: false, permissions: [], collections: {} } });
  assert.doesNotMatch(html, /href="\/(comments|menus|redirects|widgets|sections|schema)"/);
});
