// Selected source auth/me.ts persisted welcomeDismissed write at immutable
// EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; MIT2026 Cloudflare Inc.
// Native current-role/session/profile host. No session/credential algorithm edits.
import type {RequestEvent} from '@sveltejs/kit';
import {CmsError} from '../database/contract.ts';
import {requestIdentity} from '../auth/identity-request.ts';
import {identityAdapter,identityDb} from '../auth/identity-store.ts';
export async function dismissCurrentWelcome(event:RequestEvent){
 const principal=event.locals.cms?.principal;
 if(!principal)throw new CmsError('UNAUTHENTICATED');
 const context=requestIdentity(event,true),user=await identityAdapter(context.database).getUserById(principal.id);
 if(!user)throw new CmsError('UNAUTHENTICATED');
 // Pinned whole-data merge uses the trusted loaded user's data; session state
 // never stores this flag. The existing safe projection then reads it afresh.
 await identityDb(context.database).updateTable('_cms_auth_profiles').set({data:JSON.stringify({...user.data,welcomeDismissed:true}),updated_at:new Date().toISOString()}).where('user_id','=',user.id).execute();
 return {success:true};
}
