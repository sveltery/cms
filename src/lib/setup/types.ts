// EmDash 1.1.0 setup UI port, MIT, Copyright 2026 Cloudflare Inc.
// Source pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; see parity/emdash/setup-wizard-source/NOTICE.md.
import type { Snippet } from 'svelte';
import type { PasskeyTransport } from './PasskeyRegistration.svelte';

export interface SeedInfo {
  name: string;
  description: string;
  collections: number;
  hasContent: boolean;
  title?: string;
  tagline?: string;
}
export interface SetupStatus {
  needsSetup: boolean;
  step?: 'start' | 'site' | 'admin' | 'complete';
  seedInfo?: SeedInfo;
  authMode?: 'cloudflare-access' | 'passkey';
}
export interface SiteRequest { title: string; tagline?: string; includeContent: boolean }
export interface AdminRequest { email: string; name?: string }
export interface SeedProgress { done: number; total: number }
export interface SiteResult {
  success: boolean;
  error?: string;
  setupComplete?: boolean;
  seedComplete?: boolean;
  seedProgress?: SeedProgress;
  result?: {
    collections: { created: number; skipped: number };
    fields: { created: number; skipped: number };
    taxonomies: { created: number; terms: number };
    menus: { created: number; items: number };
    widgetAreas: { created: number; widgets: number };
    settings: { applied: number };
    content: { created: number; skipped: number };
  };
}
export type StartWith = 'sample' | 'empty' | 'import';
export type WizardStep = 'site' | 'admin' | 'passkey';
export interface SetupClient {
  status(): Promise<SetupStatus>;
  site(data: SiteRequest): Promise<SiteResult>;
  prepareAdmin(data: AdminRequest): Promise<unknown>;
  branding?(): Promise<{ admin?: { logo?: string; siteName?: string } }>;
  passkeys: PasskeyTransport;
}
/** Real runtime providers supply native Svelte snippets; fixtures adapt their original components. */
export interface SetupProvider { id: string; label: string; hasButton: boolean; hasForm: boolean; hasSetupStep: boolean }
export interface ProviderViews {
  providerButton?: Snippet<[id: string]>;
  providerForm?: Snippet<[id: string, onComplete: () => void]>;
}
