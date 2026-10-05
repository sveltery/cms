// Native controlled values, not original Source callbacks or protected probes.
import { afterEach, expect, it } from 'vitest';
import { i18n } from '@lingui/core';
import { calendarMutationError, calendarMutationErrorMessage } from '../../src/lib/calendar/mutation-error.ts';
import { createCalendarMessageAdapter } from '../../src/lib/calendar/messages.ts';

afterEach(()=>i18n.loadAndActivate({locale:'en',messages:{}}));
it.each([null, undefined, false, 0, '', NaN])('suppresses Source falsy mutation rejection %s',error=>{
  i18n.loadAndActivate({locale:'en',messages:{}});
  expect(calendarMutationErrorMessage(error)).toBeNull();
  expect(calendarMutationError(error)).toBeNull();
});
it('retains an actual Error message including line breaks',()=>{
  expect(calendarMutationErrorMessage(new Error('First line\nSecond line'))).toBe('First line\nSecond line');
});
it('retains the actual empty Error message',()=>{
  expect(calendarMutationErrorMessage(new Error(''))).toBe('');
});
it('uses the exact Source generic descriptor for truthy non-Error rejection',()=>{
  i18n.loadAndActivate({locale:'en',messages:{Vw8l6h:['CONTROLLED GENERIC']}});
  expect(calendarMutationErrorMessage({failure:true})).toBe('CONTROLLED GENERIC');
});
it('keeps a stored generic descriptor responsive to catalog replacement',()=>{
  i18n.loadAndActivate({locale:'en',messages:{Vw8l6h:['FIRST FAILURE']}});
  const failure=calendarMutationError('truthy rejection'),adapter=createCalendarMessageAdapter(()=>{});
  expect(typeof failure==='object'&&failure?adapter.translate(failure.message):failure).toBe('FIRST FAILURE');
  i18n.load('en',{Vw8l6h:['SECOND FAILURE']});
  expect(typeof failure==='object'&&failure?adapter.translate(failure.message):failure).toBe('SECOND FAILURE');
});
