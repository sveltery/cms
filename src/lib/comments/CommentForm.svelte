<script lang="ts">
 let {collection,contentId,parentId=null,user,enabled=true,basePath='',turnstileSiteKey}:{collection:string;contentId:string;parentId?:string|null;user?:{name:string|null;email:string};enabled?:boolean;basePath?:string;turnstileSiteKey?:string}=$props();
</script>
{#if enabled}<form aria-label="Post a comment"></form>{/if}
