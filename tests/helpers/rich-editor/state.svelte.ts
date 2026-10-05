// Test transport state drives actual component props and lifecycle.
export function bridgeState<T extends object>(initial: T): T { const props = $state({ ...initial }); return props; }
