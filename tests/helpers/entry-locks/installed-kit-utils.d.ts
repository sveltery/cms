declare module 'sveltery-test:installed-kit-form-utils'{
 export function deserialize_binary_form(request:Request):Promise<{data:Record<string,unknown>;meta:Record<string,unknown>;form_data:FormData|null}>;
}
