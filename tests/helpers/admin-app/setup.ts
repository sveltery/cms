import '../dashboard-welcome/dom-setup';
import { expect } from 'vitest';
expect.extend({ toHaveClass(received: Element | null, expected: string) {
  const pass = Boolean(received?.classList.contains(expected));
  return { pass, message: () => `Expected actual classList ${received?.className ?? '(missing element)'} ${pass ? 'not ' : ''}to contain ${expected}` };
} });
