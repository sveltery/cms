// Actual existing-provider activation, matching Source useLingui toolbar labels.
import { afterEach, expect, it } from 'vitest';
import { setupI18n } from '@lingui/core';
import { mount, tick, unmount, flushSync } from 'svelte';
import Host from '../helpers/rich-editor/EditorHost.svelte';
import { bridgeState } from '../helpers/rich-editor/state.svelte';
import type { PortableTextEditorProps, Translate } from '../../src/lib/editor/rich-text/types';
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const fn of cleanup.splice(0)) await fn(); });
it('updates the HTML toolbar label through the same live authoring provider', async () => {
  const i18n = setupI18n({ locale: 'en', messages: { en: {}, 'es-ES': { k76x3g: 'Insertar HTML', rdUucN: 'Avance' } } });
  const translate: Translate = descriptor => typeof descriptor === 'string' ? i18n._(descriptor) : i18n._(descriptor);
  const state = bridgeState<PortableTextEditorProps>({ value: [{ _type: 'htmlBlock', _key: 'saved', html: '<p>Saved</p>' }], translate, locale: i18n.locale });
  const target = document.createElement('div'); document.body.append(target);
  const instance = mount(Host, { target, props: { state } });
  cleanup.push(async () => { await unmount(instance); target.remove(); });
  await tick();
  const button = target.querySelector<HTMLButtonElement>('button[aria-label="Insert HTML"]');
  expect(button).not.toBeNull();
  i18n.activate('es-ES'); flushSync(() => { state.locale = i18n.locale; }); await tick();
  expect([...target.querySelectorAll('[role="tab"]')].map(tab => tab.textContent)).toEqual(['HTML', 'Avance']);
  expect(button!.getAttribute('aria-label')).toBe('Insertar HTML');
});
