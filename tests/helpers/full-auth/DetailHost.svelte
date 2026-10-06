<script lang="ts">
  import UserDetail from '../../../src/lib/users/UserDetail.svelte';
  let { state }: { state: Record<string, any> } = $props();
</script>
<UserDetail {...state} />
