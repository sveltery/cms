import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import type { Component } from 'svelte';

// Original native SSR assertions. Display props are synthetic and grant no
// server/authentication credit; production navigation transport is tested separately.
let directory: string;
let Shell: Component<any>;
const collections = {
  posts: { label: 'Posts' },
  events: { label: 'Events', group: 'Calendar' },
  venues: { label: 'Venues', group: 'Calendar' },
  private_notes: { label: 'Private notes', hidden: true }
};
const navigation = { authenticated: true, permissions: ['content:read', 'content:read_drafts', 'schema:manage'], collections };

before(async () => {
  directory = await mkdtemp(fileURLToPath(new URL('.workspace-shell-display-', import.meta.url)));
  const source = await readFile(new URL('../src/lib/ui/WorkspaceShell.svelte', import.meta.url), 'utf8');
  const compiled = compile(source, { filename: 'WorkspaceShell.svelte', generate: 'server' }).js.code;
  await writeFile(`${directory}/WorkspaceShell.js`, compiled);
  ({ default: Shell } = await import(`${directory}/WorkspaceShell.js`));
});
after(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });

function html(extra: Record<string, unknown> = {}) {
  return render(Shell, { props: { children: () => {}, navigation, ...extra } }).body;
}
test('shell provides a keyboard skip link to its actual main landmark', () => {
  const body = html();
  assert.match(body, /href="#workspace-main"[^>]*>Skip to content/);
  assert.match(body, /<main[^>]*id="workspace-main"[^>]*tabindex="-1"/);
});
test('shell renders persisted collection descriptors while omitting hidden collections', () => {
  const body = html();
  assert.match(body, /href="\/content\/posts"[^>]*>[^<]*Posts/);
  assert.doesNotMatch(body, /Private notes|\/content\/private_notes/);
});
test('authenticated principals without schema permission have no administration link', () => {
  assert.doesNotMatch(html({ navigation: { ...navigation, permissions: ['content:read', 'content:read_drafts'] } }), /href="\/schema"/);
});
test('grouped collection navigation is a real accessible disclosure', () => {
  const body = html();
  assert.match(body, /<details[^>]*>[^]*<summary[^>]*>[^<]*Calendar/);
  assert.match(body, /href="\/content\/events"/);
  assert.match(body, /href="\/content\/venues"/);
});
test('collection navigation resolves the application base and actual active descendant path', () => {
  const body = html({ homeHref: '/cms/', currentPath: '/cms/content/posts/entry' });
  assert.match(body, /href="\/cms\/content\/posts"[^>]*aria-current="page"/);
  assert.doesNotMatch(body, /href="\/content\/posts"/);
});
test('shell has an accessible navigation toggle and controlled sidebar landmark', () => {
  const body = html();
  assert.match(body, /<button[^>]*aria-controls="workspace-sidebar"[^>]*>[^<]*Toggle navigation/);
  assert.match(body, /<aside[^>]*id="workspace-sidebar"/);
});
test('unavailable feature families are not advertised as working destinations', () => {
  assert.doesNotMatch(html(), /href="\/(media|blocks|users|plugins|comments|menus|settings)"/);
});
