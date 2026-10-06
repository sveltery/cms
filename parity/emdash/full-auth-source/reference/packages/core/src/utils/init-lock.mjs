/**
 * Reclaimable initialization lock for isolate-lifetime singletons.
 *
 * Guards "first request initializes, everyone else waits" sections
 * (runtime creation, database init) against a workerd failure mode: if the
 * request that owns the initialization is cancelled mid-await (client
 * disconnect, context teardown), its continuation — including any `finally`
 * that would release the lock — never runs. A plain boolean or shared
 * promise then stays stuck forever and every subsequent request in the
 * isolate hangs until the platform kills it (observed as 524s at the
 * 100-second wall limit, with the isolate poisoned until eviction).
 *
 * This lock instead records *when* the owner started. Waiters poll — we
 * deliberately never await a promise created by another request, which
 * workerd flags — and if the owner has held the lock past `deadlineMs`,
 * the next waiter assumes the owner is dead, reclaims the lock, and runs
 * the initialization itself. Waiters also give up after `maxWaitMs` so a
 * request degrades to an error response rather than hanging.
 */
export function createInitLock() {
    return { ownerStartedAt: null, generation: 0 };
}
const DEFAULT_DEADLINE_MS = 15_000;
const DEFAULT_POLL_MS = 50;
const MAX_WAIT_HEADROOM_MS = 15_000;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Return the cached value if present, otherwise initialize it under the
 * lock. `init` is responsible for storing the value so that `getCached`
 * returns it on subsequent calls — waiters re-check `getCached` after the
 * owner finishes rather than sharing the owner's promise.
 *
 * `init` receives an `isCurrentClaim` predicate and must gate its cache
 * publication on it: a slow init that was reclaimed past the deadline
 * must not overwrite the value published by the reclaimer (for the
 * runtime singleton that would orphan the reclaimer's active cron
 * scheduler). A losing init should also tear down any side resources it
 * started, since its result will never be published.
 */
export async function initWithLock(lock, getCached, init, options) {
    const deadlineMs = options?.deadlineMs ?? DEFAULT_DEADLINE_MS;
    const pollMs = options?.pollMs ?? DEFAULT_POLL_MS;
    const maxWaitMs = options?.maxWaitMs ?? deadlineMs + MAX_WAIT_HEADROOM_MS;
    // Date.now() is deliberate and only works because every loop iteration
    // awaits: in workerd the clock only advances across I/O, so a sync spin
    // would never observe the deadline. Don't "optimize" away the sleep.
    const waitStart = Date.now();
    for (;;) {
        const cached = getCached();
        if (cached !== null && cached !== undefined) {
            return cached;
        }
        const ownerStartedAt = lock.ownerStartedAt;
        if (ownerStartedAt === null || Date.now() - ownerStartedAt > deadlineMs) {
            // Free, or the owner has been gone past the deadline — claim it.
            // Synchronous between awaits, so two waiters can't both claim.
            lock.generation += 1;
            const claim = lock.generation;
            lock.ownerStartedAt = Date.now();
            try {
                // Promise.resolve().then(...) so a synchronous throw from
                // init still becomes a rejection after the anchor attaches.
                const isCurrentClaim = () => lock.generation === claim;
                const initPromise = Promise.resolve().then(() => init(isCurrentClaim));
                options?.anchor?.(initPromise.then(() => undefined, () => undefined));
                return await initPromise;
            }
            finally {
                // If this request dies mid-init unanchored this never runs;
                // the next waiter reclaims after deadlineMs instead. Release
                // only while still the current owner: a reclaimer may have
                // taken the lock while this (slow) init was running, and
                // clearing its claim would admit a third concurrent init.
                if (lock.generation === claim) {
                    lock.ownerStartedAt = null;
                }
            }
        }
        if (Date.now() - waitStart > maxWaitMs) {
            throw new Error(`initWithLock: timed out after ${maxWaitMs}ms waiting for initialization`);
        }
        await sleep(pollMs);
    }
}
