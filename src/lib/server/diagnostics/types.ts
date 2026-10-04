import type { Database as LifecycleDatabase } from '../database/lifecycle/upstream/database/types.ts';
/** The scanner reuses the published lifecycle schema and actual options namespace. */
export interface Database extends LifecycleDatabase {
  _cms_options: LifecycleDatabase['options'];
}
