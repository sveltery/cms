import { trackDeferredTask } from './deferred-tasks.ts';

export function after(fn: () => void | Promise<void>, keepAlive?: (task: Promise<void>) => void): void {
  const task = trackDeferredTask(Promise.resolve().then(fn).catch(error => {
    console.error('[emdash] deferred task failed:', error);
  }));
  keepAlive?.(task);
}
