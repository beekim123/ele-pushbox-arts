import test from 'node:test';
import assert from 'node:assert/strict';
import * as runner from '../tools/verify-godot-pack.mjs';
const {expectedCases,reconcileSuite}=runner;
test('the standalone matrix has explicit scope and case coverage',()=>{
  assert.equal(expectedCases('contracts').length,13);
  assert.equal(expectedCases('gpu').length,81);
  assert.equal(expectedCases('predecessor').length,81);
  assert.equal(expectedCases('pck').length,80);
});
test('a clean process cannot turn missing expected cases into passed coverage',()=>{
  const cases=expectedCases('contracts').slice(0,1).map(c=>({...c,status:'passed',checks:1,failures:0}));
  const result=reconcileSuite('contracts',{passed:true},{completed:true,failures:0,cases});
  assert.equal(result.filter(c=>c.status==='not_run').length,12);
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
  assert.equal(result.length,13);assert.equal(result[0].status,'failed');
});
test('the first predecessor is the exact T7 carrier, never a self-comparison',()=>{
  assert.equal(typeof runner.validatePredecessor,'function');
  const prior={archive_sha256:'9016ed479993c8418d8a2f1f8a83fab57c66ba66625556a528863ee30797bb78',manifest_sha256:'1962a952e88666fd6ea4bdea664f57744a76134c26038d3e7007bb84f78ad52d',manifest:{producer:{commit:'16c9082c4f838b2f1c9a58d70d7ff78890cac021'},identity:{runtime_payload_sha256:'45a54a0dd780c128102293918351bcd498f13a4914c50fe556c9d16bd2a18515'}}};
  assert.equal(runner.validatePredecessor(prior,{archive_sha256:'a'.repeat(64)}),prior);
  assert.throws(()=>runner.validatePredecessor(prior,prior),/baseline/);
  for(const key of ['archive_sha256','manifest_sha256','producer','payload']){
    const bad=structuredClone(prior);
    if(key==='producer')bad.manifest.producer.commit='0'.repeat(40);
    else if(key==='payload')bad.manifest.identity.runtime_payload_sha256='0'.repeat(64);
    else bad[key]='0'.repeat(64);
    assert.throws(()=>runner.validatePredecessor(bad,{archive_sha256:'a'.repeat(64)}),/baseline/);
  }
});
test('report target comes from the actual Godot runtime, without version/architecture fallbacks',()=>{
  const t={os:'macOS',architecture:'arm64',version:{major:4,minor:7,patch:2,status:'stable',build:'official',hash:'e'.repeat(40)},rendering_method:'gl_compatibility',rendering_driver:'opengl3',display_driver:'macos'};
  assert.equal(runner.actualTarget(t,'gpu').valid,true);
  for(const bad of [{...t,architecture:'x86_64'},{...t,rendering_method:'mobile'},{...t,version:{...t.version,patch:1}},null])assert.equal(runner.actualTarget(bad,'gpu').valid,false);
  assert.equal(runner.actualTarget(null,'gpu').godot,null);
  assert.equal(runner.actualTarget({...t,rendering_method:'',rendering_driver:'',display_driver:'headless'},'contracts').backend,'headless');
});
