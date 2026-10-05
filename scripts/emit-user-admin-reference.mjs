import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,relative,dirname} from 'node:path';
import ts from 'typescript';
const root=resolve(import.meta.dirname,'..'),source=resolve(root,'parity/emdash/user-admin-reference/source'),runtime=resolve(root,'parity/emdash/user-admin-reference/runtime');
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(item=>item.isDirectory()?walk(resolve(dir,item.name)):[resolve(dir,item.name)]);}
function emit(code){return ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;}
for(const file of walk(source).filter(path=>path.endsWith('.ts'))){const target=resolve(runtime,relative(source,file).replace(/\.ts$/,'.mjs'));mkdirSync(dirname(target),{recursive:true});writeFileSync(target,emit(readFileSync(file,'utf8')).replace(/(from\s+["'][^"']+)\.(?:js|ts)(["'])/g,'$1.mjs$2'));}
writeFileSync(resolve(root,'tests/helpers/user-admin-reference-db.mjs'),emit(readFileSync(resolve(root,'parity/emdash/user-admin-reference/native-helper-source/user-admin-reference-db.ts'),'utf8')));
