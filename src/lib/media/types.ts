/** Native UI representation of a persisted source media row. */
export interface MediaItem {
 id:string;filename:string;mimeType:string;storageKey:string;url:string;
 size:number|null;width:number|null;height:number|null;alt:string|null;caption:string|null;
 focalX:number|null;focalY:number|null;blurhash:string|null;dominantColor:string|null;
 folderId?:string|null;createdAt:string;status:'ready'|'pending'|'failed';authorId:string|null;
}
export interface MediaFolder {id:string;name:string}
