<script lang="ts">
 import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
 import SettingsPage from '$lib/comments/CommentSettingsPage.svelte';
 let {data}=$props();
</script>
<svelte:head><title>Comment settings · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={`${data.basePath}/`} activePage="settings">
 <SettingsPage {data}/>
</WorkspaceShell>
