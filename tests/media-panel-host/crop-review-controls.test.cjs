/** Finite Current Native value controls over actual compiled handlers/predicates.
 * Supplemental only: no DOM, Source callback, backend or geometry credit.
 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {parse}=require('svelte/compiler'),ts=require('typescript');
const root=path.resolve(__dirname,'../..'),native=fs.readFileSync(path.join(root,'src/lib/media/MediaDetails.svelte'),'utf8');
const ast=parse(native,{modern:true});
function descendants(node,found=[]){
 if(node&&typeof node==='object'){
  found.push(node);
  for(const [key,value]of Object.entries(node)){
   if(key==='parent')continue;
   if(Array.isArray(value))value.forEach(child=>descendants(child,found));
   else if(value&&typeof value==='object')descendants(value,found);
  }
 }
 return found;
}
function expression(attribute){const value=Array.isArray(attribute?.value)?attribute.value[0]:attribute?.value;return value?.expression;}
const elements=descendants(ast.fragment).filter(node=>node.type==='RegularElement'&&node.name==='button');
const reset=elements.find(node=>node.attributes.some(a=>a.name==='aria-label'&&a.value[0]?.data==='Reset crop'));
const option=elements.find(node=>node.attributes.some(a=>a.name==='aria-selected'&&expression(a)&&native.slice(expression(a).start,expression(a).end)==='value===aspectMode'));
assert.ok(reset&&option,'actual Native crop controls must exist');
const text=node=>native.slice(node.start,node.end);
const disabled=text(expression(reset.attributes.find(a=>a.name==='disabled')));
const optionHandler=text(expression(option.attributes.find(a=>a.name==='onclick')));
const resetHandler=text(expression(reset.attributes.find(a=>a.name==='onclick')));
const script=native.slice(ast.instance.content.start,ast.instance.content.end);
const sf=ts.createSourceFile('Native.ts',script,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
let formatDate;
const functions=[];
function visit(node){
 if(ts.isVariableDeclaration(node)&&node.name.getText(sf)==='formatDate')formatDate=node.initializer.getText(sf);
 if(ts.isFunctionDeclaration(node)&&['clearCrop','resetCrop','changeCropAspect'].includes(node.name?.text))functions.push(node.getText(sf));
 ts.forEachChild(node,visit);
}
visit(sf);assert.ok(formatDate,'actual Native uploaded formatter must exist');
const js=code=>ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const state=(overrides={})=>({busy:null,cropFailed:false,cropChanged:false,aspectMode:'original',value:'square',crop:{x:0,y:0,width:80,height:80},pixels:{x:0,y:0,width:80,height:80},cropStatus:'Creating cropped copy...',cropError:'',aspectOpen:true,aspects:[['original','Original'],['freeform','Freeform'],['square','Square'],['4:3','4:3'],['3:2','3:2'],['16:9','16:9']],...overrides});
function activate(handler,context){vm.runInNewContext(js('(()=>{'+functions.join('\n')+'\n('+handler+')();})();'),context);}

for(const aspectMode of ['freeform','square','4:3'])test(`Native reset allows unchanged ${aspectMode} aspect`,()=>{
 assert.equal(vm.runInNewContext(disabled,state({aspectMode})),false);
});
test('Native reset is disabled when the crop source failed after a changed selection',()=>{
 assert.equal(vm.runInNewContext(disabled,state({cropFailed:true,cropChanged:true})),true);
});
test('Native exposed aspect handler preserves the complete pending crop draft',()=>{
 const current=state({busy:'crop'}),before=structuredClone(current);activate(optionHandler,current);assert.deepEqual(current,before);
});
test('Native reset handler preserves the complete pending crop draft',()=>{
 const current=state({busy:'crop'}),before=structuredClone(current);activate(resetHandler,current);assert.deepEqual(current,before);
});
test('Native upload formatter includes the pinned hour and minute in the actual time zone',()=>{
 const actual=vm.runInNewContext(js('const formatDate='+formatDate+';formatDate("2025-01-15T10:30:00Z");'),{Date});
 assert.equal(actual,'Jan 15, 2025, 05:30 AM');
});
