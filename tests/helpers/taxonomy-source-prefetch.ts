// Taxonomy-only layout prefetch seam: other chrome providers are separate features.
// The real pinned taxonomy helpers warm the same request-cache entries.
import {getTaxonomyDefs,getTaxonomyTerms} from '../../src/lib/server/taxonomies/upstream/taxonomies/index.ts';
export async function prefetchLayoutData(){const defs=await getTaxonomyDefs();await Promise.allSettled(defs.map(def=>getTaxonomyTerms(def.name,{includeCounts:false})));}
