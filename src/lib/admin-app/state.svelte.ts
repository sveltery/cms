// Preserve the lifetime of pinned Source Shell.tsx state/effects while native
// pages mount their own shells. Copyright 2026 Cloudflare Inc. MIT.
// notices/emdash-MIT.txt. Only the context key is module-scoped; every provider
// creates fresh state, including every actual server render.
import { getContext, setContext } from 'svelte';
import type { CurrentUser } from '../dashboard/types';
export type ToolbarLabels = { editMode: string; hideToolbar: string };
interface ShellStateValues {
 welcomeOpen: boolean; firstLogin: boolean | undefined;
 toolbarUser: CurrentUser | undefined; toolbarLabels: ToolbarLabels | undefined; toolbarLocale: string | undefined;
}
const contextKey = Symbol('sveltery-admin-shell-state');
export function createAdminShellState() {
 let value = $state.raw<ShellStateValues>({ welcomeOpen: false, firstLogin: undefined, toolbarUser: undefined, toolbarLabels: undefined, toolbarLocale: undefined });
 function update(patch: Partial<ShellStateValues>) { value = { ...value, ...patch }; }
 return {
  get welcomeOpen() { return value.welcomeOpen; },
  observeFirstLogin(firstLogin: boolean | undefined) {
   if (value.firstLogin === firstLogin) return;
   update({ firstLogin, welcomeOpen: firstLogin ? true : value.welcomeOpen });
  },
  closeWelcome() { update({ welcomeOpen: false }); },
  shouldUpdateToolbar(user: CurrentUser, labels: ToolbarLabels, locale: string): boolean {
   if (value.toolbarUser === user && value.toolbarLocale === locale && value.toolbarLabels?.editMode === labels.editMode && value.toolbarLabels.hideToolbar === labels.hideToolbar) return false;
   update({ toolbarUser: user, toolbarLabels: { ...labels }, toolbarLocale: locale });
   return true;
  }
 };
}
export type AdminShellState = ReturnType<typeof createAdminShellState>;
export function provideAdminShellState(state: AdminShellState): void { setContext(contextKey, state); }
export function resolveAdminShellState(): AdminShellState { return getContext<AdminShellState | undefined>(contextKey) ?? createAdminShellState(); }
