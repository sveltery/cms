<script lang="ts">
  let { collections = [], isLoading = false, client }: any = $props();
</script>
<h1>Content Types</h1><a href="/schema/new">New Content Type</a>
{#if isLoading}<p>Loading collections...</p>{:else if collections.length === 0}<p>No content types yet.</p>{/if}
