import { afterEach, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount, type Component } from 'svelte';
import Dashboard from '../../src/lib/dashboard/Dashboard.svelte';
import WelcomeModal from '../../src/lib/dashboard/WelcomeModal.svelte';
import { fixtureQueryClient, clearFixtureQueryClients } from '../helpers/dashboard-welcome/query-fixture';

const mounted: ReturnType<typeof mount>[] = [];
afterEach(async () => { for (const instance of mounted.splice(0)) await unmount(instance); clearFixtureQueryClients(); document.body.replaceChildren(); });
async function render<Props extends Record<string, unknown>>(component: Component<Props>, props: Props) {
  const target = document.createElement('div'); document.body.append(target);
  mounted.push(flushSync(() => mount(component, { target, props: { ...props, queryClient: fixtureQueryClient() } })));
  await tick(); return target;
}
const manifest = { collections: {}, plugins: {} };
const stats = { collections: [], mediaCount: 7, userCount: 2, recentItems: [] };
function client() { return {
  fetchDashboardStats: vi.fn(async () => stats),
  fetchTransferCapabilities: vi.fn(async () => ({ portableDomain: { empty: false } })),
  dismissScheduledPolicyRejection: vi.fn(async () => {})
}; }

it('native welcome uses the supplied configured site name and a labelled modal', async () => {
  const target = await render(WelcomeModal, { open: true, onClose: vi.fn(), userName: 'Alice Smith', userRole: 30, siteName: 'Cedar Journal', dismissWelcome: vi.fn(async () => {}) });
  expect(target.querySelector('[role=dialog]')?.getAttribute('aria-modal')).toBe('true');
  expect(target.querySelector('h2')?.textContent).toBe('Welcome to Cedar Journal, Alice!');
});

it('native welcome keeps a pending dismissal disabled and closes after a server error', async () => {
  let reject!: (error: Error) => void;
  const dismissWelcome = vi.fn(() => new Promise<void>((_resolve, decline) => { reject = decline; }));
  const onClose = vi.fn();
  const target = await render(WelcomeModal, { open: true, userRole: 40, dismissWelcome, onClose });
  const button = [...target.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === 'Get Started');
  expect(button).toBeDefined(); button!.click(); await tick();
  expect(button!.disabled).toBe(true); expect(onClose).not.toHaveBeenCalled();
  reject(new Error('Storage unavailable')); await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(dismissWelcome).toHaveBeenCalledTimes(1);
});

it('native welcome handles Escape dismissal and restores the previous focus', async () => {
  const previous = document.createElement('button'); previous.textContent = 'Account'; document.body.append(previous); previous.focus();
  const dismissWelcome = vi.fn(async () => {}), onClose = vi.fn();
  const target = await render(WelcomeModal, { open: true, userRole: 10, dismissWelcome, onClose });
  expect(target.contains(document.activeElement)).toBe(true);
  target.querySelector('[role=dialog]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(dismissWelcome).toHaveBeenCalledTimes(1);
  for (const instance of mounted.splice(0)) await unmount(instance);
  expect(document.activeElement).toBe(previous);
});

it('native dashboard exposes an unavailable response without inventing zero counts', async () => {
  const api = client(); api.fetchDashboardStats.mockRejectedValue(new Error('Storage unavailable'));
  const target = await render(Dashboard, { manifest, client: api, user: { role: 50 } });
  await vi.waitFor(() => expect(target.textContent).toContain('Could not load dashboard data'));
  expect(target.querySelector('[data-testid=dashboard-metric-value]')).toBeNull();
  expect(target.querySelector('h2')).toBeNull();
});

it('native dashboard retains loaded counts while a focus refresh fails', async () => {
  const api = client();
  const target = await render(Dashboard, { manifest, client: api, user: { role: 50 } });
  await vi.waitFor(() => expect(target.querySelector('[data-testid=dashboard-metric-value]')).not.toBeNull());
  api.fetchDashboardStats.mockRejectedValue(new Error('Storage unavailable'));
  window.dispatchEvent(new Event('focus'));
  await vi.waitFor(() => expect(target.textContent).toContain('Could not load dashboard data'));
  expect([...target.querySelectorAll('[data-testid=dashboard-metric-value]')].map(node => node.textContent?.trim())).toEqual(['0', '7', '2']);
});
