<script lang="ts">
 import {bulkTagEntries} from '$lib/taxonomies.remote';
 let {terms,disabled}:{terms:{id:string;label:string}[];disabled:boolean}=$props();let lines=$state('');
 const items=$derived(JSON.stringify(lines.split('\n').map(line=>line.trim()).filter(Boolean).map(line=>/^https?:\/\//.test(line)?{url:line}:{collection:line.split(':')[0],id:line.slice(line.indexOf(':')+1)})));
</script>
<details><summary>Bulk tag entries</summary><form {...bulkTagEntries}><fieldset {disabled}><legend>Bulk tagging</legend>
 <label>Term <select name="termId">{#each terms as term}<option value={term.id}>{term.label}</option>{/each}</select></label>
 <label>Entry URLs or collection:id, one per line <textarea bind:value={lines}></textarea></label><input type="hidden" name="items" value={items}/>
 <label><input {...bulkTagEntries.fields.apply.as('checkbox')}/>Apply assignments</label><button disabled={bulkTagEntries.pending>0}>Check entries</button>
</fieldset></form>{#if bulkTagEntries.result}<ul>{#each bulkTagEntries.result.results as result}<li>{'url' in result.input?result.input.url:`${result.input.collection}:${result.input.id}`} — {result.status}</li>{/each}</ul>{/if}{#each bulkTagEntries.fields.allIssues()??[] as issue}<p role="alert">{issue.message}</p>{/each}</details>
<style>details{margin-block:24px}fieldset{padding:16px;border:1px solid #d9e0eb}label{display:block;margin-block:12px}select,textarea{display:block;width:100%;padding:8px}button{padding:8px 16px}</style>
