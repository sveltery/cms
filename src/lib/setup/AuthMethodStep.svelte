<!-- EmDash 1.1.0 setup UI port, MIT, Copyright 2026 Cloudflare Inc.; source pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e. -->
<script lang="ts">
  import PasskeyRegistration from './PasskeyRegistration.svelte';
  import type { AdminRequest, ProviderViews, SetupClient, SetupProvider, StartWith } from './types';
  let { adminData, providers = [], providerButton, providerForm, startWith, client, onBack, onComplete }: {
    adminData: AdminRequest; providers?: SetupProvider[]; startWith: StartWith;
    client: SetupClient; onBack: () => void; onComplete: () => void;
  } & ProviderViews = $props();
  let activeProvider = $state<string | null>(null);
  let passkeyComplete = $state(false);
  const selected = $derived(providers.find(provider => provider.id === activeProvider));
  const buttonProviders = $derived(providers.filter(provider => provider.hasButton));
</script>

{#if selected && (selected.hasSetupStep || selected.hasForm)}
  <div class="provider-form">
    <h3>Sign in with {selected.label}</h3>
    {#if providerForm}{@render providerForm(selected.id, onComplete)}{/if}
    <button type="button" onclick={() => activeProvider = null}>← Back</button>
  </div>
{:else}
  <PasskeyRegistration email={adminData.email} name={adminData.name} transport={client.passkeys}
    showEducation showSuccessStep onSuccess={onComplete} onSuccessReady={() => passkeyComplete = true}
    successButtonText={startWith === 'import' ? 'Continue to import' : 'Open the dashboard'} {onBack} />
  {#if !passkeyComplete && buttonProviders.length > 0 && providerButton}
    <p class="divider">Or continue with</p>
    <div class="providers">
      {#each buttonProviders as provider (provider.id)}
        {#if provider.hasForm || provider.hasSetupStep}
          <!-- Source wraps each original provider button; bubbling selects its full form. -->
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div onclick={() => activeProvider = provider.id}>{@render providerButton(provider.id)}</div>
        {:else}
          <div>{@render providerButton(provider.id)}</div>
        {/if}
      {/each}
    </div>
  {/if}
{/if}

<style>
  h3 { text-align: center; font-weight: 500; }
  .provider-form { display: grid; gap: 1rem; }
  button { padding: .75rem; border: 1px solid #c7ccd4; border-radius: .4rem; font: inherit; background: transparent; cursor: pointer; }
  .divider { display: flex; align-items: center; gap: .75rem; font-size: .75rem; text-transform: uppercase; margin: 1.5rem 0 1rem; }
  .divider::before, .divider::after { content: ''; flex: 1; border-top: 1px solid #c7ccd4; }
  .providers { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: .75rem; }
</style>
