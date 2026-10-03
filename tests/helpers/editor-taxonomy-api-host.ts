/** Source callbacks mock this test-only boundary; this is not a production REST API. */
export function apiFetch(_input:string|URL|Request,_init?:RequestInit):Promise<Response>{throw new Error('An unmocked taxonomy UI fixture request was made');}
