<script lang="ts">
  import type { Snippet } from 'svelte';
  import { providePluginAdmins, type PluginAdmins } from './provider.svelte.ts';
  let { pluginAdmins, children }: { pluginAdmins: PluginAdmins; children: Snippet } = $props();
  providePluginAdmins(() => pluginAdmins);
</script>

{@render children()}
