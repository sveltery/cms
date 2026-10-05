// Supplemental Native differential controls execute the EXACT frozen vendor
// safePolygon body in a controlled Node host. This is not a Source test family,
// actual DOM/browser/clock credit or a Reference UI implementation.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { createCalendarTooltipTransit,type CalendarTooltipRect,type CalendarTooltipSide,type CalendarTooltipTransitEvent } from '../../src/lib/calendar/tooltip-transit.ts';
const body=readFileSync(new URL('../../parity/emdash/calendar-tooltip-geometry/vendor/kumo-2.6.0/dist/chunks/vendor-base-ui-f9z44m829vvptrg0.js',import.meta.url),'utf8');
const wholeFunction=body.slice(body.indexOf('const of = 0.1,'),body.indexOf('const XE = {'));
const rect=(x:number,y:number,width:number,height:number):CalendarTooltipRect=>({x,y,width,height,left:x,top:y,right:x+width,bottom:y+height});
function sourceOwner(side:CalendarTooltipSide,trigger:CalendarTooltipRect,popup:CalendarTooltipRect,x:number,y:number,onClose:()=>void){
  class Timer{current:ReturnType<typeof setTimeout>|undefined;clear(){clearTimeout(this.current);this.current=undefined;}start(delay:number,callback:()=>void){this.clear();this.current=setTimeout(callback,delay);}}
  const factory=runInNewContext(wholeFunction+'\ngr;',{
    sn:Timer,performance,ct:(event:{target:unknown})=>event.target,
    Me:(element:{contains:(target:unknown)=>boolean},target:unknown)=>element.contains(target),
    at:(target:unknown)=>Boolean(target),
  });
  return factory()({x,y,placement:side,onClose,elements:{
    domReference:{contains:(target:{insideTrigger?:boolean}|null)=>Boolean(target?.insideTrigger),getBoundingClientRect:()=>trigger},
    floating:{contains:(target:{insidePopup?:boolean}|null)=>Boolean(target?.insidePopup),getBoundingClientRect:()=>popup},
  }}) as (event:unknown)=>void;
}
beforeEach(()=>vi.useFakeTimers({toFake:['setTimeout','clearTimeout','performance']}));
afterEach(()=>vi.useRealTimers());
describe('Native transit agrees with whole frozen vendor computations',()=>{
  for(const side of ['top','bottom','left','right'] as const)for(const [width,height]of[[20,10],[120,10],[20,60],[120,60]] as const){
    it(`${side}, popup ${width}x${height}, finite containment/exit/speed/intent vectors`,()=>{
      const trigger=rect(100,100,40,20);
      const popup=side==='top'?rect(90,60-height,width,height):side==='bottom'?rect(90,140,width,height):side==='left'?rect(90-width,90,width,height):rect(150,90,width,height);
      for(const [x,y]of[[100,100],[120,100],[140,120],[100,110],[140,110]] as const){
        let nativeClosed=0,sourceClosed=0;
        const native=createCalendarTooltipTransit({x,y,side,rects:()=>({trigger,popup}),onClose:()=>nativeClosed++});
        const source=sourceOwner(side,trigger,popup,x,y,()=>sourceClosed++);
        const events:CalendarTooltipTransitEvent[]=[
          {type:'mouseleave',clientX:x,clientY:y},
          {type:'mousemove',clientX:x-2,clientY:y-2},
          {type:'mousemove',clientX:x-3,clientY:y-3},
          {type:'mousemove',clientX:x-3,clientY:y-3},
          {type:'mousemove',clientX:popup.x+1,clientY:popup.y+1,insidePopup:true},
          {type:'mouseleave',clientX:popup.x+1,clientY:popup.y+1,insidePopup:true,relatedInsidePopup:true},
          {type:'mousemove',clientX:120,clientY:110,insideTrigger:true},
          {type:'mousemove',clientX:80,clientY:90},
        ];
        for(const event of events){
          native.move(event);source({...event,target:event,relatedTarget:event.relatedInsidePopup?{insidePopup:true}:null});
          expect(nativeClosed).toBe(sourceClosed);
          vi.advanceTimersByTime(20);expect(nativeClosed).toBe(sourceClosed);
        }
        vi.advanceTimersByTime(100);expect(nativeClosed).toBe(sourceClosed);native.destroy();vi.clearAllTimers();
      }
    });
  }
});
