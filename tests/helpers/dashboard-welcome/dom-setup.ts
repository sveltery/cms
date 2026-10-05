import { expect, vi } from 'vitest';
import { Locator } from './dom-render';
import { i18n } from '@lingui/core';

// Same ordinary empty-English fixture initialization as complete Source setup.
i18n.loadAndActivate({ locale: "en", messages: {} });

// Native polling reads actual DOM. No Source assertion, role, expected text,
// mocked response, or callback is replaced by this browser-to-jsdom transport.
Object.assign(expect, { element(value: Element | Locator | null) {
  const read = () => value instanceof Locator ? value.read() : value;
  const assertion = (negate: boolean) => ({
    toBeInTheDocument: () => vi.waitFor(() => expect(Boolean(read()?.isConnected)).toBe(!negate)).catch(cause => {
      // Uniform diagnostic enrichment only: retain the same actual assertion,
      // expected value, default clock and thrown failure for every locator.
      if (cause instanceof Error) {
        const originalStack = cause.stack;
        const context = JSON.stringify({ operation: 'toBeInTheDocument', negate, expectedPresent: !negate,
          actualPresent: Boolean(read()?.isConnected), selector: value instanceof Locator ? value.selector : null,
          actualText: value instanceof Locator ? value.actualText?.() : read()?.textContent });
        const diagnostic = `DASHBOARD_SOURCE_ASSERTION_CONTEXT=${context}`;
        cause.message += `\n${diagnostic}`;
        cause.stack = `${originalStack}\n${diagnostic}`;
      }
      throw cause;
    }),
    toHaveAttribute: (name: string, expected: string) => vi.waitFor(() => {
      const result = expect(read()?.getAttribute(name));
      if (negate) result.not.toBe(expected); else result.toBe(expected);
    })
  });
  return { ...assertion(false), not: assertion(true) };
} });
