// Native trusted render context; no client input supplies the database.
import {AsyncLocalStorage} from 'node:async_hooks';
import type {Kysely} from 'kysely';
import type {SettingsTables} from './tables.ts';
const key=Symbol.for('sveltery:site-settings-context');
const globalStore=globalThis as unknown as Record<symbol,unknown>;
const context=(globalStore[key]??=new AsyncLocalStorage<{db:Kysely<SettingsTables>;editMode?:boolean}>()) as AsyncLocalStorage<{db:Kysely<SettingsTables>;editMode?:boolean}>;
export function runWithContext<T>(value:{db:Kysely<SettingsTables>;editMode?:boolean},callback:()=>T):T{return context.run(value,callback);}
export function getSettingsContext(){return context.getStore();}
