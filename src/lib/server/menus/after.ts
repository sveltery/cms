// Native host substitution for Source after.ts, pinned EmDash 1.1.0.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import { trackDeferredTask } from '../redirects/deferred-tasks.ts';
import { getRequestContext } from './context.ts';
export function after(fn: () => void | Promise<void>): void {
  const context = getRequestContext();
  const task = Promise.resolve().then(fn).catch(error => {
    console.error('[emdash] deferred task failed:', error);
  });
  const requestTask = context?.deferredTasks?.track(task) ?? task;
  const tracked = trackDeferredTask(requestTask);
  context?.keepAlive?.(tracked);
}
