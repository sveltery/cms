// Supplemental actual Native browser focus/selection/event controls.
// No copied Source callbacks or URL/auth/storage/protected transport credit.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { flushSync, mount, unmount } from 'svelte';
import Harness from '../helpers/calendar-admin/PickerKeyboardHarness.svelte';
let component: ReturnType<typeof mount> | undefined;
let target: HTMLElement | undefined;
afterEach(async () => { if (component) await unmount(component); component = undefined; target?.remove(); target = undefined; });
function render(locale = 'en', direction: 'ltr' | 'rtl' = 'ltr', initialMonth = '2030-10') {
  target = document.createElement('div'); document.body.append(target);
  const onMonthChange = vi.fn();
  component = flushSync(() => mount(Harness, { target: target!, props: { locale, direction, initialMonth, onMonthChange } }));
  return onMonthChange;
}
const button = (day: string) => target!.querySelector<HTMLButtonElement>(`[data-calendar-day="${day}"]`)!;
const focused = () => document.activeElement?.getAttribute('data-calendar-day');
const selected = () => target!.querySelector('[data-calendar-day][aria-pressed="true"]')?.getAttribute('data-calendar-day');
describe('Native compact Calendar keyboard focus and selection', () => {
  it('moves same-month focus while retaining the chosen day and entries heading', async () => {
    render(); button('2030-10-15').focus(); await userEvent.keyboard('{ArrowRight}');
    await expect.poll(focused).toBe('2030-10-16');
    expect(selected()).toBe('2030-10-15'); expect(target!.querySelector('section h3')?.textContent).toContain('October 15');
  });
  it.each(['{Enter}', ' '])('selects the focused day through native %s button activation', async key => {
    render(); button('2030-10-15').focus(); await userEvent.keyboard('{ArrowRight}');
    await expect.poll(focused).toBe('2030-10-16'); await userEvent.keyboard(key);
    await expect.poll(selected).toBe('2030-10-16'); expect(target!.querySelector('section h3')?.textContent).toContain('October 16');
  });
  it.each([
    ['{Shift>}{ArrowRight}{/Shift}', '2030-11-15', '2030-11'],
    ['{Shift>}{ArrowDown}{/Shift}', '2031-10-15', '2031-10'],
    ['{PageUp}', '2030-09-15', '2030-09'],
    ['{Shift>}{PageDown}{/Shift}', '2031-10-15', '2031-10'],
  ])('retains focused date through controlled cross-month %s navigation', async (key, day, month) => {
    const change = render(); button('2030-10-15').focus(); await userEvent.keyboard(key);
    await expect.poll(focused).toBe(day); expect(change).toHaveBeenCalledWith(month);
    expect(selected()).toBe(`${month}-01`);
  });
  it('uses the supplied date-fns locale for Home and End without selecting', async () => {
    render('en-GB'); button('2030-10-15').focus(); await userEvent.keyboard('{Home}');
    await expect.poll(focused).toBe('2030-10-14'); expect(selected()).toBe('2030-10-15');
    await userEvent.keyboard('{End}'); await expect.poll(focused).toBe('2030-10-20'); expect(selected()).toBe('2030-10-15');
  });
  it('reverses horizontal movement for an explicitly supplied Native RTL direction', async () => {
    render('ar', 'rtl'); button('2030-10-15').focus(); await userEvent.keyboard('{ArrowRight}');
    await expect.poll(focused).toBe('2030-10-14'); expect(selected()).toBe('2030-10-15');
  });
  it('clamps an end-of-month date before focusing the controlled next month', async () => {
    const change = render('en', 'ltr', '2031-01'); button('2031-01-31').focus(); await userEvent.keyboard('{PageDown}');
    await expect.poll(focused).toBe('2031-02-28'); expect(change).toHaveBeenCalledWith('2031-02'); expect(selected()).toBe('2031-02-01');
  });
  it('prevents the browser movement default and stops propagation at the actual component', async () => {
    render(); button('2030-10-15').focus(); const escaped = vi.fn();
    document.addEventListener('keydown', escaped);
    try {
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
      const allowed = button('2030-10-15').dispatchEvent(event);
      expect(allowed).toBe(false); expect(event.defaultPrevented).toBe(true); expect(escaped).not.toHaveBeenCalled();
      await expect.poll(focused).toBe('2030-10-16'); expect(selected()).toBe('2030-10-15');
    } finally { document.removeEventListener('keydown', escaped); }
  });
  it('retains the last-focused day through toolbar navigation away and back without stealing toolbar focus', async () => {
    render(); button('2030-10-15').focus(); await userEvent.keyboard('{ArrowRight}');
    await expect.poll(focused).toBe('2030-10-16');
    await page.getByRole('button', { name: 'Next fixture month' }).click();
    await expect.poll(() => target!.querySelector('[data-calendar-day][tabindex="0"]')?.getAttribute('data-calendar-day')).toBe('2030-11-01');
    const previous = page.getByRole('button', { name: 'Previous fixture month' }); await previous.click();
    await expect.poll(() => target!.querySelector('[data-calendar-day][tabindex="0"]')?.getAttribute('data-calendar-day')).toBe('2030-10-16');
    expect(document.activeElement).toBe(previous.element()); expect(selected()).toBe('2030-10-15');
    await userEvent.keyboard('{Tab}'); await userEvent.keyboard('{Tab}'); await expect.poll(focused).toBe('2030-10-16');
  });
});
