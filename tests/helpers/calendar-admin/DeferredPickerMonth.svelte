<script lang="ts">
  // Controlled display caller applies a requested month after the old day blurs.
  // Actual production Month owns all focus/selection behavior.
  import Month from '../../../src/lib/calendar/CalendarMonth.svelte';
  import {createCalendarDisplay,monthGridDays,type CalendarItem} from '../../../src/lib/calendar/calendar.ts';
  let month=$state('2026-10'),pending=$state<string>();
  const display=createCalendarDisplay({locale:'en',timeZone:'America/New_York',collections:[],showLocale:false});
  const days=new Map<string,CalendarItem[]>();
</script>
<button type="button" data-pending-month={pending} onclick={()=>{if(pending)month=pending;}}>Apply pending month</button>
<Month {month} gridDays={monthGridDays(month,0)} {days} {display} today="2026-10-15" now={Date.parse('2026-10-15T16:00:00Z')} compact onMonthChange={next=>pending=next}/>
