// Native URL transport for EmDash1.1.0 calendar content-client contracts.
// Pin913cb1bb; MIT notices/emdash-MIT.txt. Source calls and payloads retained;
// Native routes delegate to the published lifecycle. No query cache is created.
import { API_BASE,apiFetch,parseApiResponse } from '../sections-widgets/client.ts';
import type { CalendarContent,CalendarManifest,CalendarUser } from './ui-types.ts';
export { ApiResponseError } from '../sections-widgets/client.ts';
export type ContentItem=CalendarContent;
export type CurrentUser=CalendarUser;
function contentUrl(collection:string,id:string,locale?:string){
  const path=`${API_BASE}/calendar/content/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`;
  return locale?`${path}?${new URLSearchParams({locale})}`:path;
}
export async function fetchManifest():Promise<CalendarManifest>{return parseApiResponse(await apiFetch(`${API_BASE}/calendar/manifest`),'Failed to load calendar settings');}
export async function fetchCurrentUser():Promise<CalendarUser|null>{return parseApiResponse(await apiFetch(`${API_BASE}/calendar/user`),'Failed to load current user');}
export async function fetchContent(collection:string,id:string,options:{locale?:string}={}):Promise<CalendarContent>{return parseApiResponse(await apiFetch(contentUrl(collection,id,options.locale)),"Could not load this entry's details.");}
async function action(collection:string,id:string,body:Record<string,unknown>,locale?:string):Promise<CalendarContent>{
  return parseApiResponse(await apiFetch(contentUrl(collection,id,locale),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),'Could not update the schedule');
}
export function publishContent(collection:string,id:string,options:{locale:string;_rev?:string}){return action(collection,id,{action:'publish',...(options._rev===undefined?{}:{_rev:options._rev})},options.locale);}
export function scheduleContent(collection:string,id:string,scheduledAt:string,options:{locale:string}){return action(collection,id,{action:'schedule',scheduledAt},options.locale);}
export function unscheduleContent(collection:string,id:string,options:{locale:string}){return action(collection,id,{action:'unschedule'},options.locale);}
export async function fetchTranslations(collection:string,id:string):Promise<{translationGroup:string|null;translations:{id:string;locale:string;status:string}[]}>{return parseApiResponse(await apiFetch(`${contentUrl(collection,id)}?view=translations`),'Failed to load translations');}
export interface PreviewUrlResponse {url:string;expiresAt?:string}
/** Whole pinned frontend preview fallback; the preview producer is separate. */
export async function getPreviewUrl(
	collection: string,
	id: string,
	options?: {
		expiresIn?: string;
		pathPattern?: string;
	},
): Promise<PreviewUrlResponse | null> {
	try {
		const response = await apiFetch(`${API_BASE}/content/${collection}/${id}/preview-url`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(options || {}),
		});

		if (response.status === 500) {
			const body: unknown = await response.json().catch(() => ({}));
			if (
				typeof body === "object" &&
				body !== null &&
				"error" in body &&
				typeof body.error === "object" &&
				body.error !== null &&
				"code" in body.error &&
				body.error.code === "NOT_CONFIGURED"
			) {
				return null;
			}
			throw new Error("Failed to get preview URL");
		}

		return parseApiResponse<PreviewUrlResponse>(response, "Failed to get preview URL");
	} catch {
		return null;
	}
}
