// Test-host prop transport. React rerenders update the actual Svelte instance.
export function componentProps(current: Record<string, unknown>) {
  let value = $state(current);
  return { get current() { return value; }, set current(next: Record<string, unknown>) { value = next; } };
}
