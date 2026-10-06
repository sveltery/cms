// Original supplemental Svelte DOM requirements; complete Source modal inventory is separate.
import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushSync, tick, unmount } from 'svelte';
import Host from '../helpers/full-auth/InviteHost.svelte';
import { componentState } from '../helpers/full-auth/state.svelte.ts';
const instances: ReturnType<typeof mount>[] = [];
afterEach(async () => { vi.useRealTimers(); vi.unstubAllGlobals(); for (const instance of instances.splice(0)) await unmount(instance); document.body.replaceChildren(); });
async function settle() { await tick(); await Promise.resolve(); await tick(); }
async function render(props: Record<string, unknown> = {}) {
  const state = componentState({ open: true, onOpenChange: vi.fn(), onInvite: vi.fn(), ...props });
  const target = document.createElement('div'); document.body.append(target); instances.push(flushSync(() => mount(Host, { target, props: { state } }))); await settle(); return { target, state };
}
function button(label: string) { return [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === label); }
it('open invite exposes email, role, all Source role options and Author default', async () => {
  await render(); expect(document.querySelector('[aria-label="Email address"]')).not.toBeNull(); expect(document.querySelector<HTMLSelectElement>('[aria-label=Role]')?.value).toBe('30');
  expect([...document.querySelectorAll('option')].map(item => [item.value, item.textContent])).toEqual([['10', 'Subscriber'], ['20', 'Contributor'], ['30', 'Author'], ['40', 'Editor'], ['50', 'Admin']]);
});
it('empty email disables the invitation submission', async () => { await render(); expect(button('Send Invite')?.disabled).toBe(true); });
it('submitting the Source invite fixture invokes email and selected role', async () => {
  const { state } = await render(); const email = document.querySelector<HTMLInputElement>('[aria-label="Email address"]'); expect(email).not.toBeNull();
  email!.value = 'new@example.com'; email!.dispatchEvent(new Event('input', { bubbles: true })); await settle(); expect(button('Send Invite')?.disabled).toBe(false); button('Send Invite')!.click(); await settle(); expect(state.onInvite).toHaveBeenCalledWith('new@example.com', 30);
});
it('pending invite submission is disabled and retains Sending label', async () => { await render({ isSending: true }); expect(button('Sending...')?.disabled).toBe(true); });
it('invite displays errors without closing the form', async () => { const { target } = await render({ error: 'Email already exists' }); expect(target.textContent).toContain('Email already exists'); expect(document.querySelector('[aria-label="Email address"]')).not.toBeNull(); });
it('opening resets email, role and copy status', async () => {
  const { state } = await render({ open: false }); expect(document.querySelector('[role=dialog]')).toBeNull(); state.open = true; await settle(); expect(document.querySelector<HTMLInputElement>('[aria-label="Email address"]')?.value).toBe('');
  const input = document.querySelector<HTMLInputElement>('[aria-label="Email address"]')!; input.value = 'new@example.com'; input.dispatchEvent(new Event('input', { bubbles: true })); state.open = false; await settle(); state.open = true; await settle(); expect(document.querySelector<HTMLInputElement>('[aria-label="Email address"]')?.value).toBe('');
});
it('cancel invokes the provided close callback', async () => { const { state } = await render(); expect(button('Cancel')).toBeDefined(); button('Cancel')!.click(); expect(state.onOpenChange).toHaveBeenCalledWith(false); });
it('copy-link view shows the Source supplied invite URL and retains clipboard failure', async () => {
  const writeText = vi.fn().mockRejectedValue(new Error('Unavailable')); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const { target } = await render({ inviteUrl: 'https://example.com/admin/invite/accept?token=example' }); expect(target.textContent).toContain('Invite Link Created');
  expect(document.querySelector<HTMLInputElement>('[aria-label="Invite link"]')?.value).toBe('https://example.com/admin/invite/accept?token=example');
  expect(button('Copy link')).toBeDefined(); button('Copy link')!.click(); await settle(); expect(writeText).toHaveBeenCalledWith('https://example.com/admin/invite/accept?token=example'); expect(target.textContent).toContain('Could not copy');
});
