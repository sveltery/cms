<script lang="ts">
 import {getSiteSettings,updateSiteSettings} from '$lib/settings.remote';
 import type {SiteSettings} from '$lib/server/settings/types';
 let {section,settings}:{section:'general'|'social'|'seo';settings:Partial<SiteSettings>}=$props();
 let dirty=$state(false);let failure=$state('');let saved=$state(false);
 const socialLabels=[['twitter','Twitter'],['github','GitHub'],['facebook','Facebook'],['instagram','Instagram'],['linkedin','LinkedIn'],['youtube','YouTube']] as const;
</script>
<form {...updateSiteSettings.enhance(async({submit})=>{
 failure='';saved=false;
 try{await submit();if(updateSiteSettings.result){dirty=false;saved=true;}}
 catch{failure='Settings could not be saved. Your changes are still here.';}
 })} oninput={()=>{dirty=true;saved=false;}}>
 <fieldset disabled={updateSiteSettings.pending>0}>
 {#if section==='general'}
  <h2>Site Identity</h2>
  <label>Site Title <input name="title" value={settings.title??''} /></label>
  <label>Tagline <input name="tagline" value={settings.tagline??''} /></label>
  <label>Site URL <input name="url" value={settings.url??''} type="url" /></label>
  <h2>Display</h2>
  <label>Posts per page <input name="n:postsPerPage" value={settings.postsPerPage??10} type="number" min="1" max="100" /></label>
  <label>Date format <input name="dateFormat" value={settings.dateFormat??''} /></label>
  <label>Timezone <input name="timezone" value={settings.timezone??''} /></label>
 {:else if section==='social'}
  <h2>Social Profiles</h2>
  {#each socialLabels as [key,label]}<label>{label} <input name={`social.${key}`} value={settings.social?.[key]??''} /></label>{/each}
 {:else}
  <h2>Search Engine Optimization</h2>
  <label>Title Separator <input name="seo.titleSeparator" value={settings.seo?.titleSeparator??''} maxlength="10" /></label>
  <label>Google Verification <input name="seo.googleVerification" value={settings.seo?.googleVerification??''} maxlength="100" /></label>
  <label>Bing Verification <input name="seo.bingVerification" value={settings.seo?.bingVerification??''} maxlength="100" /></label>
  <label>robots.txt <textarea name="seo.robotsTxt" maxlength="5000">{settings.seo?.robotsTxt??''}</textarea></label>
 {/if}
 <button disabled={!dirty||updateSiteSettings.pending>0}>{updateSiteSettings.pending>0?'Saving…':dirty?'Save':'Saved'}</button>
 </fieldset>
 {#each updateSiteSettings.fields.allIssues()??[] as issue}<p role="alert">{issue.message}</p>{/each}
 {#if failure}<p role="alert">{failure}</p>{/if}
 {#if saved}<p role="status">{section==='social'?'Social links saved':section==='seo'?'SEO settings saved':'Settings saved'}</p>{/if}
</form>
<style>
 fieldset{border:0;padding:0;}label{display:block;margin-block:1rem;}input,textarea{display:block;inline-size:min(100%,35rem);padding:.7rem;border:1px solid #b8c1cd;border-radius:.4rem;font:inherit;}textarea{min-height:10rem;}button{padding:.7rem 1rem;}h2{font-size:1.3rem;}p[role=alert]{color:#a32020;}
</style>
