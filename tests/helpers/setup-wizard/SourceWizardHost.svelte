<!-- Test-only Source React provider fixture to native Svelte snippets. No provider runtime is implemented here. -->
<script lang="ts">
  import SetupWizard from '../../../src/lib/setup/SetupWizard.svelte';
  import ReactComponent from './ReactComponent.svelte';
  import type { AuthProviderModule } from '../../../parity/emdash/setup-wizard-source/upstream/packages/admin/src/lib/auth-provider-context';
  import type { SetupClient, StartWith } from '../../../src/lib/setup/types';
  let { client, providers, navigate, destination }: {
    client: SetupClient; providers: AuthProviderModule[]; navigate: (url: string) => void; destination: (choice: StartWith) => string;
  } = $props();
  const nativeProviders = $derived(providers.map(provider => ({
    id: provider.id, label: provider.label, hasButton: !!provider.LoginButton,
    hasForm: !!provider.LoginForm, hasSetupStep: !!provider.SetupStep
  })));
</script>

<SetupWizard {client} {navigate} {destination} providers={nativeProviders}>
  {#snippet providerButton(id: string)}
    {@const provider = providers.find(provider => provider.id === id)!}
    {#if provider.LoginButton}<ReactComponent component={provider.LoginButton} />{/if}
  {/snippet}
  {#snippet providerForm(id: string, onComplete: () => void)}
    {@const provider = providers.find(provider => provider.id === id)!}
    {#if provider.SetupStep}<ReactComponent component={provider.SetupStep} componentProps={{ onComplete }} />
    {:else if provider.LoginForm}<ReactComponent component={provider.LoginForm} />{/if}
  {/snippet}
</SetupWizard>
