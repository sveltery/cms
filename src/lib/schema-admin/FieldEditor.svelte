<script lang="ts">
  let { open = false, onOpenChange, onSave, field, isSaving = false, client }: any = $props();
</script>
{#if open}<dialog open aria-label={field ? 'Configure Field' : 'Add Field'}><h2>{field ? 'Configure Field' : 'Add Field'}</h2><button onclick={() => onOpenChange(false)}>Cancel</button></dialog>{/if}
