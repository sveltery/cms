// Supplemental Native DOM transport. The complete original TableControls
// browser family remains immutable and supplies browser keyboard/layout credit.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import TableSizePicker from '../../src/lib/editor/rich-text/TableSizePicker.svelte';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.unstubAllGlobals();
});

async function picker(coarse = false) {
  // Controlled pointer capability for this supplemental DOM fixture only.
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: coarse && query === '(any-pointer: coarse)', media: query,
    onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  })));
  const host = document.createElement('div'); document.body.append(host);
  const onInsert = vi.fn(), onCancel = vi.fn();
  const instance = mount(TableSizePicker, { target: host, props: { onInsert, onCancel } });
  cleanups.push(async () => { await unmount(instance); host.remove(); });
  await tick(); await tick();
  return { host, onInsert, onCancel };
}

describe('Actual Native table picker controls', () => {
  it('exposes the shared header-row choice as the Source switch role', async () => {
    const { host, onInsert } = await picker();
    const header = host.querySelector<HTMLInputElement>('input[role="switch"]');
    expect(header).toBeTruthy(); expect(header!.checked).toBe(true);
    header!.click(); await tick();
    host.querySelector<HTMLButtonElement>('[role="gridcell"][aria-label="2 × 2 table"]')!.click();
    expect(onInsert).toHaveBeenCalledExactlyOnceWith(2, 2, false);
  });

  it('starts the coarse-pointer flow at Rows and keeps the header switch before confirmation', async () => {
    const { host, onInsert } = await picker(true);
    const rows = host.querySelector<HTMLSelectElement>('select[id$="-rows"]')!;
    const columns = host.querySelector<HTMLSelectElement>('select[id$="-columns"]')!;
    expect(document.activeElement).toBe(rows);
    const header = host.querySelector<HTMLInputElement>('input[role="switch"]')!;
    const insert = [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Insert table')!;
    expect(header.compareDocumentPosition(insert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    rows.value = '3'; rows.dispatchEvent(new Event('change', { bubbles: true }));
    columns.value = '4'; columns.dispatchEvent(new Event('change', { bubbles: true }));
    header.click(); await tick(); insert.click();
    expect(onInsert).toHaveBeenCalledExactlyOnceWith(3, 4, false);
  });

  it('keeps hovered preview separate from the roving keyboard cell', async () => {
    const { host } = await picker();
    const first = host.querySelector<HTMLButtonElement>('[aria-label="1 × 1 table"]')!;
    const hovered = host.querySelector<HTMLButtonElement>('[aria-label="3 × 4 table"]')!;
    expect(document.activeElement).toBe(first);
    hovered.dispatchEvent(new MouseEvent('mouseenter')); await tick();
    expect(host.querySelector('p')!.textContent).toBe('3 × 4 table');
    expect(document.activeElement).toBe(first); expect(first.tabIndex).toBe(0); expect(hovered.tabIndex).toBe(-1);
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await tick(); await tick();
    const second = host.querySelector<HTMLButtonElement>('[aria-label="1 × 2 table"]')!;
    expect(document.activeElement).toBe(second); expect(second.tabIndex).toBe(0);
    expect(host.querySelector('p')!.textContent).toBe('1 × 2 table');
  });

  it('cancels with Escape without emitting an insertion', async () => {
    const { host, onCancel, onInsert } = await picker();
    const first = host.querySelector<HTMLButtonElement>('[aria-label="1 × 1 table"]')!;
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    first.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
    expect(onCancel).toHaveBeenCalledExactlyOnceWith(); expect(onInsert).not.toHaveBeenCalled();
  });

  it('clamps keyboard movement to the grid edges and confirms the selected dimensions', async () => {
    const { host, onInsert } = await picker();
    const first = host.querySelector<HTMLButtonElement>('[aria-label="1 × 1 table"]')!;
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    await tick(); await tick(); expect(document.activeElement).toBe(first);
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', ctrlKey: true, bubbles: true, cancelable: true }));
    await tick(); await tick();
    const last = host.querySelector<HTMLButtonElement>('[aria-label="10 × 10 table"]')!;
    expect(document.activeElement).toBe(last);
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(onInsert).toHaveBeenCalledExactlyOnceWith(10, 10, true);
  });
});
