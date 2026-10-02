// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Execute the complete immutable repository/handler through the existing
// disclosed draft fixture; adapt only the verified pinned unit assertions.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function trashPaginationEntry(cursorSource) {
  const replacements = [
    ['expect(decoded).toEqual({ orderValue: "2024-01-01", id: "01ABC" })', 'assert.deepEqual(decoded, { orderValue: "2024-01-01", id: "01ABC" })'],
    ['expect(() => decodeCursor("")).toThrow(InvalidCursorError)', 'assert.throws(() => decodeCursor(""), InvalidCursorError)'],
    ['expect(() => decodeCursor("not-base64-!!!")).toThrow(InvalidCursorError)', 'assert.throws(() => decodeCursor("not-base64-!!!"), InvalidCursorError)'],
    ['expect(() => decodeCursor(bad)).toThrow(InvalidCursorError)', 'assert.throws(() => decodeCursor(bad), InvalidCursorError)'],
    ['expect(() => decodeCursor(huge)).toThrow(InvalidCursorError)', 'assert.throws(() => decodeCursor(huge), InvalidCursorError)'],
    ['expect.fail("expected throw")', 'assert.fail("expected throw")'],
    ['expect(error).toBeInstanceOf(InvalidCursorError)', 'assert.ok(error instanceof InvalidCursorError)'],
    ['expect((error as Error).message.length).toBeLessThan(120)', 'assert.ok((error as Error).message.length < 120)']
  ];
  let converted = cursorSource.replace('import { describe, expect, it } from "vitest";', '')
    .replace('../../../../src/database/repositories/types.js', './packages/core/src/database/repositories/types.ts');
  let count = 0;
  for (const [source, local] of replacements) {
    const matches = converted.split(source).length - 1;
    if (!matches) throw new Error('Pinned cursor assertion disappeared: ' + source);
    count += matches;
    converted = converted.replaceAll(source, local);
  }
  if (count !== 10 || converted.includes('expect(') || converted.includes('expect.fail')) {
    throw new Error('Unexpected pinned cursor assertion conversion: ' + count);
  }
  return `
const describe = (_title, callback) => callback();
const it = (title, callback) => test(target + ': upstream cursor.test.ts: ' + title, callback);
${converted}

async function seedPagination(f) {
  const dates=['2026-01-01T00:00:00.000Z','2026-02-01T00:00:00.000Z','2026-03-01T00:00:00.000Z'];
  const rows=[];
  for(let index=0;index<103;index++) {
    const id=String(index).padStart(3,'0');
    await f.seed(id,['en','fr','de'][index%3],id,dates[index%3]);
    rows.push({id,locale:['en','fr','de'][index%3],deletedAt:dates[index%3]});
  }
  await f.seed('active','en','active',null);
  return rows.sort((a,b)=>b.deletedAt.localeCompare(a.deletedAt)||b.id.localeCompare(a.id));
}
async function walkPagination(f,options={}) {
  let cursor; const rows=[]; const sizes=[];
  do {
    const page=await handleContentListTrashed(f.db,'posts',{...options,cursor});
    assert.equal(page.success,true);
    assert.equal(page.data.items.some(item=>item.id==='active'),false);
    sizes.push(page.data.items.length);rows.push(...page.data.items);
    if(page.data.nextCursor) {
      const last=page.data.items.at(-1);
      assert.deepEqual(decodeCursor(page.data.nextCursor),{orderValue:last.deletedAt,id:last.id});
    }
    cursor=page.data.nextCursor;
    assert.ok(sizes.length<200,'pagination must terminate');
  } while(cursor);
  return {rows,sizes};
}
test(target+': supplemental 103-row handler walk preserves deletion/ID ties without duplicates',async()=>{
  const f=await fixture();try {
    const expected=await seedPagination(f);
    const walked=await walkPagination(f);
    assert.deepEqual(walked.sizes,[50,50,3]);
    assert.deepEqual(walked.rows.map(item=>item.id),expected.map(item=>item.id));
    assert.equal(new Set(walked.rows.map(item=>item.id)).size,103);
    const capped=await handleContentListTrashed(f.db,'posts',{limit:1000});
    assert.equal(capped.data.items.length,100);
    const terminal=await handleContentListTrashed(f.db,'posts',{limit:100,cursor:capped.data.nextCursor});
    assert.equal(terminal.data.items.length,3);assert.equal(terminal.data.nextCursor,undefined);
  } finally {await f.close();}
});
test(target+': supplemental locale paging retains filters and omitted locale includes every locale',async()=>{
  const f=await fixture();try {
    const expected=await seedPagination(f);
    for(const locale of ['en','fr','de']) {
      const walked=await walkPagination(f,{locale,limit:7});
      assert.deepEqual(walked.rows.map(item=>item.id),expected.filter(row=>row.locale===locale).map(row=>row.id));
      assert.ok(walked.rows.every(row=>row.locale===locale));
    }
    const unknown=await handleContentListTrashed(f.db,'posts',{locale:'zz'});
    assert.equal(unknown.success,true);assert.deepEqual(unknown.data.items,[]);assert.equal(unknown.data.nextCursor,undefined);
    const all=await walkPagination(f,{limit:17});assert.equal(all.rows.length,103);
  } finally {await f.close();}
});
test(target+': supplemental empty/terminal pages, empty native cursor and malformed handler error',async()=>{
  const f=await fixture();try {
    const empty=await handleContentListTrashed(f.db,'posts');
    assert.equal(empty.success,true);assert.deepEqual(empty.data.items,[]);assert.equal(empty.data.nextCursor,undefined);
    await f.seed('row');
    const first=await handleContentListTrashed(f.db,'posts');
    assert.deepEqual(await handleContentListTrashed(f.db,'posts',{cursor:''}),first);
    const terminal=await handleContentListTrashed(f.db,'posts',{cursor:encodeCursor('2026-01-01T00:00:00.000Z','row')});
    assert.equal(terminal.success,true);assert.deepEqual(terminal.data.items,[]);assert.equal(terminal.data.nextCursor,undefined);
    const before=await f.repo.findByIdIncludingTrashed('posts','row');
    for(const cursor of ['garbage','not-base64-!!!','A'.repeat(4097)]) {
      const result=await handleContentListTrashed(f.db,'posts',{cursor});
      assert.equal(result.success,false);assert.equal(result.error.code,'INVALID_CURSOR');
    }
    assert.deepEqual(await f.repo.findByIdIncludingTrashed('posts','row'),before);
  } finally {await f.close();}
});
test(target+': supplemental UTF-8 standard base64 and shape-only cursor semantics',async()=>{
  const unicode={orderValue:'删除 🗑️',id:'記事/entrée'};
  const token=encodeCursor(unicode.orderValue,unicode.id);
  assert.equal(token,Buffer.from(JSON.stringify(unicode),'utf8').toString('base64'));
  assert.deepEqual(decodeCursor(token),unicode);
  for(const value of [{orderValue:'',id:''},{orderValue:'arbitrary',id:'arbitrary',collection:'other',locale:'fr'}]) {
    assert.deepEqual(decodeCursor(Buffer.from(JSON.stringify(value)).toString('base64')),{orderValue:value.orderValue,id:value.id});
  }
  const exact=encodeCursor('x'.repeat(3047),'');assert.equal(exact.length,4096);assert.doesNotThrow(()=>decodeCursor(exact));
  assert.throws(()=>decodeCursor(encodeCursor('x'.repeat(3050),'')),InvalidCursorError);
});
test(target+': supplemental later-page restore retains cursor scope and stale receipt leaves row unchanged',async()=>{
  const f=await fixture();try {
    await seedPagination(f);
    const first=await handleContentListTrashed(f.db,'posts');
    const options={cursor:first.data.nextCursor,limit:50};
    const second=await handleContentListTrashed(f.db,'posts',options);
    const id=second.data.items[8].id;
    const before=await f.repo.findByIdIncludingTrashed('posts',id);
    const stale=await handleContentRestore(f.db,'posts',id,{_rev:encodeRev({...before,version:before.version-1})});
    assert.equal(stale.success,false);assert.equal(stale.error.code,'CONFLICT');
    assert.deepEqual(await f.repo.findByIdIncludingTrashed('posts',id),before);
    const restored=await handleContentRestore(f.db,'posts',id,{_rev:encodeRev(before)});
    assert.equal(restored.success,true);
    const refreshed=await handleContentListTrashed(f.db,'posts',options);
    assert.equal(refreshed.success,true);assert.equal(refreshed.data.items.some(row=>row.id===id),false);
    assert.deepEqual(refreshed.data.items.slice(0,49).map(row=>row.id),second.data.items.filter(row=>row.id!==id).map(row=>row.id));
    assert.ok(await f.repo.findById('posts',id));
    assert.equal((await f.repo.findByIdIncludingTrashed('posts',id)).deletedAt,null);
  } finally {await f.close();}
});
`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  execFileSync(process.execPath, [fileURLToPath(new URL('./reproduce-draft-trash-upstream.mjs', import.meta.url)), '--pagination'], {
    env: process.env, stdio: 'inherit'
  });
}
