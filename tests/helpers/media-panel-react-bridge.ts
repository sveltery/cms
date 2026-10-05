/** Test-only React props host for the actual native Svelte detail component.
 * No DOM/assertion/behavior substitution. Source item omissions and provider metadata survive.
 * Permission arrays compose the isolated Source widget fixture; zero identity/authorization credit.
 */
import * as React from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useRouter} from '@tanstack/react-router';
import {mount, unmount, flushSync, type ComponentProps} from 'svelte';
import MediaDetails from '../../src/lib/media/MediaDetails.svelte';
import type {MediaItem} from '../../src/lib/media/types';
import {mediaPanelState} from './media-panel-state.svelte';
import {MediaPanelRefTransport} from './media-panel-ref-transport';
export interface MediaDetailPanelProps {
 open:boolean; item:MediaItem & {provider?:string;meta?:Record<string,unknown>}; embedded?:boolean; context?:'library'|'content';
 providerName?:string;canDelete?:boolean;canMoveLocation?:boolean;canCropOriginal?:boolean;canReplaceOriginal?:boolean;canDuplicateCrop?:boolean;
 requestExitRef?:React.MutableRefObject<(()=>void)|null>;restoreFocusTargetRef?:React.RefObject<HTMLElement|null>;
 onClose:()=>void;onExit?:()=>void;onClosed?:()=>void;onUpdated?:()=>void;onItemRefreshed?:(item:MediaItem)=>void;
 onCroppedCopyCreated?:(item:MediaItem)=>void;onUnavailable?:(id:string)=>void;onDeleted?:()=>void;
}
function nativeProps(props:MediaDetailPanelProps,queryClient:ReturnType<typeof useQueryClient>,router:ReturnType<typeof useRouter>|undefined) {
 const permissions:string[]=[];
 if(!props.item.provider && (props.item.mimeType.startsWith('image/')||props.canMoveLocation))permissions.push('media:edit_any');
 if((props.context??'library')==='library' && (!props.item.provider || props.canDelete))permissions.push('media:delete_any');
 if(props.canDuplicateCrop)permissions.push('media:upload');
 return {open:props.open,item:props.item,permissions,embedded:props.embedded??false,context:props.context??'library',providerName:props.providerName,canDelete:props.canDelete,canMoveLocation:props.canMoveLocation,canDuplicateCrop:props.canDuplicateCrop??false,canReplaceOriginal:props.canReplaceOriginal??props.canCropOriginal??false,
  queryClient,requestExitRef:props.requestExitRef?new MediaPanelRefTransport(props.requestExitRef):undefined,restoreFocusTargetRef:props.restoreFocusTargetRef?new MediaPanelRefTransport(props.restoreFocusTargetRef):undefined,
  onnavigate:router?((entry:{collection:string;contentId:string;locale:string|null})=>{void router.navigate({to:'/content/$collection/$id',params:{collection:entry.collection,id:entry.contentId},search:{locale:entry.locale??undefined}});}):undefined,
  onclose:props.onClose,onexit:props.onExit,onclosed:props.onClosed,ondeleted:props.onDeleted,
  onupdated:(item:MediaItem)=>{props.onItemRefreshed?.(item);props.onUpdated?.();},
  oncreated:props.onCroppedCopyCreated,onunavailable:props.onUnavailable};
}
function MountedPanel(props:MediaDetailPanelProps) {
 const queryClient=useQueryClient(),router=useRouter({warn:false});
 const target=React.useRef<HTMLDivElement>(null);
 const state=React.useRef<ReturnType<typeof mediaPanelState>|null>(null);
 if(!state.current)state.current=mediaPanelState(nativeProps(props,queryClient,router));
 React.useLayoutEffect(()=>{flushSync(()=>Object.assign(state.current!,nativeProps(props,queryClient,router)));});
 React.useLayoutEffect(()=>{let instance:ReturnType<typeof mount>;flushSync(()=>{instance=mount(MediaDetails,{target:target.current!,props:state.current as unknown as ComponentProps<typeof MediaDetails>});});return()=>{void unmount(instance!);};},[]);
 return React.createElement('div',{ref:target});
}
export function MediaDetailPanel(props:MediaDetailPanelProps){return React.createElement(MountedPanel,props);}
