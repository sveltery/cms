<script lang="ts">
 import BlockTypeEditor from '../../src/lib/ui/BlockTypeEditor.svelte';
 import type {BlockType} from '../../src/lib/server/schema/block-types';
 let {type,plainFixture=false}:{type?:BlockType;plainFixture?:boolean}=$props();
 // The unproxied fixture isolates the stale-edit contract from the independently
 // tested Svelte proxy cloning boundary. The real widget owns both behaviors.
 const supplied=$derived(plainFixture&&type?JSON.parse(JSON.stringify(type)):type);
</script>
<svelte:boundary>
 <BlockTypeEditor type={supplied}/>
 {#snippet failed(error)}<p role="alert">{error instanceof Error?error.message:String(error)}</p>{/snippet}
</svelte:boundary>
