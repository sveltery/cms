import type { CmsDatabase } from '../database/contract.ts';
import type { ServerPrincipal } from '../database/service.ts';
export async function editorManifest(_database: CmsDatabase, _principal: ServerPrincipal | null): Promise<{ collections: Record<string, any> }> { return { collections: {} }; }
