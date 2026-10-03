import { trackDeferredTask } from './deferred-tasks.ts';

export function after(fn: () => void | Promise<void>, keepAlive?: (task: Promise<void>) => void): void {
  const task = trackDeferredTask(Promise.resolve().then(fn).catch(error => {
    console.error('[emdash] deferred task failed:', error);
  }));
  // Source hands the host its already-queued task in a separate microtask.
  // A throwing host handoff cannot synchronously report a failed committed save.
  if(keepAlive)void Promise.resolve().then(()=>keepAlive(task));
}
