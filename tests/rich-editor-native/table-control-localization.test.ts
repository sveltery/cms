// Supplemental real catalog integration. IDs are taken from the immutable
// Source Lingui compilation, not English matching or a simulated translator.
import { afterEach, expect, it, vi } from 'vitest';
import { setupI18n } from '@lingui/core';
import { mount, tick, unmount } from 'svelte';
import TableSizePicker from '../../src/lib/editor/rich-text/TableSizePicker.svelte';
import type { Translate } from '../../src/lib/editor/rich-text/types';
const releases: (() => Promise<void>)[] = [];
afterEach(async () => { for (const release of releases.splice(0)) await release(); vi.unstubAllGlobals(); });
it('uses actual Source catalog IDs for picker controls and interpolated dimensions', async () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  // Fixed IDs independently read from the pinned Source macro output.
  const i18n = setupI18n({ locale: 'es', messages: { es: {
    'Gi0VDy': 'Fila de encabezado', 'y9fIj7': 'Tamaño de tabla',
    'wcydjE': 'Tabla {row} × {column}', 'QtjT8L': 'Vista {previewRows} × {previewColumns}'
  } } });
  const host = document.createElement('div'); document.body.append(host);
  const translate: Translate = descriptor => i18n._(descriptor);
  const props = { translate, onInsert: vi.fn(), onCancel: vi.fn() };
  const instance = mount(TableSizePicker, { target: host, props }); releases.push(async () => { await unmount(instance); host.remove(); });
  await tick(); await tick();
  expect(host.querySelector('[role="grid"]')!.getAttribute('aria-label')).toBe('Tamaño de tabla');
  expect(host.querySelector('label')!.textContent).toContain('Fila de encabezado');
  expect(host.querySelector('[role="gridcell"]')!.getAttribute('aria-label')).toBe('Tabla 1 × 1');
  expect(host.querySelector('p')!.textContent).toBe('Vista 1 × 1');
});
