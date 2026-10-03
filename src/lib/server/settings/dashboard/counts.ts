import {sql,type Kysely} from 'kysely';
import type {SettingsTables} from '../tables.ts';
import type {Database} from '../../database/lifecycle/upstream/database/types.ts';
export type DashboardTables=Database&SettingsTables;
/** Count actual persisted authority rows, matching the source count-all contract. */
export class UserRepository {
 private readonly db:Kysely<DashboardTables>;
 constructor(db:Kysely<DashboardTables>){this.db=db;}
 async count(){return Number((await sql<{count:number}>`SELECT COUNT(id) AS count FROM _cms_auth_users`.execute(this.db)).rows[0].count);}
}
/** The absent media provider is an empty domain; installed rows are counted. */
export class MediaRepository {
 private readonly db:Kysely<DashboardTables>;
 constructor(db:Kysely<DashboardTables>){this.db=db;}
 async count(){
  const exists=(await sql`SELECT name FROM sqlite_master WHERE type='table' AND name='media'`.execute(this.db)).rows.length>0;
  if(!exists)return 0;
  return Number((await sql<{count:number}>`SELECT COUNT(id) AS count FROM media`.execute(this.db)).rows[0].count);
 }
}
