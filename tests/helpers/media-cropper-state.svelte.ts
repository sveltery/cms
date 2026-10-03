// Explicit test-only rune props so whole immutable React callbacks mount native Svelte.
export function cropperState(initial:Record<string,unknown>){const state=$state({...initial});return state;}
