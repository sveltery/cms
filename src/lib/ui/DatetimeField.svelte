<script lang="ts">
  import { fromDatetimeLocalInputValue, toDatetimeLocalInputValue } from './datetime-local';
  let { id, label, value, timezone = 'UTC', required = false, disabled = false, onChange }: {
    id: string; label: string; value?: unknown; timezone?: string; required?: boolean;
    disabled?: boolean; onChange?: (value: string) => void;
  } = $props();
  // Source ContentEditor preserves a rejected ambiguous/nonexistent local value
  // in the draft; persisted validation remains the save boundary.
  function change(event: Event) {
    const edited = (event.currentTarget as HTMLInputElement).value;
    try { onChange?.(fromDatetimeLocalInputValue(edited, timezone)); }
    catch { onChange?.(edited); }
  }
</script>
<label for={id}>{label}{required ? ' *' : ''}</label>
<input {id} data-field={id} type="datetime-local" value={toDatetimeLocalInputValue(value, timezone)} {required} {disabled} oninput={change} />

<style>
  label { display: block; margin-block-end: .5rem; }
  input { box-sizing: border-box; inline-size: 100%; padding: .625rem; border: 1px solid #c4cedd; border-radius: .375rem; font: inherit; }
</style>
