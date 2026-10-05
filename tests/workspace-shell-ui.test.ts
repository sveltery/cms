import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import type { Component } from 'svelte';
import { compileWorkspaceAccountSsr } from './helpers/admin-app/compile-account-ssr.ts';

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
  const compiled = compile(source, { filename: 'WorkspaceShell.svelte', generate: 'server', experimental: { async: true } }).js.code;
  await compileWorkspaceAccountSsr(directory);
  await mkdir(`${directory}/card`);
  for (const name of ['Card', 'CardHeader', 'CardTitle', 'CardDescription', 'CardAction', 'CardContent', 'CardFooter']) {
    const cardSource = await readFile(new URL(`../src/lib/ui/vendor/sveltery/card/${name}.svelte`, import.meta.url), 'utf8');
    await writeFile(`${directory}/card/${name}.js`, compile(cardSource, { filename: `${name}.svelte`, generate: 'server' }).js.code
      .replace('../shared/classes.js', '../classes.js'));
  }
  await cp(new URL('../src/lib/ui/vendor/sveltery/shared/classes.js', import.meta.url), `${directory}/classes.js`);
  await writeFile(`${directory}/card/index.js`, "export {default as Card} from './Card.js';");
  await writeFile(`${directory}/display-state.js`, "export const page = {url: new URL('https://display.example/')};");
  await writeFile(`${directory}/display-remote.js`, "export function getWorkspaceNavigation() { throw new Error('SSR display props never call remote transport'); }");
  await writeFile(`${directory}/WorkspaceShell.js`, compiled
    .replace('$app/state', './display-state.js')
    .replace('../admin-app/WorkspaceAccount.svelte', './WorkspaceAccount.js')
    .replace('$lib/workspace.remote', './display-remote.js')
    .replace('./nav/navigation', new URL('../src/lib/ui/nav/navigation.ts', import.meta.url).href)
    .replace('./nav/admin-version', new URL('../src/lib/ui/nav/admin-version.ts', import.meta.url).href)
    .replace('./vendor/sveltery/card/index', './card/index.js')
    .replace("import './vendor/sveltery/themes-native.css';", ''));
  ({ default: Shell } = await import(`${directory}/WorkspaceShell.js`));
});
after(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });

async function html(extra: Record<string, unknown> = {}) {
  return (await render(Shell, { props: { children: () => {}, navigation, ...extra } })).body;
}
test('shell provides a keyboard skip link to its actual main landmark', async () => {
  const body = await html();
  assert.match(body, /href="#workspace-main"[^>]*>Skip to content/);
  assert.match(body, /<main[^>]*id="workspace-main"[^>]*tabindex="-1"/);
});
test('shell renders persisted collection descriptors while omitting hidden collections', async () => {
  const body = await html();
  assert.match(body, /href="\/content\/posts"[^>]*>[^<]*Posts/);
  assert.doesNotMatch(body, /Private notes|\/content\/private_notes/);
});
test('authenticated principals without schema permission have no administration link', async () => {
  assert.doesNotMatch(await html({ navigation: { ...navigation, permissions: ['content:read', 'content:read_drafts'] } }), /href="\/schema"/);
});
test('grouped collection navigation is a real accessible disclosure', async () => {
  const body = await html();
  assert.match(body, /<details[^>]*>[^]*<summary[^>]*>[^<]*Calendar/);
  assert.match(body, /href="\/content\/events"/);
  assert.match(body, /href="\/content\/venues"/);
});
test('collection navigation resolves the application base and actual active descendant path', async () => {
  const body = await html({ homeHref: '/cms/', currentPath: '/cms/content/posts/entry' });
  assert.match(body, /href="\/cms\/content\/posts"[^>]*aria-current="page"/);
  assert.doesNotMatch(body, /href="\/content\/posts"/);
});
test('shell has an accessible navigation toggle and controlled sidebar landmark', async () => {
  const body = await html();
  assert.match(body, /<button[^>]*aria-controls="workspace-sidebar"[^>]*>[^<]*Toggle navigation/);
  assert.match(body, /<aside[^>]*id="workspace-sidebar"/);
});
test('unavailable feature families are not advertised as working destinations', async () => {
  assert.doesNotMatch(await html(), /href="\/(media|blocks|users|plugins|comments|menus|settings)"/);
});
