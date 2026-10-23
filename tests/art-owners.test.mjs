import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import * as pack from '../tools/lib/godot-pack.mjs';
let owners;
try { owners = await import('../tools/lib/art-owners.mjs'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function assets() {
 const walk = directory => fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry => entry.isDirectory() ? walk(path.join(directory,entry.name)) : entry.name.endsWith('.json') ? [JSON.parse(fs.readFileSync(path.join(directory,entry.name),'utf8'))] : []);
 return walk(path.join(REPO,'art/source'));
}
test('owner metadata helper exists outside content identities', () => assert.equal(typeof owners?.assetOwner,'function'));
test('new producers cannot silently omit the owner metadata table', {skip:!owners}, t => {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'art07-owner-required-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 assert.throws(()=>owners.readOwnerTable(root,[]),/owner metadata.*required/);
});
test('every actual composition has an explicit owner and single items stay common', {skip:!owners}, () => {
 const table=owners.readOwnerTable(REPO), source=assets();
 const combinations=source.filter(owners.isComposition);
 assert.equal(combinations.length,69);
 assert.deepEqual(Object.keys(table.owners).sort(),combinations.map(asset=>asset.id).sort());
 for(const asset of source) {
  const owner=owners.assetOwner(asset,table);
  assert.ok(['common','lab','delivery','story','hell'].includes(owner));
  if(!owners.isComposition(asset)||['ui.action_icon','ui.key_cmd'].includes(asset.id)) assert.equal(owner,'common',asset.id);
 }
 assert.equal(owners.assetOwner({id:'ui.screen.observe',kind:'procedural'},table),'lab');
});
test('invalid owners, missing composition ownership and private single sprites are refused', {skip:!owners}, () => {
 assert.throws(()=>owners.validateOwnerTable({format:'portitor.art.owners/1',owners:{'theme.test':'unknown'}}),/owner/);
 assert.throws(()=>owners.assetOwner({id:'theme.test',kind:'procedural'},{owners:{}}),/missing.*owner/);
 assert.throws(()=>owners.assetOwner({id:'char.test',kind:'sprite'},{owners:{'char.test':'lab'}}),/common/);
 assert.throws(()=>owners.assetOwner({id:'ui.action_icon',kind:'procedural'},{owners:{'ui.action_icon':'delivery'}}),/common/);
});
test('owner export preserves every existing content and approval identity field', {skip:!owners}, () => {
 const asset={id:'ui.screen.test',kind:'procedural',version:3,content_hash:'a'.repeat(64),current:{version:3,hash:'a'.repeat(64),preview_sha256:'b'.repeat(64)},approved:{hash:'a'.repeat(64),png_sha256:'c'.repeat(64)},params:{keep:true}};
 const original=structuredClone(asset);
 const first=owners.withOwners([asset],{owners:{'ui.screen.test':'lab'}})[0];
 const second=owners.withOwners([asset],{owners:{'ui.screen.test':'common'}})[0];
 assert.deepEqual(asset,original);
 for(const exported of [first,second]){const {owner,...same}=exported;assert.deepEqual(same,original);}
 assert.equal(first.owner,'lab');assert.equal(second.owner,'common');
 const artCode=fs.readFileSync(path.join(REPO,'tools/art.mjs'),'utf8');
 assert.doesNotMatch(/const CONTENT_KEYS = \[([^\]]+)\]/.exec(artCode)[1],/owner/);
});

test('owner preflight rejects unknown IDs before art build can change source versions or outputs', {skip:!owners}, t => {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'art07-owner-preflight-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const asset={format:'pushbox.art/1',id:'obj.fixture',name:'Isolated fixture',category:'object',kind:'sprite',stage:'review',version:1,content_hash:'0'.repeat(64),size:[1,1],anchor:[0,0],palette:'endesga32',frames:[['a']],animations:{default:{frames:[0],fps:0,loop:true}}};
 const source=path.join(root,'art/source/object/obj.fixture.json'),manifest=path.join(root,'art/export/manifest.json');
 fs.mkdirSync(path.dirname(source),{recursive:true});fs.mkdirSync(path.dirname(manifest),{recursive:true});
 fs.writeFileSync(source,JSON.stringify(asset)+'\n');fs.writeFileSync(manifest,'{"unchanged":true}\n');
 fs.writeFileSync(path.join(root,'art/owners.json'),JSON.stringify({format:'portitor.art.owners/1',owners:{'obj.unknown':'common'}})+'\n');
 const before=fs.readFileSync(source),output=fs.readFileSync(manifest);
 const result=spawnSync(process.execPath,['--single-threaded','--v8-pool-size=1',path.join(REPO,'tools/art.mjs'),'build','--root',root],{encoding:'utf8',timeout:20000});
 assert.notEqual(result.status,0);assert.match(result.stderr,/unknown owner asset ID/);
 assert.deepEqual(fs.readFileSync(source),before);assert.deepEqual(fs.readFileSync(manifest),output);
 assert.equal(fs.existsSync(path.join(root,'art/export/preview')),false);
});

function git(root,...args){return execFileSync('git',['-c','gc.auto=0','-c','maintenance.auto=false','-c','pack.threads=1',...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function commit(root){git(root,'add','-A');git(root,'commit','--allow-empty','-qm','synthetic owner metadata contract');return git(root,'rev-parse','HEAD');}
function frozenProducer(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'art07-owner-producer-'));
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 execFileSync('git',['-c','gc.auto=0','-c','maintenance.auto=false','-c','pack.threads=1','clone','--quiet','--no-hardlinks',REPO,directory],{stdio:'pipe'});
 for(const relative of ['godot','art/owners.json','art/approvals.json','art/history','art/export/approved','art/export/manifest.json','art-pack.json','audio/approvals.json','audio/history','audio/export/approved','third_party/fonts','LICENSE','LICENSE-ASSETS.md','tools/lib/godot-pack.mjs','tools/lib/art-owners.mjs','tools/pack-godot.mjs']){
  const destination=path.join(directory,relative);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.cpSync(path.join(REPO,relative),destination,{recursive:true});
 }
 // Existing packer contract: synthetic frozen-v1 producer, not current-main approval validation.
 for(const relative of ['art/export/manifest.json','art/approvals.json'])fs.writeFileSync(path.join(directory,relative),execFileSync('git',['show',pack.BASE.commit+':'+relative],{cwd:directory}));
 fs.rmSync(path.join(directory,'godot/verification-index.json'),{force:true});
 fs.rmSync(path.join(directory,'godot/verification'),{recursive:true,force:true});
 git(directory,'config','user.name','Fixture');git(directory,'config','user.email','fixture@example.invalid');
 return {root:directory,sourceCommit:commit(directory)};
}
test('committed owner metadata reaches real ZIP without altering approved identities', {skip:!owners}, t => {
 const fixture=frozenProducer(t);
 const evidence=process.env.ART07_TEST_EVIDENCE_DIR || path.join(fixture.root,'test-output');
 const first=pack.buildGodotPack({...fixture,packageVersion:'1.0.0-owner-test.1',outDir:path.join(evidence,'synthetic-frozen-v1-first')});
 const firstFiles=pack.readStoreZip(fs.readFileSync(first.archive));
 const firstIndex=JSON.parse(firstFiles.get('addons/portitor_art/resources/catalog.json'));
 const firstManifest=JSON.parse(fs.readFileSync(first.manifest));
 assert.ok(firstIndex.assets.filter(owners.isComposition).every(asset=>typeof asset.owner==='string'));
 assert.equal(firstIndex.assets.find(asset=>asset.id==='ui.screen.chapters').owner,'lab');
 assert.equal(firstIndex.assets.find(asset=>asset.id==='char.portitor').owner,'common');
 const mapping=JSON.parse(fs.readFileSync(path.join(fixture.root,'art/owners.json')));
 mapping.owners['ui.screen.chapters']='common';
 fs.writeFileSync(path.join(fixture.root,'art/owners.json'),JSON.stringify(mapping)+'\n');
 // Working-tree ownership is ignored until its bytes have a new producer commit.
 const ignored=pack.buildGodotPack({...fixture,packageVersion:'1.0.0-owner-test.1',outDir:path.join(evidence,'synthetic-uncommitted-ignored')});
 assert.equal(ignored.archive_sha256,first.archive_sha256);
 const next={...fixture,sourceCommit:commit(fixture.root)};
 const second=pack.buildGodotPack({...next,packageVersion:'1.0.0-owner-test.1',outDir:path.join(evidence,'synthetic-frozen-v1-second')});
 const secondFiles=pack.readStoreZip(fs.readFileSync(second.archive));
 const secondIndex=JSON.parse(secondFiles.get('addons/portitor_art/resources/catalog.json'));
 const secondManifest=JSON.parse(fs.readFileSync(second.manifest));
 assert.equal(secondIndex.assets.find(asset=>asset.id==='ui.screen.chapters').owner,'common');
 assert.equal(firstManifest.identity.approved_identity_sha256,secondManifest.identity.approved_identity_sha256);
 assert.notEqual(firstManifest.identity.runtime_payload_sha256,secondManifest.identity.runtime_payload_sha256);
 assert.notEqual(firstManifest.identity.renderer_sha256,secondManifest.identity.renderer_sha256);
 const identities=index=>index.assets.map(asset=>[asset.uid,asset.version,asset.hash,asset.approval,asset.png_sha256]);
 assert.deepEqual(identities(firstIndex),identities(secondIndex));
 assert.deepEqual(firstIndex.approval_records,secondIndex.approval_records);
 for(const [relative,bytes] of firstFiles)if(relative.includes('/resources/sprites/')||relative.includes('/resources/audio/'))assert.deepEqual(secondFiles.get(relative),bytes,relative);
 if(process.env.ART07_TEST_EVIDENCE_DIR){
  fs.mkdirSync(evidence,{recursive:true});
  fs.writeFileSync(path.join(evidence,'owner-synthetic-receipt.json'),JSON.stringify({purpose:'synthetic-committed-frozen-v1-owner-contract-not-current-main-verification',first:{producer:fixture.sourceCommit,archive_sha256:first.archive_sha256,manifest_sha256:first.manifest_sha256,identity:firstManifest.identity},second:{producer:next.sourceCommit,archive_sha256:second.archive_sha256,manifest_sha256:second.manifest_sha256,identity:secondManifest.identity},assets:firstIndex.assets.length,approved_identity_unchanged:true,media_bytes_unchanged:true},null,2)+'\n');
 }
 const helper=path.join(fixture.root,'tools/lib/art-owners.mjs');fs.appendFileSync(helper,'\n// synthetic changed producer helper\n');
 assert.throws(()=>pack.buildGodotPack({...fixture,sourceCommit:commit(fixture.root),packageVersion:'1.0.0-owner-test.1',outDir:path.join(evidence,'must-not-build')}),/running owner metadata helper differs from sourceCommit/);
});
