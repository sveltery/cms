<script lang="ts">
	import { tick } from 'svelte';
	import { flattenTerms, type TaxonomyTerm } from '$lib/taxonomy-editor/types';
	import { foldForMatch, termExactMatches, termMatches } from '$lib/taxonomy-editor/source/taxonomy-match';
	let { terms, selectedIds, onChange, onCreate, isCreating, createError, label, entryLocale,
		canCreate, allowDelimitedValues, singularLabel, disabled }: {
		terms: TaxonomyTerm[]; selectedIds: Set<string>; onChange: (ids: string[]) => void;
		onCreate: (labels: string[], matchedIds: string[]) => void; isCreating: boolean; createError?: string;
		label: string; entryLocale?: string; canCreate: boolean; allowDelimitedValues: boolean;
		singularLabel: string; disabled: boolean;
	} = $props();
	const id = $props.id();
	const listId = `${id}-options`;
	let input = $state('');
	let open = $state(false);
	let activeIndex = $state(0);
	let pastedInput: string | null = null;
	let search = $state<HTMLInputElement>();
	let lastTrigger: HTMLButtonElement | null = null;
	let fieldTrigger: HTMLButtonElement;
	let root: HTMLDivElement;
	let optionRefs: HTMLButtonElement[] = [];
	const flatTerms = $derived(flattenTerms(terms));
	const trimmed = $derived(input.trim());
	const selectedOptions = $derived(flatTerms.filter(({ term }) => selectedIds.has(term.id)));
	const selectedTermIds = $derived(selectedOptions.map(({ term }) => term.id));
	const visible = $derived.by(() => {
		const matches = trimmed ? flatTerms.filter(({ term }) => termMatches(term, trimmed)) : flatTerms;
		const ordered = trimmed ? matches.toSorted((a, b) => Number(termExactMatches(b.term, trimmed)) - Number(termExactMatches(a.term, trimmed))) : matches;
		return ordered.slice(0, 100);
	});
	const hasExact = $derived(flatTerms.some(({ term }) => termExactMatches(term, trimmed)));
	const canCreateInput = $derived(canCreate && !!trimmed && !hasExact);
	$effect(() => { activeIndex = Math.min(activeIndex, Math.max(visible.length - 1, 0)); });
	async function show(trigger: HTMLButtonElement) {
		lastTrigger = trigger;
		open = true;
		await tick();
		search?.focus();
	}
	function close() { open = false; input = ''; activeIndex = 0; pastedInput = null; }
	async function escape(event: KeyboardEvent) {
		event.preventDefault(); close(); await tick(); lastTrigger?.focus();
	}
	function toggle(id: string) {
		const next = new Set(selectedTermIds);
		if (next.has(id)) next.delete(id); else next.add(id);
		onChange([...next]);
	}
	function create() {
		if (!trimmed) { search?.focus(); return; }
		if (isCreating || disabled) return;
		const raw = pastedInput ?? trimmed;
		const seen = new Set<string>();
		const values = (allowDelimitedValues ? raw.split(/[,\r\n]+/) : [raw])
			.map((value) => value.trim()).filter((value) => {
				const identity = foldForMatch(value).trim();
				if (!identity || seen.has(identity)) return false;
				seen.add(identity); return true;
			});
		const matched: string[] = [], labels: string[] = [];
		for (const value of values) {
			const found = flatTerms.find(({ term }) => termExactMatches(term, value));
			if (found) { if (!selectedIds.has(found.term.id)) matched.push(found.term.id); }
			else if (canCreate) labels.push(value);
		}
		if (labels.length) onCreate(labels, matched);
		else if (matched.length) onChange([...new Set([...selectedTermIds, ...matched])]);
		input = ''; activeIndex = 0; pastedInput = null;
	}
	async function inputKey(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault(); open = true;
			if (!visible.length) return;
			activeIndex = event.key === 'ArrowDown' ? 0 : visible.length - 1;
			await tick(); optionRefs[activeIndex]?.focus();
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const option = visible[activeIndex];
			if (option) toggle(option.term.id); else if (canCreateInput) create();
		} else if (event.key === 'Escape') await escape(event);
		else if (event.key === 'Backspace' && !input && selectedOptions.length) {
			event.preventDefault(); const last = selectedOptions.at(-1); if (last) toggle(last.term.id);
		}
	}
	function optionKey(event: KeyboardEvent, index: number, termId: string) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			activeIndex = event.key === 'ArrowDown' ? (index + 1) % visible.length : (index - 1 + visible.length) % visible.length;
			optionRefs[activeIndex]?.focus();
		} else if (event.key === 'Enter') { event.preventDefault(); toggle(termId); }
		else if (event.key === 'Escape') void escape(event);
	}
	function paste(event: ClipboardEvent) {
		const value = event.clipboardData?.getData('text') ?? '';
		if (!allowDelimitedValues || !/[\r\n]/.test(value)) return;
		event.preventDefault();
		const element = event.currentTarget as HTMLInputElement;
		const raw = `${input.slice(0, element.selectionStart ?? input.length)}${value}${input.slice(element.selectionEnd ?? input.length)}`;
		pastedInput = raw; input = raw.replace(/[,\r\n]+/g, ', '); activeIndex = 0;
	}
	function outside(event: PointerEvent) {
		if (open && root && !root.contains(event.target as Node)) close();
	}
</script>

<svelte:window onpointerdown={outside} />
<div class="term-picker" bind:this={root}>
	<div class="picker-label">
		<span>{label}</span>
		<button type="button" aria-label="Choose {label}" title="Choose {label}" aria-expanded={open}
			aria-controls={listId} disabled={disabled || isCreating}
			onclick={(event) => open ? close() : show(event.currentTarget)}>+</button>
	</div>
	<div class="selected-control">
		<button type="button" class="field-trigger" bind:this={fieldTrigger} aria-label="Edit {label}"
			aria-expanded={open} aria-controls={listId} disabled={disabled || isCreating}
			onclick={(event) => open ? close() : show(event.currentTarget)}><span class="visually-hidden">Edit {label}</span></button>
		{#if selectedOptions.length}
			<div role="list" aria-label="Selected {label}" class="selected-terms">
				{#each selectedOptions as { term } (term.id)}
					<span role="listitem" class="selected-chip">
						<span class="chip-label">{term.label}</span>
						{#if entryLocale && term.locale !== entryLocale}<span class="locale-badge">{term.locale.toUpperCase()} fallback</span>{/if}
						<button type="button" aria-label="Remove {term.label}" disabled={disabled || isCreating}
							onclick={(event) => { event.stopPropagation(); toggle(term.id); }}>×</button>
					</span>
				{/each}
			</div>
		{/if}
	</div>
	{#if open}
		<div class="picker-popup" role="dialog" aria-label="Choose {label}">
			<input bind:this={search} role="searchbox" aria-label="Search {label}" aria-controls={listId}
				placeholder="Search {label}…" value={input} disabled={disabled || isCreating}
				oninput={(event) => { pastedInput = null; input = event.currentTarget.value; activeIndex = 0; }}
				onpaste={paste} onkeydown={inputKey} />
			{#if createError}<p role="alert">{createError}</p>{/if}
			<div id={listId} role="group" aria-label="{label} options" class="term-options">
				{#each visible as { term, depth }, index (term.id)}
					<button type="button" role="checkbox" aria-checked={selectedIds.has(term.id)}
						bind:this={optionRefs[index]} disabled={disabled || isCreating} class:active={activeIndex === index}
						onmouseenter={() => { activeIndex = index; }} onfocus={() => { activeIndex = index; }}
						onkeydown={(event) => optionKey(event, index, term.id)} onclick={() => toggle(term.id)}>
						<span aria-hidden="true" class="checkmark">{selectedIds.has(term.id) ? '☑' : '☐'}</span>
						<span style:padding-inline-start="{depth}rem">{term.label}</span>
						{#if entryLocale && term.locale !== entryLocale}<span class="locale-badge">{term.locale.toUpperCase()} fallback</span>{/if}
					</button>
				{:else}<p>No {label} found.</p>{/each}
			</div>
			{#if canCreate}
				<button type="button" class="create-term" disabled={disabled || isCreating || (!!trimmed && !canCreateInput)} onclick={create}>
					{trimmed ? `Create "${trimmed}"` : `Create a new ${singularLabel}`}
				</button>
			{/if}
			<div class="keyboard-help"><span><kbd>↑ ↓</kbd> Navigate</span><span><kbd>↵</kbd> Toggle</span><span><kbd>Esc</kbd> Close</span></div>
		</div>
	{/if}
</div>

<style>
	.term-picker { display: grid; gap: .375rem; min-width: 0; position: relative; }
	.picker-label { display: flex; align-items: center; justify-content: space-between; gap: .5rem; font-weight: 600; }
	.picker-label button { width: 1.5rem; height: 1.5rem; padding: 0; }
	.selected-control { position: relative; min-height: 2.25rem; padding: .375rem; border: 1px solid #cbd5e1; border-radius: .5rem; min-width: 0; }
	.field-trigger { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: transparent; padding: 0; border-radius: .5rem; }
	.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
	.selected-terms { position: relative; display: flex; width: 100%; min-width: 0; flex-wrap: wrap; align-content: flex-start; gap: .375rem; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; box-sizing: border-box; max-height: calc(5.25rem + 2px); padding: 1px; scrollbar-gutter: stable; scrollbar-width: thin; pointer-events: none; }
	.selected-chip { display: flex; height: 1.5rem; min-width: 0; max-width: 100%; align-items: center; gap: .25rem; padding-inline-start: .5rem; border-radius: .2rem; background: #e2e8f0; font-size: 1rem; box-shadow: inset 0 0 0 1px #cbd5e1; }
	.chip-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
	.selected-chip button { pointer-events: auto; width: 1.5rem; min-width: 1.5rem; height: 1.5rem; padding: 0; border: 0; background: transparent; }
	.locale-badge { font-size: .75rem; white-space: nowrap; border-radius: .25rem; padding-inline: .25rem; background: #f1f5f9; }
	.picker-popup { position: absolute; inset-inline: 0; top: 100%; margin-top: .375rem; z-index: 100; min-width: 12rem; border: 1px solid #cbd5e1; border-radius: .5rem; background: #fff; color: #0f172a; box-shadow: 0 4px 10px #0002; padding: .375rem; }
	.picker-popup input { box-sizing: border-box; width: 100%; font-size: 1rem; padding: .5rem; }
	.term-options { max-height: 14rem; overflow-y: auto; overscroll-behavior: contain; padding-block: .375rem; }
	.term-options button { width: 100%; display: flex; align-items: center; gap: .5rem; padding: .375rem .5rem; border: 0; border-radius: .25rem; background: transparent; text-align: start; font-size: 1rem; }
	.term-options button.active, .term-options button:hover { background: #f1f5f9; }
	.create-term { box-sizing: border-box; width: 100%; text-align: start; padding: .5rem; border: 0; border-top: 1px solid #cbd5e1; background: transparent; }
	.keyboard-help { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .5rem; font-size: .75rem; padding: .5rem; border-top: 1px solid #cbd5e1; }
	button { cursor: pointer; } button:disabled { cursor: default; opacity: .6; }
	p[role='alert'] { color: #b91c1c; font-size: .8rem; }
</style>
