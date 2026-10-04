<script lang="ts">
 import Page from '../../../src/lib/comments/CommentSettingsPage.svelte';
 import type { CommentSettingsCollection } from '../../../src/lib/comments/settings-types.ts';
 let {state}:{state:{data:{collection:CommentSettingsCollection;basePath:string;mutationsEnabled:boolean}}}=$props();
</script>
<Page data={state.data}/>
