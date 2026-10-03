export type ApiResult<T>={success:true;data:T}|{success:false;error:{code:string;message:string;details?:unknown}};
