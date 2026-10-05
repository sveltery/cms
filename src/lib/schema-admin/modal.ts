/** Native dialog behavior. Unsupported DOM hosts retain declarative open
 * markup; no showModal, geometry, focus or cancel behavior is fabricated. */
export function modal(node: HTMLDialogElement, cancel: () => void) {
  if (typeof node.showModal === 'function') {
    node.removeAttribute('open'); node.showModal();
  }
  const onCancel = (event: Event) => { event.preventDefault(); cancel(); };
  node.addEventListener('cancel', onCancel);
  return { destroy() { node.removeEventListener('cancel', onCancel); if (typeof node.close === 'function' && node.open) node.close(); } };
}
