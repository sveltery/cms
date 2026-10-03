<script lang="ts">
 // Selected immutable EmDash1.1.0 WelcomeModal/Shell behavior; native Kit UI.
 // 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; MIT2026 Cloudflare Inc.
 import {onMount} from 'svelte';
 import {getCurrentUser} from '$lib/auth.remote';
 import {dismissWelcome} from '$lib/welcome.remote';
 import WelcomeMark from './WelcomeMark.svelte';
 let user=$state<Awaited<ReturnType<typeof getCurrentUser>>|null>(null);
 let open=$state(false);
 let dialog=$state<HTMLDialogElement>();
 const firstName=$derived(user?.name?.split(' ')?.[0]?.trim()??'');
 const role=$derived(user?.role??10);
 const roleLabel=$derived(role>=50?'Administrator':role>=40?'Editor':role>=30?'Author':role>=20?'Contributor':'Subscriber');
 const roleVariant=$derived(role>=50?'primary':role>=30?'secondary':'outline');
 const scope=$derived(role>=50?'You have full access to manage this site, including users, settings, and all content.':role>=40?'You can manage content, media, menus, and taxonomies.':role>=30?'You can create and edit your own content.':'You can view and contribute to the site.');
 onMount(()=>{
  let cancelled=false;
  void getCurrentUser().then(value=>{if(!cancelled){user=value;open=!!value?.isFirstLogin;}},()=>{});
  return ()=>{cancelled=true;};
 });
 $effect(()=>{if(open&&dialog&&!dialog.open)dialog.showModal();else if(!open&&dialog?.open)dialog.close();});
 async function dismiss(){
  try{await dismissWelcome.submit();}catch{/* Pinned behavior still closes on error. */}
  finally{open=false;}
 }
</script>

<dialog bind:this={dialog} aria-labelledby="welcome-title" aria-describedby="welcome-description" oncancel={event=>{event.preventDefault();void dismiss();}}>
 <div class="header"><WelcomeMark/><button class="close" type="button" aria-label="Close" onclick={()=>void dismiss()}>×</button></div>
 <h2 id="welcome-title">{firstName?`Welcome to EmDash, ${firstName}!`:'Welcome to EmDash!'}</h2>
 <p id="welcome-description" class="description">Your account has been created successfully.</p>
 <div class="role-info">
  <div class="role"><span>Your Role</span><strong class:primary={roleVariant==='primary'} class:secondary={roleVariant==='secondary'}>{roleLabel}</strong></div>
  <p>{scope}</p>
  {#if role>=50}<p class="description">As an administrator, you can invite other users from the Users section.</p>{/if}
 </div>
 <form {...dismissWelcome.enhance(async({submit})=>{try{await submit();}catch{/* Source closes on error. */}finally{open=false;}})}>
  <button class="start" disabled={dismissWelcome.pending>0}>{dismissWelcome.pending>0?'Getting Started…':'Get Started'}</button>
 </form>
</dialog>

<style>
 dialog{width:calc(100vw - 2rem);max-width:28rem;padding:1.5rem;border:1px solid #dfe3e9;border-radius:1rem;background:white;color:#202735;box-shadow:0 1.5rem 5rem #0004;}
 dialog::backdrop{background:#11182766;}
 .header{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:1.25rem;}
 .close{width:2rem;height:2rem;border:0;border-radius:.375rem;background:transparent;font-size:1.5rem;cursor:pointer;}
 h2{margin:0;font-size:1.25rem;font-weight:600;line-height:1.25;text-align:left;overflow-wrap:anywhere;}
 p{margin:.75rem 0 0;font-size:.875rem;line-height:1.25rem;text-align:left;}
 .description{color:#526079;}
 #welcome-description{margin-top:.25rem;}
 .role-info,form{margin-top:1.25rem;padding-top:1.25rem;border-top:1px solid #dfe3e9;}
 .role{display:flex;align-items:center;gap:.5rem;font-size:.875rem;}
 .role>span{color:#526079;}
 strong{padding:.25rem .5rem;border:1px solid #dfe3e9;border-radius:.375rem;font-size:.75rem;font-weight:500;}
 strong.primary{background:#edf1ff;border-color:#d7defb;color:#263f96;}
 strong.secondary{background:#f0f2f6;}
 .start{width:100%;padding:.875rem;border:0;border-radius:.5rem;background:#263f96;color:white;font:inherit;cursor:pointer;}
 .start:disabled{opacity:.65;cursor:wait;}
 button:focus-visible{outline:3px solid #8395df;outline-offset:2px;}
</style>
