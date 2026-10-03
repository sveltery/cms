<script lang="ts">
  // EmDash 1.1.0 MIT, Copyright 2026 Cloudflare Inc.; notices/emdash-MIT.txt.
  // Svelte rendering of whole pinned Redirects.tsx behavior; authority in parity.
  import {onMount} from 'svelte';
  import * as defaultApi from '../redirects/client.ts';
  import type {Redirect,NotFoundSummary,RedirectListOptions} from '../redirects/client.ts';
  type RedirectApi=Pick<typeof defaultApi,'fetchRedirects'|'fetch404Summary'|'createRedirect'|'updateRedirect'|'deleteRedirect'>;
  let {api=defaultApi,canManage=true}:{api?:RedirectApi;canManage?:boolean}=$props();
  let tab=$state<'redirects'|'404s'>('redirects');
  let redirects=$state<Redirect[]>([]),notFound=$state<NotFoundSummary[]>([]),nextCursor=$state<string>();
  let loops=$state<string[]>([]),loading=$state(true),error=$state(''),busy=$state(false);
  let search=$state(''),debouncedSearch=$state(''),filterEnabled=$state('all'),filterAuto=$state('all');
  let showForm=$state(false),edit=$state<Redirect|null>(null),deleteId=$state<string|null>(null);
  let source=$state(''),destination=$state(''),type=$state('301'),enabled=$state(true),groupName=$state('');
  let formError=$state(''),formBusy=$state(false),mounted=$state(false),requestGeneration=0;
  const terminal=$derived(type==='410'||type==='451');
  function options(cursor?:string):RedirectListOptions{return {search:debouncedSearch||undefined,
    enabled:filterEnabled==='all'?undefined:filterEnabled==='true',auto:filterAuto==='all'?undefined:filterAuto==='true',cursor,limit:100};}
  async function loadRedirects(append=false){
    const generation=++requestGeneration;loading=true;error='';
    try{const page=await api.fetchRedirects(options(append?nextCursor:undefined));if(generation!==requestGeneration)return;
      redirects=append?[...redirects,...page.items]:page.items;nextCursor=page.nextCursor;
      loops=append?[...new Set([...loops,...page.loopRedirectIds??[]])]:page.loopRedirectIds??[];
    }catch(cause){if(generation===requestGeneration)error=cause instanceof Error?cause.message:'Failed to fetch redirects';}
    finally{if(generation===requestGeneration)loading=false;}
  }
  async function load404s(){try{notFound=await api.fetch404Summary(50);}catch(cause){error=cause instanceof Error?cause.message:'Failed to fetch 404 summary';}}
  async function reset(){await loadRedirects();if(tab==='404s')await load404s();}
  async function mutate(operation:()=>Promise<unknown>,resetOnError=false){
    busy=true;error='';try{await operation();await reset();return true;}
    catch(cause){error=cause instanceof Error?cause.message:'Failed to change redirect';if(resetOnError)await reset();return false;}
    finally{busy=false;}
  }
  function openForm(redirect:Redirect|null=null,prefill=''){
    edit=redirect;source=redirect?.source??prefill;destination=redirect?.destination??'';type=String(redirect?.type??301);
    enabled=redirect?.enabled??true;groupName=redirect?.groupName??'';formError='';showForm=true;
  }
  async function submit(event:SubmitEvent){
    event.preventDefault();formBusy=true;formError='';
    const input={source:source.trim(),destination:terminal?'':destination.trim(),type:Number(type),enabled,groupName:groupName.trim()||null};
    try{if(edit)await api.updateRedirect(edit.id,input);else await api.createRedirect(input);showForm=false;await reset();}
    catch(cause){formError=cause instanceof Error?cause.message:'Failed to save redirect';}finally{formBusy=false;}
  }
  onMount(()=>{mounted=true;return()=>{requestGeneration++;};});
  $effect(()=>{if(!mounted)return;const value=search;const timer=setTimeout(()=>{debouncedSearch=value;},300);return()=>clearTimeout(timer);});
  $effect(()=>{if(mounted){debouncedSearch;filterEnabled;filterAuto;void loadRedirects();}});
  $effect(()=>{if(mounted&&tab==='404s')void load404s();});
</script>

<section class="redirects-page" aria-label="Redirect management">
  <header><div><h1>Redirects</h1><p>Manage URL redirects and view 404 errors.</p></div>
    {#if canManage}<button type="button" onclick={()=>openForm()}>New Redirect</button>{/if}</header>
  <div class="tabs" role="tablist" aria-label="Redirect sections">
    <button id="redirects-tab" type="button" role="tab" aria-controls="redirects-content" aria-selected={tab==='redirects'} onclick={()=>tab='redirects'}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={tab==='redirects'?'M3 5h18v5H3zM3 14h18v5H3z':'M3 7h18M17 3l4 4-4 4M21 17H3m4-4-4 4 4 4'} /></svg>
      Redirects {#if !loading}<span>{redirects.length}{nextCursor?'+':''}</span>{/if}</button>
    <button id="not-found-tab" type="button" role="tab" aria-controls="not-found-content" aria-selected={tab==='404s'} onclick={()=>tab='404s'}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={tab==='404s'?'M4 2h12l4 4v16H4zM8 9l8 8m0-8-8 8':'M4 2h12l4 4v16H4V2m4 7 8 8m0-8-8 8'} /></svg>404 Errors</button>
  </div>
  {#if error}<p role="alert">{error}</p>{/if}
  {#if tab==='redirects'}
    <div id="redirects-content" role="tabpanel" aria-labelledby="redirects-tab">
      <div class="tools">
        <input type="search" aria-label="Search source or destination..." placeholder="Search source or destination..." bind:value={search} />
        <select aria-label="Filter by status" bind:value={filterEnabled}><option value="all">All statuses</option><option value="true">Enabled</option><option value="false">Disabled</option></select>
        <select aria-label="Filter by type" bind:value={filterAuto}><option value="all">All types</option><option value="false">Manual</option><option value="true">Auto (slug change)</option></select>
      </div>
      {#if loops.length}<div role="alert"><strong>Redirect loop detected</strong><p>{loops.length} {loops.length===1?'redirect is':'redirects are'} part of a loop. Visitors hitting these paths will see an error.</p></div>{/if}
      {#if loading&&redirects.length===0}<p role="status">Loading redirects...</p>
      {:else if redirects.length===0}<p>No redirects yet</p><p>Create redirect rules to manage URL changes.</p>
      {:else}<div class="table-scroll"><table><thead><tr><th>Source</th><th>Destination</th><th>Code</th><th>Hits</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{#each redirects as redirect(redirect.id)}<tr class:disabled={!redirect.enabled}>
          <td title={redirect.source}>{redirect.source}{#if redirect.auto}<small>Auto</small>{/if}</td><td title={redirect.destination}>{redirect.destination}</td><td>{redirect.type}</td><td>{redirect.hits}</td>
          <td><button type="button" role="switch" aria-checked={redirect.enabled} aria-label={redirect.enabled?'Disable redirect':'Enable redirect'} disabled={!canManage||busy}
            onclick={()=>mutate(()=>api.updateRedirect(redirect.id,{enabled:!redirect.enabled}),true)}>{redirect.enabled?'Enabled':'Disabled'}</button></td>
          <td>{#if loops.includes(redirect.id)}<span role="img" aria-label="Part of a redirect loop">⚠</span>{/if}
            {#if canManage}<button type="button" aria-label={`Edit redirect ${redirect.source}`} onclick={()=>openForm(redirect)}>Edit</button>
              <button type="button" aria-label={`Delete redirect ${redirect.source}`} onclick={()=>deleteId=redirect.id}>Delete</button>{/if}</td>
        </tr>{/each}</tbody></table></div>
        {#if nextCursor}<button type="button" disabled={loading} onclick={()=>loadRedirects(true)}>Load more</button>{/if}
      {/if}
    </div>
  {:else}
    <div id="not-found-content" role="tabpanel" aria-labelledby="not-found-tab">
      {#if notFound.length===0}<p>No 404 errors recorded yet.</p>
      {:else}<div class="table-scroll"><table><thead><tr><th>Path</th><th>Hits</th><th>Last seen</th><th>Actions</th></tr></thead><tbody>
        {#each notFound as item(item.path)}<tr><td>{item.path}</td><td>{item.count}</td><td>{Number.isNaN(new Date(item.lastSeen).getTime())?item.lastSeen:new Date(item.lastSeen).toLocaleDateString()}</td>
          <td>{#if canManage}<button type="button" aria-label={`Create redirect for ${item.path}`} onclick={()=>{openForm(null,item.path);tab='redirects';}}>Create redirect</button>
            <button type="button" aria-label={`Mark ${item.path} as Gone (410)`} disabled={busy} onclick={()=>mutate(()=>api.createRedirect({source:item.path,destination:'',type:410,enabled:true}))}>410</button>{/if}</td></tr>{/each}
      </tbody></table></div>{/if}
    </div>
  {/if}
  {#if showForm}
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="redirect-form-title">
      <h2 id="redirect-form-title">{edit?'Edit Redirect':'New Redirect'}</h2><p>{edit?'Update this redirect rule.':'Use [param] or [...rest] in paths for pattern matching.'}</p>
      <form onsubmit={submit}>
        <label>Source path<input name="source" bind:value={source} required /></label>
        {#if !terminal}<label>Destination path<input name="destination" bind:value={destination} required /></label>{/if}
        <label>Status code<select name="type" bind:value={type}><option value="301">301 Permanent</option><option value="302">302 Temporary</option><option value="307">307 Temporary (Strict)</option><option value="308">308 Permanent (Strict)</option><option value="410">410 Content Deleted (Gone)</option><option value="451">451 Unavailable for legal reasons</option></select></label>
        <label>Group (optional)<input name="groupName" bind:value={groupName} /></label><label><input type="checkbox" bind:checked={enabled} />Enabled</label>
        {#if formError}<p role="alert">{formError}</p>{/if}<div class="dialog-actions"><button type="button" onclick={()=>showForm=false}>Cancel</button><button type="submit" disabled={formBusy}>{formBusy?(edit?'Saving...':'Creating...'):(edit?'Save':'Create')}</button></div>
      </form>
    </div>
  {/if}
  {#if deleteId}<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="delete-redirect-title"><h2 id="delete-redirect-title">Delete redirect?</h2><p>This redirect will be permanently deleted.</p>
    <button type="button" onclick={()=>deleteId=null}>Cancel</button><button type="button" disabled={busy} onclick={async()=>{const id=deleteId!;if(await mutate(()=>api.deleteRedirect(id)))deleteId=null;}}>Delete</button></div>{/if}
</section>

<style>
  .redirects-page { display: grid; gap: 20px; } header { display:flex; justify-content:space-between; align-items:start; gap:16px; } h1 { margin:0; font-size:32px; } p { color:var(--muted-foreground); }
  button,input,select { font:inherit; border:1px solid var(--border); background:var(--background); color:var(--foreground); border-radius:6px; padding:8px 12px; } button { cursor:pointer; } button:disabled { opacity:.6; cursor:default; }
  .tabs,.tools,.dialog-actions { display:flex; gap:8px; flex-wrap:wrap; } .tabs button { display:flex; align-items:center; gap:8px; } .tabs button[aria-selected="true"] { background:var(--accent); font-weight:650; } svg { width:18px; height:18px; stroke:currentColor; fill:none; stroke-width:2; }
  .tools { margin-bottom:16px; } .tools input { flex:1; min-width:180px; } table { width:100%; border-collapse:collapse; text-align:left; font-size:14px; } td,th { padding:10px; border-bottom:1px solid var(--border); } td { overflow-wrap:anywhere; } td button { margin:2px; } small { display:block; } .table-scroll { overflow-x:auto; } tr.disabled { opacity:.55; }
  .dialog { position:fixed; z-index:100; inset:50% auto auto 50%; transform:translate(-50%,-50%); max-width:560px; width:calc(100% - 32px); max-height:90vh; overflow-y:auto; background:var(--background); border:1px solid var(--border); border-radius:12px; padding:24px; box-shadow:0 0 0 100vmax #0006; } form { display:grid; gap:16px; } label { display:grid; gap:6px; } label:has(input[type="checkbox"]) { display:flex; align-items:center; } .dialog-actions { justify-content:flex-end; }
  :is(button,input,select):focus-visible { outline:2px solid var(--ring); outline-offset:2px; } [role="alert"] { color:var(--destructive); } @media(max-width:600px){header{flex-direction:column;}th,td{padding:6px;}}
</style>
