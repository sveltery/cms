import {expect,it} from 'vitest';
import {sql} from 'kysely';
import {createForDialect,setupForDialectWithCollections,teardownForDialect} from '../helpers/taxonomy-history-db.ts';

function boundColumns(count:number){
  return sql`SELECT ${sql.join(Array.from({length:count},(_,index)=>sql`${index+1} AS ${sql.id(`value_${index+1}`)}`))}`;
}

for(const [name,setup] of [
  ['historical prestate',createForDialect],
  ['canonical collections',setupForDialectWithCollections]
] as const){
  it(`executes the real D1 binding boundary through ${name}`,async()=>{
    const ctx=await setup('workerd-d1');
    try {
      const result=await boundColumns(100).execute(ctx.db);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toEqual(Object.fromEntries(Array.from({length:100},(_,index)=>[`value_${index+1}`,index+1])));
      // Node SQLite accepts this query. Real workerd D1 must reject it.
      await expect(boundColumns(101).execute(ctx.db)).rejects.toThrow(/too many (?:sql variables|bound parameters)/i);
    }finally{await teardownForDialect(ctx);}
  });
}
