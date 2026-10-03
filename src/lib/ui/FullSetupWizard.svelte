<script lang="ts">
 import {tick} from 'svelte';
 import {getSiteSetup,setupSiteConfiguration} from '$lib/setup.remote';
 import {beginSetup,completeSetup} from '$lib/auth.remote';
 import {createPasskey} from '$lib/auth/passkey-browser';
 let {loginHref='/login'}:{loginHref?:string}=$props();
 const status=await getSiteSetup().then(data=>({data,unavailable:false}),()=>({data:null,unavailable:true}));
 let step=$state<'site'|'admin'|'passkey'|'success'>('site');
 let title=$state(status.data?.seedInfo?.title??''),tagline=$state(status.data?.seedInfo?.tagline??'');
 let includeContent=$state(status.data?.seedInfo?.hasContent??false);
 let failure=$state(''),pending=$state(false),credentialJSON=$state('');
 let progress=$state<{done:number;total:number}|undefined>();
 async function register(){
  failure='';pending=true;
  try{
   // A fresh challenge/nonce is issued for each browser registration attempt.
   await beginSetup.submit();if(!beginSetup.result)throw new Error('Missing passkey options');
   const credential=await createPasskey(beginSetup.result.options);credentialJSON=JSON.stringify(credential);await tick();
   await completeSetup.submit();if(!completeSetup.result)throw new Error('Registration failed');step='success';
  }catch{failure='Setup could not be completed. Please try again.';}finally{pending=false;}
 }
</script>

{#if status.unavailable}
 <h1>Set up your site</h1><p role="status">Setup is unavailable until the database and public URL are configured.</p>
{:else}
 <h1>{step==='site'?'Set up your site':step==='admin'?'Create your account':step==='passkey'?'Secure your account':'Your account is ready'}</h1>
 <ol aria-label="Setup progress"><li aria-current={step==='site'?'step':undefined}>Site</li><li aria-current={step==='admin'?'step':undefined}>Account</li><li aria-current={step==='passkey'?'step':undefined}>Passkey</li></ol>
 <form hidden={step!=='site'} novalidate {...setupSiteConfiguration.enhance(async({submit})=>{
  failure='';if(!title.trim()){failure='Site title is required';return;}pending=true;
  try{
   let lastDone=-1;await submit();
   for(;;){const result=setupSiteConfiguration.result;if(!result)throw new Error('Setup failed');if(result.seedComplete!==false)break;
    if(!result.seedProgress||result.seedProgress.done<=lastDone)throw new Error('Setup failed');lastDone=result.seedProgress.done;progress=result.seedProgress;await setupSiteConfiguration.submit();
   }
   progress=undefined;step='admin';
  }catch{failure='Setup failed. Continue to try again.';}finally{pending=false;}
 })}>
  <fieldset disabled={pending}>
   <label>Site Title <input {...setupSiteConfiguration.fields.title.as('text')} bind:value={title} /></label>
   <label>Tagline <input {...setupSiteConfiguration.fields.tagline.as('text')} bind:value={tagline} /></label>
   <fieldset><legend>How do you want to start?</legend>
    <label><input type="radio" value="empty" checked={!includeContent} onchange={()=>includeContent=false} /> Empty site</label>
    {#if status.data?.seedInfo?.hasContent}<label><input type="radio" value="sample" checked={includeContent} onchange={()=>includeContent=true} /> Sample content</label>{/if}
   </fieldset>
   <input {...setupSiteConfiguration.fields.includeContent.as('checkbox')} checked={includeContent} hidden aria-hidden="true" />
   <button>Continue</button>
  </fieldset>
  {#if progress}<p role="status">{progress.done} of {progress.total} items</p><progress value={progress.done} max={progress.total}></progress>{/if}
 </form>
 <form hidden={step!=='admin'} {...beginSetup.enhance(async({submit})=>{
  failure='';pending=true;try{await submit();if(beginSetup.result)step='passkey';}catch{failure='Failed to create admin';}finally{pending=false;}
 })}>
  <fieldset disabled={pending}>
   <label>Your Email <input {...beginSetup.fields.email.as('email')} required autocomplete="email" /></label>
   <label>Your Name <input {...beginSetup.fields.name.as('text')} autocomplete="name" /></label>
   <button type="button" onclick={()=>{failure='';step='site';}}>Back</button><button>Continue</button>
  </fieldset>
 </form>
 {#if step==='passkey'}
  <h2>With a passkey, you don’t need to remember complex passwords</h2>
  <p>Save a passkey on your device to sign in securely.</p>
  <button type="button" disabled={pending} onclick={register}>Create passkey</button>
  <button type="button" disabled={pending} onclick={()=>{failure='';step='admin';}}>Back</button>
  <noscript><p>Passkeys require JavaScript. Enable JavaScript to create your account.</p></noscript>
 {/if}
 <form {...completeSetup} hidden aria-hidden="true"><input {...completeSetup.fields.credential.as('hidden',credentialJSON)} /></form>
 {#if step==='success'}<p>Your passkey is saved.</p><a href={loginHref}>Open the dashboard</a>{/if}
 {#each [...(setupSiteConfiguration.fields.allIssues()??[]),...(beginSetup.fields.allIssues()??[])] as issue}<p role="alert">{issue.message}</p>{/each}
 {#if failure}<p role="alert">{failure}</p>{/if}
{/if}
<style>
 :global(body){margin:0;background:#f5f6f8;color:#202735;font-family:system-ui,sans-serif;}
 h1{font-size:2rem;line-height:1.25;}ol{display:flex;gap:2rem;padding-inline-start:1rem;}li[aria-current]{font-weight:700;}
 form{margin-block:1.5rem;}fieldset{border:0;padding:0;}fieldset fieldset{margin-block:1.25rem;}label{display:block;margin-block:1rem;}input:not([type=radio],[type=checkbox]){display:block;padding:.7rem;inline-size:100%;box-sizing:border-box;margin-top:.35rem;}button,a{padding:.7rem 1rem;margin-inline-end:.5rem;}button{cursor:pointer;}[hidden]{display:none;}[role=alert]{color:#ac2020;}
</style>
