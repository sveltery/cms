// Widget mock response-shape adaptation only. Retain the exact current Source fixture and returned fields;
// never fabricate persisted edits, provider results, file admission, or completed storage cleanup.
const items=new Map<string,Record<string,unknown>>();
export function rememberPanelFixture(item:Record<string,unknown> & {id:string}){items.set(item.id,item);}
export function forgetPanelFixture(item:Record<string,unknown> & {id:string}){if(items.get(item.id)===item)items.delete(item.id);}
export function nativeMockRow(id:string,row:unknown){
 if(typeof row!=='object'||row===null)throw new TypeError('Source API mock returned a non-object media row');
 const previous=items.get(id);
 return {...previous,...row,url:(row as {url?:string}).url||previous?.url};
}
