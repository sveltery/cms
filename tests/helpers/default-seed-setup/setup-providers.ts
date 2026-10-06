// Actual unchanged Original React provider components mount as portals under
// the same Original QueryClient/AuthProvider tree. No provider result is made.
import type * as React from 'react';
import type { Component } from 'svelte';
import type { AuthProviderModule } from '../../../parity/emdash/default-seed-setup-runtime/source/packages/admin/src/lib/auth-provider-context';
import type { SetupProviderModule } from '../../../src/lib/setup/providers.ts';
import Host from './react-provider-host.svelte';
type Mount = (target: HTMLElement, component: React.ComponentType<any>, props: Record<string, unknown>) => () => void;
let actualProviders: AuthProviderModule[] = [];
let actualMount: Mount;
export function setControlledSetupProviders(providers: AuthProviderModule[], mount: Mount) {
  actualProviders = providers; actualMount = mount;
}
export function configuredSetupProviders(): SetupProviderModule[] {
  const mount = actualMount;
  const adapt = (component: React.ComponentType<any>): Component<any> => (internals, props) =>
    Host(internals, { render: target => mount(target, component, props) });
  return actualProviders.map(provider => ({ id: provider.id, label: provider.label,
    ...(provider.LoginButton ? { LoginButton: adapt(provider.LoginButton) } : {}),
    ...(provider.SetupStep ? { SetupStep: adapt(provider.SetupStep) } : {}),
    ...(provider.LoginForm ? { LoginForm: adapt(provider.LoginForm) } : {}),
  }));
}
