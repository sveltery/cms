<script lang="ts">
  let { label, value = '', options = [], disabled = false, onchange }: {
    label: string; value?: string; options: { value: string; label: string }[];
    disabled?: boolean; onchange: (value: string) => void;
  } = $props();
  let expanded = $state(false);
  const id = $props.id();
</script>
<div class="choice"><span id={id}>{label}</span>
  <button type="button" role="combobox" aria-labelledby={id} aria-expanded={expanded} aria-controls={`${id}-options`} {disabled}
    onclick={() => expanded = !expanded} onkeydown={event => { if (event.key === 'Escape') expanded = false; }}>
    {options.find(option => option.value === value)?.label ?? 'Select…'}
  </button>
  {#if expanded}<div role="listbox" id={`${id}-options`} aria-label={label}>
    {#each options as option}<button type="button" role="option" aria-selected={value === option.value}
      onclick={() => { onchange(option.value); expanded = false; }}>{option.label}</button>{/each}
  </div>{/if}
</div>
<style>.choice { margin-block: 12px; } [role='listbox'] { border: 1px solid #bbb; padding: 8px; } [role='option'] { display: block; inline-size: 100%; text-align: start; }</style>
