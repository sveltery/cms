import { expect } from 'vitest';
import { i18n } from '@lingui/core';
import { Locator } from './dom-render';
i18n.loadAndActivate({ locale: 'en', messages: {} });
const element = (value: Element | Locator | null) => value instanceof Locator ? value.node : value;
Object.assign(expect, { element(value: Element | Locator | null) {
  const node = element(value);
  return {
    async toHaveValue(expected: string) { expect(node instanceof HTMLInputElement || node instanceof HTMLSelectElement ? node.value : undefined).toBe(expected); },
    async toHaveTextContent(expected: string) { expect(node?.textContent).toContain(expected); },
    async toHaveFocus() { expect(document.activeElement).toBe(node); },
    async toBeInTheDocument() { expect(Boolean(node?.isConnected)).toBe(true); },
    async toBeVisible() { expect(Boolean(node?.isConnected && !node.closest('[hidden]') && getComputedStyle(node).display !== 'none')).toBe(true); }
  };
} });
