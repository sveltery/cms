declare module 'virtual:sveltery/taxonomy-history-native' {
  import type {Kysely} from 'kysely';
  export const nativeHost:undefined|{
    registerTaxonomyDatabase(database:import('../../src/lib/server/database/contract.ts').CmsDatabase):void;
    resetCaches():void;
    setupForDialectWithCollections(dialect:'sqlite'|'workerd-d1'):Promise<any>;
    teardownForDialect(ctx:any):Promise<void>;
  };
}
