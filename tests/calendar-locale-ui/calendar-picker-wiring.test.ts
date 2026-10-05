// Supplemental Native actual Svelte output controls from pinned CalendarMonth/
// PublishingDateTimeEditor and the qualified whole Source locale catalog.
// No original callback, protected transport, focus or real browser credit.
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { i18n } from '@lingui/core';
import Schedule from '../../src/lib/calendar/CalendarScheduleDialog.svelte';
import Month from '../../src/lib/calendar/CalendarMonth.svelte';
import { createCalendarDisplay, monthGridDays, type CalendarItem } from '../../src/lib/calendar/calendar.ts';

const now = Date.parse('2026-10-15T16:00:00Z');
const item: CalendarItem = {collection:'posts',id:'one',locale:'en',title:'One',status:'draft',kind:'scheduled',at:'2026-10-15T15:00:00Z',key:'posts:one:scheduled',time:now-3600000,day:'2026-10-15',state:'overdue'};
afterEach(() => i18n.loadAndActivate({locale:'en',messages:{}}));

describe('Calendar delegates shared labels to its existing descriptor owner', () => {
  for (const [message, id] of [['Time','LhMjLm'],['Hour','6XgEPi'],['Minute','6UYTy8'],['Period','NtQvjo'],['Timezone','40Gx0U']] as const) {
    it(`renders the exact Source ${message} descriptor in its production schedule form`, () => {
      // English locale has Source's AM/PM field; French is intentionally 24h.
      i18n.loadAndActivate({locale:'en',messages:{[id]:[`TRANSLATED ${message}`]}});
      const body = render(Schedule,{props:{open:true,entryKey:item.key,scheduledAt:item.at,locale:'en',onOpenChange(){},onSchedule(){}}}).body;
      expect(body).toContain(`TRANSLATED ${message}`);
    });
  }
});

describe('actual compact Calendar uses Source extended vendor day labels', () => {
  for (const [locale, label] of [
    ['en','Today, Thursday, October 15th, 2026, selected, 1 entry'],
    ['de','Heute, Donnerstag, 15. Oktober 2026, ausgewählt, 1 entry'],
    ['fr',"Aujourd'hui, jeudi 15 octobre 2026, sélectionné, 1 entry"]
  ] as const) {
    it(`retains ${locale} today/selection modifiers before the Source entry count`, () => {
      i18n.loadAndActivate({locale,messages:{}});
      const display = createCalendarDisplay({locale,timeZone:'America/New_York',collections:[],showLocale:false});
      const body = render(Month,{props:{month:'2026-10',gridDays:monthGridDays('2026-10',0),days:new Map([['2026-10-15',[item]]]),today:'2026-10-15',now,display,compact:true,onMonthChange(){}}}).body;
      expect(body).toContain(`aria-label="${label}"`);
    });
  }
  it('keeps a count-free label on an empty unselected day', () => {
    i18n.loadAndActivate({locale:'en',messages:{}});
    const display = createCalendarDisplay({locale:'en',timeZone:'America/New_York',collections:[],showLocale:false});
    const body = render(Month,{props:{month:'2026-10',gridDays:monthGridDays('2026-10',0),days:new Map(),today:'2026-10-15',now,display,compact:true,onMonthChange(){}}}).body;
    expect(body).toContain('aria-label="Friday, October 16th, 2026"');
  });
  it('exposes the Source date-picker grid role and year-first Japanese grid label', () => {
    i18n.loadAndActivate({locale:'ja',messages:{}});
    const display = createCalendarDisplay({locale:'ja',timeZone:'America/New_York',collections:[],showLocale:false});
    const body = render(Month,{props:{month:'2026-10',gridDays:monthGridDays('2026-10',0),days:new Map(),today:'2026-10-15',now,display,compact:true,onMonthChange(){}}}).body;
    expect(body).toMatch(/<table[^>]*role="grid"[^>]*aria-label="2026年10月"/);
  });
});
