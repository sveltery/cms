import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { sourceSeedPlugin } from '../../scripts/source-seed-vite.ts';
import { defaultSeed } from '../../src/lib/server/seed/default.ts';

const cleanup: Array<() => void | Promise<void>> = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });
async function fixture(files: Record<string, unknown>) {
  const root = mkdtempSync(join(tmpdir(), 'native-seed-module-'));
  cleanup.push(() => rmSync(root, { recursive: true, force: true }));
  for (const [name, body] of Object.entries(files)) {
    const file = join(root, name);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, typeof body === 'string' ? body : JSON.stringify(body));
  }
  const server = await createServer({ root, configFile: false, appType: 'custom',
    plugins: [sourceSeedPlugin()], server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true } });
  cleanup.push(() => server.close());
  return server.ssrLoadModule('virtual:emdash/seed');
}
const sample = (name: string) => ({ version: '1', meta: { name }, settings: { title: name, tagline: 'Seeded' },
  collections: [{ slug: 'posts', label: 'Posts', fields: [] }], content: { posts: [{ data: { title: name } }] } });

describe('native build-time seed transport; supplemental, no whole Source-family credit', () => {
  it('loads the pinned default when the operator has no custom seed', async () => {
    const module = await fixture({ 'package.json': { name: 'ordinary-fixture' } });
    expect(module.seed).toEqual(defaultSeed);
    expect(module.userSeed).toBeNull();
  });
  it('prefers .emdash/seed.json over the package pointer and conventional file', async () => {
    const preferred = sample('Preferred');
    const module = await fixture({ '.emdash/seed.json': preferred,
      'package.json': { name: 'ordinary-fixture', emdash: { seed: 'custom.json' } },
      'custom.json': sample('Pointer'), 'seed/seed.json': sample('Conventional') });
    expect(module.seed).toEqual(preferred);
    expect(module.userSeed).toEqual(preferred);
  });
  it('uses a real configured package file and keeps metadata/content intact', async () => {
    const configured = sample('Configured');
    const module = await fixture({ 'package.json': { name: 'ordinary-fixture', emdash: { seed: 'custom.json' } },
      'custom.json': configured, 'seed/seed.json': sample('Conventional') });
    expect(module.seed).toEqual(configured);
    expect(module.userSeed).toEqual(configured);
  });
  it('preserves Source fallback from malformed JSON to the conventional seed', async () => {
    const fallback = sample('Conventional');
    const module = await fixture({ '.emdash/seed.json': '{ malformed', 'package.json': { name: 'ordinary-fixture' },
      'seed/seed.json': fallback });
    expect(module.seed).toEqual(fallback);
    expect(module.userSeed).toEqual(fallback);
  });
});
