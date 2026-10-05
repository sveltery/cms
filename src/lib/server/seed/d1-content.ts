// Source-compatible privileged storage entry; the sole canonical lifecycle owns
// every D1 write. All Source reads remain in the original repository.
import type {Kysely} from 'kysely';
import {ContentRepository as SourceContent} from './upstream/database/repositories/content.ts';
import {registeredSeedDatabaseOwner} from './namespace.ts';
import {registeredBylineDatabaseOwner} from '../bylines/storage.ts';
import {createSourceContent,deleteSourceContent} from '../database/lifecycle/seed-plan.ts';
import type {Database} from './upstream/database/types.ts';
import type {DatetimeContextCache} from './upstream/database/content-datetime.ts';
import type {CreateContentInput} from './upstream/database/repositories/types.ts';
export class ContentRepository extends SourceContent {
 private readonly sourceHandle:Kysely<Database>;
 constructor(db:Kysely<Database>,datetimes?:DatetimeContextCache){super(db,datetimes);this.sourceHandle=db;}
 private owner(){
  const owner=registeredSeedDatabaseOwner(this.sourceHandle)??registeredBylineDatabaseOwner(this.sourceHandle as unknown as Parameters<typeof registeredBylineDatabaseOwner>[0]);
  if(!owner)throw new Error('Native seed content requires its actual registered CMS database owner');
  return owner;
 }
 override create(input:CreateContentInput){return createSourceContent(this.owner(),input);}
 override delete(type:string,id:string){return deleteSourceContent(this.owner(),type,id);}
}
