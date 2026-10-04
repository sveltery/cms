import { calendarGet } from '../../../src/lib/server/calendar/http.ts';
import { fixtureStorage } from './source-host.ts';
import { servicePrincipal } from '../../../src/lib/server/auth/composition.ts';
export async function GET({ url, locals }: any) {
  const user = locals.user;
  return calendarGet({ url, locals: { cms: { database: fixtureStorage(locals.emdash.db), principal: servicePrincipal(user) } } } as any);
}
