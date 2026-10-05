// Supplemental Native value controls from whole pinned Source App/locales/Calendar contracts.
// Controlled singleton/SSR execution earns no protected HTTP, original callback or browser credit.
import { afterEach,describe,expect,it } from 'vitest';
import { render } from 'svelte/server';
import { i18n } from '@lingui/core';
import { bootstrapCalendarLocale } from '../../src/lib/calendar/locale-browser.ts';
import { translateCalendarMessage } from '../../src/lib/calendar/messages.ts';
import Entry from '../../src/lib/calendar/CalendarEntry.svelte';
import Panel from '../../src/lib/calendar/CalendarEntryPanel.svelte';
import Month from '../../src/lib/calendar/CalendarMonth.svelte';
import { createCalendarDisplay,monthGridDays,type CalendarItem } from '../../src/lib/calendar/calendar.ts';

const now=Date.parse('2026-10-15T16:00:00Z');
const item:CalendarItem={collection:'posts',id:'one',locale:'fr',title:'Locale entry',status:'draft',kind:'scheduled',at:'2026-10-15T15:00:00Z',key:'posts:one:scheduled',time:now-3600000,day:'2026-10-15',state:'overdue'};
const display=createCalendarDisplay({locale:'en',timeZone:'America/New_York',collections:[],showLocale:true});
const client={fetchContent:async()=>({id:'one',type:'posts',locale:'fr',updatedAt:'2026-10-15T15:00:00Z'}),publishContent:async()=>{},scheduleContent:async()=>{},unscheduleContent:async()=>{}};
afterEach(()=>i18n.loadAndActivate({locale:'en',messages:{}}));

describe('actual browser locale bootstrap boundary',()=>{
  it('initializes the resolved Source display locale on the existing cold singleton',async()=>{
    i18n.loadAndActivate({locale:'',messages:{}});
    await bootstrapCalendarLocale('fr');
    expect(i18n.locale).toBe('fr');
  });
  it('loads the whole current locale catalog before translated UI output',async()=>{
    i18n.loadAndActivate({locale:'de',messages:{}});
    await bootstrapCalendarLocale('de');
    expect(translateCalendarMessage('Calendar')).toBe('Kalender');
  });
  it('loads English Source catalog entries even when current locale is already English',async()=>{
    i18n.loadAndActivate({locale:'en',messages:{}});
    await bootstrapCalendarLocale('en');
    expect(Object.keys(i18n.messages).length).toBe(3184);
  });
  it('retains the sole existing current locale owner when request display locale differs',async()=>{
    i18n.loadAndActivate({locale:'de',messages:{}});
    await bootstrapCalendarLocale('fr');
    expect(i18n.locale).toBe('de');
  });
});

describe('actual production content locale endonyms',()=>{
  for(const [locale,label]of [['de','Deutsch'],['fr','Français'],['zh-tw','繁體中文'],['it','Italiano']] as const){
    it(`renders Source ${locale} endonym in entry`,()=>{
      i18n.loadAndActivate({locale:'en',messages:{}});
      expect(render(Entry,{props:{item:{...item,locale},display,now}}).body).toContain(label);
    });
    it(`renders Source ${locale} endonym in entry detail panel`,()=>{
      i18n.loadAndActivate({locale:'en',messages:{}});
      expect(render(Panel,{props:{item:{...item,locale},display,now,compact:false,client,onClose(){},onRescheduled(){}}}).body).toContain(label);
    });
  }
});

describe('actual compact calendar locale direction',()=>{
  for(const locale of ['ar','fa'] as const)it(`uses Source RTL for ${locale} without a separate caller direction`,()=>{
    i18n.loadAndActivate({locale,messages:{}});
    const localized=createCalendarDisplay({locale,timeZone:'America/New_York',collections:[],showLocale:false});
    expect(render(Month,{props:{month:'2026-10',gridDays:monthGridDays('2026-10',0),days:new Map(),today:'2026-10-15',now,display:localized,compact:true,onMonthChange(){}}}).body).toContain('dir="rtl"');
  });
  it('preserves Source LTR for English',()=>{
    i18n.loadAndActivate({locale:'en',messages:{}});
    expect(render(Month,{props:{month:'2026-10',gridDays:monthGridDays('2026-10',0),days:new Map(),today:'2026-10-15',now,display,compact:true,onMonthChange(){}}}).body).toContain('dir="ltr"');
  });
});
