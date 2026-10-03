import type {Kysely} from 'kysely';
import {SchemaRegistry as CmsRegistry} from '../../../database/registry.ts';
import {taxonomyDatabase} from '../host.ts';
import {resetRegisteredCollectionsCacheForTests} from './collection-slugs-cache.ts';
export class SchemaRegistry {
 private registry:CmsRegistry;
 constructor(db:Kysely<any>){const database=taxonomyDatabase(db);if(!database)throw new Error('Unregistered native taxonomy database');this.registry=new CmsRegistry(database);}
 async createCollection(input:any){const result=await this.registry.createCollection(input);resetRegisteredCollectionsCacheForTests();return result;}
 createField(collection:string,input:any){return this.registry.createField(collection,input);}
 getCollection(collection:string){return this.registry.getCollection(collection);}
 getCollectionWithFields(collection:string){return this.registry.getCollectionWithFields(collection);}
 listCollections(){return this.registry.listCollections();}
 async deleteCollection(collection:string,options:any={}){const result=await this.registry.deleteCollection(collection,options);resetRegisteredCollectionsCacheForTests();return result;}
 updateCollection(collection:string,input:any){return this.registry.updateCollection(collection,input);}
}
