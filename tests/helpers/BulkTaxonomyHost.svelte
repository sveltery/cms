<script lang="ts">
 import Dialog from '../../src/lib/bulk-taxonomy/BulkTaxonomyDialog.svelte';
 import type {BulkTaxonomyDialogProps} from '../../src/lib/bulk-taxonomy/types';
 import {untrack} from 'svelte';
 const {initial}:{initial:BulkTaxonomyDialogProps}=$props();
 let current=$state(untrack(()=>initial));
 export function setOpen(open:boolean){current={...current,open};}
 export function update(props:BulkTaxonomyDialogProps){current=props;}
</script>
<Dialog {...current}/>
