<script lang="ts">
  // EmDash DialogError markup, MIT Copyright 2026 Cloudflare Inc.
  // Pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; notices/emdash-MIT.txt.
  // The caller owns message extraction and translation; this renders text only.
  let { message }: { message?: string | null } = $props();
</script>

{#if message}
  <div role="alert">
    {#each message.split('\n') as line, index (index)}<div>{line}</div>{/each}
  </div>
{/if}

<style>
  [role="alert"] { color: var(--destructive, #b32929); font-size: .875rem; }
</style>
