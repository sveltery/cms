<script lang="ts">
 import type { CommentSettingsCollection,CommentSettingsInput } from './settings-types.ts';
 let {collection,onSave,disabled=false}:{collection:CommentSettingsCollection;onSave:(input:CommentSettingsInput,expected:{version:number;updatedAt:string})=>Promise<CommentSettingsCollection>;disabled?:boolean}=$props();
</script>
<!-- Original test-first baseline: settings controls unavailable. -->
