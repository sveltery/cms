import type {RequestEvent} from '@sveltejs/kit';
/** Only the actual registered storage-image route is exempt from D1 bookmark writes. */
export function isStorageImageRequest(event:Pick<RequestEvent,'route'|'request'>):boolean{
 return event.route?.id==='/_image'&&(event.request.method==='GET'||event.request.method==='HEAD');
}
