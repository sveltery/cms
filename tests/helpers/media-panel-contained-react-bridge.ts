/** Test-only React lifecycle transport of the actual native observer and size calculation. */
import * as React from 'react';
import {containedMediaSize,observeMediaFrame,type MediaSize} from '../../src/lib/media/contained-media-size';
export function useContainedMediaSize(frameRef:React.RefObject<HTMLElement|null>,source:MediaSize|null):MediaSize|null{
 const [frame,setFrame]=React.useState<MediaSize|null>(null);
 React.useLayoutEffect(()=>frameRef.current?observeMediaFrame(frameRef.current,setFrame):undefined,[frameRef]);
 return containedMediaSize(frame,source);
}
