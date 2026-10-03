import { cn } from 'cn';
/**
 * @template State
 * @param {string} base
 * @param {import('cn').ClassValue | ((state: State) => string | undefined)} [value]
 */
export function classes(base, value) {
  return typeof value === 'function' ? (/** @type {State} */ state) => cn(base, value(state)) : cn(base, value);
}
export const closeBase = 'cn-button group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0';
