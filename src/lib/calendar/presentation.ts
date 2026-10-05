// Native extraction of Calendar UI behavior; EmDash1.1.0 pin913cb1bb.
// Source production and frozen Kumo2.6.0 authorities are recorded in the packet.
// MIT notices/emdash-MIT.txt. Controlled data tests grant no Source callback credit.
export function calendarInitialLoading(_pending:boolean,fetching:boolean):boolean{return fetching;}
export function calendarEditedState(_pending:boolean,available:boolean):'pending'|'value'|'unavailable'{return available?'value':'unavailable';}
export type CalendarDirection='ltr'|'rtl';
export function calendarTabTarget(_key:string,_current:number,_count:number,_direction:CalendarDirection='ltr'):number|undefined{return;}
export function calendarMenuOpenTarget(_key:string,count:number):number{return count?0:-1;}
export function createCalendarTypeahead(){return {key(_event:Pick<KeyboardEvent,'key'|'ctrlKey'|'metaKey'|'altKey'>,_labels:readonly string[],_current:number):number|undefined{return;},reset(){}};}

export interface CalendarTooltipGroup {
  delay():number;opened(close:()=>void):void;closed(close:()=>void):void;destroy():void;
}
export function createCalendarTooltipGroup(_delay=600):CalendarTooltipGroup{
  return {delay:()=>600,opened(){},closed(){},destroy(){}};
}
export function createCalendarHoverTiming(show:()=>void,hide:()=>void,_group?:CalendarTooltipGroup){
  let opening:ReturnType<typeof setTimeout>|undefined;
  const cancel=()=>{clearTimeout(opening);opening=undefined;};
  return {
    enter(pointerType:string){if(pointerType==='mouse')opening=setTimeout(show,600);},
    move(_pointerType:string,_movementX=0,_movementY=0){},
    focus(){cancel();show();},
    cancel,
    close(){cancel();hide();},
    destroy:cancel,
  };
}
