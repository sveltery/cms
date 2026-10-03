<script lang="ts">
	import { onMount } from 'svelte';
	import { resolveTaxonomyDefinitions } from '$lib/taxonomy-editor/source/taxonomy-definitions';
	import type { EditorTaxonomyClient, TaxonomyDefinition } from '$lib/taxonomy-editor/types';
	import EditorTaxonomySection from './EditorTaxonomySection.svelte';
	let { collection, entryId, entryLocale, defaultLocale, canManageTaxonomies = false, disabled = false,
		client, onChange, class: className = '' }: {
		collection: string; entryId?: string; entryLocale?: string; defaultLocale?: string;
		canManageTaxonomies?: boolean; disabled?: boolean; client: EditorTaxonomyClient;
		onChange?: (taxonomy: string, ids: string[]) => void; class?: string;
	} = $props();
	let definitions = $state<TaxonomyDefinition[]>([]);
	let error = $state('');
	const applicable = $derived(resolveTaxonomyDefinitions(definitions, entryLocale, defaultLocale)
		.filter((taxonomy) => taxonomy.collections.includes(collection)));
	onMount(() => {
		let active = true;
		void client.definitions().then((value) => { if (active) definitions = value; })
			.catch((reason) => { if (active) error = reason instanceof Error ? reason.message : 'Failed to fetch taxonomies'; });
		return () => { active = false; };
	});
</script>

{#if error}<p role="alert">{error}</p>{/if}
{#if applicable.length > 0}
	<section class="editor-taxonomies {className}">
		<h3>Taxonomies</h3>
		{#each applicable as taxonomy (taxonomy.name)}
			<EditorTaxonomySection {taxonomy} {collection} {entryId} {entryLocale} {canManageTaxonomies} {disabled} {client}
				onChange={(ids) => onChange?.(taxonomy.name, ids)} />
		{/each}
	</section>
{/if}

<style>
	.editor-taxonomies { display: grid; gap: 1rem; min-width: 0; }
	h3 { font-size: 1rem; font-weight: 600; margin: 0; }
</style>
