import { SqliteQueryCompiler, type RootOperationNode, type QueryId } from 'kysely';
import { RawBindingD1Dialect as NativeDialect, type D1Binding } from '../../../src/lib/server/database/d1.ts';
import { sourceBlockTables } from './source-namespace.ts';
class SourceBlockCompiler extends SqliteQueryCompiler {
  override compileQuery(node: RootOperationNode, queryId: QueryId) {
    return super.compileQuery(sourceBlockTables.transformNode(node),queryId);
  }
}
/** Exact Source constructor shape, actual native raw D1 driver/adapter and finite TableNode mapping. */
export class RawBindingD1Dialect extends NativeDialect {
  constructor(config: {database: D1Binding}) { super(config.database); }
  override createQueryCompiler() { return new SourceBlockCompiler(); }
}
