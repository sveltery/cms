/** Reactive controlled props across the unchanged React fixture boundary. */
export function nativeProps<P extends Record<string, unknown>>(props: P): P {
  const current = $state({ ...props });
  return current;
}
