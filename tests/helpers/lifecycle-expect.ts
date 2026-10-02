// Runner adapter only; source assertion expressions remain unchanged.
import assert from 'node:assert/strict';
import { expect as existingExpect, it as sourceIt } from './upstream-expect.ts';
const subset=Symbol('runner-object-containing');
export const it=Object.assign(sourceIt,{skipIf(condition:boolean){return (title:string,callback:()=>unknown)=>sourceIt(title,{skip:condition},callback);}});
function matches(actual:any,expected:any):boolean {
  if(expected?.[subset])return Object.entries(expected[subset]).every(([key,value])=>matches(actual?.[key],value));
  try{assert.deepEqual(actual,expected);return true;}catch{return false;}
}
export const expect=Object.assign((actual: unknown): any => {
  const match = existingExpect(actual);
  match.toBeTruthy = () => assert.ok(actual);
  match.toBeGreaterThanOrEqual = (expected: number) => assert.ok(typeof actual === 'number' && actual >= expected);
  match.toContainEqual=(expected:any)=>assert.ok(Array.isArray(actual)&&actual.some(value=>matches(value,expected)),'Expected array to contain source expected value');
  return match;
},{objectContaining(value:any){return {[subset]:value};}});
