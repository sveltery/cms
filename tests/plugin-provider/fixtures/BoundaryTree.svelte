<script lang="ts">
  import ContentEditorPanelBoundary from '../../../src/lib/plugins/ContentEditorPanelBoundary.svelte';
  import ContentListColumnBoundary from '../../../src/lib/plugins/ContentListColumnBoundary.svelte';
  import ThrowingSurface from './ThrowingSurface.svelte';
  let failing = $state(true);
  let resetKey = $state('first');
  export function recover() { failing = false; }
  export function nextRow() { failing = false; resetKey = 'second'; }
</script>
<p>Host stays mounted</p>
<div data-panel><ContentEditorPanelBoundary pluginId="example" panelId="broken"><ThrowingSurface {failing} /></ContentEditorPanelBoundary></div>
<div data-column><ContentListColumnBoundary pluginId="example" columnId="broken" {resetKey}><ThrowingSurface {failing} /></ContentListColumnBoundary></div>
