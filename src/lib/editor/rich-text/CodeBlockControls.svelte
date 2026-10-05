<script lang="ts">
  // Native portal/control transport for pinned CodeBlockNode.tsx. Data helpers,
  // clipboard fallback and Source language/descriptor values remain exact.
  import { onDestroy, tick } from 'svelte';
  import { CODE_BLOCK_LANGUAGES, languageLabelDescriptor, normalizeLanguage } from './codeBlockLanguages';
  import { copyTextToClipboard } from './code-values';
  import type { NodeViewState } from './node-view-state.svelte';
  let { state: viewState }: { state: NodeViewState } = $props();
  let open = $state(false), draft = $state(''), active = $state(-1);
  let status = $state<'idle' | 'copied' | 'failed'>('idle');
  let trigger = $state<HTMLButtonElement>(null!), popup = $state<HTMLDivElement>(null!), input = $state<HTMLInputElement>(null!);
  const instanceId = $props.id();
  let requestId = 0, reset: ReturnType<typeof setTimeout> | undefined;
  const stored = $derived(typeof viewState.node.attrs.language === 'string' ? viewState.node.attrs.language : '');
  const label = $derived(viewState.translate(languageLabelDescriptor(stored)));
  const languages = $derived(CODE_BLOCK_LANGUAGES.toSorted((a, b) => viewState.translate(a.label).localeCompare(viewState.translate(b.label))));
  const matches = $derived(languages.filter(language => {
    const query = draft.trim().toLowerCase();
    return !query || viewState.translate(language.label).toLowerCase().includes(query) || language.id.toLowerCase().includes(query) || language.aliases?.some(alias => alias.toLowerCase().includes(query));
  }));
  const freeForm = $derived(matches.length ? undefined : normalizeLanguage(draft));
  $effect(() => {
    if (!open || !popup) return;
    const currentPopup = popup, currentInput = input;
    const bounds = trigger.getBoundingClientRect();
    document.body.append(currentPopup);
    currentPopup.style.top = `${Math.min(bounds.bottom + 4, window.innerHeight - 300)}px`;
    currentPopup.style.left = `${Math.max(8, Math.min(bounds.left, window.innerWidth - 328))}px`;
    const outside = (event: PointerEvent) => { if (!currentPopup.contains(event.target as Node) && !trigger.contains(event.target as Node)) close(); };
    document.addEventListener('pointerdown', outside);
    void tick().then(() => { if (open && currentPopup.isConnected) currentInput?.focus(); });
    return () => { document.removeEventListener('pointerdown', outside); currentPopup.remove(); };
  });
  function close() { open = false; trigger?.focus(); }
  function commit(value?: string) {
    if (!viewState.editable) return;
    const raw = value ?? draft;
    const selected = languages.find(language => viewState.translate(language.label) === raw);
    viewState.updateAttributes({ language: selected?.id ?? normalizeLanguage(raw) ?? null });
    close();
  }
  function keyboard(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      active = matches.length ? (active + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length : -1;
    } else if (event.key === 'Enter') { event.preventDefault(); commit(active >= 0 ? viewState.translate(matches[active].label) : undefined); }
  }
  async function copy() {
    const current = ++requestId; status = 'idle';
    try {
      await copyTextToClipboard(viewState.node.textContent, () => current === requestId);
      if (current !== requestId) return;
      status = 'copied'; if (reset) clearTimeout(reset);
      reset = setTimeout(() => { status = 'idle'; }, 1500);
    } catch {
      if (current !== requestId) return;
      if (reset) clearTimeout(reset); status = 'failed';
    }
  }
  onDestroy(() => { requestId += 1; if (reset) clearTimeout(reset); });
</script>

<div class="emdash-code-block-controls" role="toolbar" aria-label="Code block actions" data-persistent={open || status !== 'idle' ? 'true' : 'false'}>
  <button bind:this={trigger} type="button" aria-label={`Set language (current: ${label})`} aria-expanded={open} disabled={!viewState.editable}
    onmousedown={event => event.preventDefault()} onclick={() => { draft = ''; active = -1; open = !open; }}>{stored ? label : 'Set language'} ▾</button>
  <button type="button" aria-label={status === 'failed' ? 'Retry copy' : 'Copy code'} onmousedown={event => event.preventDefault()} onclick={copy}>⧉</button>
  <span class="sr-only" role="status" aria-live="polite">{status === 'failed' ? 'Copy failed' : status === 'copied' ? 'Copied' : ''}</span>
</div>
{#if open}
  <div bind:this={popup} class="emdash-code-language-popover kumo-popover-popup" role="dialog" aria-label="Code language">
    <label for={`${instanceId}-search`}>Language</label>
    <input bind:this={input} id={`${instanceId}-search`} role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={`${instanceId}-list`}
      placeholder="Search for a language…" value={draft} oninput={event => { draft = event.currentTarget.value; active = -1; }} onkeydown={keyboard} />
    <div id={`${instanceId}-list`} role="listbox" aria-label="Languages">
      {#each matches as language, index}
        <button type="button" role="option" aria-selected={stored === language.id} class:highlighted={active === index}
          onpointermove={() => { active = index; }} onclick={() => commit(viewState.translate(language.label))}>{viewState.translate(language.label)}</button>
      {/each}
    </div>
    <div role="status" class:empty={!freeForm}>{freeForm ? `No matches. Press Enter to use “${freeForm}”.` : ''}</div>
  </div>
{/if}

<style>
  .emdash-code-block-controls { display: flex; width: max-content; max-width: calc(100% - .25rem); gap: .25rem; position: absolute; inset-block-start: 0; inset-inline-end: .25rem; background: #fff; border: 1px solid #d9e0eb; border-radius: .375rem; }
  button { background: transparent; border: 0; font: inherit; padding: .25rem .5rem; cursor: pointer; }
  .sr-only { position: absolute; height: 1px; width: 1px; overflow: hidden; clip-path: inset(50%); }
  .emdash-code-language-popover { position: fixed; z-index: 100; width: 20rem; max-width: calc(100vw - 1rem); padding: .75rem; border: 1px solid #d9e0eb; border-radius: .5rem; background: white; box-shadow: 0 .5rem 1rem #0002; }
  label { display: block; } input { inline-size: 100%; box-sizing: border-box; padding: .5rem; margin-block: .5rem; }
  [role='listbox'] { max-height: 15rem; overflow: auto; } [role='option'] { display: block; width: 100%; text-align: start; }
  .highlighted, [role='option']:hover { background: #e4e9ef; } [role='status'].empty { height: 0; overflow: hidden; }
</style>
