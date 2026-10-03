import { sql, type CompiledQuery, type Kysely, type SqlBool } from 'kysely';
import { RawBindingD1Adapter } from '../database/d1.ts';
import type { Database } from './database-types.ts';
import { chunks } from './chunks.ts';

interface Artifact { digest: string; kind: 'exact' | 'pattern'; payload: string }

/** Native D1 batch transport for the pinned publication/CAS/cleanup sequence. */
export async function publishD1RedirectArtifacts(
  db: Kysely<Database>, revision: number, generation: string, artifacts: Artifact[]
): Promise<boolean> {
  const adapter = db.getExecutor().adapter;
  if (!(adapter instanceof RawBindingD1Adapter)) return false;
  const statements: CompiledQuery[] = [];
  // All candidate artifacts are ensured within the same atomic batch. A reuse
  // read outside that batch could race another publisher's orphan cleanup.
  for (const artifact of artifacts) {
    statements.push(db.insertInto('_cms_redirect_artifacts').values(artifact)
      .onConflict(conflict => conflict.column('digest').doUpdateSet({ kind: artifact.kind, payload: artifact.payload })).compile());
  }
  const links = artifacts.map((artifact, position) => ({ generation, position, digest: artifact.digest }));
  for (const batch of chunks(links, 30)) {
    statements.push(db.insertInto('_cms_redirect_generation_artifacts').values(batch)
      .onConflict(conflict => conflict.columns(['generation', 'position'])
        .doUpdateSet(eb => ({ digest: eb.ref('excluded.digest') }))).compile());
  }
  statements.push(db.deleteFrom('_cms_redirect_generation_artifacts')
    .where('generation', '=', generation).where('position', '>=', links.length).compile());
  statements.push(db.updateTable('_cms_redirect_state').set({ generation, generation_revision: revision })
    .where('id', '=', 1).where('generation_revision', '<=', revision).compile());
  // Source returns before cleanup when its activation CAS loses. This batch
  // has no JS branch between statements, so cleanup carries the same condition.
  const activated = sql<SqlBool>`EXISTS (SELECT 1 FROM _cms_redirect_state
    WHERE id = 1 AND generation = ${generation} AND generation_revision = ${revision})`;
  statements.push(db.deleteFrom('_cms_redirect_generation_artifacts')
    .where(activated).where(eb => eb('generation', '<>',
      eb.selectFrom('_cms_redirect_state').select('generation').where('id', '=', 1))).compile());
  statements.push(db.deleteFrom('_cms_redirect_artifacts').where(activated)
    .where(({ exists, not, selectFrom }) => not(exists(selectFrom('_cms_redirect_generation_artifacts')
      .select('_cms_redirect_generation_artifacts.digest')
      .whereRef('_cms_redirect_generation_artifacts.digest', '=', '_cms_redirect_artifacts.digest')))).compile());
  // Preserve the real request-scoped adapter's Kysely connection serialization.
  await db.connection().execute(() => adapter.executeAtomicBatch(statements));
  return true;
}
