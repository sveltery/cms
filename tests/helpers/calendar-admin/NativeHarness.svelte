<script lang="ts">
  import Agenda from '../../../src/lib/calendar/CalendarAgenda.svelte';
  import Filters from '../../../src/lib/calendar/CalendarFilters.svelte';
  import Month from '../../../src/lib/calendar/CalendarMonth.svelte';
  import Panel from '../../../src/lib/calendar/CalendarEntryPanel.svelte';
  import Page from '../../../src/lib/calendar/CalendarPage.svelte';
  let { state, kind }: { state:Record<string,any>;kind:string }=$props();
</script>
{#if kind==='Agenda'}<Agenda {...state as any}/>{:else if kind==='Filters'}<Filters {...state as any}/>{:else if kind==='Month'}<Month {...state as any}/>{:else if kind==='Panel'}<Panel {...state as any}/>{:else}<Page {...state as any}/>{/if}
