<script lang="ts">
  // Controlled production caller; no API, URL, session or storage fixture.
  import {provideCalendarMessages} from '../../src/lib/calendar/message-context.svelte.ts';
  import {createCalendarDisplay,monthGridDays} from '../../src/lib/calendar/calendar.ts';
  import Schedule from '../../src/lib/calendar/CalendarScheduleDialog.svelte';
  import Month from '../../src/lib/calendar/CalendarMonth.svelte';
  const messages=provideCalendarMessages();
  const display=$derived(createCalendarDisplay({locale:messages.locale||'en',timeZone:'America/New_York',collections:[],showLocale:false}));
</script>
<Schedule open={false} entryKey="posts:one:scheduled" locale={messages.locale||'en'} onOpenChange={()=>{}} onSchedule={()=>{}} />
<Month month="2026-10" gridDays={monthGridDays('2026-10',0)} days={new Map()} today="2026-10-15" now={Date.parse('2026-10-15T16:00:00Z')} {display} compact onMonthChange={()=>{}} />
