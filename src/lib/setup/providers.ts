import type { Component } from 'svelte';
export interface SetupProviderModule {
  id: string; label: string;
  LoginButton?: Component;
  LoginForm?: Component;
  SetupStep?: Component<{ onComplete: () => void }>;
}
/** Only genuinely configured providers may be supplied here. The current
 * runtime configures passkeys; external auth belongs to its actual provider. */
export function configuredSetupProviders(): SetupProviderModule[] { return []; }
