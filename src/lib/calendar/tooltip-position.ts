// Native fixed/top-layer DOM transport for frozen Kumo's tooltip positioner.
// Source full compiled authorities and MIT licenses are retained in the ledger.
import {arrow,computePosition,flip,hide,limitShift,offset,shift,size,type Middleware,type Platform} from '@floating-ui/dom';
export interface CalendarTooltipPositionOptions{arrow?:HTMLElement;platform?:Platform}
export async function computeCalendarTooltipPosition(trigger:Element,popup:HTMLElement,options:CalendarTooltipPositionOptions={}){
  // Source adds one to the side opposite its requested top placement. Flip's
  // padding adds one again, so size and shift can settle before flip takes over.
  const padding={top:5,right:5,bottom:6,left:5};
  const middleware:Middleware[]=[
    offset({mainAxis:10,crossAxis:0,alignmentAxis:0}),
    shift({padding,mainAxis:true,crossAxis:false,limiter:limitShift(state=>{
      if(!options.arrow)return{};
      const bounds=options.arrow.getBoundingClientRect(),vertical=/^(top|bottom)/.test(state.placement);
      return{offset:(vertical?bounds.width:bounds.height)/2+(vertical?padding.left+padding.right:padding.top+padding.bottom)/2};
    })}),
    flip({padding:{top:6,right:6,bottom:7,left:6},mainAxis:true,crossAxis:'alignment',fallbackAxisSideDirection:'end'}),
    size({padding,apply({availableWidth,availableHeight,rects}){
      popup.style.setProperty('--available-width',`${availableWidth}px`);
      popup.style.setProperty('--available-height',`${availableHeight}px`);
      const ratio=typeof window==='undefined'?1:window.devicePixelRatio||1,reference=rects.reference;
      popup.style.setProperty('--anchor-width',`${(Math.round((reference.x+reference.width)*ratio)-Math.round(reference.x*ratio))/ratio}px`);
      popup.style.setProperty('--anchor-height',`${(Math.round((reference.y+reference.height)*ratio)-Math.round(reference.y*ratio))/ratio}px`);
    }}),
  ];
  if(options.arrow){
    // This absolute child has the popup as its actual offset parent, matching
    // Source's explicit floating offset parent without a new arrow algorithm.
    middleware.push(arrow({element:options.arrow,padding:5}),{
      name:'transformOrigin',fn(state){
        const horizontal=(state.middlewareData.arrow?.x??0)+options.arrow!.clientWidth/2;
        const vertical=(state.middlewareData.arrow?.y??0)+options.arrow!.clientHeight/2;
        const origin={top:`${horizontal}px calc(100% + 10px)`,bottom:`${horizontal}px -10px`,left:`calc(100% + 10px) ${vertical}px`,right:`-10px ${vertical}px`};
        popup.style.setProperty('--transform-origin',origin[state.placement.split('-')[0] as keyof typeof origin]);return{};
      }
    });
  }
  middleware.push({name:'hide',async fn(state){const result=await hide().fn(state),reference=state.rects.reference;return{...result,data:{...result.data,referenceHidden:result.data?.referenceHidden||reference.width===0&&reference.height===0&&reference.x===0&&reference.y===0}};}});
  return computePosition(trigger,popup,{strategy:'fixed',placement:'top',middleware,...(options.platform?{platform:options.platform}:{})});
}
