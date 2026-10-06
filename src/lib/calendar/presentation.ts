// Native Calendar presentation adaptation from whole EmDash1.1.0 production,
// pin913cb1bb, and frozen Kumo2.6.0. MIT notices/emdash-MIT.txt.
// Pure controlled data tests grant no original Source callback or browser credit.
export function calendarInitialLoading(pending:boolean,fetching:boolean):boolean{return pending&&fetching;}
export function calendarEditedState(pending:boolean,available:boolean):'pending'|'value'|'unavailable'{return pending?'pending':available?'value':'unavailable';}
export function calendarTabFocus(selected:number,current:number,focusedInside:boolean):number{return focusedInside?current:selected;}
export type CalendarDirection='ltr'|'rtl';
export function calendarTabTarget(key:string,current:number,count:number,direction:CalendarDirection='ltr'):number|undefined{
  if(!count)return;
  if(key==='Home')return 0;if(key==='End')return count-1;
  const step=key==='ArrowRight'?(direction==='rtl'?-1:1):key==='ArrowLeft'?(direction==='rtl'?1:-1):undefined;
  return step===undefined?undefined:(current+step+count)%count;
}
export function calendarMenuOpenTarget(key:string,count:number):number{return !count?-1:key==='ArrowUp'?count-1:0;}
/** Bundled Menu typeahead: label prefix, current-relative cycle, 500ms reset. */
export function createCalendarTypeahead(){
  let buffer='',base=-1,last:number|null=null,timer:ReturnType<typeof setTimeout>|undefined;
  const expire=()=>{clearTimeout(timer);buffer='';base=last??-1;};
  const reset=()=>{expire();last=null;};
  return {
    get typing(){return buffer.length>0;},
    key(event:Pick<KeyboardEvent,'key'|'ctrlKey'|'metaKey'|'altKey'>,labels:readonly string[],current:number):number|undefined{
      if(event.key.length!==1||event.ctrlKey||event.metaKey||event.altKey||!labels.length)return;
      const first=buffer==='';if(first)base=current;
      if(labels.every(label=>label[0]?.toLocaleLowerCase()!==label[1]?.toLocaleLowerCase())&&buffer===event.key){buffer='';base=last??-1;}
      buffer+=event.key;clearTimeout(timer);timer=setTimeout(expire,500);
      const start=(first?current:base)+1,needle=buffer.toLocaleLowerCase();
      for(let offset=0;offset<labels.length;offset++){const index=((start+offset)%labels.length+labels.length)%labels.length;if(labels[index]?.toLocaleLowerCase().startsWith(needle)){last=index;return index;}}
      if(event.key!==' ')buffer='';return;
    },reset,
  };
}
export interface CalendarTooltipGroup {delay():number;opened(close:()=>void):void;closed(close:()=>void):void;destroy():void}
/** Actual grid provider400 and vendor group closed timeout400; no geometry shim. */
export function createCalendarTooltipGroup(initialDelay=600):CalendarTooltipGroup{
  let warm=false,active:(()=>void)|undefined,reset:ReturnType<typeof setTimeout>|undefined;
  return {
    delay:()=>warm?0:initialDelay,
    opened(close){clearTimeout(reset);const previous=active;active=close;warm=true;if(previous&&previous!==close)previous();},
    closed(close){if(active!==close)return;active=undefined;clearTimeout(reset);reset=setTimeout(()=>{if(!active)warm=false;},400);},
    destroy(){clearTimeout(reset);const previous=active;active=undefined;warm=false;previous?.();},
  };
}
/** Mouse rest is independent of entry; focus-visible opens immediately. */
export function createCalendarHoverTiming(show:()=>void|boolean,hide:()=>void,group?:CalendarTooltipGroup){
  let opening:ReturnType<typeof setTimeout>|undefined,isOpen=false,blocked=false;
  const cancel=()=>{clearTimeout(opening);opening=undefined;};
  const close=()=>{cancel();blocked=true;if(isOpen){isOpen=false;hide();group?.closed(close);}};
  const open=()=>{cancel();if(isOpen)return;if(show()===false)return;isOpen=true;group?.opened(close);};
  return {
    enter(pointerType:string){blocked=false;if(pointerType==='mouse'&&(group?.delay()??600)===0)open();},
    move(pointerType:string,movementX=0,movementY=0){
      if(pointerType!=='mouse'||isOpen||blocked)return;const delay=group?.delay()??600;if(delay===0||opening!==undefined&&movementX**2+movementY**2<2)return;
      cancel();opening=setTimeout(open,delay);
    },focus:open,cancel,close,destroy:close,
  };
}
