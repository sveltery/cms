import { flushSync } from 'svelte';
import { flushSync as reactFlushSync } from 'react-dom';
export const userEvent = {
  async keyboard(value: string) {
    for (const character of value) {
      const node = document.activeElement;
      if (!(node instanceof HTMLInputElement)) throw new Error('No actual focused input');
      reactFlushSync(() => flushSync(() => {
        const start = node.selectionStart ?? node.value.length, end = node.selectionEnd ?? start;
        node.value = node.value.slice(0, start) + character + node.value.slice(end);
        node.dispatchEvent(new Event('input', { bubbles: true }));
      }));
    }
  }
};
