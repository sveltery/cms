// Same complete Source provider/mocks as the existing ordinary DOM transport.
// Svelte async rendering settles before render returns, as the browser host does.
import { settled } from 'svelte';
import { vi } from 'vitest';
import { render as nativeRender } from '../dashboard-welcome/dom-render';
export async function render(...args: Parameters<typeof nativeRender>) {
 const screen = await nativeRender(...args);
 await settled();
 await vi.waitFor(() => { if (!screen.container.querySelector("main")) throw new Error("Actual WorkspaceShell mount not ready"); });
 return screen;
}
