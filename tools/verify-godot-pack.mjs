#!/usr/bin/env node
// Producer validation only. Every job begins with fixed artifact/source identities.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {canonical,sha256,readStoreZip,validateFiles,payloadDigest,validateVerification} from './lib/godot-pack.mjs';
import {publicReference} from '../tests/native/public-reference.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const THREADS={OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',MKL_NUM_THREADS:'1',VECLIB_MAXIMUM_THREADS:'1',UV_THREADPOOL_SIZE:'1'};
const T7_BASELINE={archive_sha256:'9016ed479993c8418d8a2f1f8a83fab57c66ba66625556a528863ee30797bb78',manifest_sha256:'1962a952e88666fd6ea4bdea664f57744a76134c26038d3e7007bb84f78ad52d',producer_commit:'16c9082c4f838b2f1c9a58d70d7ff78890cac021'};
const need=(ok,message)=>{if(!ok)throw Error(message);};
const cmp=(a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b));
function git(root,...args){return execFileSync('git',['-c','gc.auto=0','-c','maintenance.auto=false','-c','pack.threads=1',...args],{cwd:root,maxBuffer:16*1024*1024});}
function packageAt(archive){
  const bytes=fs.readFileSync(archive),files=readStoreZip(bytes),manifestBytes=files.get('addons/portitor_art/manifest.json');
  need(manifestBytes,'missing archive manifest');const manifest=JSON.parse(manifestBytes);validateFiles(manifest.files);
  need(files.size===manifest.files.length+1&&payloadDigest(manifest.files)===manifest.identity.runtime_payload_sha256,'actual archive set/payload mismatch');
  for(const file of manifest.files){const value=files.get(file.path);need(value&&value.length===file.bytes&&sha256(value)===file.sha256,'actual archive bytes changed: '+file.path);}
  return {archive:path.resolve(archive),bytes,files,manifest,index:JSON.parse(files.get('addons/portitor_art/resources/catalog.json')),archive_sha256:sha256(bytes),manifest_sha256:sha256(manifestBytes)};
}
function sourceReader(root,commit){
  need(typeof commit==='string'&&/^[a-f0-9]{40}$/.test(commit),'fixed verifier commit required');
  need(git(root,'rev-parse',commit+'^{commit}').toString().trim()===commit,'verifier commit missing');
  const used=new Map();
  return {read(relative){if(!used.has(relative))used.set(relative,git(root,'show',commit+':'+relative));return used.get(relative);},used};
}
function write(file,bytes){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);}
function sourceSnapshot(root,paths){return paths.map(relative=>({path:relative,sha256:sha256(fs.readFileSync(path.join(root,relative)))}));}
function fixtureIdentity(table){return sha256(Buffer.from('portitor.art.t8-fixtures/1\n'+table.sort((a,b)=>cmp(a.path,b.path)).map(f=>f.path+'\t'+f.bytes+'\t'+f.sha256+'\n').join('')));}
const THEMES=['dungeon','ruins','cave','forest','sky','cosmos','diyu'];
const VIEWS=['lobby','chapters','levels','play','pause','settings','hint','complete','rulecard','dialogue','controls'];
const EMBEDDED=[['hub_start','lobby'],['lobby_generic','lobby'],['pause_help','pause'],['settings_help','settings'],['clear_found','complete'],['rulecard_how','rulecard']];
export function expectedCases(phase){
  if(phase==='contracts')return ['actual-package','editor-sidecars','capabilities','report-envelope','display-schemas','font-attributes','ui-intents-atomicity',...EMBEDDED.map(x=>'embedded-denial.'+x[0])].map(x=>({id:'contracts.'+x,scope:'public-contracts'}));
  const result=[{id:'gpu.package',scope:'public-render'},{id:'reference.integer-and-frames',scope:'public-js-reference'}];
  for(const theme of THEMES)for(const tick of [0,127])for(const kind of ['background','terrain'])result.push({id:'reference.'+kind+'.'+theme+'.'+tick,scope:'public-js-reference'});
  for(const theme of THEMES)for(const tick of [0,127])result.push({id:'world.'+theme+'.'+tick,scope:'public-render'});
  for(const language of ['en','zh-Hans'])for(const view of VIEWS)result.push({id:'ui.'+view+'.'+language+'.base',scope:'public-render'});
  for(const [variant,view]of EMBEDDED)result.push({id:'ui.'+view+'.en.'+variant,scope:'public-render'});
  for(const skin of ['S1','S2','S3','S4','S5','S6'])result.push({id:'ui.lobby.en.'+skin,scope:'public-render'});
  for(const id of ['cells.classes-and-variants','cells.dynamic-lifecycle',...(phase==='pck'?[]:['catalog.root-cache-isolation'])])result.push({id,scope:'public-render'});
  return result.map(c=>({...c,scope:phase==='predecessor'?'native-predecessor':phase==='pck'?'public-pck':c.scope}));
}
export function reconcileSuite(phase,receipt,suite){
  const expected=expectedCases(phase),actual=Array.isArray(suite?.cases)?suite.cases:[],seen=new Set(),result=[];let malformed=false;
  for(const item of actual){
    const wanted=expected.find(x=>x.id===item.id);
    if(!wanted||seen.has(item.id)||!['passed','failed'].includes(item.status)||!Number.isInteger(item.failures)||item.failures<0||!Number.isInteger(item.checks)||item.checks<1||(item.status==='passed'?item.failures!==0:item.failures===0)){malformed=true;continue;}
    seen.add(item.id);result.push({...item,id:phase+':'+item.id,scope:wanted.scope});
  }
  for(const item of expected)if(!seen.has(item.id))result.push({...item,id:phase+':'+item.id,status:'not_run',checks:0,failures:0,notes:['Expected case did not produce a result in this run.']});
  if(!(receipt.integrity_ok??receipt.passed)||malformed||!suite?.completed||actual.reduce((n,c)=>n+(Number.isInteger(c.failures)?c.failures:0),0)!==suite?.failures)result.push({id:phase+':process',scope:expected[0].scope,status:'incomplete',checks:1,failures:1,notes:['Process/suite integrity failed; see bound job and engine logs.']});
  return result;
}
async function job({godot,args,cwd,out,pkg,verifierCommit,fixtureSha,phase,extraInput={}}){
  fs.mkdirSync(out,{recursive:true});
  const receipt={format:'portitor.art.native-job/1',phase,started_utc:new Date().toISOString(),completed:false,run_incomplete:true,input:{archive:pkg.archive,archive_sha256:pkg.archive_sha256,manifest_sha256:pkg.manifest_sha256,tested_producer_commit:pkg.manifest.producer.commit,...pkg.manifest.identity,verifier_commit:verifierCommit,fixture_sha256:fixtureSha},command:{executable:godot,args,cwd},host:{platform:process.platform,arch:process.arch,numeric_threads:1,uv_threadpool:1}};
  receipt.input.derived=extraInput;
  receipt.host.load_average=os.loadavg();receipt.host.free_memory=os.freemem();
  receipt.host.relevant_processes=execFileSync('ps',['-axo','pid,ppid,ni,%cpu,rss,command'],{encoding:'utf8'}).split('\n').filter(line=>/Godot|node .*\b(test|verify-godot|pack-godot)|python .*\b(test|build|render)/i.test(line));
  const receiptPath=path.join(out,'job.json');write(receiptPath,JSON.stringify(receipt,null,2)+'\n');
  const stdoutPath=path.join(out,'stdout.log'),stderrPath=path.join(out,'stderr.log');
  const stdout=fs.createWriteStream(stdoutPath),stderr=fs.createWriteStream(stderrPath);let text='',errorText='';
  const child=spawn(godot,args,{cwd,env:{...process.env,...THREADS,PORTITOR_OUTPUT:out,PORTITOR_PHASE:phase},stdio:['ignore','pipe','pipe']});
  receipt.pid=child.pid;write(receiptPath,JSON.stringify(receipt,null,2)+'\n');
  child.stdout.on('data',chunk=>{stdout.write(chunk);text+=chunk;});child.stderr.on('data',chunk=>{stderr.write(chunk);errorText+=chunk;});
  let timedOut=false;const timer=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');},180000);
  const exit=await new Promise(resolve=>{child.on('error',error=>resolve({code:null,error:error.message}));child.on('close',(code,signal)=>resolve({code,signal}));});
  clearTimeout(timer);await Promise.all([new Promise(resolve=>stdout.end(resolve)),new Promise(resolve=>stderr.end(resolve))]);
  const objects=text.split('\n').flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}}),suite=objects.findLast(x=>x.suite);
  receipt.finished_utc=new Date().toISOString();receipt.exit=exit;receipt.timed_out=timedOut;receipt.suite=suite||null;
  receipt.godot_version_line=text.split('\n').find(x=>x.startsWith('Godot Engine '))||'';
  receipt.process_completed=!timedOut&&!exit.error&&exit.code!==null;
  const needsSuite=['contracts','gpu','predecessor','pck'].includes(phase);
  receipt.completed=receipt.process_completed&&(!needsSuite||suite?.completed===true);receipt.run_incomplete=!receipt.completed;
  receipt.engine_errors=/SCRIPT ERROR|Parse Error|ERROR:/.test(errorText);
  receipt.input.archive_after_sha256=sha256(fs.readFileSync(pkg.archive));receipt.input_changed=receipt.input.archive_after_sha256!==pkg.archive_sha256;
  receipt.integrity_ok=receipt.completed&&exit.code===(needsSuite&&suite?.failures>0?1:0)&&!receipt.engine_errors&&!receipt.input_changed;
  receipt.passed=receipt.completed&&exit.code===0&&(!needsSuite||suite?.failures===0)&&!receipt.engine_errors&&!receipt.input_changed;
  write(receiptPath,JSON.stringify(receipt,null,2)+'\n');return {receipt,suite,stdoutPath,stderrPath};
}
export async function verifyGodotPack({root=ROOT,verifierCommit,archive,baselineArchive,godot,outDir,phases=['contracts','gpu','pck']}){
  need(typeof godot==='string'&&path.isAbsolute(godot)&&path.isAbsolute(outDir),'explicit Godot/output paths required');
  need(Array.isArray(phases)&&phases.length>0&&new Set(phases).size===phases.length&&phases.every(p=>['contracts','gpu','pck'].includes(p)),'unknown/duplicate verification phase');
  need(!fs.existsSync(outDir)||fs.readdirSync(outDir).length===0,'use a new empty evidence directory for each run');
  const pkg=packageAt(archive),source=sourceReader(root,verifierCommit);
  need(pkg.manifest.package_version==='1.0.0','actual candidate package version stays 1.0.0');
  const paths=git(root,'ls-tree','-r','--name-only',verifierCommit,'godot/demo','godot/tests','tests/native/fixtures').toString().trim().split('\n').filter(p=>p&&!p.endsWith('.uid')&&!p.endsWith('.import')&&!p.includes('/.godot/'));
  const tracked=['tools/verify-godot-pack.mjs','tools/lib/godot-pack.mjs','tests/native/public-reference.mjs',...paths];
  const before=sourceSnapshot(root,tracked);for(const f of before)need(sha256(source.read(f.path))===f.sha256,'working verifier differs from commit: '+f.path);
  const reference=publicReference(p=>source.read(p),pkg.index),referenceBytes=canonical(reference);
  const fixtures=paths.filter(p=>p.startsWith('tests/native/fixtures/')||p.startsWith('godot/tests/')).map(p=>({path:p,bytes:source.read(p).length,sha256:sha256(source.read(p))}));
  fixtures.push({path:'generated/public-reference.json',bytes:referenceBytes.length,sha256:sha256(referenceBytes)});
  const fixtureSha=fixtureIdentity(fixtures);
  fs.mkdirSync(outDir,{recursive:true});write(path.join(outDir,'public-reference.json'),referenceBytes);
  const hostRoot=fs.mkdtempSync(path.join(os.tmpdir(),'portitor-native-host-'));
  const runs=[],cases=[],artifacts=[];
  const stage=(target,selected)=>{
    fs.mkdirSync(target,{recursive:true});for(const [relative,bytes]of selected.files)write(path.join(target,relative),bytes);
    for(const relative of paths){let destination;if(relative.startsWith('godot/demo/'))destination=relative.slice('godot/demo/'.length);else if(relative.startsWith('godot/tests/'))destination='tests/'+relative.slice('godot/tests/'.length);else destination='fixtures/'+relative.slice('tests/native/fixtures/'.length);write(path.join(target,destination),source.read(relative));}
    write(path.join(target,'fixtures/public-reference.json'),referenceBytes);write(path.join(target,'fixtures/manifest.sha256'),selected.manifest_sha256+'\n');
  };
  const candidateHost=path.join(hostRoot,'candidate');stage(candidateHost,pkg);
  const headless=(host,...extra)=>['--headless','--path',host,...extra];
  const gpu=(host,...extra)=>['--display-driver','macos','--path',host,...extra];
  async function run(phase,selected,host,args,extraInput={}){
    const result=await job({godot,args,cwd:host,out:path.join(outDir,phase),pkg:selected,verifierCommit,fixtureSha,phase,extraInput});runs.push(result.receipt);
    cases.push(...reconcileSuite(phase,result.receipt,result.suite));
    return result;
  }
  try{
    // Import/parse is a real prerequisite; it is not a report-producing suite.
    const imported=await job({godot,args:headless(candidateHost,'--editor','--import'),cwd:candidateHost,out:path.join(outDir,'import'),pkg,verifierCommit,fixtureSha,phase:'import'});runs.push(imported.receipt);
    need(imported.receipt.passed,'candidate import/parse failed; partial logs preserved');
    if(phases.includes('contracts'))await run('contracts',pkg,candidateHost,headless(candidateHost,'--script','res://tests/contracts.gd'));
    if(phases.includes('gpu')){
      await run('gpu',pkg,candidateHost,gpu(candidateHost,'--script','res://tests/render_cases.gd'));
      need(baselineArchive,'first native predecessor carrier must be explicit');
      const prior=packageAt(baselineArchive),priorHost=path.join(hostRoot,'predecessor');stage(priorHost,prior);
      need(prior.archive_sha256===T7_BASELINE.archive_sha256&&prior.manifest_sha256===T7_BASELINE.manifest_sha256&&prior.manifest.producer.commit===T7_BASELINE.producer_commit&&prior.archive_sha256!==pkg.archive_sha256,'baseline must be the fixed actual T7 source carrier, never the current candidate');
      artifacts.push({kind:'native-predecessor-input',archive_sha256:prior.archive_sha256,manifest_sha256:prior.manifest_sha256,producer_commit:prior.manifest.producer.commit,...prior.manifest.identity});
      // Compare original source-host execution. T7 did not support editor-created
      // shader UID sidecars; do not mutate that immutable baseline to hide it.
      await run('predecessor',prior,priorHost,gpu(priorHost,'--script','res://tests/render_cases.gd'));
      const current=fs.readdirSync(path.join(outDir,'gpu')).filter(p=>p.endsWith('.rgba')).sort();
      for(const file of current){const a=fs.readFileSync(path.join(outDir,'gpu',file)),other=path.join(outDir,'predecessor',file);let diff=0;
        if(!fs.existsSync(other))diff=a.length/4;else{const b=fs.readFileSync(other);if(a.length!==b.length)diff=Math.max(a.length,b.length)/4;else for(let i=0;i<a.length;i+=4)if(!a.subarray(i,i+4).equals(b.subarray(i,i+4)))diff++;}
        cases.push({id:'native-compare:'+file,scope:'native-predecessor',status:diff===0?'passed':'failed',checks:1,failures:diff===0?0:1,diff_pixels:diff});
      }
    }
    if(phases.includes('pck')){
      // The GPU root-isolation case creates B at runtime. Never export that tree.
      const exportHost=path.join(hostRoot,'export-clean');stage(exportHost,pkg);
      const exportImport=await job({godot,args:headless(exportHost,'--editor','--import'),cwd:exportHost,out:path.join(outDir,'export-import'),pkg,verifierCommit,fixtureSha,phase:'export-import'});runs.push(exportImport.receipt);
      need(exportImport.receipt.passed,'clean export host import failed');
      const pck=path.join(outDir,'native-art-raw.pck');
      const exported=await job({godot,args:headless(exportHost,'--editor','--export-pack','Native Raw PCK',pck),cwd:exportHost,out:path.join(outDir,'export'),pkg,verifierCommit,fixtureSha,phase:'export'});runs.push(exported.receipt);
      if(!exported.receipt.passed||!fs.existsSync(pck))cases.push({id:'pck:export',scope:'public-pck',status:'incomplete',checks:1,failures:1,notes:['Raw export failed; logs retained.']});
      else{
        const empty=path.join(hostRoot,'pck-empty');fs.mkdirSync(empty);const pckBefore=sha256(fs.readFileSync(pck));
        const result=await run('pck',pkg,empty,['--display-driver','macos','--path',empty,'--main-pack',pck,'--script','res://tests/render_cases.gd'],{application_pack_sha256:pckBefore,application_pack_bytes:fs.statSync(pck).size});
        need(sha256(fs.readFileSync(pck))===pckBefore,'PCK bytes changed during run');artifacts.push({path:'native-art-raw.pck',sha256:pckBefore,bytes:fs.statSync(pck).size});
        for(const file of (phases.includes('gpu')?fs.readdirSync(path.join(outDir,'gpu')):[]).filter(p=>p.endsWith('.rgba')).sort()){
          const a=fs.readFileSync(path.join(outDir,'gpu',file)),packed=path.join(outDir,'pck',file);let same=fs.existsSync(packed)&&a.equals(fs.readFileSync(packed));
          cases.push({id:'pck-compare:'+file,scope:'public-pck',status:same?'passed':'failed',checks:1,failures:same?0:1});
        }
      }
    }
  }catch(error){write(path.join(outDir,'orchestrator-error.txt'),error.stack+'\n');cases.push({id:'orchestrator:incomplete',scope:'public-contracts',status:'incomplete',checks:0,failures:1,notes:[error.message]});}
  finally{fs.rmSync(hostRoot,{recursive:true,force:true});}
  const after=sourceSnapshot(root,tracked),sourceChanged=!canonical(before).equals(canonical(after))||git(root,'rev-parse','HEAD').toString().trim()!==verifierCommit,inputChanged=sha256(fs.readFileSync(pkg.archive))!==pkg.archive_sha256;
  for(const phase of ['gpu','predecessor','pck'])if(fs.existsSync(path.join(outDir,phase)))for(const file of fs.readdirSync(path.join(outDir,phase)).filter(p=>/\.(png|rgba)$/.test(p)).sort()){const bytes=fs.readFileSync(path.join(outDir,phase,file));artifacts.push({path:phase+'/'+file,sha256:sha256(bytes),bytes:bytes.length});}
  if(sourceChanged||inputChanged)cases.push({id:'source-or-input:changed',scope:'public-contracts',status:'incomplete',checks:1,failures:1});
  const scopes=[...new Set(cases.map(c=>c.scope))].sort(),godotLine=runs.map(r=>r.godot_version_line).find(Boolean)||'',godotVersion=/Godot Engine v([^ ]+)/.exec(godotLine)?.[1]||'4.7.2.unknown';
  const binding={tested_producer_commit:pkg.manifest.producer.commit,tested_manifest_sha256:pkg.manifest_sha256,...pkg.manifest.identity,verifier_commit:verifierCommit,fixture_sha256:fixtureSha,godot:godotVersion,platform:'macos-arm64',backend:'gl_compatibility',scope:scopes};
  const report={format:'portitor.art.native-test-report/1',binding,completed:cases.length>0&&!cases.some(c=>['not_run','incomplete'].includes(c.status)),failures:cases.reduce((n,c)=>n+c.failures,0),cases,artifacts,run_summary:runs.map(r=>({phase:r.phase,exit_code:r.exit.code,completed:r.completed,run_incomplete:r.run_incomplete,engine_errors:r.engine_errors,integrity_ok:r.integrity_ok,job_receipt_path:r.phase+'/job.json',job_receipt_sha256:sha256(fs.readFileSync(path.join(outDir,r.phase,'job.json')))})),known_limits:['First native predecessor is the fixed actual T7 local carrier of T1/T2/T6 source mapping, not a previous formal native release; it executes source directly without editor import. T7 editor shader UID incompatibility remains recorded in the first T8 failure.','Public JS terrain comparison covers variant0/classes0..5; classes6..18 have synthetic native GPU coverage without a JS equivalent.','Neutral public UI is contract/GPU/native-predecessor coverage, not private gameplay/SDK or real localization acceptance.','178 sprites have approved bytes/frame-selection checks; only selected artificial scene sprites are GPU-rendered, not blanket178-sprite visual acceptance.','Full private Mac app/export/consumer-lock tests remain T13/T14; this is a public standalone PCK.']};
  const reportBytes=canonical(report);write(path.join(outDir,'report.json'),reportBytes);
  const record={report_path:'godot/verification/t8-report.json',report_sha256:sha256(reportBytes),...binding,completed:report.completed,failures:report.failures,case_ids:cases.map(c=>c.id).sort(cmp)};
  const envelope={status:'recorded',runtime_payload_sha256:binding.runtime_payload_sha256,reports:[record]};validateVerification(envelope,pkg.manifest.identity,()=>reportBytes);
  write(path.join(outDir,'verification-index.json'),canonical(envelope));write(path.join(outDir,'source-and-input.json'),canonical({verifier_commit:verifierCommit,source_before:before,source_after:after,source_changed:sourceChanged,input_changed:inputChanged,input:{archive_sha256:pkg.archive_sha256,manifest_sha256:pkg.manifest_sha256,...pkg.manifest.identity},fixture_sha256:fixtureSha}));
  return {report:path.join(outDir,'report.json'),verification:path.join(outDir,'verification-index.json'),completed:report.completed,failures:report.failures,cases:cases.length,fixture_sha256:fixtureSha};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),get=name=>args[args.indexOf('--'+name)+1];
  try{const result=await verifyGodotPack({verifierCommit:get('source-commit'),archive:get('archive'),baselineArchive:get('baseline'),godot:get('godot'),outDir:path.resolve(get('out')),phases:args.includes('--phases')?get('phases').split(','):['contracts','gpu','pck']});console.log(JSON.stringify(result));if(!result.completed||result.failures)process.exitCode=1;}catch(error){console.error(error.stack);process.exitCode=1;}
}
