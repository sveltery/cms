<script lang="ts">
 import {tick} from 'svelte';
 import {goto} from '$app/navigation';
 import {base} from '$app/paths';
 import {buildNavItems,filterNavItems,type CommandPaletteManifest} from '$lib/search/command-palette-nav.ts';
 import type {SearchResult} from '$lib/search/types.ts';
 let {manifest,role}:{manifest:CommandPaletteManifest;role:number}=$props();
 let open=$state(false),query=$state(''),pending=$state(false),results=$state<SearchResult[]>([]),focused=$state(0);
 let input=$state<HTMLInputElement>(),dialog=$state<HTMLElement>();let invoker:HTMLElement|undefined;let timer:ReturnType<typeof setTimeout>|undefined;let controller:AbortController|undefined;
 const nav=$derived(filterNavItems(buildNavItems(manifest,role,value=>value),query,value=>value));
 const items=$derived([...nav.map(item=>({id:item.id,title:item.title,to:item.to.replace(/\$(\w+)/g,(_whole,key)=>item.params?.[key]??''),description:'Navigation'})),...results.map(item=>({id:`content-${item.collection}-${item.id}`,title:item.title??item.slug??item.id,to:`/content/${item.collection}/${item.id}`,description:manifest.collections[item.collection]?.label??item.collection}))]);
 async function show(){invoker=document.activeElement instanceof HTMLElement?document.activeElement:undefined;open=true;query='';results=[];focused=0;await tick();input?.focus();}
 function close(){open=false;clearTimeout(timer);controller?.abort();pending=false;if(invoker?.isConnected)invoker.focus();}
 async function navigate(path:string,newTab=false){close();if(newTab)window.open(base+path,'_blank');else await goto(base+path);}
 function search(){
  clearTimeout(timer);controller?.abort();results=[];focused=0;
  if(query.length<2){pending=false;return;}
  pending=true;const value=query;
  timer=setTimeout(async()=>{
   const active=new AbortController();controller=active;
   try{
    const response=await fetch(`${base}/api/search?q=${encodeURIComponent(value)}&limit=10`,{signal:active.signal});
    if(!response.ok)return;const payload=await response.json();
    if(query===value)results=payload.data?.items??[];
   }catch(cause){if(!(cause instanceof DOMException&&cause.name==='AbortError'))results=[];}
   finally{if(controller===active)pending=false;}
  },300);
 }
 function keyboard(event:KeyboardEvent){
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();if(open)close();else void show();return;}
  if(!open)return;
  if(event.key==='Tab'){
   const controls=dialog?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]');
   const first=controls?.[0],last=controls?.[controls.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
  if(event.key==='Escape'){event.preventDefault();close();}
  if(event.key==='ArrowDown'){event.preventDefault();focused=Math.min(focused+1,items.length-1);}
  if(event.key==='ArrowUp'){event.preventDefault();focused=Math.max(focused-1,0);}
  if(event.key==='Enter'&&items[focused]){event.preventDefault();void navigate(items[focused].to,event.ctrlKey||event.metaKey);}
 }
</script>
<svelte:window onkeydown={keyboard}/>
{#if open}
 <div class="shade" role="presentation" onclick={event=>{if(event.target===event.currentTarget)close();}}>
  <div bind:this={dialog} role="dialog" aria-modal="true" aria-label="Search and navigation" tabindex="-1">
   <input bind:this={input} bind:value={query} oninput={search} placeholder="Search pages and content..." aria-label="Search pages and content" aria-controls="command-results" aria-activedescendant={items[focused]?.id} autocomplete="off"/>
   <div id="command-results" role="listbox" aria-label="Search results">
    {#each items as item,index (item.id)}
     <a id={item.id} role="option" aria-selected={index===focused} href={base+item.to} onclick={event=>{event.preventDefault();void navigate(item.to,event.ctrlKey||event.metaKey);}}><span>{item.title}</span><small>{item.description}</small></a>
    {/each}
   </div>
   {#if pending}<p role="status">Searching...</p>{:else if items.length===0}<p role="status">No results found</p>{/if}
   <footer><span>↑ ↓ to select · Enter to open</span><button type="button" onclick={close}>Close <kbd>Esc</kbd></button></footer>
  </div>
 </div>
{/if}
<style>
 .shade{position:fixed;inset:0;background:#17203388;z-index:1000;display:grid;align-items:start;justify-items:center;padding:12vh 20px;}
 [role=dialog]{width:min(620px,100%);background:white;color:#202735;border-radius:12px;box-shadow:0 24px 80px #0005;overflow:hidden;}
 input{width:100%;border:0;border-bottom:1px solid #e2e5ea;padding:20px;font:inherit;font-size:18px;outline:none;}
 #command-results{max-height:50vh;overflow:auto;padding:8px;}
 a{display:flex;justify-content:space-between;gap:20px;padding:12px;border-radius:7px;text-decoration:none;}
 a[aria-selected=true],a:hover{background:#edf1ff;}small{color:#526079;}
 p{padding:20px;}footer{border-top:1px solid #e2e5ea;padding:10px 16px;display:flex;justify-content:space-between;font-size:12px;color:#526079;}button{border:0;background:transparent;color:inherit;cursor:pointer;}
</style>
