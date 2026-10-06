// Native HTTP policy transport of complete pinned EmDash setup/index.ts.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import type { CmsDatabase } from '../database/contract.ts';
import { apiError, apiSuccess, handleError } from '../comments/upstream/api/error.ts';
import { isParseError, parseBody } from '../comments/upstream/api/parse.ts';
import { OptionsRepository } from '../comments/upstream/database/repositories/options.ts';
import { applySetupSeedWithinBudget, type SetupSeedParameters } from '../seed/index.ts';
import { registeredSeedDatabaseOwner, seedSourceDatabase } from '../seed/namespace.ts';
import { setupBody } from './schemas.ts';

export interface SetupSiteContext {
  database?: CmsDatabase;
  /** Exact registered handle preserves caller's actual query observers. */
  seedDb?: ReturnType<typeof seedSourceDatabase>;
  request: Request;
  url: URL;
  configuredOrigin?: string;
  development: boolean;
  workers: boolean;
  storage?: SetupSeedParameters['storage'];
}

/** The production wrapper verifies requestIdentity's origin before this policy.
 * Source APIContext unit fixtures can supply the original origin inputs. */
export async function applySetupSite(context: SetupSiteContext): Promise<Response> {
  if (!context.database) return apiError('NOT_CONFIGURED', 'EmDash is not initialized', 500);
  const db = context.seedDb ?? seedSourceDatabase(context.database);
  if (registeredSeedDatabaseOwner(db) !== context.database) throw new Error('Setup requires its registered database owner');
  try {
    try {
      const complete = await new OptionsRepository(db).get('emdash:setup_complete');
      if (complete === true || complete === 'true') {
        return apiError('ALREADY_CONFIGURED', 'Setup has already been completed', 409);
      }
    } catch { /* Source permits first-ever setup when options are unreadable. */ }
    const loopback = context.url.hostname === 'localhost' || context.url.hostname === '127.0.0.1' || context.url.hostname === '[::1]';
    let requestOrigin: string | undefined;
    if (context.development) { if (loopback) requestOrigin = context.url.origin; }
    else if (context.workers) requestOrigin = `https://${context.url.hostname}`;
    const siteUrl = context.configuredOrigin ?? requestOrigin;
    if (!siteUrl) return apiError('SITE_URL_REQUIRED', 'Set siteUrl or EMDASH_SITE_URL before running production setup', 500);
    const body = await parseBody(context.request, setupBody);
    if (isParseError(body)) return body;
    let outcome;
    try {
      outcome = await applySetupSeedWithinBudget(db, { ...body, storage: context.storage });
    } catch (error) { return handleError(error, 'Failed to apply seed', 'SEED_ERROR'); }
    if (!outcome.validation.valid) return apiError('INVALID_SEED', `Invalid seed file: ${outcome.validation.errors.join(', ')}`, 400);
    if (!outcome.seeded) throw new Error('Valid seed application produced no result');
    const { result, complete: seedComplete, progress: seedProgress } = outcome.seeded;
    try {
      const options = new OptionsRepository(db);
      await options.setIfAbsent('emdash:site_url', siteUrl);
      // The current runtime supplies genuine passkey enrollment. External-auth
      // completion remains unimplemented until its actual provider is configured.
      if (seedComplete) await options.set('emdash:setup_state', {
        step: 'site_complete', title: body.title, tagline: body.tagline
      });
    } catch (error) { console.error('Failed to save setup state:', error); }
    if (!seedComplete) return apiSuccess({ success: true, setupComplete: false, seedComplete: false, seedProgress, result });
    return apiSuccess({ success: true, setupComplete: false, seedComplete: true, result });
  } catch (error) { return handleError(error, 'Setup failed', 'SETUP_ERROR'); }
}
