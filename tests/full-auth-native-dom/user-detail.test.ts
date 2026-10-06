// Original Native DOM requirements follow complete pinned UserDetail fixtures and behaviors.
// These are supplemental Svelte assertions: zero copied Source/browser/security credit.
import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushSync, tick, unmount } from 'svelte';
import Host from '../helpers/full-auth/DetailHost.svelte';
import { componentState } from '../helpers/full-auth/state.svelte.ts';
import { makeUser } from '../helpers/full-auth/user-fixture.ts';
const instances: ReturnType<typeof mount>[] = [];
afterEach(async () => { for (const instance of instances.splice(0)) await unmount(instance); document.body.replaceChildren(); });
async function settle() { await tick(); await Promise.resolve(); await tick(); }
async function render(props: Record<string, unknown> = {}) {
  const state = componentState({ user: makeUser(), isOpen: true, onClose: vi.fn(), onSave: vi.fn(), onDisable: vi.fn(), onEnable: vi.fn(), ...props });
  const target = document.createElement('div'); document.body.append(target);
  instances.push(flushSync(() => mount(Host, { target, props: { state } }))); await settle();
  return { target, state };
}
function button(label: string) { return [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === label || item.getAttribute('aria-label') === label); }
async function change(name: string, value: string) {
  const input = document.querySelector<HTMLInputElement | HTMLSelectElement>(`[aria-label="${name}"]`); expect(input).not.toBeNull();
  input!.value = value; input!.dispatchEvent(new Event(input!.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); await settle();
}
it('closed detail has no visible dialog', async () => { await render({ isOpen: false }); expect(document.querySelector('[role=dialog]')).toBeNull(); });
it('loading detail exposes a dialog and loading skeleton', async () => { await render({ user: null, isLoading: true }); expect(document.querySelector('[role=dialog]')).not.toBeNull(); expect(document.querySelector('.animate-pulse')).not.toBeNull(); });
it('missing detail shows User not found after loading', async () => { const { target } = await render({ user: null }); expect(target.textContent).toContain('User not found'); });
it('stored profile controls display the Source fixture and unchanged save is disabled', async () => {
  await render(); expect(document.querySelector<HTMLInputElement>('[aria-label=Name]')?.value).toBe('Test User');
  expect(document.querySelector<HTMLInputElement>('[aria-label=Email]')?.value).toBe('test@example.com'); expect(button('Save Changes')?.disabled).toBe(true);
});
it('changed name enables save and emits only changed fields', async () => {
  const { state } = await render({ user: makeUser({ name: 'Original' }) }); await change('Name', 'Changed'); expect(button('Save Changes')?.disabled).toBe(false);
  button('Save Changes')!.click(); await settle(); expect(state.onSave).toHaveBeenCalledWith({ name: 'Changed' });
});
it('changed email enables save and emits only email', async () => {
  const { state } = await render(); await change('Email', 'new@example.com'); expect(button('Save Changes')?.disabled).toBe(false);
  button('Save Changes')!.click(); await settle(); expect(state.onSave).toHaveBeenCalledWith({ email: 'new@example.com' });
});
it('explicit Source self fixture disables role and hides disable/recovery', async () => {
  const { target } = await render({ user: makeUser({ id: 'me' }), currentUserId: 'me', onSendRecovery: vi.fn() });
  expect(target.textContent).toContain('You cannot change your own role'); expect(document.querySelector<HTMLInputElement>('[aria-label=Role]')?.disabled).toBe(true);
  expect(button('Disable')).toBeUndefined(); expect(button('Send Recovery Link')).toBeUndefined();
});
it('non-self disable and disabled-user enable invoke the provided callbacks', async () => {
  const { state } = await render({ user: makeUser({ id: 'other' }), currentUserId: 'me' }); expect(button('Disable')).toBeDefined(); button('Disable')!.click(); expect(state.onDisable).toHaveBeenCalledOnce();
  state.user = makeUser({ id: 'other', disabled: true }); await settle(); expect(button('Enable')).toBeDefined(); button('Enable')!.click(); expect(state.onEnable).toHaveBeenCalledOnce();
});
it('close control invokes onClose', async () => { const { state } = await render(); expect(button('Close panel')).toBeDefined(); button('Close panel')!.click(); expect(state.onClose).toHaveBeenCalledOnce(); });
it('switching Source fixtures resets all edit controls', async () => {
  const { state } = await render(); await change('Name', 'Unsaved'); state.user = makeUser({ id: 'other', name: 'Original', email: 'new@example.com', role: 40 }); await settle();
  expect(document.querySelector<HTMLInputElement>('[aria-label=Name]')?.value).toBe('Original'); expect(document.querySelector<HTMLInputElement>('[aria-label=Email]')?.value).toBe('new@example.com');
  expect(document.querySelector<HTMLSelectElement>('[aria-label=Role]')?.value).toBe('40'); expect(button('Save Changes')?.disabled).toBe(true);
});
it('detail displays passkey metadata and Source unnamed and device-bound labels', async () => {
  const { target, state } = await render(); expect(target.textContent).toContain('Passkeys (1)'); expect(target.textContent).toContain('My Passkey'); expect(target.textContent).toContain('Synced');
  state.user = makeUser({ id: 'other', credentials: [{ id: 'cred-1', name: null, deviceType: 'singleDevice', createdAt: '2025-01-01T00:00:00Z', lastUsedAt: '2025-01-02T00:00:00Z' }] }); await settle();
  expect(target.textContent).toContain('Unnamed passkey'); expect(target.textContent).toContain('Device-bound');
});
it('recovery preserves pending, sent and failure presentation from supplied Source props', async () => {
  const { target, state } = await render({ onSendRecovery: vi.fn(), isSendingRecovery: true }); expect(button('Sending...')?.disabled).toBe(true);
  state.isSendingRecovery = false; state.recoverySent = true; await settle(); expect(target.textContent).toContain('Recovery link sent to test@example.com');
  button('Send Recovery Link')!.click(); expect(state.onSendRecovery).toHaveBeenCalledOnce(); state.recoveryError = 'Email unavailable'; await settle(); expect(target.textContent).toContain('Email unavailable');
});
