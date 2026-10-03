import * as React from 'react';
import { i18n } from '@lingui/core';
import { mount, unmount, flushSync } from 'svelte';
import Harness from './NativeHarness.svelte';
import { bridgeState } from './state.svelte';
export function PublishingDateTimeFields(props: Record<string, unknown>) {
  const target = React.useRef<HTMLDivElement>(null);
  const state = React.useRef<ReturnType<typeof bridgeState> | null>(null);
  if (!state.current) state.current = bridgeState({ ...props, locale: i18n.locale });
  React.useLayoutEffect(() => { flushSync(() => Object.assign(state.current!, props, { locale: i18n.locale })); });
  React.useLayoutEffect(() => {
    const component = mount(Harness, { target: target.current!, props: { state: state.current! } });
    flushSync();
    return () => { void unmount(component); };
  }, []);
  return React.createElement('div', { ref: target });
}
