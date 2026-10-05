/** Preserve the exact foreign imperative ref through the native reactive props host. */
export class MediaPanelRefTransport<T>{
 constructor(private readonly ref:{current:T}){}
 get current():T{return this.ref.current;}
 set current(value:T){this.ref.current=value;}
}
