// Native fixed/top-layer tooltip transport; initial extraction retains the
// existing viewport8/vertical-only placement before Source middleware repair.
import type { Platform } from '@floating-ui/dom';
export interface CalendarTooltipPositionOptions{arrow?:HTMLElement;platform?:Platform;viewport?:{width:number;height:number}}
export async function computeCalendarTooltipPosition(trigger:Element,popup:HTMLElement,options:CalendarTooltipPositionOptions={}){
  const viewport=options.viewport??{width:window.innerWidth,height:window.innerHeight};
  const reference=trigger.getBoundingClientRect(),floating=popup.getBoundingClientRect(),above=reference.top-10-floating.height;
  const below=above<8;
  return{x:Math.max(8,Math.min(reference.left+(reference.width-floating.width)/2,viewport.width-floating.width-8)),y:below?Math.max(8,Math.min(reference.bottom+10,viewport.height-floating.height-8)):above,placement:below?'bottom' as const:'top' as const,middlewareData:{} as {arrow?:{x?:number;y?:number};hide?:{referenceHidden?:boolean}}};
}
