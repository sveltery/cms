// Native mouse-event transport for frozen Kumo 2.6.0 safePolygon.
// MIT Kumo/Base UI; whole frozen authority and license retained in
// parity/emdash/calendar-tooltip-geometry. Native transport supplies containment
// results/rects for real elements; no floating-tree producer is synthesized.
export interface CalendarTooltipRect {x:number;y:number;width:number;height:number;left:number;right:number;top:number;bottom:number}
export type CalendarTooltipSide='top'|'bottom'|'left'|'right';
export interface CalendarTooltipTransitEvent {type:'mousemove'|'mouseleave';clientX:number;clientY:number;insidePopup?:boolean;insideTrigger?:boolean;relatedInsidePopup?:boolean}
export interface CalendarTooltipTransitOptions {x:number;y:number;side:CalendarTooltipSide;rects:()=>{trigger:CalendarTooltipRect;popup:CalendarTooltipRect};onClose:()=>void}
export function createCalendarTooltipTransit(options:CalendarTooltipTransitOptions){
  const {x:exitX,y:exitY,side,rects,onClose}=options;
  let enteredPopup=false,previousX:number|null=null,previousY:number|null=null,previousTime=performance.now();
  let timer:ReturnType<typeof setTimeout>|undefined;
  const clear=()=>{clearTimeout(timer);timer=undefined;};
  const close=()=>{clear();onClose();};
  function tooSlow(x:number,y:number){
    const currentTime=performance.now(),elapsed=currentTime-previousTime;
    if(previousX===null||previousY===null||elapsed===0){previousX=x;previousY=y;previousTime=currentTime;return false;}
    const distanceSquared=(x-previousX)**2+(y-previousY)**2;
    previousX=x;previousY=y;previousTime=currentTime;
    return distanceSquared<elapsed**2*.01;
  }
  return {
    move(event:CalendarTooltipTransitEvent){
      clear();
      const {clientX:x,clientY:y}=event,leaving=event.type==='mouseleave';
      if(event.insidePopup){enteredPopup=true;if(!leaving)return;}
      if(event.insideTrigger){enteredPopup=false;if(!leaving){enteredPopup=true;return;}}
      if(leaving&&event.relatedInsidePopup)return;
      const {trigger,popup}=rects(),rightOfCenter=exitX>popup.right-popup.width/2,belowCenter=exitY>popup.bottom-popup.height/2;
      const wider=popup.width>trigger.width,taller=popup.height>trigger.height;
      const horizontal=wider?trigger:popup,vertical=taller?trigger:popup;
      if(side==='top'&&exitY>=trigger.bottom-1||side==='bottom'&&exitY<=trigger.top+1||side==='left'&&exitX>=trigger.right-1||side==='right'&&exitX<=trigger.left+1){close();return;}
      const bridge=side==='top'?insideBounds(x,y,horizontal.left,trigger.top+1,horizontal.right,popup.bottom-1):
        side==='bottom'?insideBounds(x,y,horizontal.left,popup.top+1,horizontal.right,trigger.bottom-1):
        side==='left'?insideBounds(x,y,popup.right-1,vertical.bottom,trigger.left+1,vertical.top):
        insideBounds(x,y,trigger.right-1,vertical.bottom,popup.left+1,vertical.top);
      if(bridge)return;
      if(enteredPopup&&!insideRect(x,y,trigger)){close();return;}
      if(!leaving&&tooSlow(x,y)){close();return;}
      const buffer=.5;
      let polygon:readonly [number,number,number,number,number,number,number,number];
      if(side==='top'||side==='bottom'){
        const offset=wider?buffer/2:buffer*4;
        const first=wider||rightOfCenter?exitX+offset:exitX-offset;
        const second=wider?exitX-offset:rightOfCenter?exitX+offset:exitX-offset;
        const rootY=side==='top'?exitY+buffer+1:exitY-buffer;
        const farY=side==='top'?popup.bottom-buffer:popup.top+buffer;
        const otherY=side==='top'?popup.top:popup.bottom;
        polygon=[first,rootY,second,rootY,popup.left,rightOfCenter||wider?farY:otherY,popup.right,rightOfCenter?wider?farY:otherY:farY];
      }else{
        const offset=taller?buffer/2:buffer*4;
        const first=taller||belowCenter?exitY+offset:exitY-offset;
        const second=taller?exitY-offset:belowCenter?exitY+offset:exitY-offset;
        const rootX=side==='left'?exitX+buffer+1:exitX-buffer;
        const farX=side==='left'?popup.right-buffer:popup.left+buffer;
        const otherX=side==='left'?popup.left:popup.right;
        const topX=belowCenter||taller?farX:otherX,bottomX=belowCenter?taller?farX:otherX:farX;
        polygon=side==='left'?[topX,popup.top,bottomX,popup.bottom,rootX,first,rootX,second]:[rootX,first,rootX,second,topX,popup.top,bottomX,popup.bottom];
      }
      if(insidePolygon(x,y,polygon)){if(!enteredPopup)timer=setTimeout(close,40);}else close();
    },destroy:clear,
  };
}

function intersects(x:number,y:number,x1:number,y1:number,x2:number,y2:number){return(y1>=y)!==(y2>=y)&&x<=(x2-x1)*(y-y1)/(y2-y1)+x1;}
function insidePolygon(x:number,y:number,points:readonly [number,number,number,number,number,number,number,number]){
  let inside=false;for(let i=0;i<8;i+=2){const j=(i+2)%8;if(intersects(x,y,points[i],points[i+1],points[j],points[j+1]))inside=!inside;}return inside;
}
function insideBounds(x:number,y:number,x1:number,y1:number,x2:number,y2:number){return x>=Math.min(x1,x2)&&x<=Math.max(x1,x2)&&y>=Math.min(y1,y2)&&y<=Math.max(y1,y2);}
function insideRect(x:number,y:number,rect:CalendarTooltipRect){return x>=rect.x&&x<=rect.x+rect.width&&y>=rect.y&&y<=rect.y+rect.height;}
