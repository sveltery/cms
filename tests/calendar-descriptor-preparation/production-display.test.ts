// Supplemental Native controlled display assertions. No original callback credit.
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { i18n } from '@lingui/core';
import Toolbar from '../../src/lib/calendar/CalendarToolbar.svelte';
import Agenda from '../../src/lib/calendar/CalendarAgenda.svelte';
import Month from '../../src/lib/calendar/CalendarMonth.svelte';
import Entry from '../../src/lib/calendar/CalendarEntry.svelte';
import Schedule from '../../src/lib/calendar/CalendarScheduleDialog.svelte';
import { createCalendarDisplay, monthGridDays, type CalendarItem } from '../../src/lib/calendar/calendar.ts';

const display = createCalendarDisplay({ locale:'en', timeZone:'America/New_York', viewerTimeZone:'Europe/Paris', collections:[], showLocale:false });
const now = Date.parse('2026-10-15T16:00:00Z');
const item:CalendarItem = { collection:'posts', id:'one', locale:'en', title:'A title', status:'draft', kind:'scheduled', at:'2026-10-15T15:00:00Z', key:'posts:one:scheduled', time:now-3600000, day:'2026-10-15', state:'overdue' };
afterEach(()=>i18n.loadAndActivate({locale:'en',messages:{}}));

describe('controlled translated production Calendar displays',()=>{
  it('uses the Source named zone description descriptor',()=>{
    i18n.loadAndActivate({locale:'en',messages:{cfmmVf:['ZONE ',['zoneName'],' / BROWSER ',['viewerZoneName']]}});
    expect(render(Toolbar,{props:{title:'October',display,zoneTime:now,loading:false,onPrevious(){},onNext(){},onToday(){}}}).body).toContain(`ZONE ${display.zoneName} / BROWSER ${display.viewerZoneName}`);
  });
  it('uses the Source empty month descriptor values',()=>{
    i18n.loadAndActivate({locale:'en',messages:{'2vP0Qd':['EMPTY ',['monthTitle']]}});
    expect(render(Agenda,{props:{month:'2026-10',days:new Map(),today:'2026-10-15',now,display}}).body).toContain('EMPTY October 2026');
  });
  it('uses Source plural descriptors for collapsed earlier entries',()=>{
    i18n.loadAndActivate({locale:'en',messages:{se9WaZ:[['earlierCount','plural',{one:['EARLY ', '#',' SINGLE'],other:['EARLY ','#',' MULTIPLE']}]]}});
    const days=new Map([['2026-10-14',[{...item,day:'2026-10-14',state:'published' as const},{...item,key:'posts:two:published',day:'2026-10-14',state:'published' as const}]]]);
    expect(render(Agenda,{props:{month:'2026-10',days,today:'2026-10-15',now,display}}).body).toContain('EARLY 2 MULTIPLE');
  });
  it('uses the Source overdue lateness descriptor',()=>{
    i18n.loadAndActivate({locale:'en',messages:{'NV/gQ6':['LATE ',['lateness']]}});
    expect(render(Entry,{props:{item,display,now}}).body).toContain('LATE 1 hour ago');
  });
  it('uses the Source flat published state/time descriptor',()=>{
    i18n.loadAndActivate({locale:'en',messages:{kDmC2a:['FLAT ',['state'],' AT ',['time']]}});
    expect(render(Entry,{props:{item:{...item,kind:'published',state:'published'},display,now,chip:true}}).body).toContain('FLAT Published AT 11:00 AM');
  });
  it('uses Source more-entry plural/date descriptor in the month',()=>{
    i18n.loadAndActivate({locale:'en',messages:{YSXm8I:[['hidden','plural',{one:['HIDDEN ','#',' ON ',['date']],other:['HIDDEN ','#',' ON ',['date']]}]]}});
    const entries=Array.from({length:5},(_,index)=>({...item,key:`posts:${index}:scheduled`}));
    expect(render(Month,{props:{month:'2026-10',gridDays:monthGridDays('2026-10',0),days:new Map([['2026-10-15',entries]]),today:'2026-10-15',now,display,onMonthChange(){}}}).body).toContain('HIDDEN 2 ON');
  });
  it('retains the Source schedule action label while pending',()=>{
    i18n.loadAndActivate({locale:'en',messages:{}});
    const body=render(Schedule,{props:{open:true,entryKey:item.key,scheduledAt:item.at,isPending:true,onOpenChange(){},onSchedule(){}}}).body;
    expect(body).toContain('Save schedule');
    expect(body).not.toContain('Saving…');
  });
  it('retains the English descriptor fallback',()=>{
    i18n.loadAndActivate({locale:'en',messages:{}});
    expect(render(Agenda,{props:{month:'2026-10',days:new Map(),today:'2026-10-15',now,display}}).body).toContain('Nothing published or scheduled in October 2026');
  });
});
