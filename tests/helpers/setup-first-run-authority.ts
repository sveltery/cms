import type {CmsDatabase} from '../../src/lib/server/database/contract.ts';

// The schema transport host seeds four minimal role/session rows. First-run
// setup fixtures instead start from the pin's empty authority database; retain
// real auth availability checks and never fabricate profiles or enrollment.
export async function useEmptySetupAuthority(database:CmsDatabase){
 await database.db.deleteFrom('_cms_auth_sessions').execute();
 await database.db.deleteFrom('_cms_auth_users').execute();
}
