// Supplemental Native toolbar semantics using actual pinned CalendarDisplay
// Intl formatters; no mocked geometry/time-zone producer or HTTP/auth probes.
import { afterEach,describe,expect,it } from 'vitest';
import { flushSync,mount,unmount } from 'svelte';
import Toolbar from '../../src/lib/calendar/CalendarToolbar.svelte';
import { createCalendarDisplay,type CalendarDisplay } from '../../src/lib/calendar/calendar.ts';
let component:ReturnType<typeof mount>|undefined,target:HTMLElement|undefined;
afterEach(async()=>{if(component)await unmount(component);component=undefined;target?.remove();target=undefined;});
const zoneTime=Date.parse('2030-12-15T12:00:00Z');
function render(display:CalendarDisplay){target=document.createElement('div');document.body.append(target);component=flushSync(()=>mount(Toolbar,{target:target!,props:{title:'December 2030',display,zoneTime,loading:false,onPrevious:()=>{},onNext:()=>{},onToday:()=>{}}}));}
describe('Native Calendar toolbar zone semantics',()=>{
  it('suppresses a duplicate short zone even when the full site/viewer zones differ',()=>{
    const display=createCalendarDisplay({locale:'en',timeZone:'America/Denver',viewerTimeZone:'America/Phoenix',collections:[],showLocale:false});
    expect(display.viewerZoneDiffers).toBe(true);expect(display.zoneShortName(zoneTime)).toBe(display.viewerZoneShortName(zoneTime));render(display);
    expect(target!.querySelector('p')!.textContent).not.toContain('Your time:');
  });
  it('exposes both full zone names in accessible text when short zones differ',()=>{
    const display=createCalendarDisplay({locale:'en',timeZone:'America/New_York',viewerTimeZone:'UTC',collections:[],showLocale:false});render(display);
    const zone=target!.querySelector('p')!;
    expect(zone.textContent).toContain(`Times are in ${display.zoneName}. Your browser uses ${display.viewerZoneName}.`);
  });
});
