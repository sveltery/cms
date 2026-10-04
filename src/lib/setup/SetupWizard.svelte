<!-- EmDash 1.1.0 setup UI port, MIT, Copyright 2026 Cloudflare Inc.; source pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import SiteStep from './SiteStep.svelte';
  import AccountStep from './AccountStep.svelte';
  import AuthMethodStep from './AuthMethodStep.svelte';
  import BrandLogo from './BrandLogo.svelte';
  import type { AdminRequest, ProviderViews, SeedProgress, SetupClient, SetupProvider, SetupStatus, SiteRequest, StartWith, WizardStep } from './types';
  let { client, navigate, destination, providers = [], providerButton, providerForm }: {
    client: SetupClient; navigate: (url: string) => void; destination: (choice: StartWith) => string;
    providers?: SetupProvider[];
  } & ProviderViews = $props();
  // Source always begins at site, including when status.step reports admin.
  let currentStep = $state<WizardStep>('site');
  let startWith = $state<StartWith>('sample');
  let adminData = $state<AdminRequest | null>(null);
  let error = $state<string>();
  let seedProgress = $state<SeedProgress>();
  let urlError = $state<string | null>(null);
  let status = $state<SetupStatus>();
  let statusLoading = $state(true);
  let statusError = $state<string>();
  let manifest = $state<{ admin?: { logo?: string; siteName?: string } }>();
  let sitePending = $state(false);
  let adminPending = $state(false);
  const useAccessAuth = $derived(status?.authMode === 'cloudflare-access');
  const steps = $derived(useAccessAuth ? [{ key: 'site', label: 'Site Settings' }] : [
    { key: 'site', label: 'Site' }, { key: 'admin', label: 'Account' }, { key: 'passkey', label: 'Sign In' }
  ]);
  const currentIndex = $derived(steps.findIndex(step => step.key === currentStep));

  onMount(() => {
    let disposed = false;
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    if (errorParam) {
      urlError = params.get('message') || `Authentication error: ${errorParam}`;
      window.history.replaceState({}, '', window.location.pathname);
    }
    void client.status().then(data => {
      if (disposed) return;
      status = data;
      if (!data.needsSetup) navigate(destination('sample'));
    }, cause => {
      if (!disposed) statusError = cause instanceof Error ? cause.message : 'Failed to load setup';
    }).finally(() => { if (!disposed) statusLoading = false; });
    if (client.branding) void client.branding().then(data => { if (!disposed) manifest = data; }, () => {});
    return () => { disposed = true; };
  });

  async function setupSite(data: SiteRequest, choice: StartWith) {
    startWith = choice;
    sitePending = true;
    try {
      // Reset for each submit and retain the previous visible progress on failure, as in Source.
      let lastDone = -1;
      for (;;) {
        const result = await client.site(data);
        if (result.seedComplete !== false) {
          error = undefined;
          seedProgress = undefined;
          if (result.setupComplete) navigate(destination(choice));
          else currentStep = 'admin';
          return;
        }
        if (!result.seedProgress || result.seedProgress.done <= lastDone) throw new Error('Setup failed');
        lastDone = result.seedProgress.done;
        seedProgress = result.seedProgress;
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Setup failed';
    } finally { sitePending = false; }
  }
  async function setupAdmin(data: AdminRequest) {
    adminData = data;
    adminPending = true;
    try {
      await client.prepareAdmin(data);
      error = undefined;
      currentStep = 'passkey';
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Failed to create admin';
    } finally { adminPending = false; }
  }
  function backTo(step: WizardStep) { error = undefined; currentStep = step; }
</script>

{#if statusLoading}
  <div class="setup loading"><p role="status">Loading setup...</p></div>
{:else if statusError}
  <div class="setup"><h1>Error</h1><p>{statusError}</p></div>
{:else if status?.needsSetup}
  <div class="setup">
    <div class="wizard">
      <header>
        <BrandLogo logoUrl={manifest?.admin?.logo} siteName={manifest?.admin?.siteName} />
        <h1>{currentStep === 'site' ? 'Set up your site' : currentStep === 'admin' ? 'Create your account' : 'Secure your account'}</h1>
        {#if useAccessAuth && currentStep === 'site'}<p>You're signed in via Cloudflare Access</p>{/if}
      </header>
      {#if urlError}<p class="error" role="alert">{urlError}</p>{/if}
      <ol class="steps" aria-label="Setup progress">
        {#each steps as step, index}
          <li aria-current={index === currentIndex ? 'step' : undefined} class:active={index <= currentIndex}>
            <span class="number" aria-hidden="true">{index < currentIndex ? '✓' : index + 1}</span><span>{step.label}</span>
          </li>
        {/each}
      </ol>
      <div class="card">
        {#if currentStep === 'site'}
          <SiteStep seedInfo={status.seedInfo} onNext={setupSite} isLoading={sitePending} {error} {seedProgress} />
        {:else if currentStep === 'admin'}
          <AccountStep onNext={setupAdmin} onBack={() => backTo('site')} isLoading={adminPending} {error} />
        {:else if adminData}
          <AuthMethodStep {adminData} {providers} {providerButton} {providerForm} {startWith} {client}
            onBack={() => backTo('admin')} onComplete={() => navigate(destination(startWith))} />
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .setup { box-sizing: border-box; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1.5rem; background: var(--setup-background, #f8fafc); color: var(--setup-color, #172033); }
  .wizard { width: min(100%, 32rem); }
  header { text-align: center; margin-bottom: 1.5rem; }
  h1 { font-size: 1.5rem; font-weight: 600; margin: .75rem 0; }
  header p { font-size: .875rem; }
  .card { border: 1px solid #d1d5db; background: var(--setup-card, white); border-radius: .65rem; padding: 1.5rem; box-shadow: 0 1px 3px #0000000a; }
  .steps { padding: 0; margin: 0 0 2rem; list-style: none; display: flex; align-items: center; justify-content: center; gap: 1.25rem; }
  .steps li { display: flex; align-items: center; gap: .5rem; font-size: .875rem; color: #687285; }
  .number { display: grid; place-items: center; width: 2rem; height: 2rem; border-radius: 50%; background: #e5e7eb; }
  .active { color: inherit; }
  .active .number { background: #4f46e5; color: white; }
  .error { color: #a61b29; background: #a61b2910; padding: 1rem; border-radius: .5rem; }
  @media (max-width: 380px) { .setup { padding: .75rem; } .steps { gap: .5rem; } .card { padding: 1rem; } }
</style>
