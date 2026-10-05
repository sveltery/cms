import { afterEach, expect, it, vi } from 'vitest';
import { setBase } from '../helpers/schema-ui/kit-paths';
import { adminClient } from '../../src/lib/schema-admin/runtime-client';
import { fetchRelations } from '../../src/lib/schema-admin/client';
afterEach(()=>{setBase('');vi.restoreAllMocks();});
it('uses the configured Kit base for actual schema and relation client requests',async()=>{
  setBase('/cms');const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>new Response(JSON.stringify({success:true,data:{items:[]}}),{headers:{'Content-Type':'application/json'}}));
  await adminClient.listCollections();await fetchRelations();
  expect(fetcher.mock.calls.map(call=>call[0])).toEqual(['/cms/api/schema/collections','/cms/api/relations']);
});
it('reports a plain request failure when an unavailable API returns HTML',async()=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('<html>Not found</html>',{status:404}));
  await expect(fetchRelations()).rejects.toThrow('Schema request failed');
});
