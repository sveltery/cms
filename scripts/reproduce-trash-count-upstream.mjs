// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Count probes execute the complete pinned repository/handler in the existing
// disclosed draft fixture. translationOf/setup are adapted, not source parity.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function trashCountEntry() {
  return `
test(target+': adapted trash-locale-filter.test.ts:83 count value expectations',async()=>{
  const f=await fixture();try {
    await f.seed('en','en','hello-en');await f.seed('fr','fr','hello-fr');await f.seed('de','de','hallo-de');
    const scoped=await handleContentCountTrashed(f.db,'posts',{locale:'en'});
    const all=await handleContentCountTrashed(f.db,'posts');
    assert.equal(scoped.success && scoped.data.count,1);
    assert.equal(all.success && all.data.count,3);
  } finally {await f.close();}
});
test(target+': supplemental count empty/scoped/all and active exclusion',async()=>{
  const f=await fixture();try {
    assert.equal(await f.repo.countTrashed('posts'),0);
    await f.seed('active','en','active',null);
    assert.equal(await f.repo.countTrashed('posts'),0);
    await f.seed('en','en');await f.seed('fr','fr');
    assert.equal(await f.repo.countTrashed('posts'),2);
    assert.equal(await f.repo.countTrashed('posts',{locale:'en'}),1);
    assert.equal(await f.repo.countTrashed('posts',{locale:'fr'}),1);
    assert.equal(await f.repo.countTrashed('posts',{locale:'zz'}),0);
  } finally {await f.close();}
});
test(target+': supplemental count independently exceeds list default and cap',async()=>{
  const f=await fixture();try {
    for(let index=0;index<103;index++) await f.seed(String(index),index%2?'fr':'en');
    await f.seed('active','en','active',null);
    assert.equal((await f.repo.findTrashed('posts')).items.length,50);
    assert.equal((await f.repo.findTrashed('posts',{limit:1000})).items.length,100);
    assert.equal(await f.repo.countTrashed('posts'),103);
    assert.equal(await f.repo.countTrashed('posts',{locale:'en'}),52);
    assert.equal(await f.repo.countTrashed('posts',{locale:'fr'}),51);
  } finally {await f.close();}
});
test(target+': supplemental upstream count has no status predicate',async()=>{
  const f=await fixture();try {
    await f.seed('draft');await f.seed('published');
    await f.db.updateTable('ec_posts').set({status:'published'}).where('id','=','published').execute();
    assert.equal(await f.repo.countTrashed('posts'),2);
  } finally {await f.close();}
});
test(target+': supplemental count reads fresh state after restore',async()=>{
  const f=await fixture();try {
    const row=await f.seed('restore','fr');await f.seed('remaining','en');
    assert.equal(await f.repo.countTrashed('posts'),2);
    const restored=await handleContentRestore(f.db,'posts',row.id,{_rev:encodeRev(row)});
    assert.equal(restored.success,true);
    assert.equal(await f.repo.countTrashed('posts'),1);
    assert.equal(await f.repo.countTrashed('posts',{locale:'fr'}),0);
  } finally {await f.close();}
});
`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  execFileSync(process.execPath, [fileURLToPath(new URL('./reproduce-draft-trash-upstream.mjs', import.meta.url)), '--count'],
    { env: process.env, stdio: 'inherit' });
}
