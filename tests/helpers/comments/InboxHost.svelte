<script lang="ts">
 import { untrack } from 'svelte';
 import Inbox from '../../../src/lib/comments/CommentInbox.svelte';
 import type { CommentInboxProps } from '../../../src/lib/comments/types.ts';
 const {initial}:{initial:CommentInboxProps}=$props();
 let current=$state(untrack(()=>initial));
 export function update(props:CommentInboxProps){current=props;}
</script>
<Inbox {...current}/>
