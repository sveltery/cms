// Native Svelte controls are mounted through the actual React-controlled bridge.
// Source query/i18n provider wrappers are inventoried; this replacement earns
// no query-provider, translated-message, or original renderer parity credit.
export { render } from 'vitest-browser-react';
