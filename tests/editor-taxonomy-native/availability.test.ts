import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
const root=new URL('../../',import.meta.url);
test('the native content editor has a taxonomy sidebar component',()=>{assert.equal(existsSync(new URL('src/lib/ui/EditorTaxonomySidebar.svelte',root)),true);});
test('the native editor detail route mounts its entry taxonomy section',()=>{assert.match(readFileSync(new URL('src/routes/content/[collection]/[id]/+page.svelte',root),'utf8'),/EditorTaxonomySidebar/);});
