import { expect, vi } from 'vitest';
import { Locator } from './dom-render';
function assertions(value: Element | Locator | null, negate = false): Record<string, unknown> {
  const node = () => value instanceof Locator ? value.query() : value;
  const check = (read: () => boolean) => vi.waitFor(() => expect(read()).toBe(!negate));
  return {
    get not() { return assertions(value, !negate); },
    toBeInTheDocument: () => check(() => Boolean(node()?.isConnected)),
    toHaveValue: (expected: string) => check(() => (node() as HTMLInputElement | null)?.value === expected),
    toHaveTextContent: (expected: string) => check(() => Boolean(node()?.textContent?.includes(expected))),
    toHaveAttribute: (name: string, expected: string) => check(() => node()?.getAttribute(name) === expected),
    toBeChecked: () => check(() => (node() as HTMLInputElement | null)?.checked === true || node()?.getAttribute('aria-checked') === 'true'),
    toBeDisabled: () => check(() => Boolean(node()?.matches(':disabled') || node()?.getAttribute('aria-disabled') === 'true')),
    toBeEnabled: () => check(() => Boolean(node() && !node()?.matches(':disabled') && node()?.getAttribute('aria-disabled') !== 'true'))
  };
}
Object.assign(expect, { element: assertions });
