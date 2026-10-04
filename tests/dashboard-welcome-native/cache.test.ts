import { afterEach, expect, it, vi } from 'vitest';
import { onlineManager } from '@tanstack/react-query';
import { flushSync, mount, tick, unmount, type Component } from 'svelte';
import Dashboard from '../../src/lib/dashboard/Dashboard.svelte';
import WelcomeModal from '../../src/lib/dashboard/WelcomeModal.svelte';
import DashboardHost from '../helpers/dashboard-welcome/DashboardLifecycleHost.svelte';
import { lifecycleState } from '../helpers/dashboard-welcome/lifecycle-state.svelte.ts';
import { fixtureQueryClient, clearFixtureQueryClients } from '../helpers/dashboard-welcome/query-fixture';
import type { DashboardStats } from '../../src/lib/dashboard/types';

// These ordinary DOM/promise fixtures mount the actual current Svelte library.
// They do not call protected HTTP, create sessions, or supply fake product data.
const mounted: ReturnType<typeof mount>[] = [];
afterEach(async () => {
  for (const instance of mounted.splice(0)) await unmount(instance);
  clearFixtureQueryClients(); onlineManager.setOnline(true);
  document.body.replaceChildren();
});
async function render<Props extends Record<string, unknown>>(component: Component<Props>, props: Props) {
  const target = document.createElement('div'); document.body.append(target);
  const instance = flushSync(() => mount(component, { target, props }));
  mounted.push(instance); await tick(); return { target, instance };
}
async function remove(instance: ReturnType<typeof mount>) {
  mounted.splice(mounted.indexOf(instance), 1); await unmount(instance);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const manifest = { collections: {}, plugins: {} };
const stats = (mediaCount = 7): DashboardStats => ({ collections: [], mediaCount, userCount: 2, recentItems: [] });
function api() { return {
  fetchDashboardStats: vi.fn(async () => stats()),
  fetchTransferCapabilities: vi.fn(async () => ({ portableDomain: { empty: true } })),
  dismissScheduledPolicyRejection: vi.fn(async () => {})
}; }
const metrics = (target: HTMLElement) => [...target.querySelectorAll('[data-testid=dashboard-metric-value]')].map(node => node.textContent?.trim());
const loaded = (target: HTMLElement) => vi.waitFor(() => expect(target.querySelector('[data-testid=dashboard-metric-value]')).not.toBeNull());

it('fresh shared dashboard data renders immediately without another request', async () => {
  const queryClient = fixtureQueryClient(60_000), client = api();
  queryClient.setQueryData(['dashboard-stats'], stats(5));
  const { target } = await render(Dashboard, { manifest, user: { role: 40 }, client, ...{ queryClient } });
  await loaded(target);
  expect([client.fetchDashboardStats.mock.calls.length, metrics(target)]).toEqual([0, ['0', '5', '2']]);
});

it('two dashboards share one pending stats request and both receive its data', async () => {
  const queryClient = fixtureQueryClient(60_000), client = api(), request = deferred<DashboardStats>();
  client.fetchDashboardStats.mockImplementation(() => request.promise);
  const first = await render(Dashboard, { manifest, client, ...{ queryClient } });
  const second = await render(Dashboard, { manifest, client, ...{ queryClient } });
  const requestsWhilePending = client.fetchDashboardStats.mock.calls.length;
  request.resolve(stats(8)); await loaded(first.target); await loaded(second.target);
  expect([requestsWhilePending, metrics(first.target), metrics(second.target)]).toEqual([1, ['0', '8', '2'], ['0', '8', '2']]);
});

it('a remounted dashboard uses fresh data from the same application cache', async () => {
  const queryClient = fixtureQueryClient(60_000), client = api();
  const first = await render(Dashboard, { manifest, client, ...{ queryClient } });
  await loaded(first.target); await remove(first.instance);
  const second = await render(Dashboard, { manifest, client, ...{ queryClient } }); await loaded(second.target);
  expect([client.fetchDashboardStats.mock.calls.length, metrics(second.target)]).toEqual([1, ['0', '7', '2']]);
});

it('an unobserved request that does not consume AbortSignal completes into the shared cache', async () => {
  const queryClient = fixtureQueryClient(60_000), client = api(), request = deferred<DashboardStats>();
  client.fetchDashboardStats.mockImplementation(() => request.promise);
  const first = await render(Dashboard, { manifest, client, ...{ queryClient } });
  await remove(first.instance); request.resolve(stats(8)); await request.promise;
  await vi.waitFor(() => expect(queryClient.getQueryData(['dashboard-stats'])).toEqual(stats(8)));
});

it('retained role changes reuse fresh capability data when the import hint becomes eligible again', async () => {
  const queryClient = fixtureQueryClient(60_000), client = api(); client.fetchDashboardStats.mockResolvedValue(stats(0));
  const state = lifecycleState({ manifest, user: { role: 50 }, client, queryClient });
  const { target } = await render(DashboardHost, { state });
  await vi.waitFor(() => expect(target.textContent).toContain('Moving from another EmDash site?'));
  state.user = { role: 40 }; await tick();
  await vi.waitFor(() => expect(target.textContent).not.toContain('Moving from another EmDash site?'));
  state.user = { role: 50 }; await tick();
  await vi.waitFor(() => expect(target.textContent).toContain('Moving from another EmDash site?'));
  expect([client.fetchDashboardStats.mock.calls.length, client.fetchTransferCapabilities.mock.calls.length]).toEqual([1, 1]);
});

async function dismissAndRefreshBoth(fails: boolean) {
  const queryClient = fixtureQueryClient(60_000), client = api();
  const blocked = { ...stats(1), policyRejectedScheduled: 1, policyRejections: [{ collection: 'posts', id: 'item', pluginId: 'policy', reason: 'Needs review', rejectedAt: '2026-01-01T00:00:00Z', _rev: 'rev-1' }] };
  client.fetchDashboardStats.mockResolvedValue(blocked);
  const first = await render(Dashboard, { manifest, user: { role: 40 }, client, ...{ queryClient } });
  const second = await render(Dashboard, { manifest, user: { role: 40 }, client, ...{ queryClient } });
  await loaded(first.target); await loaded(second.target);
  client.fetchDashboardStats.mockResolvedValue(stats(9));
  if (fails) client.dismissScheduledPolicyRejection.mockRejectedValue(new Error('Policy unavailable'));
  [...first.target.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Dismiss')!.click();
  await vi.waitFor(() => expect(metrics(first.target)).toEqual(['0', '9', '2']));
  expect([metrics(second.target), client.dismissScheduledPolicyRejection.mock.calls]).toEqual([['0', '9', '2'], [['posts', 'item', 'rev-1']]]);
  if (fails) expect(first.target.textContent).toContain('Policy unavailable');
}
it('successful policy dismissal refreshes every active dashboard observer', async () => { await dismissAndRefreshBoth(false); });
it('failed policy dismissal still refreshes every active dashboard observer', async () => { await dismissAndRefreshBoth(true); });

it('repeated ordinary native focus events deduplicate a pending background refresh', async () => {
  const queryClient = fixtureQueryClient(), client = api();
  const { target } = await render(Dashboard, { manifest, client, ...{ queryClient } }); await loaded(target);
  const request = deferred<DashboardStats>(); client.fetchDashboardStats.mockImplementation(() => request.promise);
  window.dispatchEvent(new Event('focus')); await tick();
  window.dispatchEvent(new Event('focus')); await tick();
  const requestsWhilePending = client.fetchDashboardStats.mock.calls.length;
  request.resolve(stats(8)); await vi.waitFor(() => expect(metrics(target)).toEqual(['0', '8', '2']));
  expect(requestsWhilePending).toBe(2);
});

it('shared invalidation keeps the newer response after an older background response arrives late', async () => {
  const queryClient = fixtureQueryClient(), client = api();
  const { target } = await render(Dashboard, { manifest, client, ...{ queryClient } }); await loaded(target);
  const older = deferred<DashboardStats>(), newer = deferred<DashboardStats>();
  client.fetchDashboardStats.mockImplementationOnce(() => older.promise).mockImplementationOnce(() => newer.promise);
  window.dispatchEvent(new Event('focus')); await tick();
  const invalidation = queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
  await vi.waitFor(() => expect(client.fetchDashboardStats).toHaveBeenCalledTimes(3));
  newer.resolve(stats(9)); await invalidation;
  await vi.waitFor(() => expect(metrics(target)).toEqual(['0', '9', '2']));
  older.resolve(stats(5)); await older.promise; await tick();
  expect([queryClient.getQueryData(['dashboard-stats']), metrics(target)]).toEqual([stats(9), ['0', '9', '2']]);
});

it('successful welcome dismissal clears first-login only in the existing shared user profile', async () => {
  const queryClient = fixtureQueryClient(), onClose = vi.fn();
  const user = { id: 'fixture-user', email: 'reader@example.test', name: 'Alice', role: 30, avatarUrl: null, isFirstLogin: true };
  queryClient.setQueryData(['currentUser'], user);
  const { target } = await render(WelcomeModal, { open: true, userRole: 30, onClose, dismissWelcome: vi.fn(async () => {}), ...{ queryClient } });
  target.querySelector<HTMLButtonElement>('button.primary')!.click();
  await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(queryClient.getQueryData(['currentUser'])).toEqual({ ...user, isFirstLogin: false });
});

it('failed welcome dismissal closes while preserving the existing shared user profile', async () => {
  const queryClient = fixtureQueryClient(), onClose = vi.fn();
  const user = { id: 'fixture-user', isFirstLogin: true }; queryClient.setQueryData(['currentUser'], user);
  const { target } = await render(WelcomeModal, { open: true, userRole: 30, onClose, dismissWelcome: vi.fn(async () => { throw new Error('Unavailable'); }), ...{ queryClient } });
  target.querySelector<HTMLButtonElement>('button.primary')!.click();
  await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(queryClient.getQueryData(['currentUser'])).toEqual(user);
});

it('Source visibility changes refetch stale stats but leave fresh stats in the cache', async () => {
  const queryClient = fixtureQueryClient(60_000), client = api();
  queryClient.setQueryData(['dashboard-stats'], stats(5));
  const { target } = await render(Dashboard, { manifest, client, ...{ queryClient } }); await loaded(target);
  window.dispatchEvent(new Event('visibilitychange')); await tick();
  expect([client.fetchDashboardStats.mock.calls.length, metrics(target)]).toEqual([0, ['0', '5', '2']]);
  queryClient.setQueryData(['dashboard-stats'], stats(5), { updatedAt: Date.now() - 60_001 });
  window.dispatchEvent(new Event('visibilitychange'));
  await vi.waitFor(() => expect(metrics(target)).toEqual(['0', '7', '2']));
  expect(client.fetchDashboardStats).toHaveBeenCalledTimes(1);
});

it('an offline pending stats query waits for connectivity before making its first request', async () => {
  const queryClient = fixtureQueryClient(60_000), client = api(); onlineManager.setOnline(false);
  const { target } = await render(Dashboard, { manifest, client, ...{ queryClient } });
  expect(client.fetchDashboardStats).not.toHaveBeenCalled();
  onlineManager.setOnline(true); await loaded(target);
  expect([client.fetchDashboardStats.mock.calls.length, metrics(target)]).toEqual([1, ['0', '7', '2']]);
});


it('native policy dismissal retains generic non-Error feedback while awaiting the stats refresh', async () => {
  const queryClient = fixtureQueryClient(60_000), client = api();
  const blocked = { ...stats(1), policyRejectedScheduled: 1, policyRejections: [{ collection: 'posts', id: 'item', pluginId: 'policy', reason: 'Needs review', rejectedAt: '2026-01-01T00:00:00Z', _rev: 'rev-1' }] };
  client.fetchDashboardStats.mockResolvedValue(blocked);
  const { target } = await render(Dashboard, { manifest, user: { role: 40 }, client, ...{ queryClient } });
  await loaded(target);
  const refresh = deferred<DashboardStats>(); client.fetchDashboardStats.mockImplementation(() => refresh.promise);
  client.dismissScheduledPolicyRejection.mockRejectedValue({ code: 'policy_unavailable' });
  const button = [...target.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent === 'Dismiss')!;
  button.click(); await vi.waitFor(() => expect(client.fetchDashboardStats).toHaveBeenCalledTimes(2));
  expect(button.disabled).toBe(true);
  refresh.resolve({ ...blocked, mediaCount: 9 });
  await vi.waitFor(() => expect(target.textContent).toContain('An error occurred'));
  await vi.waitFor(() => expect(button.disabled).toBe(false));
  expect([metrics(target), client.dismissScheduledPolicyRejection.mock.calls]).toEqual([['0', '9', '2'], [['posts', 'item', 'rev-1']]]);
});
