// Original test-only scheduler instrumentation. Miniflare's installed worker
// script is executed unchanged; no dependency file or production code is patched.
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { Worker, type WorkerOptions } from 'node:worker_threads';

/** Force a previous response's notify to arrive during the next synchronous wait. */
export async function withPriorD1Notification<T>(operation: (arm: () => void) => Promise<T>): Promise<T> {
  const builtin = createRequire(import.meta.url)('node:worker_threads') as { Worker: typeof Worker };
  const OriginalWorker = builtin.Worker;
  const originalWait = Atomics.wait;
  const control = new Int32Array(new SharedArrayBuffer(4));
  let armedWaits = 0;
  builtin.Worker = class extends OriginalWorker {
    constructor(filename: ConstructorParameters<typeof Worker>[0], options?: WorkerOptions) {
      if (options?.eval && typeof filename === 'string' && filename.includes('const { notifyHandle, port, filename } = workerData;')) {
        // The first armed worker response stores its original completion flag
        // before entering Atomics.notify. Pause only that notify, then release
        // it once the caller starts waiting for its next response.
        const instrumentation = `
const cmsControl = new Int32Array(require('node:worker_threads').workerData.cmsControl);
const cmsNotify = Atomics.notify;
Atomics.notify = function(handle, index, count) {
  if (handle === require('node:worker_threads').workerData.notifyHandle && Atomics.compareExchange(cmsControl, 0, 1, 2) === 1) {
    cmsNotify(cmsControl, 0);
    Atomics.wait(cmsControl, 0, 2);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
  }
  return cmsNotify(handle, index, count);
};
`;
        super(instrumentation + filename, { ...options, workerData: { ...options.workerData, cmsControl: control.buffer } });
      } else super(filename, options);
    }
  };
  syncBuiltinESMExports();
  Atomics.wait = function(handle, index, value, timeout) {
    if (Atomics.load(control, 0) > 0 && handle !== control) {
      if (armedWaits++ === 0) {
        // Start this wait after the worker's store, so it returns "not-equal"
        // without needing the old notify. This is a permitted scheduler order.
        originalWait(control, 0, 1, 5000);
      } else if (Atomics.load(control, 0) === 2) {
        Atomics.store(control, 0, 3);
        Atomics.notify(control, 0);
      }
    }
    return originalWait(handle, index, value, timeout);
  };
  try { return await operation(() => Atomics.store(control, 0, 1)); }
  finally {
    Atomics.store(control, 0, 3);
    Atomics.notify(control, 0);
    Atomics.wait = originalWait;
    builtin.Worker = OriginalWorker;
    syncBuiltinESMExports();
  }
}
