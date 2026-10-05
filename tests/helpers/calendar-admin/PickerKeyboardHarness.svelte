<script lang="ts">
  import { untrack } from 'svelte';
  import Month from '../../../src/lib/calendar/CalendarMonth.svelte';
  import { createCalendarDisplay, monthGridDays, type CalendarItem } from '../../../src/lib/calendar/calendar.ts';
  import { getDayPickerLocale } from '../../../src/lib/ui/date-time-locales.ts';
  let { locale = 'en', direction = 'ltr', initialMonth = '2030-10', onMonthChange }: {
    locale?: string; direction?: 'ltr' | 'rtl'; initialMonth?: string; onMonthChange: (month: string) => void;
  } = $props();
  let month = $state(untrack(() => initialMonth));
  const display = $derived(createCalendarDisplay({ locale, timeZone: 'UTC', viewerTimeZone: 'UTC', collections: [], showLocale: false }));
  const gridDays = $derived(monthGridDays(month, getDayPickerLocale(locale).options?.weekStartsOn ?? 0));
  const days = new Map<string, CalendarItem[]>();
  function changeMonth(next: string) { month = next; onMonthChange(next); }
</script>
<Month {month} {gridDays} {days} {display} today="2030-10-15" now={Date.parse('2030-10-15T12:00:00Z')}
  compact onMonthChange={changeMonth} {...{ dir: direction }}/>
