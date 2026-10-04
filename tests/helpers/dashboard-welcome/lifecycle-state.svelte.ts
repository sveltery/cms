// Ordinary native DOM fixture state: updates props on one retained Svelte
// instance. It supplies no principal, real HTTP transport or backend behavior.
export function lifecycleState<T extends object>(value: T): T { return $state(value); }
