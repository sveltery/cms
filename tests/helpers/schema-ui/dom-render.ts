// Local DOM transport only. Browser geometry, focus and modal behavior require
// the separate secured Playwright browser run.
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync as reactFlushSync } from 'react-dom';
import { flushSync } from 'svelte';
import { afterEach } from 'vitest';
import { queryAllByRole, queryAllByLabelText, queryAllByText, queryAllByTestId, queryAllByPlaceholderText } from '@testing-library/react';
const roots: ReturnType<typeof createRoot>[] = [];
afterEach(() => { for (const root of roots.splice(0)) reactFlushSync(() => root.unmount()); document.body.replaceChildren(); });
export class Locator {
  constructor(readonly find: () => Element[]) {}
  elements() { flushSync(); return this.find(); }
  query() { return this.elements()[0] ?? null; }
  element() { const element = this.query(); if (!element) throw new Error('Control absent from actual native DOM'); return element; }
  last() { return new Locator(() => this.elements().slice(-1)); }
  first() { return this.nth(0); }
  all() { return this.elements().map((_, index) => this.nth(index)); }
  nth(index: number) { return new Locator(() => this.elements().slice(index, index + 1)); }
  getByText(text: string | RegExp, options?: { exact?: boolean }) { return new Locator(() => this.query() ? queryAllByText(this.element() as HTMLElement, text, options) : []); }
  async fill(value: string) {
    const node = this.element();
    if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)) throw new Error('Control is not an input');
    reactFlushSync(() => flushSync(() => {
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node), 'value')!.set!.call(node, value);
      node.dispatchEvent(new Event('input', { bubbles: true })); node.dispatchEvent(new Event('change', { bubbles: true }));
    }));
  }
  async click() { reactFlushSync(() => flushSync(() => (this.element() as HTMLElement).click())); }
}
export async function render(ui: React.ReactNode) {
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container); roots.push(root);
  await React.act(async () => { root.render(ui); }); flushSync();
  return {
    container,
    getByText(text: string | RegExp, options?: { exact?: boolean }) { return new Locator(() => queryAllByText(container, text, options)); },
    getByLabelText(text: string | RegExp, options?: { exact?: boolean }) { return new Locator(() => queryAllByLabelText(container, text, options)); },
    getByRole(role: Parameters<typeof queryAllByRole>[1], options?: Parameters<typeof queryAllByRole>[2]) { return new Locator(() => queryAllByRole(container, role, options)); },
    getByTestId(id: string) { return new Locator(() => queryAllByTestId(container, id)); }
    , getByPlaceholder(text: string) { return new Locator(() => queryAllByPlaceholderText(container, text)); }
  };
}
