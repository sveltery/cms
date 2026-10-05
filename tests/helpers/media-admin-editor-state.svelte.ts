export function nativeMediaState<T extends Record<string, unknown>>(props:T):T {
  return $state(props);
}
