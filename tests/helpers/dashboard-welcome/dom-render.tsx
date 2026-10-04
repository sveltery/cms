// Ordinary DOM development host for complete, unchanged Source callbacks.
// Secured Chromium execution uses the original browser render helper separately.
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync as reactFlushSync } from 'react-dom';
import { flushSync } from 'svelte';
import { afterEach } from 'vitest';
import { within } from '@testing-library/react';

const roots: ReturnType<typeof createRoot>[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) reactFlushSync(() => root.unmount());
  document.body.replaceChildren();
});
export class Locator {
  constructor(readonly read: () => HTMLElement | null) {}
  element() { const element = this.read(); if (!element) throw new Error('Control absent from actual native DOM'); return element; }
  async click() { reactFlushSync(() => flushSync(() => this.element().click())); }
}
export async function render(ui: React.ReactNode) {
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container); roots.push(root);
  reactFlushSync(() => root.render(ui)); flushSync();
  const queries = within(container);
  return {
    container,
    getByText(text: string | RegExp, options?: { exact?: boolean }) {
      return new Locator(() => { flushSync(); return queries.queryByText(text, options); });
    },
    getByRole(role: Parameters<typeof queries.queryByRole>[0], options?: Parameters<typeof queries.queryByRole>[1]) {
      return new Locator(() => { flushSync(); return queries.queryByRole(role, options); });
    },
    async unmount() { roots.splice(roots.indexOf(root), 1); reactFlushSync(() => root.unmount()); container.remove(); }
  };
}
