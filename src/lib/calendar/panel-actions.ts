// Extracted Native Calendar panel action boundary, pin913cb1bb/MIT.
// The published lifecycle remains the only mutation writer.
import type {CalendarClient} from './ui-types.ts';
import type {CalendarItem} from './calendar.ts';
export type CalendarPanelAction='publish'|'unschedule';
export interface CalendarActionContext {
  client:CalendarClient;rev?:string;current:()=>boolean;
  pending:(value:boolean)=>void;error:(value:string|undefined)=>void;
  refresh:()=>void;success:()=>void;failure:(description:string|null)=>void;genericError?:()=>string;close:()=>void;
}
export async function runCalendarPanelAction(action:CalendarPanelAction,item:CalendarItem,context:CalendarActionContext):Promise<void>{
  context.pending(true);
  try{
    if(action==='publish')await context.client.publishContent(item.collection,item.id,{locale:item.locale,_rev:context.rev});
    else await context.client.unscheduleContent(item.collection,item.id,{locale:item.locale});
    context.refresh();context.success();if(context.current())context.close();
  }catch(cause){const description=!cause?null:cause instanceof Error?cause.message:(context.genericError?.()??'An error occurred');context.failure(description);}
  finally{if(context.current())context.pending(false);}
}
export interface CalendarRescheduleContext {
  client:CalendarClient;pending:(value:boolean)=>void;
  refresh:()=>void;success:()=>void;rescheduled:()=>void;current:()=>boolean;
}
export async function runCalendarReschedule(item:CalendarItem,at:string,context:CalendarRescheduleContext):Promise<void>{
  context.pending(true);
  try{await context.client.scheduleContent(item.collection,item.id,at,{locale:item.locale});context.refresh();context.success();if(context.current())context.rescheduled();}
  finally{context.pending(false);}
}
