// TEST-ONLY genuine Source physical content owner. Only taxonomy behavior under
// test resolves to Native modules. This establishes no Native content/provider
// acceptance. Original Source7 test bodies/SQL/assertions/clocks are retained.
import {ContentRepository} from '../../../parity/emdash/taxonomies/source/packages/core/src/database/repositories/content.ts';
import {withTransaction} from '../../../parity/emdash/taxonomies/source/packages/core/src/database/transaction.ts';
import {getI18nConfig,resolveConfiguredLocale} from '../../../src/lib/server/menus/i18n-config.ts';
import {validateRev} from '../../../src/lib/server/database/lifecycle/upstream/api/rev.ts';
import {CmsError} from '../../../src/lib/server/database/contract.ts';
import {resolveTaxonomySlugMap,applyResolvedTaxonomySelections,completeContentTaxonomies} from '../../../src/lib/server/taxonomies/content-write.ts';
import {handleContentCreate as create,handleContentUpdate as update,handleContentGet as get} from '../../../src/lib/server/taxonomies/content.ts';

function sourceHost(db){return{database:db,
 async get(collection,id,locale){
  const item=await new ContentRepository(db).findByIdOrSlug(collection,id,locale?resolveConfiguredLocale(locale):undefined);
  if(!item)throw new CmsError('NOT_FOUND',`Content item not found: ${id}`);return item;
 },
 async create(collection,body){
  let selections=[];
  const item=await withTransaction(db,async transaction=>{
   const content=new ContentRepository(transaction);
   const locale=body.locale?resolveConfiguredLocale(body.locale):getI18nConfig()?.defaultLocale;
   let slug=body.slug;
   if(!slug){const source=typeof body.data?.title==='string'&&body.data.title.length>0?body.data.title:typeof body.data?.name==='string'&&body.data.name.length>0?body.data.name:null;if(source)slug=await content.generateUniqueSlug(collection,source,locale);}
   const created=await content.create({...body,type:collection,locale,slug});
   if(body.taxonomies){selections=await resolveTaxonomySlugMap(transaction,body.taxonomies,locale);
    await applyResolvedTaxonomySelections(transaction,collection,created.id,selections);}
   return created;
  });
  completeContentTaxonomies(selections);return item;
 },
 async update(collection,id,body){
  let selections=[];
  const item=await withTransaction(db,async transaction=>{
   const content=new ContentRepository(transaction);
   if(body._rev){const existing=await content.findById(collection,id);if(!existing)throw new CmsError('NOT_FOUND');
    const check=validateRev(body._rev,existing);if(!check.valid)throw new CmsError('CONFLICT',check.message);}
   const updated=await content.update(collection,id,body);
   if(body.taxonomies){selections=await resolveTaxonomySlugMap(transaction,body.taxonomies,updated.locale??body.locale);
    await applyResolvedTaxonomySelections(transaction,collection,id,selections);}
   return updated;
  });
  completeContentTaxonomies(selections);return item;
 }
};}
export function handleContentCreate(db,collection,body){return create(db,collection,body,sourceHost(db));}
export function handleContentUpdate(db,collection,id,body){return update(db,collection,id,body,sourceHost(db));}

export function handleContentGet(db,collection,id,locale){return get(db,collection,id,locale,sourceHost(db));}
