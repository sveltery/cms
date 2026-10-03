import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync as reactFlushSync } from 'react-dom';
import { flushSync } from 'svelte';
import { afterEach } from 'vitest';
const roots: ReturnType<typeof createRoot>[] = [];
afterEach(() => { for (const root of roots.splice(0)) reactFlushSync(() => root.unmount()); document.body.replaceChildren(); });
export class Locator {
  constructor(readonly node: Element | null) {}
  element() { if (!this.node) throw new Error('Control absent from actual native DOM'); return this.node; }
  async fill(value: string) {
    const node = this.element();
    if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)) throw new Error('Control is not an input');
    node.focus();
    reactFlushSync(() => flushSync(() => { Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node), 'value')!.set!.call(node, value); node.dispatchEvent(new Event('input', { bubbles: true })); }));
  }
  async click(_options?: { force?: boolean }) {
    const node = this.element();
    reactFlushSync(() => flushSync(() => { (node as HTMLElement).focus(); (node as HTMLElement).click(); }));
  }
}
export async function render(ui: React.ReactNode) {
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container); roots.push(root);
  reactFlushSync(() => { root.render(ui); }); flushSync();
  const name = (node: Element) => node.getAttribute('aria-label') ?? node.textContent?.trim() ?? '';
  return {
    container,
    getByText(text: string, _options?: { exact?: boolean }) { return new Locator([...container.querySelectorAll('*')].find(node => node.textContent?.trim() === text && ![...node.children].some(child => child.textContent?.trim() === text)) ?? null); },
    getByRole(role: string, options?: { name?: string | RegExp; exact?: boolean }) {
      const selector = role === 'textbox' ? 'input:not([type]),input[type=text],textarea' : role === 'button' ? 'button,[role=button]' : `[role=${role}]`;
      return new Locator([...container.querySelectorAll(selector)].find(node => options?.name instanceof RegExp ? options.name.test(name(node)) : options?.name === undefined || name(node) === options.name) ?? null);
    },
    async rerender(next: React.ReactNode) { reactFlushSync(() => { root.render(next); }); flushSync(); },
    async unmount() { roots.splice(roots.indexOf(root), 1); reactFlushSync(() => root.unmount()); container.remove(); }
  };
}
