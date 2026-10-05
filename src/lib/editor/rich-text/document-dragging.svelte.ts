import { onMount } from 'svelte';

// Native lifecycle equivalent of pinned useDocumentDragging. Every mounted
// preview owns and releases its actual document subscriptions.
export function documentDragging() {
  const state = $state({ active: false });
  onMount(() => {
    const start = () => { state.active = true; }, end = () => { state.active = false; };
    document.addEventListener('dragstart', start);
    document.addEventListener('dragend', end);
    document.addEventListener('drop', end);
    return () => {
      document.removeEventListener('dragstart', start);
      document.removeEventListener('dragend', end);
      document.removeEventListener('drop', end);
    };
  });
  return state;
}
