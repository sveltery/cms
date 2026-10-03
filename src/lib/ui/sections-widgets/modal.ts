/** Native modal supplies the keyboard/focus lifecycle previously owned by Base UI. */
export function modal(node: HTMLDialogElement, onClose: () => void) {
  const previous = document.activeElement;
  const cancel = (event: Event) => { event.preventDefault(); onClose(); };
  node.addEventListener('cancel', cancel);
  node.showModal();
  return { destroy() { node.removeEventListener('cancel', cancel); node.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); } };
}
