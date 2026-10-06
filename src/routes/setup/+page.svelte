<script lang="ts">
  import { resolve } from '$app/paths';
  import { getSetupStatus } from '$lib/auth.remote';
  import PasskeySetup from '$lib/ui/PasskeySetup.svelte';
  import SetupWizard from '$lib/ui/SetupWizard.svelte';
  const status = $derived(await getSetupStatus().then(data => ({ data, unavailable: false }), () => ({ data: null, unavailable: true })));
  const legacyUnavailable = $derived(status.data !== null && 'unavailable' in status.data && status.data.unavailable === true);
</script>

<svelte:head><title>Setup · Sveltery CMS</title></svelte:head>
<main>{#if status.unavailable || legacyUnavailable || status.data?.needsSetup === false}
  <PasskeySetup unavailable={status.unavailable} {legacyUnavailable} completed={status.data?.needsSetup === false} loginHref={resolve('/login')} />
{:else if status.data}<SetupWizard status={status.data} loginHref={resolve('/login')} />{/if}</main>
