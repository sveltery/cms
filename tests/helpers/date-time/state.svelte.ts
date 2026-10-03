export function bridgeState(initial: Record<string, unknown>) { const state = $state({ ...initial }); return state; }
