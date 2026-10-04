<script lang="ts">
  import { resolve } from '$app/paths';
  import { getSetupStatus, getCurrentUser, getAuthenticatedState } from '$lib/auth.remote';
  import PasskeyLogin from '$lib/ui/PasskeyLogin.svelte';
  let { data } = $props();
  const status = $derived(await getSetupStatus().then(data => ({ data, unavailable: false }), () => ({ data: null, unavailable: true })));
  const legacyUnavailable = $derived(status.data !== null && 'unavailable' in status.data && status.data.unavailable === true);
  const user = $derived(await getCurrentUser());
  const authenticated = $derived((await getAuthenticatedState()).authenticated);
</script>

<svelte:head><title>Sign in · Sveltery CMS</title></svelte:head>
<main><PasskeyLogin unavailable={status.unavailable} {legacyUnavailable} {authenticated} needsSetup={status.data?.needsSetup === true} setupHref={resolve('/setup')} homeHref={data.loginRedirect ?? resolve('/')} user={user} loginHref={resolve('/login')} /></main>
