// Native DOM/lifecycle supplements derived from the complete immutable hook.
// Source clocks and case data remain in the original whole browser family.
import { afterEach,beforeEach,expect,test,vi } from 'vitest';
import { createEntryLockController,ENTRY_LOCK_HEARTBEAT_MS } from '../../src/lib/entry-locks/controller.ts';
const ada={userId:'ada',userName:'Ada',acquiredAt:'2026-09-04T10:00:00.000Z',expiresAt:'2026-09-04T10:07:00.000Z'};
const granted={enabled:true,heldByCaller:true,holder:ada};
const blocked={enabled:true,heldByCaller:false,holder:ada};
let stop:(()=>void)|undefined;
beforeEach(()=>{vi.useFakeTimers();});
afterEach(()=>{stop?.();stop=undefined;vi.useRealTimers();});
function fixture(acquire=vi.fn().mockResolvedValue(granted)){
 const release=vi.fn().mockResolvedValue(undefined);
 const controller=createEntryLockController({collection:'posts',entryId:'entry',ready:true},{acquire,release,refusal:()=>null},new EventTarget(),new EventTarget());
 stop=controller.stop;return {controller,acquire,release};
}
test('a granted lease keeps the Native editor writable and uses one tab token',async()=>{
 const {controller,acquire,release}=fixture();controller.start();await Promise.resolve();await Promise.resolve();
 expect(controller.snapshot().state.status).toBe('holding');expect(controller.snapshot().readOnly).toBe(false);
 await vi.advanceTimersByTimeAsync(ENTRY_LOCK_HEARTBEAT_MS);
 expect(acquire).toHaveBeenCalledTimes(2);expect(acquire.mock.calls[0][2].token).toBe(acquire.mock.calls[1][2].token);
 controller.stop();expect(release.mock.calls[0][2].token).toBe(acquire.mock.calls[0][2].token);
});
test('read-only persists until the current holder leaves and the heartbeat reacquires',async()=>{
 const {controller,acquire}=fixture(vi.fn().mockResolvedValue(blocked));controller.start();await Promise.resolve();await Promise.resolve();
 expect(controller.snapshot().readOnly).toBe(true);controller.readInstead();expect(controller.snapshot().state.status).toBe('reading');
 acquire.mockResolvedValue(granted);await vi.advanceTimersByTimeAsync(ENTRY_LOCK_HEARTBEAT_MS);
 expect(controller.snapshot().state.status).toBe('holding');expect(controller.snapshot().readOnly).toBe(false);
});
test('an old pending acquire returns its actual lease after the editor switches entries',async()=>{
 let resolve:(value:typeof granted)=>void=()=>{};const acquire=vi.fn().mockImplementationOnce(()=>new Promise(done=>{resolve=done;})).mockResolvedValue(granted);
 const {controller,release}=fixture(acquire);controller.start();controller.replace({collection:'posts',entryId:'next',ready:true});
 resolve(granted);await Promise.resolve();await Promise.resolve();await Promise.resolve();
 expect(release).toHaveBeenCalledWith('posts','entry',expect.objectContaining({token:expect.any(String)}));
 expect(controller.snapshot().state.status).toBe('holding');
});
