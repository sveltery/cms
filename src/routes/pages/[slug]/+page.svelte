<script lang="ts">
  import PublicShell from '$lib/public-site/PublicShell.svelte';
  import PublicEntry from '$lib/public-site/PublicEntry.svelte';
  import SeoHead from '$lib/seo/SeoHead.svelte';
  let { data }: { data: import('./$types').PageData } = $props();
</script>
<SeoHead page={data.page} />
<PublicShell><PublicEntry entry={data.entry} fields={data.fields} /></PublicShell>
