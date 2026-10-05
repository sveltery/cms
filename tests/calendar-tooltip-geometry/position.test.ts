// Supplemental controlled computational transport, not actual browser geometry.
// Expectations follow literal frozen Kumo/AnchorPositioning/FloatingUI defaults.
import {describe,expect,it} from 'vitest';
import type {Platform} from '@floating-ui/dom';
import {computeCalendarTooltipPosition} from '../../src/lib/calendar/tooltip-position.ts';
const rect=(x:number,y:number,width:number,height:number)=>({x,y,width,height,left:x,top:y,right:x+width,bottom:y+height});
function setup(reference:ReturnType<typeof rect>,width:number,height:number,viewport={width:400,height:300},clipping=rect(0,0,viewport.width,viewport.height)){
  const trigger={getBoundingClientRect:()=>reference} as Element;
  const floatingRect=rect(0,0,width,height);
  const popup={getBoundingClientRect:()=>floatingRect,clientWidth:width,clientHeight:height,style:{setProperty(){}}} as unknown as HTMLElement;
  const arrow={getBoundingClientRect:()=>rect(0,0,20,10),clientWidth:20,clientHeight:10} as HTMLElement;
  const platform:Platform={
    getElementRects:async()=>({reference,floating:floatingRect}),
    getClippingRect:async()=>clipping,
    getDimensions:async element=>element===arrow?{width:20,height:10}:{width,height},
    isRTL:async()=>false,isElement:async()=>true,
    getOffsetParent:async()=>popup,
    // Controlled rectangles already use viewport coordinates. Supply the
    // documented platform conversion rather than polyfilling a browser global.
    convertOffsetParentRelativeRectToViewportRelativeRect:async({rect})=>rect,
    getScale:async()=>({x:1,y:1}),
    getDocumentElement(){throw new Error('Controlled rectangle fixture has no DOM document');},
    getClientRects(){throw new Error('Controlled fixture has no inline client rectangles');},
  };
  return{trigger,popup,arrow,platform,viewport};
}
describe('Native production tooltip positioning transport',()=>{
  it('retains Source10px top gap and center alignment',async()=>{const f=setup(rect(100,100,40,20),80,50);const value=await computeCalendarTooltipPosition(f.trigger,f.popup,f);expect(value).toMatchObject({x:80,y:40,placement:'top'});});
  it('uses Source5px clipping padding at the left edge',async()=>{const f=setup(rect(0,100,40,20),80,50);const value=await computeCalendarTooltipPosition(f.trigger,f.popup,f);expect(value.x).toBe(5);});
  it('uses Source5px clipping padding at the right edge',async()=>{const f=setup(rect(360,100,40,20),80,50);const value=await computeCalendarTooltipPosition(f.trigger,f.popup,f);expect(value.x).toBe(315);});
  it('flips to the bottom when the Source top side overflows',async()=>{const f=setup(rect(100,10,40,20),80,50);const value=await computeCalendarTooltipPosition(f.trigger,f.popup,f);expect(value).toMatchObject({x:80,y:40,placement:'bottom'});});
  it('uses the Source end-axis fallback when neither vertical side fits',async()=>{const f=setup(rect(100,70,40,20),80,100,{width:400,height:160});const value=await computeCalendarTooltipPosition(f.trigger,f.popup,f);expect(value).toMatchObject({x:150,y:30,placement:'right'});});
  it('honors the Source clipping-ancestor rectangle rather than only viewport',async()=>{const f=setup(rect(105,100,40,20),80,50,{width:400,height:300},rect(100,0,200,300));const value=await computeCalendarTooltipPosition(f.trigger,f.popup,f);expect(value.x).toBe(105);});
  it('positions the Source20px arrow toward the trigger center',async()=>{const f=setup(rect(100,100,40,20),80,50);const value=await computeCalendarTooltipPosition(f.trigger,f.popup,f);expect(value.middlewareData.arrow?.x).toBe(30);});
  it('reports a reference hidden outside the Source clipping boundary',async()=>{const f=setup(rect(-100,100,40,20),80,50);const value=await computeCalendarTooltipPosition(f.trigger,f.popup,f);expect(value.middlewareData.hide?.referenceHidden).toBe(true);});
});
