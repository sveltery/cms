export function pickerState<T extends Record<string, unknown>>(initial: T): T {
  const state = $state(initial); return state;
}
