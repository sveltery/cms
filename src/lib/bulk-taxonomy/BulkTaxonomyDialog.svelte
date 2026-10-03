<script lang="ts">
import type { BulkTaxonomyDialogProps, BulkTaxonomyTerm, BulkTaxonomyResult, BulkTaxonomySource } from './types';
let { taxonomies, client, open, onClose, onClosed, selected, activeLocale, defaultLocale, adminLocale = 'en', onApplied }: BulkTaxonomyDialogProps = $props();
let taxonomyName = $state<string | null>(null), termId = $state(''), urls = $state(''), terms = $state<BulkTaxonomyTerm[]>([]), loading = $state(false), termsFailed = $state(false), optionsOpen = $state(false), taxonomyOptionsOpen = $state(false);
const id = $props.id(), headingId = `${id}-heading`, termIdAttribute = `${id}-term`, termOptionsId = `${id}-term-options`, taxonomyOptionsId = `${id}-taxonomy-options`;
const taxonomy = $derived(taxonomies.find(def => def.name === taxonomyName) ?? taxonomies[0]);
const name = $derived(taxonomy?.name ?? ''), singular = $derived(taxonomy?.labelSingular || taxonomy?.label || 'Term'), plural = $derived(taxonomy?.label || 'Terms');
const singularLower = $derived(adminLocale.split('-')[0] === 'de' ? singular : singular.toLowerCase()), pluralLower = $derived(adminLocale.split('-')[0] === 'de' ? plural : plural.toLowerCase());
const termLocale = $derived(activeLocale ?? defaultLocale ?? 'en');
let review = $state<BulkTaxonomyResult[] | null>(null), applied = $state(false), busy = $state(false), error = $state<string | null>(null), creating = $state(false), newLabel = $state(''), cacheRefreshFailed = $state(false);
let wasOpen = false;
$effect(() => { if (open) {
    wasOpen = true;
    return;
} if (wasOpen) {
    wasOpen = false;
    taxonomyName = null;
    termId = '';
    urls = '';
    optionsOpen = false;
    taxonomyOptionsOpen = false;
    review = null;
    applied = false;
    busy = false;
    error = null;
    creating = false;
    newLabel = '';
    cacheRefreshFailed = false;
    onClosed?.();
} });
$effect(() => { if (!open || !taxonomy)
    return; const currentName = name, currentLocale = termLocale; let cancelled = false; loading = true; termsFailed = false; void client.terms(currentName, { locale: currentLocale, includeCounts: false, resolveFallback: true }).then(values => { if (!cancelled)
    terms = values; }).catch(() => { if (!cancelled) {
    terms = [];
    termsFailed = true;
} }).finally(() => { if (!cancelled)
    loading = false; }); return () => { cancelled = true; }; });
const uniqueTerms = (values: BulkTaxonomyTerm[]): BulkTaxonomyTerm[] => { const groups = new Map<string, BulkTaxonomyTerm>(); for (const term of values) {
    groups.set(term.translationGroup ?? term.id, term);
    for (const child of uniqueTerms(term.children))
        groups.set(child.translationGroup ?? child.id, child);
} return [...groups.values()]; };
const options = $derived(uniqueTerms(terms));
const sources = $derived<BulkTaxonomySource[]>(selected ? selected.map(({ collection, id }) => ({ collection, id })) : urls.split(/\r?\n/).map(url => url.trim()).filter(Boolean).map(url => ({ url })));
const results = $derived(review ?? []), ready = $derived(results.filter(result => result.status === 'ready').length), failed = $derived(results.filter(result => result.status === 'failed')), added = $derived(results.filter(result => result.status === 'added').length);
const termLabel = $derived(options.find(term => term.id === termId)?.label);
async function reloadTerms() { loading = true; termsFailed = false; try {
    terms = await client.terms(name, { locale: termLocale, includeCounts: false, resolveFallback: true });
}
catch {
    terms = [];
    termsFailed = true;
}
finally {
    loading = false;
} }
async function create() { if (!newLabel.trim())
    return; busy = true; error = null; try {
    const term = await client.createTerm(name, { label: newLabel.trim(), locale: termLocale });
    await client.invalidate?.('taxonomy-terms', name);
    await reloadTerms();
    termId = term.id;
    creating = false;
    newLabel = '';
    review = null;
    applied = false;
    cacheRefreshFailed = false;
}
catch (caught) {
    error = caught instanceof Error ? caught.message : `Could not create ${singularLower}`;
}
finally {
    busy = false;
} }
async function preview() { if (!termId || sources.length === 0 || sources.length > 50) {
    error = 'Choose a term and enter between 1 and 50 posts.';
    return;
} busy = true; error = null; try {
    review = (await client.bulkTag(termId, sources)).results;
    applied = false;
    cacheRefreshFailed = false;
}
catch (caught) {
    error = caught instanceof Error ? caught.message : 'Could not review posts';
}
finally {
    busy = false;
} }
async function apply(indices: number[], refreshOnly = false) { if (!review || indices.length === 0)
    return; const targets = indices.map(index => ({ index, reviewed: review![index]! })); busy = true; error = null; try {
    const response = await client.bulkTag(termId, targets.map(({ reviewed }) => reviewed.entry ? { collection: reviewed.entry.collection, id: reviewed.entry.id } : reviewed.input), true, refreshOnly);
    const merged = [...review];
    for (const [position, { index, reviewed }] of targets.entries()) {
        const updated = response.results[position];
        if (updated)
            merged[index] = { ...updated, status: reviewed.status === 'added' && updated.status === 'skipped' ? 'added' : updated.status, input: reviewed.input, entry: updated.entry ?? reviewed.entry };
    }
    review = merged;
    applied = true;
    cacheRefreshFailed = refreshOnly ? response.cacheRefreshFailed : cacheRefreshFailed || response.cacheRefreshFailed;
    void client.invalidate?.('taxonomy-terms', name);
    void client.invalidate?.('content');
    onApplied?.(merged);
}
catch (caught) {
    error = caught instanceof Error ? caught.message : `Could not add ${singularLower}`;
}
finally {
    busy = false;
} }
function statusLabel(status: BulkTaxonomyResult['status']) { return status === 'ready' ? 'Ready' : status === 'added' ? 'Added' : status === 'skipped' ? 'Already assigned or duplicate' : status === 'failed' ? 'Failed' : 'Not matched'; }
</script>
{#if open}
 <div class="bulk-overlay">
  <div role="dialog" tabindex="-1" aria-modal="true" aria-labelledby={headingId} class="bulk-dialog">
   <header><h2 id={headingId}>Add {singularLower} to posts</h2><button type="button" aria-label="Close" disabled={busy} onclick={onClose}>×</button><p>Existing {pluralLower} stay in place.</p></header>
   <div class="bulk-body">
   {#if !review}
    {#if taxonomies.length>1}<div><span>Taxonomy</span><button type="button" role="combobox" aria-label="Taxonomy" aria-expanded={taxonomyOptionsOpen} aria-controls={taxonomyOptionsId} disabled={busy} onclick={()=>taxonomyOptionsOpen=!taxonomyOptionsOpen}>{taxonomy?.label??''}</button>{#if taxonomyOptionsOpen}<div id={taxonomyOptionsId} role="listbox" aria-label="Taxonomy">{#each taxonomies as def(def.name)}<button type="button" role="option" aria-selected={name===def.name} data-option-id={def.name} onclick={()=>{taxonomyName=def.name;taxonomyOptionsOpen=false;termId='';creating=false;newLabel='';error=null;}}>{def.label}</button>{/each}</div>{/if}</div>{/if}
    {#if !creating}<div><label for={termIdAttribute}>{singular}</label><button id={termIdAttribute} type="button" role="combobox" aria-label={singular} aria-expanded={optionsOpen} aria-controls={termOptionsId} disabled={busy||loading||termsFailed} onclick={()=>optionsOpen=!optionsOpen}>{options.find(term=>term.id===termId)?.label??'Choose…'}</button>
     {#if optionsOpen}<div id={termOptionsId} role="listbox" aria-label={singular}>{#each options as term(term.id)}<button type="button" role="option" aria-selected={termId===term.id} data-option-id={term.id} onclick={()=>{termId=term.id;optionsOpen=false;cacheRefreshFailed=false;}}>{term.label}</button>{/each}</div>{/if}
    </div>
    {/if}
    {#if loading}<p>Loading {pluralLower}…</p>{/if}
    {#if termsFailed}<p role="alert">Could not load {pluralLower}.</p><button type="button" disabled={loading} onclick={()=>void reloadTerms()}>Retry loading {pluralLower}</button>{/if}
    {#if creating}<label>New {singularLower} name<input aria-label={`New ${singularLower} name`} bind:value={newLabel} disabled={busy} /></label><button type="button" disabled={busy||termsFailed||!newLabel.trim()} onclick={()=>void create()}>Create {singularLower}</button><button type="button" onclick={()=>creating=false}>Cancel</button>{:else}<button type="button" disabled={busy||loading||termsFailed} onclick={()=>creating=true}>Create new {singularLower}</button>{/if}
    {#if selected}<h3>Selected posts</h3><span>{selected.length}</span><ul>{#each selected as post(post.id)}<li><span>{post.title}</span> <span>{post.locale??''}</span></li>{/each}</ul>{:else}<label>Post URLs (one per line)<textarea aria-label="Post URLs (one per line)" rows="4" disabled={busy} bind:value={urls}></textarea></label>{/if}
   {:else}
    <div aria-live="polite">
    {#if applied}<h3>{failed.length?`${added} updated · ${failed.length} failed`:added===1?'1 post updated':`${added} posts updated`}</h3><p>{termLabel}</p>{:else}<p>{singular}</p><p>{termLabel}</p><span>{ready} of {results.length} ready</span>{/if}
    <h3>{applied?'Results':'Review posts'}</h3><ul>{#each results as result,index(index)}<li><p>{result.entry?result.entry.title:'url'in result.input?result.input.url:result.input.id}</p>{#if result.entry}<p>{result.entry.locale}</p>{:else if result.status==='unmatched'}<p>{result.reason==='ambiguous'?'More than one post matches this link':'No exact match on this site'}</p>{/if}<span>{statusLabel(result.status)}</span></li>{/each}</ul>
    {#if cacheRefreshFailed}<p role="status">Changes were saved, but cached pages may still show old {pluralLower}. Retry the cache refresh.</p>{/if}
    </div>
   {/if}
   {#if error}<p role="alert">{error}</p>{/if}
   </div>
   <footer>
    {#if review&&!applied&&ready>0}<p>{plural} go live now; draft edits stay unpublished.</p>{/if}
    {#if review&&!applied}<button type="button" disabled={busy} onclick={()=>review=null}>Back</button>{/if}
    {#if !review||applied||ready===0}<button type="button" disabled={busy} onclick={onClose}>{applied||(review&&ready===0)?'Done':'Cancel'}</button>{/if}
    {#if applied}
     {#if failed.length}<button type="button" disabled={busy} onclick={()=>void apply(results.flatMap((result,index)=>result.status==='failed'?[index]:[]))}>Retry failures</button>{/if}
     {#if cacheRefreshFailed}<button type="button" disabled={busy} onclick={()=>void apply(results.flatMap((result,index)=>(result.status==='added'||result.status==='skipped')&&result.entry?[index]:[]),true)}>Retry cache refresh</button>{/if}
    {:else if review}
     {#if ready>0}<button type="button" disabled={busy} onclick={()=>void apply(results.flatMap((result,index)=>result.status==='ready'?[index]:[]))}>{busy?'Adding…':ready===1?`Add ${singularLower} to 1 post`:`Add ${singularLower} to ${ready} posts`}</button>{/if}
    {:else}<button type="button" disabled={busy||loading||termsFailed} onclick={()=>void preview()}>{busy?'Reviewing…':'Review posts'}</button>{/if}
   </footer>
  </div>
 </div>
{/if}
<style>
 .bulk-overlay{position:fixed;inset:0;background:rgb(0 0 0 / .4);display:grid;place-items:center;z-index:50}.bulk-dialog{width:min(768px,calc(100vw - 32px));height:min(448px,calc(100vh - 32px));display:flex;flex-direction:column;background:white;border:1px solid #bbb;border-radius:12px;color:#222;box-sizing:border-box}.bulk-dialog header,.bulk-dialog footer{padding:16px 24px;flex-shrink:0}.bulk-dialog header{position:relative;border-bottom:1px solid #ddd}.bulk-dialog header>button{position:absolute;inset-inline-end:16px;top:16px}.bulk-body{padding:20px 24px;overflow:auto;flex:1;min-height:0}.bulk-body label{display:block;margin-block-end:12px}.bulk-body textarea{display:block;width:100%;box-sizing:border-box}.bulk-dialog footer{display:flex;gap:8px;justify-content:flex-end;border-top:1px solid #ddd}h2{margin:0}button,textarea{font:inherit}button[role=option]{display:block;width:100%;text-align:start}
</style>
