// Runner adapter only; source assertion expressions remain unchanged.
import assert from 'node:assert/strict';
import { expect as existingExpect, it as sourceIt } from './upstream-expect.ts';
const subset=Symbol('runner-object-containing');
export const it=Object.assign(sourceIt,{skipIf(condition:boolean){return (title:string,callback:()=>void|Promise<void>)=>sourceIt(title,{skip:condition},callback);}});
// Vitest.toEqual ignores an ordinary object's prototype; Node SQLite returns
// null-prototype SQL rows. Retain every key/value while bridging that runner
// distinction, without coercing class instances or modifying source assertions.
function comparable(value:any):any {
  if(Array.isArray(value))return value.map(comparable);
  if(value&&typeof value==='object'&&[null,Object.prototype].includes(Object.getPrototypeOf(value))) {
    return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,comparable(item)]));
  }
  return value;
}
function matches(actual:any,expected:any):boolean {
  if(expected?.[subset])return Object.entries(expected[subset]).every(([key,value])=>matches(actual?.[key],value));
  try{assert.deepEqual(actual,expected);return true;}catch{return false;}
}
export const expect=Object.assign((actual: unknown): any => {
  const match = existingExpect(actual);
  match.toEqual=(expected:unknown)=>assert.deepEqual(comparable(actual),comparable(expected));
  match.toBeTruthy = () => assert.ok(actual);
  match.toBeFalsy = () => assert.ok(!actual);
  match.toBeGreaterThanOrEqual = (expected: number) => assert.ok(typeof actual === 'number' && actual >= expected);
  match.toContainEqual=(expected:any)=>assert.ok(Array.isArray(actual)&&actual.some(value=>matches(value,expected)),'Expected array to contain source expected value');
  return match;
},{objectContaining(value:any){return {[subset]:value};}});
