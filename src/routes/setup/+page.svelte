<script lang="ts">
 import {resolve} from '$app/paths';
 import FullSetupWizard from '$lib/ui/FullSetupWizard.svelte';
</script>
<svelte:head><title>Setup · Sveltery CMS</title></svelte:head>
<main><FullSetupWizard loginHref={resolve('/login')} /></main>
<style>main{max-width:32rem;margin:4rem auto;padding:2rem;}</style>
