import * as React from 'react';
import { flushSync, mount, unmount, type Component } from 'svelte';
export function nativeMount(component: Component<any>, props: object) {
  const target = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => { const instance = flushSync(() => mount(component, { target: target.current!, props })); return () => { void unmount(instance); }; }, []);
  return React.createElement('div', { ref: target });
}
