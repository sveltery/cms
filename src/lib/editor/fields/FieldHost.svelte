<script lang="ts">
  // Svelte controls port ContentEditor FieldRenderer/UrlFieldEditor/
  // JsonFieldEditor and RepeaterField SubFieldInput at immutable913cb1bb.
  // Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
  import { untrack } from 'svelte';
  import DatetimeField from '../../ui/DatetimeField.svelte';
  import PortableTextEditor from '../rich-text/PortableTextEditor.svelte';
  import type { AuthoringBlock } from '../rich-text/types';
  import RepeaterField from './RepeaterField.svelte';
  import RepeaterSelect from './RepeaterSelect.svelte';
  import { choiceOptions, type FieldProps } from './field-types';
  import { isNonListValue, isValidUrl, lengthConstraints, rangeConstraints, hasBounds, isOutOfBounds } from './field-values';
  import type { RepeaterSubFieldDef } from './repeater-values';
  let { name, field, value, onChange, readOnly = false, timezone = 'UTC', context = 'field' }: FieldProps = $props();
  const id = $derived(context === 'repeater' ? name : `field-${name}`);
  const repeaterTypes = new Set(['string', 'text', 'number', 'integer', 'boolean', 'datetime', 'select', 'image']);
  const kind = $derived(context === 'repeater' ?
    field.type === 'text' ? 'richText' : field.type === 'integer' ? 'number' : repeaterTypes.has(field.type) ? field.type : 'string' :
    field.kind ?? (field.type === 'integer' ? 'number' : field.type === 'slug' ? 'string' : field.type === 'text' ? 'richText' : field.type));
  const required = $derived(context === 'repeater' && !repeaterTypes.has(field.type) ? false : field.required);
  const options = $derived(choiceOptions(field.options));
  const validation = $derived(field.validation ?? undefined);
  const length = $derived(lengthConstraints(validation));
  const range = $derived(rangeConstraints(validation));
  const textValue = $derived(typeof value === 'string' ? value : '');
  const listMismatch = $derived(['repeater', 'portableText', 'multiSelect', 'blocks'].includes(kind) && isNonListValue(value));
  const selected = $derived(Array.isArray(value) ? value : []);
  const subFields = $derived(Array.isArray(validation?.subFields) ? validation.subFields as RepeaterSubFieldDef[] : []);
  const textOutOfBounds = $derived(isOutOfBounds(textValue.length, length, typeof value === 'string'));
  const numberOutOfBounds = $derived(typeof value === 'number' && isOutOfBounds(value, range, true));
  function jsonString(input: unknown) { return typeof input === 'string' ? input : input != null ? JSON.stringify(input, null, 2) : ''; }
  let jsonText = $state(untrack(() => jsonString(value)));
  let previousJson = $state(untrack(() => jsonString(value)));
  let jsonError = $state<string | undefined>(), urlError = $state<string | undefined>();
  $effect(() => {
    if (kind !== 'json') return;
    const incoming = jsonString(value);
    untrack(() => { if (incoming !== previousJson) { previousJson = incoming; jsonText = incoming; jsonError = undefined; } });
  });
  function change(next: unknown) { if (!readOnly) onChange(next); }
  function jsonBlur() {
    if (readOnly) return;
    const trimmed = jsonText.trim();
    if (trimmed === '') { jsonError = undefined; change(null); return; }
    try { const parsed: unknown = JSON.parse(trimmed); jsonError = undefined; change(parsed); }
    catch { jsonError = 'Invalid JSON'; }
  }
  function urlBlur(event: FocusEvent) {
    if (readOnly) return;
    const input = event.currentTarget as HTMLInputElement, trimmed = input.value.trim();
    if (trimmed !== input.value) change(trimmed);
    urlError = trimmed && !isValidUrl(trimmed) ? 'Enter a valid URL (e.g. https://example.com)' : undefined;
  }
  const formatted = (number: number) => new Intl.NumberFormat('en').format(number);
  const lengthHint = $derived(length.max !== undefined ? `${formatted(textValue.length)} of ${formatted(length.max)} ${length.max === 1 ? 'character' : 'characters'}${length.min !== undefined ? `, at least ${formatted(length.min)}` : ''}` :
    length.min !== undefined ? `At least ${formatted(length.min)} ${length.min === 1 ? 'character' : 'characters'}` : undefined);
  const rangeHint = $derived(range.min !== undefined && range.max !== undefined ? `Between ${formatted(range.min)} and ${formatted(range.max)}` :
    range.max !== undefined ? `At most ${formatted(range.max)}` : range.min !== undefined ? `At least ${formatted(range.min)}` : undefined);
</script>

<div class="field-host">
  {#if field.unsupportedType || kind === 'unsupported'}
    <p class="label">{field.label}</p><p>This field cannot be edited by this version of the CMS.</p>
  {:else if listMismatch}
    <label for={id}>{field.label}</label>
    <textarea {id} value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)} readonly rows="3" dir="auto"></textarea>
    <div role="alert"><p>The stored value doesn't match this field's type</p>
      <p>This field expects a list. The stored value stays unchanged until you replace it with an empty list, which deletes it. Copy anything you need from it first.</p>
      <button type="button" disabled={readOnly} onclick={() => change([])}>Replace with empty list</button>
    </div>
  {:else if kind === 'portableText'}
    <p class="label" id={`${id}-label`}>{field.label}{required ? ' *' : ''}</p>
    <PortableTextEditor value={(Array.isArray(value) ? value : []) as AuthoringBlock[]}
      onChange={change} editable={!readOnly} aria-labelledby={`${id}-label`} />
  {:else if kind === 'datetime'}
    <DatetimeField {id} label={field.label} {value} {timezone} required={required} disabled={readOnly} onChange={change} />
  {:else if kind === 'repeater'}
    <RepeaterField {id} label={field.label} {value} onChange={change} {subFields} {timezone} {readOnly}
      minItems={typeof validation?.minItems === 'number' ? validation.minItems : undefined}
      maxItems={typeof validation?.maxItems === 'number' ? validation.maxItems : undefined} />
  {:else if kind === 'boolean'}
    <label class="checked"><input {id} type="checkbox" checked={Boolean(value)} disabled={readOnly}
      onchange={event => change(event.currentTarget.checked)} />{field.label}</label>
  {:else if kind === 'select' && context === 'repeater'}
    <RepeaterSelect {id} label={field.label} {value} options={options.map(option => option.value)} required={required} disabled={readOnly} onChange={change} />
  {:else if kind === 'select'}
    <label for={id}>{field.label}</label>
    <select {id} value={textValue} disabled={readOnly} onchange={event => change(event.currentTarget.value)}>
      {#each options as option}<option value={option.value}>{option.label}</option>{/each}
    </select>
  {:else if kind === 'multiSelect'}
    <fieldset><legend>{field.label}</legend>
      {#each options as option}
        <label class="checked"><input type="checkbox" checked={selected.includes(option.value)} disabled={readOnly}
          onchange={event => change(event.currentTarget.checked ? [...selected, option.value] : selected.filter(value => value !== option.value))} />{option.label}</label>
      {/each}
    </fieldset>
  {:else if kind === 'json'}
    <label for={id}>{field.label}{required ? ' *' : ''}</label>
    <textarea {id} value={jsonText} rows="8" placeholder={'{}'} required={required} disabled={readOnly} class="json"
      oninput={event => { jsonText = event.currentTarget.value; jsonError = undefined; }} onblur={jsonBlur}
      aria-invalid={Boolean(jsonError) || undefined} aria-describedby={jsonError ? `${id}-error` : undefined}></textarea>
    {#if jsonError}<p id={`${id}-error`} class="error">{jsonError}</p>{/if}
  {:else if kind === 'url'}
    <label for={id}>{field.label}{required ? ' *' : ''}</label>
    <input {id} type="text" inputmode="url" dir="ltr" value={textValue} placeholder="https://" required={required} disabled={readOnly}
      oninput={event => { urlError = undefined; change(event.currentTarget.value); }} onblur={urlBlur}
      aria-invalid={Boolean(urlError) || undefined} aria-describedby={urlError ? `${id}-error` : undefined} />
    {#if urlError}<p id={`${id}-error`} class="error">{urlError}</p>{/if}
  {:else if kind === 'number' || kind === 'integer'}
    <label for={id}>{field.label}{required ? ' *' : ''}</label>
    <input {id} type="number" value={typeof value === 'number' ? value : ''} required={required} disabled={readOnly}
      step={context === 'repeater' ? field.type === 'integer' ? '1' : 'any' : undefined}
      min={range.min} max={range.max} aria-invalid={numberOutOfBounds || undefined}
      aria-describedby={hasBounds(range) ? `${id}-hint` : undefined}
      oninput={event => change(context === 'repeater' && !event.currentTarget.value ? null : Number(event.currentTarget.value))} />
    {#if rangeHint}<p id={`${id}-hint`} dir="auto" class:error={numberOutOfBounds}>{rangeHint}</p>{/if}
  {:else if ['string', 'slug', 'richText', 'text'].includes(kind)}
    <label for={id}>{field.label}{required ? ' *' : ''}</label>
    {#if kind === 'richText' || kind === 'text'}
      <textarea {id} value={textValue} rows={context === 'repeater' ? 3 : 10} dir="auto" maxlength={length.max}
        disabled={readOnly} required={context === 'repeater' ? required : undefined} placeholder={context === 'field' ? 'Enter markdown content...' : undefined}
        oninput={event => change(event.currentTarget.value)} aria-invalid={textOutOfBounds || undefined}
        aria-describedby={lengthHint ? `${id}-hint` : undefined}></textarea>
    {:else}
      <input {id} value={textValue} dir="auto" maxlength={length.max} required={required} disabled={readOnly}
        oninput={event => change(event.currentTarget.value)} aria-invalid={textOutOfBounds || undefined}
        aria-describedby={lengthHint ? `${id}-hint` : undefined} />
    {/if}
    {#if lengthHint}<p id={`${id}-hint`} dir="auto" class:error={textOutOfBounds}>{lengthHint}</p>{/if}
  {:else}
    <p class="label">{field.label}</p><p>This field's value is preserved when saving.</p>
  {/if}
</div>

<style>
  .field-host { margin-block: 1rem; }
  label, .label { display: block; margin-block-end: .5rem; font-weight: 500; }
  input:not([type='checkbox']), textarea, select { box-sizing: border-box; inline-size: 100%; padding: .625rem; border: 1px solid #c4cedd; border-radius: .375rem; font: inherit; }
  .checked { display: flex; align-items: center; gap: .5rem; }
  .json { font-family: ui-monospace, monospace; }
  .error { color: #b42318; }
  fieldset { border: 0; padding: 0; }
  button { padding: .5rem .75rem; }
</style>
