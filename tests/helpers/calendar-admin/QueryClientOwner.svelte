<script lang="ts">
  import type { QueryClient } from '@tanstack/react-query';
  let { create,onReady }:{create:()=>QueryClient;onReady:(client:QueryClient)=>void}=$props();
  // Only the supplied actual production owner creates/manages the client.
  onReady(create());
</script>
