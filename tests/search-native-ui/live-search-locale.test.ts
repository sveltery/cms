// Supplemental genuine Svelte SSR transport for the whole pinned Astro locale repro.
// Source three assertions remain unchanged in the frozen original Astro family.
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import LiveSearch from '../../src/lib/search/LiveSearch.svelte';

function renderConfig(props: Record<string, unknown>) {
 const html = render(LiveSearch, { props }).body;
 const match = html.match(/data-config="([^"]*)"/);
 if (!match) throw new Error('no data-config on the rendered component');
 const json = match[1].replaceAll('&#34;', '"').replaceAll('&quot;', '"').replaceAll('&amp;', '&');
 return JSON.parse(json) as { locale: string };
}

describe('Native LiveSearch locale SSR transport', () => {
 it('sends no locale when the site has no i18n configuration', () => {
  expect(renderConfig({}).locale).toBe('');
 });
 it('forwards an explicit locale', () => {
  expect(renderConfig({locale:'fr'}).locale).toBe('fr');
 });
 it('sends no locale when passed null, so results span every locale', () => {
  expect(renderConfig({locale:null}).locale).toBe('');
 });
 it('uses the actual Native page locale when no override is supplied', () => {
  expect(renderConfig({currentLocale:'fr'}).locale).toBe('fr');
 });
});
