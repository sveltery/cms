<script lang="ts">
  // EmDash 1.1.0 segmented-time behavior, MIT Copyright 2026 Cloudflare Inc.
  // Source pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; notices/emdash-MIT.txt.
  import { addDays, addMonths, addWeeks, addYears, startOfWeek, endOfWeek, format } from 'date-fns';
  import { untrack } from 'svelte';
  import { getDayPickerLocale } from './date-time-locales';
  import { getPublishingTimeZone, resolvePublishingLocalDateTime } from './publishing-datetime';
  let { date, time, locale = 'en', disabled = false, restrictToFuture = false, dateAriaLabel,
    onDateChange, onTimeChange }: {
    date?: Date; time: string; locale?: string; disabled?: boolean; restrictToFuture?: boolean;
    dateAriaLabel: string; onDateChange?: (date: Date | undefined) => void;
    onTimeChange?: (time: string) => void;
  } = $props();
  type DayPeriod = 'am' | 'pm';
  interface TimeParts { hour: string; minute: string; period: DayPeriod; }
  const TIME_VALUE_PATTERN = /^(?<hour>\d{2}):(?<minute>\d{2})$/;
  function numericTimePart(value: string): string {
    return value
      .replace(/[\u0660-\u0669]/g, digit => String(digit.charCodeAt(0) - 0x0660))
      .replace(/[\u06f0-\u06f9]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
      .replace(/[\u0966-\u096f]/g, digit => String(digit.charCodeAt(0) - 0x0966))
      .replace(/[\u0e50-\u0e59]/g, digit => String(digit.charCodeAt(0) - 0x0e50))
      .replace(/\D/g, '').slice(0, 2);
  }
  function uses12HourClock(value: string): boolean {
    const cycle = new Intl.DateTimeFormat(value, { hour: 'numeric' }).resolvedOptions().hourCycle;
    return cycle === 'h11' || cycle === 'h12';
  }
  function dayPeriodLabel(value: string, hour: number, fallback: string): string {
    return new Intl.DateTimeFormat(value, { hour: 'numeric', hour12: true })
      .formatToParts(new Date(2020, 0, 1, hour)).find(part => part.type === 'dayPeriod')?.value ?? fallback;
  }
  function timePartsFromValue(value: string, use12: boolean): TimeParts {
    const match = TIME_VALUE_PATTERN.exec(value);
    if (!match?.groups) return { hour: '', minute: '', period: 'am' };
    const { hour = '', minute = '' } = match.groups, hour24 = Number(hour);
    if (hour24 > 23 || Number(minute) > 59) return { hour: '', minute: '', period: 'am' };
    return { hour: String(use12 ? hour24 % 12 || 12 : hour24).padStart(2, '0'), minute, period: hour24 >= 12 ? 'pm' : 'am' };
  }
  function timeValueFromParts(parts: TimeParts, use12: boolean): string {
    if (parts.hour.length !== 2 || parts.minute.length !== 2) return '';
    const hour = Number(parts.hour), minute = Number(parts.minute);
    if (minute > 59 || (use12 ? hour < 1 || hour > 12 : hour > 23)) return '';
    const hour24 = use12 ? hour % 12 + (parts.period === 'pm' ? 12 : 0) : hour;
    return `${String(hour24).padStart(2, '0')}:${parts.minute}`;
  }
  function today(): Date { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()); }
  function sameDay(left: Date | undefined, right: Date) { return Boolean(left && left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate()); }
  let month = $state(untrack(() => date ?? today()));
  $effect(() => { month = date ?? today(); });
  const use12HourClock = $derived(uses12HourClock(locale));
  let timeParts = $state(untrack(() => timePartsFromValue(time, uses12HourClock(locale))));
  let minuteInput = $state<HTMLInputElement>();
  let lastEmitted: string | null = null, previousHourCycle = untrack(() => uses12HourClock(locale));
  $effect(() => {
    const incoming = time, cycle = use12HourClock, changed = previousHourCycle !== cycle;
    previousHourCycle = cycle;
    if (!changed && lastEmitted === incoming) { lastEmitted = null; return; }
    lastEmitted = null; timeParts = timePartsFromValue(incoming, cycle);
  });
  function updateTimeParts(next: TimeParts) {
    timeParts = next; const value = timeValueFromParts(next, use12HourClock);
    lastEmitted = value; onTimeChange?.(value);
  }
  function updateHour(value: string) {
    let hour = numericTimePart(value);
    if (hour.length === 1 && Number(hour) > (use12HourClock ? 1 : 2)) hour = `0${hour}`;
    if (hour.length === 2 && (use12HourClock ? Number(hour) < 1 || Number(hour) > 12 : Number(hour) > 23)) return;
    updateTimeParts({ ...timeParts, hour });
    if (hour.length === 2) { minuteInput?.focus(); minuteInput?.select(); }
  }
  function updateMinute(value: string) {
    const minute = numericTimePart(value);
    if (minute.length === 2 && Number(minute) > 59) return;
    updateTimeParts({ ...timeParts, minute });
  }
  const calendarLocale = $derived(getDayPickerLocale(locale));
  const direction = $derived(locale === 'ar' || locale === 'fa' ? 'rtl' : 'ltr');
  const weekStartsOn = $derived(calendarLocale.options?.weekStartsOn ?? 0);
  const caption = $derived(format(month, 'LLLL y', { locale: calendarLocale }));
  const days = $derived.by(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() - weekStartsOn + 7) % 7;
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => new Date(first.getFullYear(), first.getMonth(), index - offset + 1));
  });
  const weekdays = $derived(Array.from({ length: 7 }, (_, index) => new Date(2020, 10, 1 + (weekStartsOn + index) % 7)));
  const resolution = $derived(resolvePublishingLocalDateTime(date, time));
  const zone = $derived(getPublishingTimeZone(resolution.success ? resolution.date : date ?? new Date(), locale));
  const zoneValue = $derived(zone.timeZone ? zone.shortName ? `${zone.timeZone} (${zone.shortName})` : zone.timeZone : 'Local time');
  const periods = $derived([{ value: 'am' as const, label: dayPeriodLabel(locale, 9, 'AM') }, { value: 'pm' as const, label: dayPeriodLabel(locale, 13, 'PM') }]);
  let periodOpen = $state(false), periodButton = $state<HTMLButtonElement>();
  const id = $props.id();
  let focusedDay = $state<Date | undefined>(untrack(() => date ?? today()));
  const blocked = (day: Date) => disabled || restrictToFuture && day.getTime() < today().getTime();
  const focusTarget = $derived.by(() => {
    const available = days.filter(day => day.getMonth() === month.getMonth() && !blocked(day));
    return available.find(day => sameDay(focusedDay, day)) ?? available.find(day => sameDay(date, day)) ?? available.find(day => sameDay(today(), day)) ?? available[0];
  });
  function changeMonth(delta: number) { month = new Date(month.getFullYear(), month.getMonth() + delta, 1); }
  function selectDay(day: Date) { if (!blocked(day)) onDateChange?.(sameDay(date, day) ? undefined : day); }
  function focusDay(day: Date) {
    focusedDay = day;
    if (day.getMonth() !== month.getMonth() || day.getFullYear() !== month.getFullYear()) month = new Date(day.getFullYear(), day.getMonth(), 1);
    // Focus after Svelte renders an adjacent month; the focus target belongs to this calendar.
    queueMicrotask(() => document.getElementById(`${id}-${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`)?.focus());
  }
  function calendarKey(event: KeyboardEvent, day: Date) {
    let move: (reference: Date) => Date;
    const before = direction === 'rtl' ? 1 : -1, after = -before;
    switch (event.key) {
      case 'ArrowLeft': move = reference => event.shiftKey ? addMonths(reference, before) : addDays(reference, before); break;
      case 'ArrowRight': move = reference => event.shiftKey ? addMonths(reference, after) : addDays(reference, after); break;
      case 'ArrowUp': move = reference => event.shiftKey ? addYears(reference, -1) : addWeeks(reference, -1); break;
      case 'ArrowDown': move = reference => event.shiftKey ? addYears(reference, 1) : addWeeks(reference, 1); break;
      case 'Home': move = reference => startOfWeek(reference, { locale: calendarLocale }); break;
      case 'End': move = reference => endOfWeek(reference, { locale: calendarLocale }); break;
      case 'PageUp': move = reference => event.shiftKey ? addYears(reference, -1) : addMonths(reference, -1); break;
      case 'PageDown': move = reference => event.shiftKey ? addYears(reference, 1) : addMonths(reference, 1); break;
      default: return;
    }
    event.preventDefault();
    event.stopPropagation();
    // Same direction/unit and 365-retry ceiling as pinned getNextFocus.
    let next = move(day);
    for (let attempt = 0; attempt <= 365 && blocked(next); attempt++) next = move(next);
    if (!blocked(next)) focusDay(next);
  }
  function choosePeriod(period: DayPeriod) { updateTimeParts({ ...timeParts, period }); periodOpen = false; periodButton?.focus(); }
</script>

<div class="publishing-fields" dir={direction}>
  <section class="calendar" aria-label={dateAriaLabel}>
    <div class="calendar-nav">
      <button type="button" aria-label="Go to the Previous Month" onclick={() => changeMonth(-1)}>{direction === 'rtl' ? '›' : '‹'}</button>
      <span id={`${id}-caption`} aria-live="polite">{caption}</span>
      <button type="button" aria-label="Go to the Next Month" onclick={() => changeMonth(1)}>{direction === 'rtl' ? '‹' : '›'}</button>
    </div>
    <table role="grid" aria-labelledby={`${id}-caption`}>
      <thead><tr>{#each weekdays as day}<th scope="col" aria-label={format(day, 'cccc', { locale: calendarLocale })}>{format(day, 'cccccc', { locale: calendarLocale })}</th>{/each}</tr></thead>
      <tbody>{#each Array.from({ length: days.length / 7 }, (_, index) => index) as week}
        <tr>{#each days.slice(week * 7, week * 7 + 7) as day}
          <td aria-selected={sameDay(date, day)} class:outside={day.getMonth() !== month.getMonth()}>
            <button type="button" id={`${id}-${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`}
              aria-label={`${format(day, 'PPPP', { locale: calendarLocale })}${sameDay(date, day) ? ', selected' : ''}`}
              aria-current={sameDay(today(), day) ? 'date' : undefined}
              class:selected={sameDay(date, day)} disabled={blocked(day)}
              tabindex={sameDay(focusTarget, day) ? 0 : -1}
              onclick={() => selectDay(day)} onfocus={() => { focusedDay = day; }} onkeydown={event => calendarKey(event, day)}>{day.getDate()}</button>
          </td>
        {/each}</tr>
      {/each}</tbody>
    </table>
  </section>
  <fieldset {disabled}>
    <legend>Time</legend>
    <div class="time-fields">
      <input aria-label="Hour" type="text" placeholder="--" inputmode="numeric" maxlength="2" pattern="[0-9]*" autocomplete="off" value={timeParts.hour} {disabled}
        oninput={event => { updateHour(event.currentTarget.value); event.currentTarget.value = timeParts.hour; }} onfocus={event => event.currentTarget.select()}
        onblur={event => { const hour = numericTimePart(event.currentTarget.value); if (hour.length === 1) updateHour(hour.padStart(2, '0')); }} />
      <span aria-hidden="true">:</span>
      <input bind:this={minuteInput} aria-label="Minute" type="text" placeholder="--" inputmode="numeric" maxlength="2" pattern="[0-9]*" autocomplete="off" value={timeParts.minute} {disabled}
        oninput={event => { updateMinute(event.currentTarget.value); event.currentTarget.value = timeParts.minute; }} onfocus={event => event.currentTarget.select()}
        onblur={event => { const minute = numericTimePart(event.currentTarget.value); if (minute.length === 1) updateMinute(minute.padStart(2, '0')); }} />
      {#if use12HourClock}
        <div class="period-picker">
          <button bind:this={periodButton} type="button" role="combobox" aria-label="Period" aria-haspopup="listbox" aria-controls={`${id}-periods`} aria-expanded={periodOpen} {disabled}
            onclick={() => { periodOpen = !periodOpen; }} onkeydown={event => { if (event.key === 'Escape') periodOpen = false; if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); choosePeriod(timeParts.period === 'am' ? 'pm' : 'am'); } }}>{periods.find(item => item.value === timeParts.period)?.label}</button>
          {#if periodOpen}<div id={`${id}-periods`} role="listbox" aria-label="Period">
            {#each periods as item}<button type="button" role="option" aria-selected={item.value === timeParts.period} onclick={() => choosePeriod(item.value)} onkeydown={event => { if (event.key === 'Escape') { periodOpen = false; periodButton?.focus(); } }}>{item.label}</button>{/each}
          </div>{/if}
        </div>
      {/if}
    </div>
  </fieldset>
  <p class="timezone"><span class="sr-only">Timezone: </span><bdi>{zoneValue}</bdi></p>
</div>

<style>
  .publishing-fields { display: grid; gap: 1rem; max-inline-size: 24rem; }
  .calendar-nav { display: flex; align-items: center; justify-content: space-between; gap: .5rem; margin-block-end: .5rem; }
  .calendar-nav span { font-weight: 600; }
  table { inline-size: 100%; table-layout: fixed; border-collapse: collapse; }
  th { font-weight: 400; color: #526079; font-size: .875rem; padding-block: .5rem; }
  td { text-align: center; padding: .125rem; }
  button { font: inherit; color: inherit; border: 1px solid transparent; border-radius: .375rem; background: transparent; padding: .5rem; cursor: pointer; }
  td button { inline-size: 100%; }
  button:hover:not(:disabled) { background: #e8edf6; }
  button:focus-visible { outline: 2px solid #2449b2; outline-offset: 2px; }
  button.selected { color: white; background: #2449b2; }
  button:disabled { cursor: default; opacity: .45; }
  .outside { color: #78849a; }
  fieldset { min-inline-size: 0; padding: 0; border: 0; margin: 0; }
  legend { font-weight: 600; margin-block-end: .5rem; }
  .time-fields { display: flex; gap: .5rem; align-items: center; }
  input { min-inline-size: 0; inline-size: 100%; padding: .625rem; border: 1px solid #c4cedd; border-radius: .375rem; font: inherit; font-variant-numeric: tabular-nums; }
  .period-picker { position: relative; min-inline-size: 5rem; }
  .period-picker > button { inline-size: 100%; border-color: #c4cedd; }
  [role=listbox] { position: absolute; z-index: 1; inset-block-start: 100%; inset-inline: 0; padding: .25rem; border: 1px solid #c4cedd; border-radius: .375rem; background: white; }
  [role=option] { inline-size: 100%; }
  .timezone { font-size: .875rem; color: #526079; margin: 0; }
  .sr-only { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); }
</style>
