<script lang="ts">
  // Same production message owner as CalendarPage; no second singleton/listener.
  import {provideCalendarMessages} from '../../src/lib/calendar/message-context.svelte.ts';
  import Schedule from '../../src/lib/calendar/CalendarScheduleDialog.svelte';
  provideCalendarMessages();
</script>
<Schedule open={false} entryKey="posts:entry:scheduled" locale="fr" onOpenChange={()=>{}} onSchedule={()=>{throw Error('invalid input must not schedule');}}/>
