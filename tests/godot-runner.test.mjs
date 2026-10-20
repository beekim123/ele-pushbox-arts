import test from 'node:test';
import assert from 'node:assert/strict';
import {expectedCases,reconcileSuite} from '../tools/verify-godot-pack.mjs';
test('the standalone matrix has explicit scope and case coverage',()=>{
  assert.equal(expectedCases('contracts').length,12);
  assert.equal(expectedCases('gpu').length,81);
  assert.equal(expectedCases('predecessor').length,81);
  assert.equal(expectedCases('pck').length,80);
});
test('a clean process cannot turn missing expected cases into passed coverage',()=>{
  const cases=expectedCases('contracts').slice(0,1).map(c=>({...c,status:'passed',checks:1,failures:0}));
  const result=reconcileSuite('contracts',{passed:true},{completed:true,failures:0,cases});
  assert.equal(result.filter(c=>c.status==='not_run').length,11);
});
test('engine/process failure remains incomplete even after a passing suite line',()=>{
  const cases=expectedCases('contracts').map(c=>({...c,status:'passed',checks:1,failures:0}));
  const result=reconcileSuite('contracts',{passed:false},{completed:true,failures:0,cases});
  assert.equal(result.at(-1).status,'incomplete');assert.equal(result.at(-1).failures,1);
});
test('completed assertions may fail without being relabeled an interrupted run',()=>{
  const cases=expectedCases('contracts').map(c=>({...c,status:'passed',checks:1,failures:0}));
  cases[0]={...cases[0],status:'failed',failures:1};
  const result=reconcileSuite('contracts',{passed:false,integrity_ok:true},{completed:true,failures:1,cases});
  assert.equal(result.length,12);assert.equal(result[0].status,'failed');
});
