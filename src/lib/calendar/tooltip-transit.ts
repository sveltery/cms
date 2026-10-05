// Native mouse-event transport for frozen Kumo 2.6.0 safePolygon.
// Initial extraction preserves Calendar's current immediate pointer-leave close.
export interface CalendarTooltipRect {x:number;y:number;width:number;height:number;left:number;right:number;top:number;bottom:number}
export type CalendarTooltipSide='top'|'bottom'|'left'|'right';
export interface CalendarTooltipTransitEvent {type:'mousemove'|'mouseleave';clientX:number;clientY:number;insidePopup?:boolean;insideTrigger?:boolean;relatedInsidePopup?:boolean}
export interface CalendarTooltipTransitOptions {x:number;y:number;side:CalendarTooltipSide;rects:()=>{trigger:CalendarTooltipRect;popup:CalendarTooltipRect};onClose:()=>void}
export function createCalendarTooltipTransit(options:CalendarTooltipTransitOptions){
  return {move(_event:CalendarTooltipTransitEvent){options.onClose();},destroy(){}};
}
