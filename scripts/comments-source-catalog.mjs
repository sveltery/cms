import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(new URL('../package.json',import.meta.url));const linguiRequire=createRequire(require.resolve('@lingui/conf'));
const {compileMessageOrThrow}=linguiRequire('@lingui/message-utils/compileMessage');const {generateMessageId}=linguiRequire('@lingui/message-utils/generateMessageId');
const source=fs.readFileSync(new URL('../parity/emdash/comments-source/authority/packages/admin/src/locales/en/messages.po.txt',import.meta.url),'utf8');
export function compileCommentsSourceCatalog() {
const catalog={};let entries=0;
for(const block of source.split(/\r?\n\r?\n/)){
 let id='',translation='',field=null;
 for(const line of block.split(/\r?\n/)){
  if(!line||line.startsWith('#'))continue;
  const match=/^(msgid|msgstr)\s+(".*")$/.exec(line);
  if(match){field=match[1];if(field==='msgid')id=JSON.parse(match[2]);else translation=JSON.parse(match[2]);continue;}
  if(line.startsWith('"')){if(field==='msgid')id+=JSON.parse(line);else if(field==='msgstr')translation+=JSON.parse(line);else throw new Error('PO continuation without field');continue;}
  throw new Error('Unsupported pinned PO record: '+line);
 }
 if(!id)continue;
 if(!translation)throw new Error('Missing English translation: '+id);
 catalog[generateMessageId(id)]=compileMessageOrThrow(translation);entries++;
}
return {catalog,entries};
}
