<script lang="ts">
	import { onMount } from 'svelte';
	import { flattenTerms, type EditorTaxonomyClient, type TaxonomyDefinition, type TaxonomyTerm,
		type UnresolvedAssignment } from '$lib/taxonomy-editor/types';
	import EditorTaxonomyTermPicker from './EditorTaxonomyTermPicker.svelte';
	let { taxonomy, collection, entryId, entryLocale, canManageTaxonomies, disabled, client, onChange }: {
		taxonomy: TaxonomyDefinition; collection: string; entryId?: string; entryLocale?: string;
		canManageTaxonomies: boolean; disabled: boolean; client: EditorTaxonomyClient; onChange?: (ids: string[]) => void;
	} = $props();
	let terms = $state<TaxonomyTerm[]>([]);
	let unresolved = $state<UnresolvedAssignment[]>([]);
	let selected = $state(new Set<string>());
	let resolvedLocale = $state<string>();
	let isCreating = $state(false);
	let isTranslating = $state(false);
	let createError = $state('');
	let readError = $state('');
	let status = $state('');
	let statusError = $state(false);
	let active = true;
	let saveQueue: Promise<void> = Promise.resolve();
	const activeUnresolved = $derived(unresolved.filter((assignment) => {
		const source = assignment.translations[0];
		return source ? selected.has(source.id) : false;
	}));
	async function refreshEntry() {
		if (!entryId) return;
		const data = await client.entryTerms(collection, entryId, taxonomy.name);
		if (!active) return;
		unresolved = data.unresolved;
		resolvedLocale = data.entryLocale;
		const next = new Set(data.terms.map((term) => term.id));
		for (const assignment of data.unresolved) {
			const source = assignment.translations[0];
			if (source) next.add(source.id);
		}
		selected = next;
	}
	onMount(() => {
		active = true;
		void Promise.all([
			client.terms(taxonomy.name, entryLocale).then((value) => { if (active) terms = value; }),
			refreshEntry()
		]).catch((reason) => { if (active) readError = reason instanceof Error ? reason.message : 'Failed to fetch terms'; });
		return () => { active = false; };
	});
	function updateSelection(next: Set<string>) {
		selected = next;
		const ids = [...next];
		onChange?.(ids);
		if (!entryId) return;
		const savedEntryId = entryId;
		saveQueue = saveQueue.then(async () => {
			try {
				await client.setEntryTerms(collection, savedEntryId, taxonomy.name, ids);
				if (!active) return;
				statusError = false;
				status = 'Saved immediately; term changes do not wait for Publish changes.';
				// Re-read authoritative assignments after every completed mutation, as Source invalidates its query.
				await refreshEntry();
			} catch (reason) {
				if (!active) return;
				statusError = true;
				status = reason instanceof Error ? reason.message : 'An error occurred';
			}
		});
	}
	function pickerChange(ids: string[]) {
		const available = new Set(flattenTerms(terms).map(({ term }) => term.id));
		const next = new Set([...selected].filter((id) => !available.has(id)));
		ids.forEach((id) => next.add(id));
		updateSelection(next);
	}
	function toggleUnresolved(id: string) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id); else next.add(id);
		updateSelection(next);
	}
	async function create(labels: string[], matchedIds: string[]) {
		if (isCreating || !canManageTaxonomies || disabled) return;
		isCreating = true;
		createError = '';
		const created: TaxonomyTerm[] = [], failed: string[] = [];
		let firstError: unknown;
		for (const label of labels) {
			try {
				const term = await client.createTerm(taxonomy.name, { label, ...(entryLocale ? { locale: entryLocale } : {}) });
				created.push({ ...term, children: term.children ?? [] });
			} catch (reason) { failed.push(label); firstError ??= reason; }
		}
		if (active) {
			if (!created.length && !matchedIds.length && firstError) {
				createError = firstError instanceof Error ? firstError.message : 'Failed to create term';
			} else {
				terms = [...terms.filter((term) => !created.some((value) => value.id === term.id)), ...created];
				const next = new Set(selected);
				matchedIds.forEach((id) => next.add(id));
				created.forEach((term) => next.add(term.id));
				updateSelection(next);
				if (failed.length) createError = `Failed to create ${failed.join(', ')}`;
				// The native client owns cache invalidation across count modes; refresh this count-free view.
				void client.terms(taxonomy.name, entryLocale).then((value) => { if (active) terms = value; })
					.catch(() => { /* Keep successfully-created options if the refresh fails. */ });
			}
			isCreating = false;
		}
	}
	async function translate(assignment: UnresolvedAssignment) {
		const source = assignment.translations[0];
		if (!source || !resolvedLocale || !canManageTaxonomies || disabled || isTranslating) return;
		isTranslating = true;
		try {
			await client.createTranslation(taxonomy.name, source.slug, source.locale, resolvedLocale);
			const value = await client.terms(taxonomy.name, entryLocale);
			if (active) terms = value;
			await refreshEntry();
			if (active) { statusError = false; status = 'Translation created'; }
		} catch (reason) {
			if (active) { statusError = true; status = reason instanceof Error ? reason.message : 'Failed to create translation'; }
		} finally { if (active) isTranslating = false; }
	}
</script>

<div class="taxonomy-section">
	{#if readError}<p role="alert">{readError}</p>{/if}
	<EditorTaxonomyTermPicker {terms} selectedIds={selected} onChange={pickerChange} onCreate={create}
		{isCreating} createError={canManageTaxonomies ? createError : ''} label={taxonomy.label}
		entryLocale={resolvedLocale ?? entryLocale} canCreate={canManageTaxonomies} allowDelimitedValues={!taxonomy.hierarchical}
		singularLabel={taxonomy.labelSingular || taxonomy.label} {disabled} />
	{#each activeUnresolved as assignment (assignment.translationGroup)}
		{@const source = assignment.translations[0]}
		{#if source}
			<div class="unresolved">
				<p>Unresolved assignment</p>
				<p>Available in {assignment.availableLocales.map((locale) => locale.toUpperCase()).join(', ')}</p>
				{#if canManageTaxonomies && resolvedLocale}
					<button type="button" disabled={disabled || isTranslating} onclick={() => translate(assignment)}>Create {resolvedLocale.toUpperCase()} translation</button>
				{/if}
				<button type="button" {disabled} onclick={() => toggleUnresolved(source.id)}>Remove assignment</button>
			</div>
		{/if}
	{/each}
	{#if status}<p role={statusError ? 'alert' : 'status'}>{status}</p>{/if}
</div>

<style>
	.taxonomy-section { display: grid; gap: .5rem; min-width: 0; }
	.unresolved { padding: .75rem; border: 1px solid #b88c34; border-radius: .5rem; }
	.unresolved p { margin: 0 0 .5rem; }
</style>
