// Supplemental real-provider locale activation. The immutable whole Source
// CodeEditor is a separate runtime witness, not an original Source test port.
import { afterEach, expect, it, vi } from 'vitest';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { mount, tick, unmount, flushSync } from 'svelte';
import SourceCodeEditor from '../../parity/emdash/rich-editor-source/packages/admin/src/components/editor/CodeEditor';
import Host from '../helpers/rich-editor/EditorHost.svelte';
import { bridgeState } from '../helpers/rich-editor/state.svelte';
import type { PortableTextEditorProps, Translate } from '../../src/lib/editor/rich-text/types';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const release of cleanup.splice(0)) await release(); });
function provider() {
  return setupI18n({ locale: 'en', messages: {
    en: {}, 'es-ES': { EWPtMO: 'Código', rdUucN: 'Avance', '8ydGzJ': 'Pulsa Escape para salir.' }
  } });
}

it('witnesses the whole Source CodeEditor live locale hint and mount-only aria label', async () => {
  const i18n = provider(), target = document.createElement('div'); document.body.append(target);
  const root = createRoot(target);
  cleanup.push(async () => { await React.act(async () => root.unmount()); target.remove(); });
  const props = { language: 'html' as const, value: '', editable: true, autoFocus: false,
    ariaLabel: 'Embed code', placeholder: '', onChange: vi.fn(), onFocusChange: vi.fn(), onEscape: vi.fn() };
  const render = () => root.render(React.createElement(I18nProvider, { i18n, children: React.createElement(SourceCodeEditor, props) }));
  await React.act(async () => render());
  await vi.waitFor(() => expect(target.querySelector('.sr-only')?.textContent).toBe('Press Escape to leave the code editor.'));
  const content = target.querySelector('.cm-content')!;
  await React.act(async () => { i18n.activate('es-ES'); props.ariaLabel = 'Código incrustado'; render(); });
  await vi.waitFor(() => expect(target.querySelector('.sr-only')?.textContent).toBe('Pulsa Escape para salir.'));
  expect(target.querySelector('.cm-content')).toBe(content);
  expect(content.getAttribute('aria-label')).toBe('Embed code');
});

it('updates the real iframe tab labels and CodeMirror hint when the same owning provider activates another locale', async () => {
  const i18n = provider(), target = document.createElement('div'); document.body.append(target);
  const translate: Translate = descriptor => i18n._(descriptor);
  const state = bridgeState<PortableTextEditorProps>({ value: [{ _type: 'iframe', _key: 'live-frame', src: '' }], translate, locale: i18n.locale });
  const instance = mount(Host, { target, props: { state } });
  cleanup.push(async () => { await unmount(instance); target.remove(); });
  await vi.waitFor(() => expect(target.querySelector('.cm-content')).toBeTruthy());
  expect([...target.querySelectorAll('[role="tab"]')].map(tab => tab.textContent)).toEqual(['Code', 'Preview']);
  i18n.activate('es-ES'); flushSync(() => { state.locale = i18n.locale; }); await tick();
  await vi.waitFor(() => expect([...target.querySelectorAll('[role="tab"]')].map(tab => tab.textContent)).toEqual(['Código', 'Avance']));
  expect(target.querySelector('.emdash-code-editor .sr-only')?.textContent).toBe('Pulsa Escape para salir.');
});
