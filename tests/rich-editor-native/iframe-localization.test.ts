// Supplemental Native integration of immutable Source Lingui IDs. Original
// Source callbacks, fixtures and clocks remain unchanged; this adds no Source credit.
import { afterEach, expect, it, vi } from 'vitest';
import { setupI18n } from '@lingui/core';
import { EditorView } from '@codemirror/view';
import { tick } from 'svelte';
import { renderInDraftForm } from '../helpers/rich-editor/native-authoring-dom';
import type { Translate } from '../../src/lib/editor/rich-text/types';

const releases: (() => Promise<void>)[] = [];
afterEach(async () => { for (const release of releases.splice(0)) await release(); });
function catalog(messages: Record<string, string>) {
  const i18n = setupI18n({ locale: 'es-ES', messages: { 'es-ES': messages } });
  const translate: Translate = descriptor => typeof descriptor === 'string' ? i18n._(descriptor) : i18n._(descriptor);
  return translate;
}
async function frame(translate: Translate, src = '') {
  const result = await renderInDraftForm({ value: [{ _type: 'iframe', _key: 'translated-frame', src }], translate, locale: 'es-ES' });
  releases.push(result.cleanup);
  return result;
}
async function code(host: HTMLElement) {
  await vi.waitFor(() => expect(host.querySelector('.cm-content')).toBeTruthy());
  return EditorView.findFromDOM(host.querySelector<HTMLElement>('.cm-content')!)!;
}

it('uses the pinned Spanish catalog Code and Preview labels through the actual editor node view', async () => {
  // These translations are the literal es-ES/messages.po entries at the Source pin.
  const { host } = await frame(catalog({ EWPtMO: 'Código', rdUucN: 'Avance' }), 'https://example.com/map');
  expect([...host.querySelectorAll('[role="tab"]')].map(tab => tab.textContent)).toEqual(['Código', 'Avance']);
  host.querySelector<HTMLButtonElement>('[role="tab"]')!.click(); await tick();
  await code(host);
  expect(host.querySelector('[role="tabpanel"]')!.getAttribute('aria-label')).toBe('Código');
});

it('passes Source catalog descriptors into CodeMirror labels, placeholder and the Escape description', async () => {
  // Nonempty supplemental catalog entries exercise the exact independently
  // compiled Source IDs even where the pinned Spanish catalog is untranslated.
  const { host } = await frame(catalog({ xIxm0t: 'Código incrustado', 'PnRbc/': 'Pega un código o enlace https…', '8ydGzJ': 'Pulsa Escape para salir.' }));
  const view = await code(host);
  expect(view.contentDOM.getAttribute('aria-label')).toBe('Código incrustado');
  expect(host.querySelector('.cm-placeholder')!.textContent).toBe('Pega un código o enlace https…');
  const descriptions = view.contentDOM.getAttribute('aria-describedby')!.split(' ').map(id => document.getElementById(id)?.textContent).join(' ');
  expect(descriptions).toContain('Pulsa Escape para salir.');
});

it('translates actual delayed invalid-input feedback while preserving the saved embed', async () => {
  const { host, editor, onChange } = await frame(catalog({ EeUenc: 'Sólo se pueden incrustar enlaces https.' }), 'https://example.com/saved');
  host.querySelector<HTMLButtonElement>('[role="tab"]')!.click(); await tick();
  const view = await code(host); onChange.mockClear();
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'http://example.com/insecure' } });
  await vi.waitFor(() => expect(host.querySelector('[role="alert"]')?.textContent).toBe('Sólo se pueden incrustar enlaces https.'));
  expect(editor.state.doc.firstChild!.attrs.src).toBe('https://example.com/saved');
  expect(onChange).not.toHaveBeenCalled();
});

it('interpolates the actual saved iframe host through the Source consent descriptor', async () => {
  const { host } = await frame(catalog({ nMPsXp: 'Este bloque incrusta una página de {0}.', 'LIm+1B': 'Cargar vista previa' }), 'https://example.com/map');
  expect(host.querySelector('.preview-consent p')!.textContent).toBe('Este bloque incrusta una página de example.com.');
  expect(host.querySelector('.preview-consent button')!.textContent).toBe('Cargar vista previa');
  expect(host.querySelector('iframe')).toBeNull();
});
