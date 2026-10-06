// Test database teardown uses this process-local registry to drain tasks that
// run without request middleware. Keep it on globalThis so duplicated SSR
// chunks and their test helpers observe the same task set.
const DEFERRED_TASKS_KEY = Symbol.for("emdash:deferred-tasks");
const deferredTasks = 
// eslint-disable-next-line typescript/no-unsafe-type-assertion -- globalThis singleton pattern
globalThis[DEFERRED_TASKS_KEY] ??
    (() => {
        const tasks = new Set();
        globalThis[DEFERRED_TASKS_KEY] = tasks;
        return tasks;
    })();
export function trackDeferredTask(promise) {
    let tracked;
    tracked = promise.finally(() => deferredTasks.delete(tracked));
    deferredTasks.add(tracked);
    return tracked;
}
export async function waitForDeferredTasks() {
    while (deferredTasks.size > 0) {
        await Promise.allSettled(deferredTasks);
    }
}
export function createDeferredTaskTracker(onSettled) {
    let pending = 0;
    let responseSettled = false;
    let completed = false;
    let resolveSettled;
    const settled = new Promise((resolve) => {
        resolveSettled = resolve;
    });
    const completeIfSettled = () => {
        if (completed || !responseSettled || pending > 0)
            return;
        completed = true;
        try {
            onSettled();
        }
        finally {
            resolveSettled();
        }
    };
    return {
        settled,
        track(promise) {
            pending++;
            return promise.finally(() => {
                // A task may register another after() call before it settles. The
                // counter therefore reaches zero only after the full task chain ends.
                pending--;
                completeIfSettled();
            });
        },
        settle() {
            responseSettled = true;
            completeIfSettled();
        },
    };
}
