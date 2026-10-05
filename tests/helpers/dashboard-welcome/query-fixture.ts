// Ordinary fixture context: the same real query-core class as the Source
// React Query provider. Legacy callbacks keep Source default staleTime=0 and
// retry=false; new cache cases explicitly choose their observable cache policy.
import { QueryClient } from '@tanstack/react-query';
const clients = new Set<QueryClient>();
export function fixtureQueryClient(staleTime = 0) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime } } });
  clients.add(client); return client;
}
export function clearFixtureQueryClients() {
  for (const client of clients) client.clear();
  clients.clear();
}
