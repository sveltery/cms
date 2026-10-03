/** Native media consumers subscribe their actual cached projections. */
let revision=0;
const listeners=new Set<()=>void>();
export function mediaCacheRevision() {return revision;}
export function invalidateMediaCache() {revision++;for(const listener of listeners) listener();}
export function onMediaChange(listener:()=>void) {listeners.add(listener);return()=>listeners.delete(listener);}
