import { describe,expect,it } from 'vitest';
import * as v from 'valibot';
import { calendarMutation } from '../../src/lib/server/calendar/mutation.ts';

describe('Native calendar Source datetime lexical boundary',()=>{
  it.each(['2030-10-20T09:00:00','2030-10-20','"2030-10-20T09:00:00Z"','2030-10-20 09:00:00Z','2030-10-20T09:00'])('rejects datetime without Source explicit ISO zone: %s',scheduledAt=>{
    expect(v.safeParse(calendarMutation,{action:'schedule',scheduledAt}).success).toBe(false);
  });
  it.each(['2030-10-20T09:00:00Z','2030-10-20T09:00Z','2030-10-20T09:00:00+02:00','2030-10-20T09:00-04:00'])('accepts Source explicit zoned seconds/minutes: %s',scheduledAt=>{
    expect(v.safeParse(calendarMutation,{action:'schedule',scheduledAt})).toMatchObject({success:true,output:{action:'schedule',scheduledAt}});
  });
});
