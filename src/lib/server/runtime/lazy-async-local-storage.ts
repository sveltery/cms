import { AsyncLocalStorage as NodeAsyncLocalStorage } from 'node:async_hooks';

/**
 * Native allocation transport for the run/getStore subset used by the retained
 * request-context modules. Context-free producers may import those modules on
 * hosts without Node ALS. Starting a scope still requires the real Node class.
 * No context is stored outside that actual AsyncLocalStorage instance.
 */
export class AsyncLocalStorage<T> {
  #storage: NodeAsyncLocalStorage<T> | undefined;

  getStore(): T | undefined {
    return this.#storage?.getStore();
  }

  run<R, A extends unknown[]>(store: T, callback: (...args: A) => R, ...args: A): R {
    const storage = this.#storage ??= new NodeAsyncLocalStorage<T>();
    return storage.run(store, callback, ...args);
  }
}
