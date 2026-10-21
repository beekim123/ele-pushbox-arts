import test from 'node:test';
import assert from 'node:assert/strict';
import * as pack from '../tools/lib/godot-pack.mjs';
const context={runtime_payload_sha256:'a'.repeat(64),renderer_sha256:'b'.repeat(64),approved_identity_sha256:'c'.repeat(64)};
function fixture(){
  const binding={tested_producer_commit:'1'.repeat(40),tested_manifest_sha256:'d'.repeat(64),...context,verifier_commit:'2'.repeat(40),fixture_sha256:'e'.repeat(64),godot:'4.7.2.stable.official.ed1daf0bf',platform:'macos-arm64',backend:'gl_compatibility',scope:['public-contracts']};
  const report={format:'portitor.art.native-test-report/1',binding,completed:true,failures:0,cases:[{id:'synthetic.contract',scope:'public-contracts',status:'passed',checks:1,failures:0}],artifacts:[],run_summary:[],known_limits:['Synthetic schema test, not a real technical report.']};
  const bytes=pack.canonical(report),record={report_path:'godot/verification/synthetic-report.json',report_sha256:pack.sha256(bytes),...binding,completed:true,failures:0,case_ids:['synthetic.contract']};
  return {bytes,record,envelope:{status:'recorded',runtime_payload_sha256:context.runtime_payload_sha256,reports:[record]}};
}
test('finite recorded reports bind their actual source/payload/fixture bytes',()=>{
  assert.equal(typeof pack.validateVerification,'function','T8 finite report schema is missing');
  const f=fixture();
  assert.deepEqual(pack.validateVerification(f.envelope,context,p=>{assert.equal(p,f.record.report_path);return f.bytes;}),f.envelope);
});
test('pending is a technical no-report state and is independent of publication',()=>{
  const pending={status:'pending',runtime_payload_sha256:context.runtime_payload_sha256,reports:[]};
  assert.deepEqual(pack.validateVerification(pending,context,()=>{throw Error('must not read');}),pending);
  assert.throws(()=>pack.validateVerification({...pending,u4_approved:true},context,()=>null));
});
test('report hashes, bounded fields, identities and scopes cannot hide functional overrides',()=>{
  for(const mutation of [
    f=>{f.envelope.runtime_payload_sha256='0'.repeat(64);},
    f=>{f.record.renderer_sha256='0'.repeat(64);},
    f=>{f.record.report_sha256='0'.repeat(64);},
    f=>{f.record.host_requirements={viewport:[1,1]};},
    f=>{f.record.scope=['game-playable'];},
    f=>{f.record.case_ids=['another.case'];},
    f=>{f.record.completed=false;},
    f=>{f.record.report_path='../escape.json';},
    f=>{f.envelope.status='approved';}
  ]){
    const f=fixture();mutation(f);
    assert.throws(()=>pack.validateVerification(f.envelope,context,()=>f.bytes));
  }
});
test('a declared scope must have actual cases even with a matching report body and SHA',()=>{
  const f=fixture(),body=JSON.parse(f.bytes);
  f.record.scope=['public-contracts','public-pck'];body.binding.scope=[...f.record.scope];
  f.bytes=pack.canonical(body);f.record.report_sha256=pack.sha256(f.bytes);
  assert.throws(()=>pack.validateVerification(f.envelope,context,()=>f.bytes),/scope/);
});
test('SHA and commit fields reject coercible arrays even when body and hash agree',()=>{
  for(const key of ['tested_manifest_sha256','fixture_sha256','tested_producer_commit','verifier_commit']){
    const f=fixture(),body=JSON.parse(f.bytes);
    f.record[key]=[f.record[key]];body.binding[key]=f.record[key];
    f.bytes=pack.canonical(body);f.record.report_sha256=pack.sha256(f.bytes);
    assert.throws(()=>pack.validateVerification(f.envelope,context,()=>f.bytes));
  }
});
test('the producer API requires packageVersion to be a String before Git access',()=>{
  assert.throws(()=>pack.buildGodotPack({root:'.',sourceCommit:'0'.repeat(40),packageVersion:['1.0.0'],outDir:'unused'}),/invalid package SemVer/);
});
