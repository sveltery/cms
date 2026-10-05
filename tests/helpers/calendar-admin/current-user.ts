// Only the test-host hook projects the original controlled React fixture.
import { useQuery } from '@tanstack/react-query';
import { fetchCurrentUser } from '../../../src/lib/calendar/client.ts';
export function useCurrentUser() { return useQuery({queryKey:['current-user'],queryFn:fetchCurrentUser}); }
