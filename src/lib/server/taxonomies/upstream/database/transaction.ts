import type {Kysely,Transaction} from 'kysely';
// Source callbacks execute in a real native SQLite transaction. A registered
// D1 caller must supply the atomic taxonomy plan adapter; never bare callbacks.
export function withTransaction<DB,T>(db:Kysely<DB>,callback:(tx:Kysely<DB>|Transaction<DB>)=>Promise<T>):Promise<T>{
 if(db.isTransaction)return callback(db);
 return db.transaction().execute(callback);
}
