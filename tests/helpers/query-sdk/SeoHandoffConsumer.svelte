<script lang="ts">
  import { peekSeoPanel } from '../../../src/lib/server/query-sdk/seo-panel.ts';
  import { getRequestContext } from '../../../src/lib/server/menus/context.ts';
  let {collection, id, fail = false}: {collection: string; id: string; fail?: boolean} = $props();
  // This fixture models one server render, whose initial inputs stay fixed.
  // svelte-ignore state_referenced_locally
  const panel = await peekSeoPanel(collection, id);
  // svelte-ignore state_referenced_locally
  if (fail) throw new Error('controlled component failure');
  const context = getRequestContext();
</script>

<p data-db-bound={Boolean(context?.db)} data-locale={context?.locale ?? ''}>{panel?.title ?? 'No primed panel'}</p>
