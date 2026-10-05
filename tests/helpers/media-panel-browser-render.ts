// React is used only by immutable Source callback JSX; the panel itself mounts native Svelte.
// Native provider/context substitution gives zero Lingui or query cache parity credit.
export {render} from 'vitest-browser-react';
