<script lang="ts">
 import {base} from '$app/paths';
 import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
 import MediaLibrary from '$lib/media/MediaLibrary.svelte';
 let {data}=$props();
</script>
<svelte:head><title>Media Library · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={`${base}/`} activePage="media">
 <MediaLibrary initialItems={data.items} initialTotal={data.totalCount} permissions={data.permissions} actorId={data.actorId} />
</WorkspaceShell>
