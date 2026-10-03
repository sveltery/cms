<script lang="ts">
 import type { PublicComment } from '../server/comments/upstream/database/repositories/comment.ts';
 let {collection,contentId,comments=[],total=0,enabled=true,threaded=false,reactions=false,basePath=''}:{collection:string;contentId:string;comments?:PublicComment[];total?:number;enabled?:boolean;threaded?:boolean;reactions?:boolean;basePath?:string}=$props();
</script>
{#if enabled}<section aria-label="Comments"></section>{/if}
