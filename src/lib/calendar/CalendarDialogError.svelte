<script lang="ts">
  let { message }: { message?: string | null } = $props();
</script>

{#if message}<p role="alert">{message}</p>{/if}

<style>
  [role="alert"] { color: var(--destructive, #b32929); }
</style>
