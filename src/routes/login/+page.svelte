<script lang="ts">
  import { resolve } from '$app/paths';
  import { getSetupStatus } from '$lib/auth.remote';
  import PasskeyLogin from '$lib/ui/PasskeyLogin.svelte';
  const status = $derived(await getSetupStatus().then(data => ({ data, unavailable: false }), () => ({ data: null, unavailable: true })));
</script>

<svelte:head><title>Sign in · Sveltery CMS</title></svelte:head>
<main><PasskeyLogin unavailable={status.unavailable} needsSetup={status.data?.needsSetup === true} setupHref={resolve('/setup')} homeHref={resolve('/')} /></main>
