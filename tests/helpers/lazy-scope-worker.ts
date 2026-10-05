// Supplemental context-allocation capability control; no protected API request.
import { AsyncLocalStorage } from '../../src/lib/server/runtime/lazy-async-local-storage.ts';

export default {
  fetch() {
    const scope = new AsyncLocalStorage<{ id: string }>();
    let callbackReached = false;
    const before = scope.getStore();
    try {
      scope.run({ id: 'actual-scope' }, () => { callbackReached = true; });
      return Response.json({ callbackReached, beforeAbsent: before === undefined, constructed: true });
    } catch (error) {
      return Response.json({ callbackReached, beforeAbsent: before === undefined,
        afterAbsent: scope.getStore() === undefined, constructed: false,
        error: error instanceof Error ? { name: error.name, message: error.message } : null });
    }
  }
};
