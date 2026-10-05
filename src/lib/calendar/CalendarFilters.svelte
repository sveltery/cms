<script lang="ts">
  // EmDash1.1.0 CalendarFilters selection/order contracts, pin913cb1bb; MIT.
  import { CALENDAR_STATES, type CalendarDisplay, type CalendarFilterValues } from './calendar.ts';
  import { stateLabels } from './entry.ts';
  let { display, collections, locales, value, onChange, triggerRef }: {
    display:CalendarDisplay; collections:{slug:string;label:string}[]; locales:readonly string[];
    value:CalendarFilterValues; onChange:(value:Partial<CalendarFilterValues>)=>void;
    triggerRef?:{current:HTMLButtonElement|null};
  } = $props();
  let open=$state(false), trigger=$state<HTMLButtonElement>();
  const count=$derived(value.collections.length+value.locales.length+value.states.length);
  const groups=$derived([{key:'collections' as const,label:'Collection',options:collections.map(c=>({value:c.slug,label:c.label}))},
    ...(locales.length>1?[{key:'locales' as const,label:'Locale',options:locales.map(locale=>({value:locale,label:new Intl.DisplayNames([display.locale],{type:'language'}).of(locale)??locale}))}]:[]),
    {key:'states' as const,label:'State',options:CALENDAR_STATES.map(state=>({value:state,label:stateLabels[state]}))}]);
  $effect(()=>{if(triggerRef)triggerRef.current=trigger??null;});
  function toggle(key:keyof CalendarFilterValues, selected:string, options:{value:string}[]) {
    const previous:readonly string[]=value[key];
    const next=previous.includes(selected)?previous.filter(v=>v!==selected):[...previous,selected];
    onChange({[key]:options.map(v=>v.value).filter(v=>next.includes(v))});
  }
</script>
<div class="filter"><button type="button" bind:this={trigger} aria-haspopup="menu" aria-expanded={open} aria-label={count?`Filter: ${count} selected`:undefined} onclick={()=>open=!open}>Filter {#if count}<span>{count}</span>{/if}</button>
{#if open}<div role="menu" aria-label="Calendar filters" onkeydown={event=>{if(event.key==='Escape'){open=false;trigger?.focus();}}} tabindex="-1">
  {#each groups as group}<div role="group" aria-label={group.label}><h3>{group.label}</h3>
  {#each group.options as option}<button type="button" role="menuitemcheckbox" aria-checked={(value[group.key] as readonly string[]).includes(option.value)} onclick={()=>toggle(group.key,option.value,group.options)}>{option.label}</button>{/each}</div>{/each}
  {#if count}<button type="button" role="menuitem" onclick={()=>{onChange({collections:[],locales:[],states:[]});open=false;trigger?.focus();}}>Clear filters</button>{/if}
</div>{/if}</div>
<style>.filter{position:relative;}button{font:inherit;padding:.55rem .8rem;border:1px solid var(--border,#ccc);border-radius:.35rem;background:var(--card,#fff);color:inherit;cursor:pointer;}[role="menu"]{position:absolute;right:0;top:calc(100% + .35rem);z-index:30;min-width:15rem;max-height:32rem;overflow:auto;padding:.5rem;background:var(--card,#fff);border:1px solid var(--border,#ccc);box-shadow:0 8px 24px #0002;}[role="menu"] button{display:block;width:100%;text-align:left;border:0;}[aria-checked="true"]::before{content:'✓ ';}h3{font-size:.7rem;text-transform:uppercase;opacity:.65;margin:.5rem;}button:focus-visible{outline:2px solid var(--ring,#165ccc);}</style>
