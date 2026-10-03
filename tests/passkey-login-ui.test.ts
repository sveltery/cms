import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
import type { Component } from 'svelte';

// Original native display coverage. These synthetic props and inert form
// attributes exercise compiled SSR only, without storage or authentication.
type DisplayProps = {
  legacyUnavailable?: boolean;
  homeHref?: string;
  user?: { name: string | null; email: string } | null;
};
let directory: string;
let PasskeyLogin: Component<DisplayProps>;
const signedInProps = {
  user: { name: 'Display fixture', email: 'display@example.test' },
  homeHref: '/display-workspace',
  legacyUnavailable: true
};

before(async () => {
  directory = await mkdtemp(fileURLToPath(new URL('.passkey-login-display-', import.meta.url)));
  const source = await readFile(new URL('../src/lib/ui/PasskeyLogin.svelte', import.meta.url), 'utf8');
  const compiled = compile(source, { filename: 'PasskeyLogin.svelte', generate: 'server' }).js.code;
  await writeFile(`${directory}/display-remotes.js`, `
    export const logout = { pending: 0, enhance: () => ({ method: 'POST', action: '/display-logout' }) };
    export const beginLogin = { pending: 0, enhance: () => ({ method: 'POST', action: '/display-begin-login' }) };
    export const completeLogin = { pending: 0, fields: { credential: { as: () => ({ name: 'credential', type: 'hidden' }) } } };
  `);
  await writeFile(`${directory}/display-browser.js`, `
    export function usePasskey() { throw new Error('Display-only test cannot start a credential ceremony'); }
  `);
  await writeFile(`${directory}/PasskeyLogin.js`, compiled
    .replaceAll('$lib/auth.remote', './display-remotes.js')
    .replaceAll('$lib/auth/passkey-browser', './display-browser.js'));
  ({ default: PasskeyLogin } = await import(`${directory}/PasskeyLogin.js`));
});

after(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });

test('compiled login retains signed-in workspace controls alongside the legacy warning', () => {
  const { body } = render(PasskeyLogin, { props: signedInProps });
  assert.match(body, /Administrator enrollment support is not implemented/);
  assert.match(body, /Signed in as Display fixture/);
  assert.match(body, /href="\/display-workspace"[^>]*>Open your workspace/);
  assert.doesNotMatch(body, /Sign in with a passkey|Set up your administrator account/);
});

test('compiled login retains the native sign-out form alongside the legacy warning', () => {
  const { body } = render(PasskeyLogin, { props: signedInProps });
  assert.match(body, /Administrator enrollment support is not implemented/);
  assert.match(body, /<form[^>]*method="POST"[^>]*action="\/display-logout"/);
  assert.match(body, /<button[^>]*>Sign out<\/button>/);
  assert.doesNotMatch(body, /Sign in with a passkey|Set up your administrator account/);
});

test('compiled signed-out legacy login keeps the warning and blocks all unavailable controls', () => {
  const { body } = render(PasskeyLogin, { props: { legacyUnavailable: true } });
  assert.match(body, /Administrator enrollment support is not implemented/);
  assert.doesNotMatch(body, /Open your workspace|Sign out|Sign in with a passkey|Set up your administrator account/);
});

test('compiled healthy signed-in login keeps the existing workspace and sign-out controls', () => {
  const { body } = render(PasskeyLogin, { props: { ...signedInProps, legacyUnavailable: false } });
  assert.match(body, /href="\/display-workspace"[^>]*>Open your workspace/);
  assert.match(body, /<button[^>]*>Sign out<\/button>/);
  assert.doesNotMatch(body, /Administrator enrollment support is not implemented|Sign in with a passkey/);
});
