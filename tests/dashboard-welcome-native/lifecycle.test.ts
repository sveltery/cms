import { afterEach, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount, type Component } from 'svelte';
import DashboardHost from '../helpers/dashboard-welcome/DashboardLifecycleHost.svelte';
import WelcomeHost from '../helpers/dashboard-welcome/WelcomeLifecycleHost.svelte';
import { lifecycleState } from '../helpers/dashboard-welcome/lifecycle-state.svelte.ts';

const mounted: ReturnType<typeof mount>[] = [];
afterEach(async () => {
  for (const instance of mounted.splice(0)) await unmount(instance);
  vi.unstubAllGlobals(); document.body.replaceChildren();
});
async function render<State extends Record<string, unknown>>(component: Component<{ state: State }>, state: State) {
  const target = document.createElement('div'); document.body.append(target);
  mounted.push(flushSync(() => mount(component, { target, props: { state } })));
  await tick(); return target;
}
const manifest = { collections: {}, plugins: {} };
const emptyStats = { collections: [], mediaCount: 0, userCount: 1, recentItems: [] };
function client() { return {
  fetchDashboardStats: vi.fn(async () => emptyStats),
  fetchTransferCapabilities: vi.fn(async () => ({ portableDomain: { empty: true } })),
  dismissScheduledPolicyRejection: vi.fn(async () => {})
}; }

it('native import suggestion retries eligibility after a transient failure on ordinary focus refresh', async () => {
  const api = client();
  api.fetchTransferCapabilities.mockRejectedValueOnce(new Error('Temporarily unavailable'));
  const state = lifecycleState({ manifest, user: { role: 50 }, client: api });
  const target = await render(DashboardHost, state);
  await vi.waitFor(() => expect(api.fetchTransferCapabilities).toHaveBeenCalledTimes(1));
  expect(target.textContent).not.toContain('Moving from another EmDash site?');
  window.dispatchEvent(new Event('focus'));
  await vi.waitFor(() => expect(api.fetchDashboardStats).toHaveBeenCalledTimes(2));
  await vi.waitFor(() => expect(api.fetchTransferCapabilities).toHaveBeenCalledTimes(2));
  await vi.waitFor(() => expect(target.textContent).toContain('Moving from another EmDash site?'));
});

it('native import eligibility reacts to an administrator arriving after stats on the same mounted component', async () => {
  const api = client();
  const state = lifecycleState<{ manifest: typeof manifest; user?: { role: number }; client: ReturnType<typeof client> }>({ manifest, user: undefined, client: api });
  const target = await render(DashboardHost, state);
  await vi.waitFor(() => expect(target.textContent).toContain('Media files'));
  expect(api.fetchTransferCapabilities).not.toHaveBeenCalled();
  state.user = { role: 50 }; await tick();
  await vi.waitFor(() => expect(api.fetchTransferCapabilities).toHaveBeenCalledTimes(1));
  expect(api.fetchDashboardStats).toHaveBeenCalledTimes(1);
  await vi.waitFor(() => expect(target.textContent).toContain('Moving from another EmDash site?'));
});

it('native retained welcome captures focus on opening and restores it on closing', async () => {
  const previous = document.createElement('button'); previous.textContent = 'Account'; document.body.append(previous); previous.focus();
  const state = lifecycleState({ open: false, onClose: vi.fn(), userRole: 30, dismissWelcome: vi.fn(async () => {}) });
  const target = await render(WelcomeHost, state);
  state.open = true; await tick();
  const focusedOnOpen = target.contains(document.activeElement);
  // An ordinary user can focus a dialog button even when automatic initial
  // focus is missing. Do so to observe closing independently of opening.
  target.querySelector<HTMLButtonElement>('button')!.focus();
  state.open = false; await tick();
  const restoredOnClose = document.activeElement === previous;
  expect([focusedOnOpen, restoredOnClose]).toEqual([true, true]);
});

it('native default dashboard and welcome clients use the configured API base without client overrides', async () => {
  const calls: { path: string; init?: RequestInit }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
    calls.push({ path, init });
    return new Response(JSON.stringify({ success: true, data: path.endsWith('/dashboard') ? emptyStats : { success: true } }), { status: 200 });
  }));
  await render(DashboardHost, lifecycleState({ manifest, user: { role: 40 }, basePath: '/cms' }));
  const onClose = vi.fn();
  const target = await render(WelcomeHost, lifecycleState({ open: true, onClose, userRole: 30, basePath: '/cms' }));
  target.querySelector<HTMLButtonElement>('button.primary')!.click();
  await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(calls.map(call => call.path)).toEqual(['/cms/api/dashboard', '/cms/api/auth/me']);
  expect(calls.map(call => new Headers(call.init?.headers).get('X-EmDash-Request'))).toEqual(['1', '1']);
  expect(calls[1].init?.body).toBe(JSON.stringify({ action: 'dismissWelcome' }));
});
