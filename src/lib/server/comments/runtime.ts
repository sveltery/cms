import { OperationNodeTransformer, TableNode, sql, type FromNode, type Kysely, type KyselyPlugin } from 'kysely';
import type { RequestEvent } from '@sveltejs/kit';
import type { CmsDatabase } from '../database/contract.ts';
import type { Database } from './upstream/database/types.ts';
import type { UserInfo } from './upstream/plugins/types.ts';
import { commentNamespacePlugin } from './namespace.ts';
import { HookPipeline } from './upstream/plugins/hooks.ts';
import { definePlugin } from './upstream/plugins/define-plugin.ts';
import { defaultCommentModerate, DEFAULT_COMMENT_MODERATOR_PLUGIN_ID } from './upstream/comments/moderator.ts';
import type { PublicCommentSubmissionRuntime } from './upstream/comments/public-submission.ts';
/** Map only Source comment dependencies to owned physical storage and a read-only user projection. */
class NativeCommentDependencies extends OperationNodeTransformer {
 protected override transformFrom(node: FromNode): FromNode {
  const transformed = super.transformFrom(node);
  return { ...transformed, froms: transformed.froms.map(from => TableNode.is(from) && from.table.identifier.name === 'users'
   ? sql`(SELECT u.id, u.role, p.name, p.email, p.email_verified, p.avatar_url, p.data, p.created_at, p.updated_at
           FROM _cms_auth_users u JOIN _cms_auth_profiles p ON p.user_id = u.id) AS users`.toOperationNode()
   : from) };
 }
 protected override transformRaw(node: import('kysely').RawNode): import('kysely').RawNode {
  const transformed=super.transformRaw(node);
  return { ...transformed, sqlFragments: transformed.sqlFragments.map(fragment=>fragment.replaceAll('_cms_rate_limits','_cms_comment_rate_limits')) };
 }
 protected override transformIdentifier(node: import('kysely').IdentifierNode): import('kysely').IdentifierNode {
  return { ...node, name: node.name === 'options' ? '_cms_comment_options'
   : node.name === '_cms_rate_limits' ? '_cms_comment_rate_limits' : node.name };
 }
}
const dependencies = new NativeCommentDependencies();
const dependencyPlugin: KyselyPlugin = { transformQuery: args => dependencies.transformNode(args.node), transformResult: async args => args.result };
export function nativeCommentDatabase(database: CmsDatabase): Kysely<Database> {
 return database.db.withTables<{[Name in keyof Database]: Database[Name]}>().withPlugin(commentNamespacePlugin).withPlugin(dependencyPlugin) as unknown as Kysely<Database>;
}
export async function nativeCommentUser(event: RequestEvent, db: Kysely<Database>): Promise<UserInfo | undefined> {
 const principal = event.locals.cms?.principal;
 if (!principal) return undefined;
 const row = await db.selectFrom('users').select(['id','role','name','email','created_at']).where('id','=',principal.id).executeTakeFirst();
 return row ? { id: row.id, name: row.name, email: row.email, role: row.role, createdAt: row.created_at ?? '' } : undefined;
}
export function nativeCommentRuntime(event: RequestEvent, db: Kysely<Database>): PublicCommentSubmissionRuntime {
 const moderator = definePlugin({ id: DEFAULT_COMMENT_MODERATOR_PLUGIN_ID, version: '1.0.0', capabilities: ['users:read'],
  hooks: { 'comment:moderate': { handler: defaultCommentModerate, exclusive: true } } });
 const hooks = new HookPipeline([moderator], { db });
 hooks.setExclusiveSelection('comment:moderate', DEFAULT_COMMENT_MODERATOR_PLUGIN_ID);
 const presentation = event.locals.cmsRuntime;
 return { db, hooks, email: null, config: { ...(presentation ? { nativeAdminBaseUrl: presentation.publicOrigin + presentation.basePath } : {}) } };
}
