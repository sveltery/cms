import type { PageServerLoad } from './$types';

// Display capabilities come from the same trusted principal and mutation gate
// as native handlers; service ownership and permission checks remain decisive.
export const load:PageServerLoad=({locals})=>{
  const context=locals.cms;const principal=context?.principal;
  const permissions=new Set<string>(principal?.permissions??[]);
  const enabled=Boolean(principal&&context?.database&&context.mutationsEnabled===true);
  return {workflow:{
    principalId:principal?.id??null,
    publishOwn:enabled&&permissions.has('content:publish_own'),
    publishAny:enabled&&permissions.has('content:publish_any'),
    editOwn:enabled&&permissions.has('content:edit_own'),
    editAny:enabled&&permissions.has('content:edit_any')
  }};
};
