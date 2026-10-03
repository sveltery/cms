<script lang="ts">
 import MediaDialog from './MediaDialog.svelte';
 import type {Snippet} from 'svelte';
 let {open,onOpenChange,title='Select image',assetDetails}: {open?:boolean;onOpenChange?:(open:boolean)=>void;title?:string;assetDetails?:Snippet<[Record<string,unknown>]>;[key:string]:unknown}=$props();
</script>
{#if open}<MediaDialog label={title} onclose={()=>onOpenChange?.(false)}><h2>{title}</h2><button onclick={()=>onOpenChange?.(false)}>Cancel</button></MediaDialog>{/if}
