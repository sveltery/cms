<script lang="ts">
  // Controlled display harness; production context/toolbar only, no HTTP/cache.
  import { provideCalendarMessages } from '../../src/lib/calendar/message-context.svelte.ts';
  import { createCalendarDisplay } from '../../src/lib/calendar/calendar.ts';
  import Toolbar from '../../src/lib/calendar/CalendarToolbar.svelte';
  const messages=provideCalendarMessages();
  const display=$derived(createCalendarDisplay({locale:messages.locale||'en',timeZone:'America/New_York',viewerTimeZone:'Europe/Paris',collections:[],showLocale:false}));
</script>
<h1>{messages.translate('Calendar')}</h1>
<Toolbar title={display.monthTitle('2026-10')} {display} zoneTime={Date.parse('2026-10-15T16:00:00Z')} loading={false} onPrevious={()=>{}} onNext={()=>{}} onToday={()=>{}} />
