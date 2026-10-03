// Test-only transport: complete Source JSX callbacks mount the actual native Svelte controls.
import * as React from 'react';
import {flushSync,mount,unmount} from 'svelte';
import Dialog from './BulkTaxonomyHost.svelte';
import Selection from '../../src/lib/bulk-taxonomy/BulkTaxonomySelection.svelte';
import type {BulkTaxonomyDialogProps,BulkTaxonomyClient} from '../../src/lib/bulk-taxonomy/types';
import {i18n} from '@lingui/core';
import {bulkTagPosts,createTerm,fetchTerms} from '../../parity/emdash/bulk-taxonomy/source/packages/admin/src/lib/api/taxonomies';
import {getEntryTitle} from '../../parity/emdash/bulk-taxonomy/source/packages/admin/src/lib/entryTitle';
const client:BulkTaxonomyClient={terms:fetchTerms,createTerm,bulkTag:bulkTagPosts};
export function BulkTagDialog(props:Omit<BulkTaxonomyDialogProps,'client'>){
 const target=React.useRef<HTMLDivElement>(null),instance=React.useRef<ReturnType<typeof mount>|null>(null);
 React.useLayoutEffect(()=>{instance.current=flushSync(()=>mount(Dialog,{target:target.current!,props:{initial:{...props,client,adminLocale:i18n.locale}}}));return()=>{void unmount(instance.current!);instance.current=null;};},[]);
 React.useLayoutEffect(()=>{(instance.current as {setOpen?:(value:boolean)=>void}|null)?.setOpen?.(props.open);},[props.open]);
 return React.createElement('div',{ref:target});
}
export function ContentList(props:{collection:string;collectionLabel:string;items:Array<{id:string;data:Record<string,unknown>;slug:string|null;locale?:string}>;bulkTagTaxonomies:BulkTaxonomyDialogProps['taxonomies'];activeLocale?:string;i18n?:{defaultLocale:string};titleField?:string}){
 const target=React.useRef<HTMLDivElement>(null);
 React.useLayoutEffect(()=>{const instance=flushSync(()=>mount(Selection,{target:target.current!,props:{collection:props.collection,collectionLabel:props.collectionLabel,items:props.items.map(item=>({collection:props.collection,id:item.id,title:getEntryTitle(item,props.titleField),locale:item.locale})),taxonomies:props.bulkTagTaxonomies,client,activeLocale:props.activeLocale,defaultLocale:props.i18n?.defaultLocale,adminLocale:i18n.locale}}));return()=>{void unmount(instance);};},[]);
 return React.createElement('div',{ref:target});
}
