<script lang="ts">
 import Picker from '../../src/lib/media/MediaPickerModal.svelte';
 import ReactDetail from './MediaPickerReactDetail.svelte';
 let options=$props();
</script>
{#snippet assetDetails(detail:Record<string,unknown>)}<ReactDetail options={detail}/>{/snippet}
<Picker {...options} {assetDetails}/>
