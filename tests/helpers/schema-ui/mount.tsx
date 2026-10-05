import * as React from 'react';
import { flushSync, mount, unmount, type Component } from 'svelte';
import { nativeProps } from './state.svelte';
export function nativeMount(component: Component<any>, props: object) {
  const target = React.useRef<HTMLDivElement>(null);
  const state = React.useMemo(() => nativeProps(props), []);
  React.useLayoutEffect(() => { const instance = flushSync(() => mount(component, { target: target.current!, props: state })); return () => { void unmount(instance); }; }, []);
  React.useLayoutEffect(() => { flushSync(() => Object.assign(state, props)); }, [props]);
  return React.createElement('div', { ref: target });
}
