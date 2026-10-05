import { expect, vi } from 'vitest';
import { Locator } from './dom-render';
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
function assertions(value: Element | Locator | null, negate = false): Record<string, unknown> {
  const node = () => value instanceof Locator ? value.query() : value;
  const check = (read: () => boolean) => vi.waitFor(() => expect(read()).toBe(!negate));
  return {
    get not() { return assertions(value, !negate); },
    toBeInTheDocument: () => check(() => Boolean(node()?.isConnected)),
    toHaveValue: (expected: string | number) => check(() => typeof expected === 'number' ? (node() as HTMLInputElement | null)?.valueAsNumber === expected : (node() as HTMLInputElement | null)?.value === expected),
    toHaveTextContent: (expected: string) => check(() => Boolean(node()?.textContent?.includes(expected))),
    toHaveAttribute: (name: string, expected: string) => check(() => node()?.getAttribute(name) === expected),
    toBeChecked: () => check(() => (node() as HTMLInputElement | null)?.checked === true || node()?.getAttribute('aria-checked') === 'true'),
    toBeDisabled: () => check(() => Boolean(node()?.matches(':disabled') || node()?.getAttribute('aria-disabled') === 'true')),
    toBeEnabled: () => check(() => Boolean(node() && !node()?.matches(':disabled') && node()?.getAttribute('aria-disabled') !== 'true'))
  };
}
Object.assign(expect, { element: assertions });
