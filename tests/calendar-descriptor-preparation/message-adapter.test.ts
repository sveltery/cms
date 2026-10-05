// Supplemental Native singleton/catalog-owner assertions, not a Source test port.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '@lingui/core';
import { createCalendarMessageAdapter } from '../../src/lib/calendar/messages.ts';

afterEach(()=>{i18n.loadAndActivate({locale:'en',messages:{}});vi.restoreAllMocks();});
describe('Calendar-owned controlled message adapter',()=>{
  it('prefers the existing loaded Source descriptor ID',()=>{
    i18n.loadAndActivate({locale:'en',messages:{AjVXBS:['Agenda owner calendar']}});
    expect(createCalendarMessageAdapter(()=>{}).translate('Calendar')).toBe('Agenda owner calendar');
  });
  it('preserves actual Source named descriptor values',()=>{
    i18n.loadAndActivate({locale:'en',messages:{'4kyjCt':[['title'],' REPLACED ',['when']]}});
    expect(createCalendarMessageAdapter(()=>{}).translate('{title} now goes live {when}.',{title:'Entry',when:'Friday'})).toBe('Entry REPLACED Friday');
  });
  it('preserves the Source numeric compact plural variable',()=>{
    i18n.loadAndActivate({locale:'en',messages:{'7oibsn':[['0','plural',{one:['SINGLE ','#'],other:['MULTIPLE ','#']}]]}});
    const adapter=createCalendarMessageAdapter(()=>{});
    expect(adapter.translate('{0, plural, one {# entry} other {# entries}}',{'0':1})).toBe('SINGLE 1');
    expect(adapter.translate('{0, plural, one {# entry} other {# entries}}',{'0':3})).toBe('MULTIPLE 3');
  });
  it('invalidates on same-locale catalog replacement',()=>{
    i18n.loadAndActivate({locale:'en',messages:{AjVXBS:['First']}});
    const change=vi.fn(),adapter=createCalendarMessageAdapter(change),unsubscribe=adapter.subscribe();
    i18n.load('en',{AjVXBS:['Second']});
    expect(change).toHaveBeenCalledTimes(1);
    expect(adapter.translate('Calendar')).toBe('Second');
    unsubscribe();
  });
  it('observes changed active locale',()=>{
    i18n.loadAndActivate({locale:'en',messages:{}});
    const change=vi.fn(),adapter=createCalendarMessageAdapter(change),unsubscribe=adapter.subscribe();
    i18n.loadAndActivate({locale:'fr',messages:{AjVXBS:['Calendrier']}});
    expect(change).toHaveBeenCalledTimes(1);
    expect(adapter.locale).toBe('fr');
    expect(adapter.translate('Calendar')).toBe('Calendrier');
    unsubscribe();
  });
  it('stops forwarding catalog events after owner cleanup',()=>{
    i18n.loadAndActivate({locale:'en',messages:{}});
    const change=vi.fn(),adapter=createCalendarMessageAdapter(change),unsubscribe=adapter.subscribe();
    unsubscribe();i18n.load('en',{AjVXBS:['Unobserved']});
    expect(change).not.toHaveBeenCalled();
  });
  it('formats inline English fallback with the production compiler disabled',()=>{
    i18n.loadAndActivate({locale:'en',messages:{}});
    i18n.setMessagesCompiler(undefined as unknown as Parameters<typeof i18n.setMessagesCompiler>[0]);
    const adapter=createCalendarMessageAdapter(()=>{});
    expect(adapter.translate('{hidden, plural, one {# more entry on {date}} other {# more entries on {date}}}',{hidden:2,date:'Friday'})).toBe('2 more entries on Friday');
    expect(adapter.translate('{title} now goes live {when}.',{title:'Entry',when:'Friday'})).toBe('Entry now goes live Friday.');
  });
  it('preserves unbootstrapped SSR without activating the singleton',()=>{
    i18n.loadAndActivate({locale:'',messages:{}});
    const adapter=createCalendarMessageAdapter(()=>{});
    expect(adapter.translate('Calendar')).toBe('Calendar');
    expect(adapter.translate('Now · {time}',{time:'noon'})).toBe('Now · noon');
    expect(i18n.locale).toBe('');
  });
});
