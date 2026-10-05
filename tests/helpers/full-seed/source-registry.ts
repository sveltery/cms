import { SchemaRegistry as NativeRegistry } from '../../../src/lib/server/database/registry.ts';
import { sourceSeedOwner } from './source-db.ts';

/** Constructor transport only: every operation is the real canonical registry. */
export class SchemaRegistry extends NativeRegistry {
  constructor(db: object) { super(sourceSeedOwner(db)); }
}
