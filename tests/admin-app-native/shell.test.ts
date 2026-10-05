import { afterEach, expect, it, vi } from 'vitest';
import { flushSync, mount, settled, tick, unmount } from 'svelte';
import NativeAppHost from '../helpers/admin-app/NativeAppHost.svelte';
import { createDashboardQueryClient } from '../../src/lib/dashboard/query.svelte';
import { lifecycleState } from '../helpers/dashboard-welcome/lifecycle-state.svelte';
const instances: ReturnType<typeof mount>[] = [];
afterEach(async () => { for (const instance of instances.splice(0)) await unmount(instance); document.body.replaceChildren(); localStorage.clear(); });
const user = { id: 'ordinary-user-fixture', email: 'alice@example.test', name: 'Alice Editor', avatarUrl: null, role: 30, isFirstLogin: true };
async function render(state: any, queryClient = createDashboardQueryClient()) {
 const target = document.createElement('div'); document.body.append(target);
 const instance = flushSync(() => mount(NativeAppHost, { target, props: { state, queryClient } }));
 instances.push(instance); await settled(); await vi.waitFor(() => { if (!target.querySelector("main")) throw new Error("Actual WorkspaceShell mount not ready"); }); return { target, instance, queryClient };
}
it('the application shell loads one shared current-user query with Source key and freshness', async () => {
 const currentUser = vi.fn(async () => ({ ...user, isFirstLogin: false }));
 const queryClient = createDashboardQueryClient();
 await render({ currentUserClient: { currentUser } }, queryClient);
 await vi.waitFor(() => expect(currentUser).toHaveBeenCalledTimes(1));
 const query = queryClient.getQueryCache().find({ queryKey: ['currentUser'] })!;
 expect([query.state.data, (query.options as { staleTime?: number }).staleTime, query.options.retry]).toEqual([{ ...user, isFirstLogin: false }, 300_000, false]);
 await render({ currentUserClient: { currentUser } }, queryClient);
 expect(currentUser).toHaveBeenCalledTimes(1);
});
it('first-login opens the actual welcome modal and dismissal updates the shared user', async () => {
 const dismissWelcome = vi.fn(async () => {}), queryClient = createDashboardQueryClient();
 queryClient.setQueryData(['currentUser'], user);
 const { target } = await render({ currentUserClient: { currentUser: vi.fn(async () => user), dismissWelcome } }, queryClient);
 await vi.waitFor(() => expect(target.querySelector('[role=dialog]')?.textContent).toContain('Alice'));
 target.querySelector<HTMLButtonElement>('button.primary')!.click();
 await vi.waitFor(() => expect(dismissWelcome).toHaveBeenCalledTimes(1));
 await vi.waitFor(() => expect(target.querySelector('[role=dialog]')).toBeNull());
 expect(queryClient.getQueryData(['currentUser'])).toEqual({ ...user, isFirstLogin: false });
});
it('editor toolbar flags and labels follow shared user role changes', async () => {
 const queryClient = createDashboardQueryClient(); queryClient.setQueryData(['currentUser'], { ...user, isFirstLogin: false });
 localStorage.setItem('emdash-toolbar-dismissed', '1');
 await render({ currentUserClient: { currentUser: vi.fn(async () => user) } }, queryClient);
 await vi.waitFor(() => expect(localStorage.getItem('emdash-editor')).toBe('1'));
 expect([JSON.parse(localStorage.getItem('emdash-toolbar-labels')!), localStorage.getItem('emdash-toolbar-dismissed')]).toEqual([{ editMode: 'Edit', hideToolbar: 'Hide toolbar' }, null]);
 queryClient.setQueryData(['currentUser'], { ...user, role: 20, isFirstLogin: false });
 await vi.waitFor(() => expect([localStorage.getItem('emdash-editor'), localStorage.getItem('emdash-toolbar-labels')]).toEqual([null, null]));
});
it('closing a failed welcome dismissal stays closed until first-login changes again', async () => {
 const queryClient = createDashboardQueryClient(); queryClient.setQueryData(['currentUser'], user);
 const state = lifecycleState({ currentUserClient: { currentUser: vi.fn(async () => user), dismissWelcome: vi.fn(async () => { throw Error('Ordinary UI failure'); }) } });
 const { target } = await render(state, queryClient);
 await vi.waitFor(() => expect(target.querySelector('[role=dialog]')).not.toBeNull());
 target.querySelector<HTMLButtonElement>('button.primary')!.click();
 await vi.waitFor(() => expect(target.querySelector('[role=dialog]')).toBeNull());
 queryClient.setQueryData(['currentUser'], { ...user, name: 'Alice Changed' }); await tick();
 expect(target.querySelector('[role=dialog]')).toBeNull();
 queryClient.setQueryData(['currentUser'], { ...user, isFirstLogin: false }); await tick();
 queryClient.setQueryData(['currentUser'], user);
 await vi.waitFor(() => expect(target.querySelector('[role=dialog]')).not.toBeNull());
});
it('separate application providers do not share current-user data', async () => {
 const first = await render({ currentUserClient: { currentUser: vi.fn(async () => ({ ...user, isFirstLogin: false })) } });
 const second = await render({ currentUserClient: { currentUser: vi.fn(async () => ({ ...user, id: 'second-fixture', name: 'Bob', isFirstLogin: false })) } });
 await vi.waitFor(() => expect(first.queryClient.getQueryData(['currentUser'])).toEqual({ ...user, isFirstLogin: false }));
 await vi.waitFor(() => expect(second.queryClient.getQueryData(['currentUser'])).toEqual({ ...user, id: 'second-fixture', name: 'Bob', isFirstLogin: false }));
 expect(first.queryClient).not.toBe(second.queryClient);
});

async function renderWithRootDefaults(state: any) {
 const target = document.createElement('div'); document.body.append(target);
 let queryClient!: ReturnType<typeof createDashboardQueryClient>;
 const instance = flushSync(() => mount(NativeAppHost, { target, props: { state, onQueryClient: (client: ReturnType<typeof createDashboardQueryClient>) => { queryClient = client; } } }));
 instances.push(instance); await settled();
 await vi.waitFor(() => { if (!target.querySelector('main')) throw new Error('Actual WorkspaceShell mount not ready'); });
 return { target, queryClient };
}
it('the real root layout shares a default current-user cache across mounted consumers', async () => {
 const currentUser = vi.fn(async () => ({ ...user, isFirstLogin: false }));
 const state = lifecycleState({ currentUserClient: { currentUser }, showSecond: false });
 const { queryClient } = await renderWithRootDefaults(state);
 await vi.waitFor(() => expect(queryClient.getQueryData(['currentUser'])).toEqual({ ...user, isFirstLogin: false }));
 state.showSecond = true; await settled();
 await vi.waitFor(() => expect(queryClient.getQueryCache().find({ queryKey: ['currentUser'] })!.getObserversCount()).toBe(2));
 expect(currentUser).toHaveBeenCalledTimes(1);
});
it('two actual root layouts create isolated default current-user caches', async () => {
 const first = await renderWithRootDefaults({ currentUserClient: { currentUser: vi.fn(async () => ({ ...user, isFirstLogin: false })) } });
 const second = await renderWithRootDefaults({ currentUserClient: { currentUser: vi.fn(async () => ({ ...user, id: 'root-second', name: 'Bob', isFirstLogin: false })) } });
 await vi.waitFor(() => expect(first.queryClient.getQueryData(['currentUser'])).toEqual({ ...user, isFirstLogin: false }));
 await vi.waitFor(() => expect(second.queryClient.getQueryData(['currentUser'])).toEqual({ ...user, id: 'root-second', name: 'Bob', isFirstLogin: false }));
 expect(first.queryClient).not.toBe(second.queryClient);
});

it('the actual content picker uses the root layout cache when no client is supplied', async () => {
 const pickerClient = { fetchCollections: vi.fn(async () => []), fetchManifest: vi.fn(async () => ({ collections: {} })), fetchContentList: vi.fn(async () => ({ items: [], total: 0 })) };
 const { queryClient } = await renderWithRootDefaults({ currentUserClient: { currentUser: vi.fn(async () => ({ ...user, isFirstLogin: false })) }, pickerClient });
 await vi.waitFor(() => expect(queryClient.getQueryCache().find({ queryKey: ['manifest'] })).toBeDefined());
 expect(queryClient.getQueryCache().find({ queryKey: ['collections'] })).toBeDefined();
 expect([pickerClient.fetchCollections.mock.calls.length, pickerClient.fetchManifest.mock.calls.length, pickerClient.fetchContentList.mock.calls.length]).toEqual([0, 0, 0]);
});

it('a retained root keeps failed welcome dismissal closed across page shell remounts', async () => {
 const state = lifecycleState({ showShell: true, currentUserClient: { currentUser: vi.fn(async () => user), dismissWelcome: vi.fn(async () => { throw Error('Ordinary welcome fixture'); }) } });
 const { target, queryClient } = await renderWithRootDefaults(state);
 await vi.waitFor(() => expect(target.querySelector('[role=dialog]')).not.toBeNull());
 target.querySelector<HTMLButtonElement>('button.primary')!.click();
 await vi.waitFor(() => expect(target.querySelector('[role=dialog]')).toBeNull());
 state.showShell = false; await settled(); await vi.waitFor(() => expect(target.querySelector('main')).toBeNull());
 state.showShell = true; await settled(); await vi.waitFor(() => expect(target.querySelector('main')).not.toBeNull());
 expect(target.querySelector('[role=dialog]')).toBeNull();
 expect(queryClient.getQueryData(['currentUser'])).toEqual(user);
});
it('a retained root preserves toolbar effect lifetime across page shell remounts', async () => {
 const state = lifecycleState({ showShell: true, currentUserClient: { currentUser: vi.fn(async () => ({ ...user, isFirstLogin: false })) } });
 const { target } = await renderWithRootDefaults(state);
 await vi.waitFor(() => expect(localStorage.getItem('emdash-editor')).toBe('1'));
 localStorage.setItem('emdash-toolbar-dismissed', '1');
 state.showShell = false; await settled(); await vi.waitFor(() => expect(target.querySelector('main')).toBeNull());
 state.showShell = true; await settled(); await vi.waitFor(() => expect(target.querySelector('main')).not.toBeNull());
 expect(localStorage.getItem('emdash-toolbar-dismissed')).toBe('1');
});
