<script lang="ts">
  import BlocksField from '../../src/lib/ui/BlocksField.svelte';
  import ReactField from './BlocksReactField.svelte';
  let {renderField:reactRenderField,...props}:any=$props();
</script>
<BlocksField {...props}>
  {#snippet renderField(input)}<ReactField render={reactRenderField} {input}/>{/snippet}
</BlocksField>
