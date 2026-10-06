<script lang="ts">
  import InviteUserModal from '../../../src/lib/users/InviteUserModal.svelte';
  let { state }: { state: Record<string, any> } = $props();
</script>
<InviteUserModal {...state} />
