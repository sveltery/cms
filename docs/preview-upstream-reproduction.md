# Pinned preview rendering reproduction

On 2026-10-01, a temporary Node 24.19.0 fixture rendered the unchanged EmDash 1.1.0 editor at `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e` and the local disabled preview. All 28 paired cases passed: string/text controls, seven values, and direct-default versus manifest-projected inputs. The fixture also rendered the exact local pre-fix and landed-fix source; the latter matches current rendering in every case. The unchanged [local SSR regression](../tests/draft-preview.test.ts) passed separately (14 subcases plus its parent test), copied into the temporary dependency workspace.

## Source and execution boundary

- [ContentEditor](https://github.com/emdash-cms/emdash/blob/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e/packages/admin/src/components/ContentEditor.tsx), blob `ad14c878697e9036558cbe521116a038c25c9eb0`: initial state is `item?.data || {}`; each field receives `formData[name]`; string and richText controls render strings unchanged and other values empty.
- [Database manifest conversion](https://github.com/emdash-cms/emdash/blob/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e/packages/core/src/api/handlers/manifest.ts), blob `a8afe936152b9cc5d8a5c426fb98a4103b7612de`: the fixture executes the unchanged `dbFieldDescriptor` declaration and its kind map, extracted by syntax-node ranges. A database field with `defaultValue: 'Schema default'` produces a descriptor without that property. Validation/relation branches are not exercised.
- [Draft status helper](https://github.com/emdash-cms/emdash/blob/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e/packages/admin/src/lib/api/content.ts), blob `b18e6eba3a7485400f07002175d0c143b175b422`: its unchanged declaration is used for the unpublished fixture.
- Local source: [pre-fix `63b4025`](https://github.com/sveltery/cms/blob/63b4025b5f8e0cf660322c17a850d9705a5614e0/src/lib/ui/DraftPreview.svelte), blob `73dd98c0a06c6d86cfb950e06acc077b6eceff5b`; [fix `066e1879`](https://github.com/sveltery/cms/blob/066e1879ae21b0d891b69627ec8138da77243cc5/src/lib/ui/DraftPreview.svelte), blob `8ff5498f6245f9534236b93914b7cc587c80bb90`; [composition main `a9726b2a`](https://github.com/sveltery/cms/blob/a9726b2a67e57290e7c49b1ddb2a1b9b1f4b1ada/src/lib/ui/DraftPreview.svelte), blob `9a8ce68f0a7ca29152195dc6afbe2c0240ac3d28`.

The full unchanged editor component is compiled with Lingui macros and rendered with real React/React DOM 19.2.4 and Kumo 2.6.0. Lingui 5.9.5 matches the upstream lockfile. Unrelated child panels/icons/router links are null fixtures; network/media/other unused helpers throw if invoked. Hotkeys are inert and locale-catalog loading is not invoked. Selected value-handling helpers, React state, field forwarding and Kumo input controls are real. An English Lingui fixture config supplies source messages. The direct-default arm deliberately injects an extra `defaultValue` property outside upstream's `FieldDescriptor`; the projected arm uses the real conversion output. Local fields are projected correspondingly without defaults, matching [the current manifest contract](session-composition.md).

This is bounded static rendering through the editor field path, not a browser, database/API, full manifest handler or whole-admin parity run. Effects, interactions, default application during database writes, relation/validation conversion and rich field families remain outside this fixture. The npm fixture installs exact direct dependency versions rather than recreating the entire upstream workspace lock. Upstream remains MIT-licensed; see [upstream provenance](../parity/emdash/README.md).

## Observed results and classification

Both string and text controls produce the same values below. `empty` means an empty rendered value.

| Input, with a directly supplied schema default | Pinned EmDash | Local before fix | Local fix/current |
| --- | --- | --- | --- |
| absent own key | empty | Schema default | Schema default |
| explicit null | empty | Schema default | empty |
| empty string | empty | empty | empty |
| stored string | Saved value | Saved value | Saved value |
| false (runtime probe) | empty | false | false |
| zero (runtime probe) | empty | 0 | 0 |
| inherited string (runtime probe) | Inherited value | Inherited value | Schema default |

With projected descriptors lacking defaults, absent keys and explicit null render empty upstream, before the fix and now. Stored/empty strings agree; false/zero still stringify locally. The inherited-string probe renders its inherited value upstream and before the fix, but empty locally now. These runtime probes do not expand supported persisted string/text/null values; inherited properties do not survive ordinary persisted JSON records.

The **explicit-null correction is a fidelity repair at the exercised direct-default control boundary**: it changes the local default display to the pinned empty display. The projected no-default null case already matched before the fix. It is not a shared upstream defect, and this narrow result does not establish new whole-editor parity.

**C-16 is an intentional local preview difference:** direct callers receive an absent-key schema-default fallback that EmDash's descriptor/editor does not provide; the landed own-key guard treats inherited keys as absent; unsupported runtime false/zero values stringify rather than being discarded. The default fallback presents local schema metadata in the temporary preview; the own-key guard reflects persisted own-key records; coercion follows the local scalar controls. These observations are comparison evidence, not parity credit or an acceptance decision. Default fallback/coercion were already present before the fix; inherited-key handling changed with `066e1879`. All landed in [PR #6](https://github.com/sveltery/cms/pull/6), merge `8bd3e62fe131116670fea7b87e623ba30fd84b19`; specific deviation acceptance is not recorded. UI writes remain disabled and projected defaults remain absent.

The [compatibility register](../parity/emdash/compatibility.md), [content contract](content-remotes.md) and [review record](content-remote-review.md) index this result. Unimplemented browser/editor and persistence scope stays separate from the verified control behavior.

## Executable temporary fixture

Set `CMS_CHECKOUT` to a checkout whose preview source matches composition main `a9726b2a`; no product files are changed. In an empty temporary directory, prepare the sources and dependencies:

```sh
export CMS_CHECKOUT=/path/to/sveltery/cms
preview_work=$(mktemp -d)
cd "$preview_work"
git clone --no-checkout https://github.com/emdash-cms/emdash.git source
mkdir upstream
git -C source archive 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e packages/admin/src packages/core/src/api/handlers/manifest.ts LICENSE | tar -x -C upstream
git -C "$CMS_CHECKOUT" show 63b4025b5f8e0cf660322c17a850d9705a5614e0:src/lib/ui/DraftPreview.svelte > DraftPreview.before.svelte
git -C "$CMS_CHECKOUT" show 066e1879ae21b0d891b69627ec8138da77243cc5:src/lib/ui/DraftPreview.svelte > DraftPreview.fix.svelte
printf '%s\n' '{"private":true,"type":"module"}' > package.json
npm install --cache "$preview_work/npm-cache" --ignore-scripts --no-audit --no-fund react@19.2.4 react-dom@19.2.4 @cloudflare/kumo@2.6.0 @lingui/core@5.9.5 @lingui/react@5.9.5 @lingui/babel-plugin-lingui-macro@5.9.5 @babel/core@7.29.7 esbuild@0.28.1 svelte@5.57.1 clsx@2.1.1 tailwind-merge@3.3.0
printf '%s\n' "export default {sourceLocale:'en',locales:['en'],catalogs:[]};" > lingui.config.js
# Save the JavaScript block below as reproduce.mjs, then run:
node reproduce.mjs > result.json
```

The executed script SHA-256 is `f39e78dd9029c9dfeb3d383a074198b90a6fd62c627ef1de2ea1f1ec674724e7`. Its output includes all observed rows and source SHA-256 values: editor `52547a10dcb248ec1776e8e1894625db5fe97ba34919b593d63a22cea02a3b25`, manifest `3189c60627da4021b7b5382f9e0cedd59734f12c575e9ca12549feeaccb2aa5b`, local current `1e3a5056c50002447eecdf88f3d4dffa2210a49f5b92fbb2a62fa5b6dc7bb68b`. The recorded result JSON SHA-256 is `4f54ec4e50aea9c7f61fa5dd03874b026f705897d1d927dadfc4f1551b87c3ff`. Existing SSR assertions are preserved.

```js
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { transformAsync, parseAsync } from '@babel/core';
import { build, transform } from 'esbuild';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';
const root = resolve('upstream');
const editor = resolve(root, 'packages/admin/src/components/ContentEditor.tsx');
const manifest = resolve(root, 'packages/core/src/api/handlers/manifest.ts');
const source = await readFile(editor, 'utf8');
const parse = (text) => parseAsync(text, { parserOpts: { plugins: ['typescript', 'jsx'] }, configFile: false, babelrc: false });
const ast = await parse(source);
const imports = new Map();
for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration' && n.importKind !== 'type')) imports.set(n.source.value, [...(imports.get(n.source.value) ?? []), ...n.specifiers.filter(s => s.importKind !== 'type').map(s => s.imported?.name).filter(Boolean)]);
const keep = new Set(['../lib/content-publishing-state.js', '../lib/datetime-local.js', '../lib/entryTitle.js', '../lib/field-label.js', '../lib/plugin-context.js', '../lib/sandboxed-editor-extensions.js', '../lib/utils', '../locales/config.js', '../locales/useLocale.js']);
const fail = name => `export const ${name}=()=>{throw new Error('Unexpected fixture dependency: ${name}')};`;
const stubs = new Map();
for (const [path, names] of imports) {
  if (path.startsWith('./')) stubs.set(path, names.map(n => `export const ${n}=()=>null;`).join('\n'));
  else if (path === '@phosphor-icons/react') stubs.set(path, names.map(n => `export const ${n}=()=>null;`).join('\n'));
  else if (path === '@tanstack/react-router') stubs.set(path, "export const Link=()=>null;");
  else if (path === 'react-hotkeys-hook') stubs.set(path, 'export const useHotkeys=()=>{};');
  else if (path.startsWith('../') && !keep.has(path)) stubs.set(path, names.map(fail).join('\n'));
}
// Use the exact pinned getDraftStatus declaration; API network calls fail if invoked.
const apiSource = await readFile(resolve(root, 'packages/admin/src/lib/api/content.ts'), 'utf8');
const apiAst = await parse(apiSource);
const status = apiAst.program.body.find(n => n.type === 'ExportNamedDeclaration' && n.declaration?.id?.name === 'getDraftStatus');
stubs.set('../lib/api', apiSource.slice(status.start, status.end) + '\n' + imports.get('../lib/api').filter(n => n !== 'getDraftStatus').map(fail).join('\n'));
const isolation = { name: 'fixture-isolation', setup(b) {
  b.onResolve({ filter: /.*/ }, a => {
    if (a.importer === editor && stubs.has(a.path)) return { path: a.path, namespace: 'fixture' };
    if (a.path.endsWith('loadMessages.js')) return { path: 'loadMessages', namespace: 'fixture' };
  });
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: a.path === 'loadMessages' ? fail('loadMessages') : stubs.get(a.path), loader: 'tsx' }));
  b.onLoad({ filter: /\.[jt]sx?$/ }, async a => {
    if (!a.path.startsWith(root)) return;
    let text = await readFile(a.path, 'utf8');
    if (text.includes('@lingui/') && text.includes('/macro')) text = (await transformAsync(text, { filename: a.path, parserOpts: { plugins: ['typescript', 'jsx'] }, plugins: [['@lingui/babel-plugin-lingui-macro', { stripMessageField: false }]], configFile: false, babelrc: false })).code;
    return { contents: text, loader: a.path.endsWith('x') ? 'tsx' : 'ts' };
  });
}};
await build({ entryPoints: [editor], outfile: 'editor.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external', plugins: [isolation] });
const { ContentEditor } = await import('./editor.mjs');
i18n.loadAndActivate({ locale: 'en', messages: {} });
// Execute the unchanged manifest conversion declaration with its exact kind map.
const manifestSource = await readFile(manifest, 'utf8');
const manifestAst = await parse(manifestSource);
const nodes = manifestAst.program.body.filter(n => (n.type === 'FunctionDeclaration' && n.id.name === 'dbFieldDescriptor') || (n.type === 'VariableDeclaration' && n.declarations.some(d => d.id.name === 'FIELD_TYPE_TO_KIND')));
await writeFile('manifest.mjs', (await transform(nodes.map(n => manifestSource.slice(n.start,n.end)).join('\n') + '\nexport { dbFieldDescriptor };', {loader:'ts',format:'esm'})).code);
const { dbFieldDescriptor } = await import('./manifest.mjs');
assert.ok(process.env.CMS_CHECKOUT, 'Set CMS_CHECKOUT to the CMS repository');
const localPath = resolve(process.env.CMS_CHECKOUT, 'src/lib/ui/DraftPreview.svelte');
const localSource = await readFile(localPath, 'utf8');
await writeFile('DraftPreview.mjs', compile(localSource, { filename: 'DraftPreview.svelte', generate: 'server' }).js.code);
const { default: DraftPreview } = await import('./DraftPreview.mjs');
const beforeSource = await readFile('DraftPreview.before.svelte','utf8');
await writeFile('DraftPreview.before.mjs',compile(beforeSource,{filename:'DraftPreview.before.svelte',generate:'server'}).js.code);
const {default: BeforePreview}=await import('./DraftPreview.before.mjs');
const fixSource=await readFile('DraftPreview.fix.svelte','utf8');
await writeFile('DraftPreview.fix.mjs',compile(fixSource,{filename:'DraftPreview.fix.svelte',generate:'server'}).js.code);
const {default: FixPreview}=await import('./DraftPreview.fix.mjs');
const cases = [['absent', {}], ['null', {value:null}], ['empty', {value:''}], ['false', {value:false}], ['zero', {value:0}], ['stored', {value:'Saved value'}], ['inherited', Object.create({value:'Inherited value'})]];
const rows=[];
for (const type of ['string', 'text']) for (const projected of [false,true]) for (const [name, values] of cases) {
  const field = {id:'value',slug:'value',label:'Value',type,...(projected ? {} : {defaultValue:'Schema default'})};
  const manifestDescriptor = dbFieldDescriptor({...field,defaultValue:'Schema default'},new Map());
  assert.equal(Object.hasOwn(manifestDescriptor,'defaultValue'),false);
  // defaultValue is deliberately supplied as an extra property: it is not in FieldDescriptor.
  const descriptor = projected ? manifestDescriptor : {...manifestDescriptor,defaultValue:'Schema default'};
  const item = {id:'fixture',type:'posts',slug:null,status:'draft',locale:'en',data:values,liveRevisionId:null,draftRevisionId:null};
  const upstream = renderToStaticMarkup(React.createElement(I18nProvider,{i18n},React.createElement(ContentEditor,{collection:'posts',collectionLabel:'Post',fields:{value:descriptor},item,isNew:false,readOnly:true,onSave:()=>{throw new Error('Unexpected save')}})));
  const local = render(DraftPreview,{props:{fields:[field],values}}).body;
  const fixed = render(FixPreview,{props:{fields:[field],values}}).body;
  const before = render(BeforePreview,{props:{fields:[field],values}}).body;
  const inputValue = (html, marker) => html.match(new RegExp(`<input\\b(?=[^>]*${marker})(?=[^>]*value="([^"]*)")[^>]*>`))?.[1];
  const up = type === 'text' ? upstream.match(/<textarea\b[^>]*[^>]*>(.*?)<\/textarea>/s)?.[1] : inputValue(upstream,'');
  const lo = type === 'text' ? local.match(/<textarea\b[^>]*>(.*?)<\/textarea>/s)?.[1] : inputValue(local,'data-field="value"');
  const prior = type === 'text' ? before.match(/<textarea\b[^>]*>(.*?)<\/textarea>/s)?.[1] : inputValue(before,'data-field="value"');
  const landed = type === 'text' ? fixed.match(/<textarea\b[^>]*>(.*?)<\/textarea>/s)?.[1] : inputValue(fixed,'data-field="value"');
  assert.equal(landed,lo);
  assert.equal(prior, ['absent','null'].includes(name) ? (projected ? '' : 'Schema default') : name === 'inherited' ? 'Inherited value' : name === 'false' ? 'false' : name === 'zero' ? '0' : name === 'stored' ? 'Saved value' : '');
  assert.equal(up, name === 'stored' ? 'Saved value' : name === 'inherited' ? 'Inherited value' : '');
  assert.equal(lo, ['absent','inherited'].includes(name) ? (projected ? '' : 'Schema default') : name === 'false' ? 'false' : name === 'zero' ? '0' : name === 'stored' ? 'Saved value' : '');
  assert.match(upstream, /<fieldset disabled/); assert.match(local, /<fieldset disabled/);
  rows.push({type,path:projected ? 'manifest-projected' : 'direct-with-default',case:name,upstream:up,before:prior,local:lo});
}
console.log(JSON.stringify({node:process.version,manifestSHA256:createHash('sha256').update(manifestSource).digest('hex'),editorSHA256:createHash('sha256').update(source).digest('hex'),fixSHA256:createHash('sha256').update(fixSource).digest('hex'),beforeSHA256:createHash('sha256').update(beforeSource).digest('hex'),localSHA256:createHash('sha256').update(localSource).digest('hex'),rows},null,2));
```
