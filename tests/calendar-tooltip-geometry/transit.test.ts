// Supplemental pure Native controls of the frozen Source hover contract.
// Actual DOM targets/rects, browser clocks, focus and geometry are not exercised.
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { createCalendarTooltipTransit,type CalendarTooltipRect,type CalendarTooltipSide,type CalendarTooltipTransitEvent } from '../../src/lib/calendar/tooltip-transit.ts';
const rect=(x:number,y:number,width:number,height:number):CalendarTooltipRect=>({x,y,width,height,left:x,top:y,right:x+width,bottom:y+height});
const trigger=rect(100,100,40,20);
const fixtures={top:{popup:rect(60,50,120,40),x:120,y:100,bridge:[120,95],diagonal:[95,96]},bottom:{popup:rect(60,140,120,40),x:120,y:120,bridge:[120,125],diagonal:[95,134]},left:{popup:rect(40,80,50,60),x:100,y:110,bridge:[95,110],diagonal:[93,98]},right:{popup:rect(150,80,50,60),x:140,y:110,bridge:[145,110],diagonal:[147,98]}} as const;
const move=(x:number,y:number,extra:Partial<CalendarTooltipTransitEvent>={}):CalendarTooltipTransitEvent=>({type:'mousemove',clientX:x,clientY:y,...extra});
function setup(side:CalendarTooltipSide='top'){
  const f=fixtures[side],close=vi.fn();const owner=createCalendarTooltipTransit({x:f.x,y:f.y,side,rects:()=>({trigger,popup:f.popup}),onClose:close});return{...f,owner,close};
}
beforeEach(()=>vi.useFakeTimers({toFake:['setTimeout','clearTimeout','performance']}));
afterEach(()=>vi.useRealTimers());
describe('Source safePolygon hover transit',()=>{
  for(const side of ['top','bottom','left','right'] as const){
    it(`keeps ${side} gap bridge transit open without a timer`,()=>{const f=setup(side);f.owner.move(move(...f.bridge));vi.advanceTimersByTime(100);expect(f.close).not.toHaveBeenCalled();});
    it(`permits ${side} diagonal transit for the Source40ms intent window`,()=>{const f=setup(side);f.owner.move(move(...f.diagonal));vi.advanceTimersByTime(39);expect(f.close).not.toHaveBeenCalled();vi.advanceTimersByTime(1);expect(f.close).toHaveBeenCalledTimes(1);});
  }
  it('closes immediately outside the source polygon',()=>{const f=setup();f.owner.move(move(20,96));expect(f.close).toHaveBeenCalledTimes(1);});
  it('keeps actual popup targets open and cancels a pending intent timer',()=>{const f=setup();f.owner.move(move(...f.diagonal));f.owner.move(move(90,80,{insidePopup:true}));vi.advanceTimersByTime(100);expect(f.close).not.toHaveBeenCalled();});
  it('keeps an actual popup related target open on mouse leave',()=>{const f=setup();f.owner.move(move(120,99,{type:'mouseleave',relatedInsidePopup:true}));vi.advanceTimersByTime(100);expect(f.close).not.toHaveBeenCalled();});
  it('closes when the cursor leaves from the opposite trigger edge',()=>{const f=setup();const close=vi.fn();const owner=createCalendarTooltipTransit({x:120,y:120,side:'top',rects:()=>({trigger,popup:f.popup}),onClose:close});owner.move(move(120,120,{type:'mouseleave'}));expect(close).toHaveBeenCalledTimes(1);});
  it('closes after entering then leaving the popup outside the bridge',()=>{const f=setup();f.owner.move(move(90,80,{insidePopup:true}));f.owner.move(move(...f.diagonal));expect(f.close).toHaveBeenCalledTimes(1);});
  it('disposes its pending40ms timer when the tooltip owner is destroyed',()=>{const f=setup();f.owner.move(move(...f.diagonal));f.owner.destroy();vi.advanceTimersByTime(100);expect(f.close).not.toHaveBeenCalled();});
});
