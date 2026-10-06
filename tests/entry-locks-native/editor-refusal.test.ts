// Native Kit-envelope transport supplements; Original class guards remain unchanged.
import {expect,test} from 'vitest';
import {error as kitError} from '@sveltejs/kit';
import {EditorResponseError} from '../../src/lib/editor/errors.ts';
import {entryLockRefusal} from '../../src/lib/entry-locks/client.ts';
import {nativeEntryLockWriteError} from '../../src/lib/entry-locks/editor-error.ts';
const holder={userId:'ada',userName:'Ada',acquiredAt:'2026-09-04T10:00:00.000Z',expiresAt:'2026-09-04T10:07:00.000Z'};
test('actual Kit lock error carries the holder through the Native API class boundary',()=>{
 let cause:unknown;try{kitError(409,{message:'Ada is holding this entry',code:'ENTRY_LOCKED',details:holder});}catch(caught){cause=caught;}
 const mapped=nativeEntryLockWriteError(cause);
 expect(entryLockRefusal(mapped)).toEqual(holder);
});
test('editor concurrency and arbitrary failures remain outside lock handling',()=>{
 expect(entryLockRefusal(nativeEntryLockWriteError(new EditorResponseError(409,'CONFLICT','stale')))).toBeNull();
 expect(entryLockRefusal(nativeEntryLockWriteError(new Error('network')))).toBeNull();
 expect(entryLockRefusal(nativeEntryLockWriteError(undefined))).toBeNull();
});
test('the Source holder shape guard still rejects missing identity and normalizes missing optional strings',()=>{
 expect(entryLockRefusal(nativeEntryLockWriteError(new EditorResponseError(409,'ENTRY_LOCKED','held',{userName:'Ada'})))).toBeNull();
 expect(entryLockRefusal(nativeEntryLockWriteError(new EditorResponseError(409,'ENTRY_LOCKED','held',{userId:'ada'})))).toEqual({userId:'ada',userName:null,acquiredAt:'',expiresAt:''});
});
