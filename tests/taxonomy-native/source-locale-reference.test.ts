// Supplemental reference-host controls, not original Source callback credit.
// Actual pinned Source physical repository/DDL plus the whole existing content
// host reproduce content.ts1075–1078 and resolveId587–590/update1496 dataflow.
// EmDash913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; MIT notices/emdash-MIT.txt.
import {afterEach,beforeEach,expect,it} from 'vitest';
import {setupTestDatabaseWithCollections} from '../../parity/emdash/taxonomies/source/packages/core/tests/utils/test-db.ts';
import {ContentRepository} from '../../parity/emdash/taxonomies/source/packages/core/src/database/repositories/content.ts';
import {setI18nConfig,resolveConfiguredLocale} from '../../src/lib/server/menus/i18n-config.ts';
import {TaxonomyRepository} from '../../src/lib/server/taxonomies/repository.ts';
import {handleContentCreate,handleContentGet,handleContentUpdate} from '../helpers/taxonomies/source-content-reference.mjs';
let db:Awaited<ReturnType<typeof setupTestDatabaseWithCollections>>;
beforeEach(async()=>{db=await setupTestDatabaseWithCollections();setI18nConfig({defaultLocale:'en',locales:['en','fr']});});
afterEach(async()=>{setI18nConfig(null);await db?.destroy();});

it('reference host: configured FR finds the generated-id French entry by slug',async()=>{
 const created=await handleContentCreate(db,'post',{slug:'bonjour',data:{title:'Français'},locale:'fr'});
 expect(created.success).toBe(true);if(!created.success)throw new Error(created.error.message);
 expect(created.data.item.id).not.toBe('bonjour');
 const result=await handleContentGet(db,'post','bonjour','FR');
 expect(result.success).toBe(true);if(!result.success)throw new Error(result.error.message);
 expect(result.data.item.id).toBe(created.data.item.id);expect(result.data.item.locale).toBe('fr');
});

it('reference host: Source resolveId dataflow finds the French slug before actual assignment update',async()=>{
 const repository=new TaxonomyRepository(db);
 await repository.create({name:'tag',slug:'initial',label:'Initial',locale:'fr'});
 const replacement=await repository.create({name:'tag',slug:'suivant',label:'Suivant',locale:'fr'});
 const created=await handleContentCreate(db,'post',{slug:'bonjour',data:{title:'Français'},locale:'fr',taxonomies:{tag:['initial']}});
 expect(created.success).toBe(true);if(!created.success)throw new Error(created.error.message);
 // Original resolveId canonicalizes before the genuine Source repository call.
 const existing=await new ContentRepository(db).findByIdOrSlug('post','bonjour',resolveConfiguredLocale('FR'));
 expect(existing?.id).toBe(created.data.item.id);if(!existing)throw new Error('Real Source entry missing');
 const result=await handleContentUpdate(db,'post',existing.id,{taxonomies:{tag:['suivant']}});
 expect(result.success).toBe(true);if(!result.success)throw new Error(result.error.message);
 expect(result.data.item.locale).toBe('fr');
 expect((await repository.getTermsForEntry('post',existing.id,'tag','fr')).map(term=>term.id)).toEqual([replacement.id]);
});
