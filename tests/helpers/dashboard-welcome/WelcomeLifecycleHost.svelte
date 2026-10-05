<script lang="ts">
  import WelcomeModal from '../../../src/lib/dashboard/WelcomeModal.svelte';
  let { state }: { state: { open: boolean; onClose: () => void; userRole: number; dismissWelcome?: () => Promise<void>; basePath?: string } } = $props();
</script>
<WelcomeModal {...state} />
