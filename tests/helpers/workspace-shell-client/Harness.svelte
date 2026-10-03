<script lang="ts">
  import WorkspaceShell from '../../../src/lib/ui/WorkspaceShell.svelte';
  const navigation = { authenticated: true, permissions: ['content:read', 'content:read_drafts', 'schema:manage'],
    collections: { posts: { label: 'Posts' }, events: { label: 'Events', group: 'Calendar' },
      venues: { label: 'Venues', group: 'Calendar' }, internal: { label: 'Internal hidden', hidden: true } } };
</script>
<WorkspaceShell {navigation} currentPath="/content/events/entry"><h1>Workspace fixture</h1><button type="button">Actual page control</button></WorkspaceShell>
