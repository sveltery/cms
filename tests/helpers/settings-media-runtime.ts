import type {Kysely} from 'kysely';
import type {Database} from '../../src/lib/server/media/source/database/types.ts';
import {NativeMediaRuntime} from '../../src/lib/server/media/runtime.ts';

// Explicit native host for only the three complete source media mutation
// methods. The callback's MCP-harness import is mapped here by the test host;
// this provides zero actual MCP/PAT/plugin/runtime infrastructure credit.
export function createTestRuntime(db:Kysely<Database>){return new NativeMediaRuntime(db);}
