import { expect, vi } from 'vitest';
import { Locator } from './dom-render';

// Native polling reads actual DOM. No Source assertion, role, expected text,
// mocked response, or callback is replaced by this browser-to-jsdom transport.
Object.assign(expect, { element(value: Element | Locator | null) {
  const read = () => value instanceof Locator ? value.read() : value;
  const assertion = (negate: boolean) => ({
    toBeInTheDocument: () => vi.waitFor(() => expect(Boolean(read()?.isConnected)).toBe(!negate), { timeout: 5000 }),
    toHaveAttribute: (name: string, expected: string) => vi.waitFor(() => {
      const result = expect(read()?.getAttribute(name));
      if (negate) result.not.toBe(expected); else result.toBe(expected);
    }, { timeout: 5000 })
  });
  return { ...assertion(false), not: assertion(true) };
} });
