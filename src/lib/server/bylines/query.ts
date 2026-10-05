/** The public query producer owns this integration; no substitute query/cache. */
export async function getEmDashCollection(_collection:string,_options:Record<string,unknown>): Promise<{entries:Array<{id:string;data:Record<string,unknown>}>}> {
 throw new Error('Byline collection querying is unavailable until the public query SDK is installed');
}
