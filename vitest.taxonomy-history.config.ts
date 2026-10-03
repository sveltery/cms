import {defineConfig} from 'vitest/config';
import {resolve,dirname} from 'node:path';

const root=process.cwd();
const testSource=resolve(root,'tests/source-taxonomy-history/packages/core/src');
const fixtureSource=resolve(root,'tests/fixtures/taxonomy-history/packages/core/src');
const allFixtureSources=resolve(root,'tests/fixtures/taxonomy-history');
const nativeRoot=process.env.SVELTERY_TAXONOMY_HISTORY_NATIVE_ROOT;
const nativeHostId='\0taxonomy-history-native-host';
const nativeD1RepositoryId='\0taxonomy-history-native-d1-repository';
// Preserve the pinned core Vitest host defaults. No scheduler/provider is run.
const virtualStubs:Record<string,string>={
  'virtual:emdash/wait-until':'export const waitUntil = undefined;',
  'virtual:emdash/scheduler':'export const createScheduler = null;',
  'virtual:emdash/config':'export default {};',
  'virtual:emdash/env':'export const env = undefined;',
  'virtual:emdash/build':'export const buildTime = 0;'
};

export default defineConfig({plugins:[{
  name:'pinned-taxonomy-history-fixtures',enforce:'pre',
  resolveId(id,importer){
    if(id==='virtual:sveltery/taxonomy-history-native')return nativeHostId;
    if(Object.hasOwn(virtualStubs,id))return '\0'+id;
    if(id==='@emdash-cms/admin/slugify')return resolve(root,'tests/fixtures/taxonomy-history/packages/admin/src/slugify.ts');
    if(id==='emdash/internal/database/migration-lock')return resolve(fixtureSource,'database/migration-lock.ts');
    if(!importer||!id.startsWith('.'))return;
    const target=resolve(dirname(importer),id);
    if(target.includes('/tests/source-taxonomy-history/packages/core/tests/utils/test-db')) {
      return resolve(root,'tests/helpers/taxonomy-history-db.ts');
    }
    if(target.startsWith(testSource+'/')) {
      const suffix=target.slice(testSource.length+1).replace(/\.js$/,'.ts');
      if(nativeRoot&&suffix==='database/repositories/taxonomy.ts'&&process.env.SVELTERY_TAXONOMY_HISTORY_TARGET==='workerd-d1')return nativeD1RepositoryId;
      if(nativeRoot&&['api/handlers/taxonomies.ts','database/repositories/content.ts','database/repositories/taxonomy.ts',
        'database/migrations/068_content_taxonomy_entry_groups.ts','database/migrations/082_taxonomy_translation_locale_unique.ts','database/migrations/085_taxonomy_def_groups.ts'].includes(suffix)) {
        return resolve(nativeRoot,'src/lib/server/taxonomies/upstream',suffix);
      }
      return resolve(fixtureSource,suffix);
    }
    if(importer.startsWith(allFixtureSources+'/')&&target.endsWith('.js')) {
      return target.replace(/\.js$/,'.ts');
    }
  },
  transform(code,id){
    if(nativeRoot&&(id.startsWith(allFixtureSources+'/')||id.includes('/tests/source-taxonomy-history/'))&&id.endsWith('.ts')){
      // Same disclosed SQL namespace substitution as the native taxonomy suite.
      return {code:code.replaceAll('_emdash_','_cms_'),map:null};
    }
  },
  load(id){
    if(id.startsWith('\0virtual:emdash/'))return virtualStubs[id.slice(1)];
    if(id===nativeD1RepositoryId)return `export {NativeTaxonomyRepository as TaxonomyRepository} from ${JSON.stringify(resolve(nativeRoot!,'src/lib/server/taxonomies/upstream/database/repositories/taxonomy-native.ts'))};`;
    if(id===nativeHostId){
      if(!nativeRoot)return 'export const nativeHost=undefined;';
      return `
        import {registerTaxonomyDatabase} from ${JSON.stringify(resolve(nativeRoot,'src/lib/server/taxonomies/upstream/host.ts'))};
        import {resetTaxonomyDefsCacheForTests} from ${JSON.stringify(resolve(nativeRoot,'src/lib/server/taxonomies/upstream/taxonomies/index.ts'))};
        import {resetRegisteredCollectionsCacheForTests} from ${JSON.stringify(resolve(nativeRoot,'src/lib/server/taxonomies/upstream/schema/collection-slugs-cache.ts'))};
        import {setupForDialectWithCollections as setupNodeCollections,teardownForDialect as teardownNode} from ${JSON.stringify(resolve(nativeRoot,'tests/helpers/taxonomy-source-db.ts'))};
        import {schemaAdminStorage} from ${JSON.stringify(resolve(nativeRoot,'tests/helpers/schema-admin-storage.ts'))};
        import {migrateCms} from ${JSON.stringify(resolve(nativeRoot,'src/lib/server/database/migrations.ts'))};
        import {registerLifecycleDatabase} from ${JSON.stringify(resolve(nativeRoot,'src/lib/server/database/lifecycle/upstream/host.ts'))};
        import {SchemaRegistry} from ${JSON.stringify(resolve(nativeRoot,'src/lib/server/taxonomies/upstream/schema/registry.ts'))};
        import {waitForDeferredTasks} from ${JSON.stringify(resolve(nativeRoot,'src/lib/server/taxonomies/upstream/deferred-tasks.ts'))};
        async function setupForDialectWithCollections(dialect){
          if(dialect==='sqlite')return setupNodeCollections('sqlite');
          if(dialect!=='workerd-d1')throw new Error('Unsupported native historical dialect: '+dialect);
          const storage=await schemaAdminStorage('D1');
          try {
            await migrateCms(storage.database);
            registerTaxonomyDatabase(storage.database);
            registerLifecycleDatabase(storage.database);
            const registry=new SchemaRegistry(storage.database.db);
            for(const slug of ['post','page']){
              await registry.createCollection({slug,label:slug==='post'?'Posts':'Pages',labelSingular:slug==='post'?'Post':'Page'});
              await registry.createField(slug,{slug:'title',label:'Title',type:'string'});
              await registry.createField(slug,{slug:'content',label:'Content',type:'portableText'});
            }
            return {db:storage.database.db,database:storage.database,dialect,closeRuntime:()=>storage.close()};
          }catch(error){await storage.close();throw error;}
        }
        async function teardownForDialect(ctx){
          if(ctx.closeRuntime){try{await waitForDeferredTasks();}finally{await ctx.closeRuntime();}}
          else await teardownNode(ctx);
        }
        export const nativeHost={registerTaxonomyDatabase,setupForDialectWithCollections,teardownForDialect,
          resetCaches(){resetTaxonomyDefsCacheForTests();resetRegisteredCollectionsCacheForTests();}};
      `;
    }
  }
}],test:{
  include:['tests/source-taxonomy-history/packages/core/tests/integration/database/*.test.ts','tests/taxonomy-history-transport.test.ts'],
  fileParallelism:false,maxWorkers:1
}});
