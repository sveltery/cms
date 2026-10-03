<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  let { children, labelledBy, onClose }: { children: Snippet; labelledBy: string; onClose: () => void } = $props();
  let dialog: HTMLDialogElement;
  onMount(() => {
    // Native modal focus/keyboard behavior in browsers. A plain DOM host that
    // lacks the modal API still renders the actual dialog's open state.
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  });
</script>
<dialog bind:this={dialog} aria-modal="true" aria-labelledby={labelledBy}
  oncancel={event => { event.preventDefault(); onClose(); }}
  onclick={event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>
  {@render children()}
</dialog>
<style>
  dialog { background:white; color:#18181b; padding:1.5rem; border:0; border-radius:.75rem; width:min(32rem,calc(100vw - 2rem)); max-height:90dvh; overflow:auto; }
  dialog::backdrop { background:#0006; }
</style>
