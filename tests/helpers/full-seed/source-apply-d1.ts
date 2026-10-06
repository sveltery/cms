import type { applySeed as SourceApply, applySeedWithinBudget as SourceBudget } from '../../../src/lib/server/seed/apply.ts';
import { applySeed as productionApply, applySeedWithinBudget as productionBudget } from '../../../src/lib/server/seed/index.ts';
import { originalFixtureGuardedHandle } from './source-d1-fixture-handle.ts';
export const applySeed: typeof SourceApply = (db, ...args) => productionApply(originalFixtureGuardedHandle(db), ...args);
export const applySeedWithinBudget: typeof SourceBudget = (db, ...args) => productionBudget(originalFixtureGuardedHandle(db), ...args);
