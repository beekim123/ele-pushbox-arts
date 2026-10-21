import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const libPath = path.join(repo, 'tools/lib/godot-pack.mjs');

test('native producer is implemented as an offline committed-source builder', async () => {
  assert.ok(fs.existsSync(libPath), 'T7 producer library is missing');
  const lib = await import(libPath);
  assert.equal(typeof lib.buildGodotPack, 'function');
});

// The fixture is a real committed producer tree. No test writes approvals in repo.
let fixture;
function git(root, ...args) {
  return execFileSync('git', ['-c','gc.auto=0','-c','maintenance.auto=false','-c','pack.threads=1',...args], {cwd: root, encoding: 'utf8'}).trim();
}
function sourceFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portitor-godot-pack-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  execFileSync('git', ['-c','gc.auto=0','-c','maintenance.auto=false','-c','pack.threads=1','clone', '--quiet', '--no-hardlinks', repo, root], {stdio: 'pipe'});
  for (const rel of ['godot', 'art/approvals.json', 'art/history', 'art/export/approved',
    'art/export/manifest.json', 'art-pack.json', 'audio/approvals.json', 'audio/history',
    'audio/export/approved', 'third_party/fonts', 'LICENSE', 'LICENSE-ASSETS.md',
    'tools/lib/godot-pack.mjs', 'tools/pack-godot.mjs']) {
    const from = path.join(repo, rel);
    assert.ok(fs.existsSync(from), 'native producer input is missing: ' + rel);
    fs.mkdirSync(path.dirname(path.join(root, rel)), {recursive: true});
    fs.cpSync(from, path.join(root, rel), {recursive: true});
  }
  git(root, 'config', 'user.name', 'Fixture');
  git(root, 'config', 'user.email', 'fixture@example.invalid');
  // A synthetic fixture starts without real attached technical reports. Its
  // packageVersion and source are intentionally different from the real run.
  fs.rmSync(path.join(root,'godot/verification-index.json'),{force:true});
  fs.rmSync(path.join(root,'godot/verification'),{recursive:true,force:true});
  git(root, 'add', '.');
  git(root, 'commit', '--allow-empty', '-qm', 'synthetic committed producer');
  return {root, sourceCommit: git(root, 'rev-parse', 'HEAD')};
}
function commit(root) {
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'isolated negative fixture');
  return git(root, 'rev-parse', 'HEAD');
}
function mutateJson(root, rel, change) {
  const file = path.join(root, rel);
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  change(value);
  fs.writeFileSync(file, JSON.stringify(value) + '\n');
}

test('rights inventory preserves operative asset terms and identifies the committed Catalog source', async t => {
  const lib = await import(libPath), f = sourceFixture(t);
  const built = lib.buildGodotPack({...f, packageVersion: '1.0.0-rc.1', outDir: path.join(f.root, 'out-rights')});
  const zipped = lib.readStoreZip(fs.readFileSync(built.archive));
  const rights = JSON.parse(zipped.get('addons/portitor_art/licenses/inventory.json'));
  await t.test('the material notice cannot be read as MIT documentation', () => {
    const notice = rights.files.find(x => x.path === 'addons/portitor_art/licenses/LICENSE-ASSETS.md');
    assert.deepEqual(notice.terms, ['operative-asset-license-notice', 'original-visual-and-sound-data-CC-BY-NC-SA-4.0',
      'reserved-brand-or-character-rights', 'third-party-fonts-retain-original-licenses', 'approval-records-historical-facts-only']);
    assert.deepEqual(zipped.get(notice.path), execFileSync('git', ['show', f.sourceCommit + ':LICENSE-ASSETS.md'], {cwd: f.root}));
  });
  await t.test('the copied Catalog names its actual committed source bytes', () => {
    const sourcePath = 'godot/addons/portitor_art/api/catalog.gd';
    const sourceBytes = execFileSync('git', ['show', f.sourceCommit + ':' + sourcePath], {cwd: f.root});
    const catalog = rights.files.find(x => x.path === 'addons/portitor_art/api/catalog.gd');
    assert.deepEqual(catalog.origin, {kind: 'committed_producer_source', source_path: sourcePath,
      source_sha256: createHash('sha256').update(sourceBytes).digest('hex'), transformation: 'byte_copy'});
    assert.deepEqual(zipped.get(catalog.path), sourceBytes);
    assert.equal(JSON.parse(fs.readFileSync(built.manifest)).producer.commit, f.sourceCommit);
  });
  assert.deepEqual(rights.palette, {creator: 'ENDESGA', name: 'ENDESGA 32', source: 'https://lospec.com/palette-list/endesga-32',
    basis: 'Existing project records free public use; no named MIT/CC0 grant is asserted.'});
});

test('real committed inputs yield identical STORE archives and preserve selected approvals', async t => {
  const lib = await import(libPath);
  fixture = sourceFixture(t);
  const opts = {...fixture, packageVersion: '1.0.0-rc.1'};
  const a = lib.buildGodotPack({...opts, outDir: path.join(fixture.root, 'out-a')});
  const b = lib.buildGodotPack({...opts, outDir: path.join(fixture.root, 'out-b')});
  assert.deepEqual(fs.readFileSync(a.archive), fs.readFileSync(b.archive));
  const manifest = JSON.parse(fs.readFileSync(a.manifest, 'utf8'));
  const zipped = lib.readStoreZip(fs.readFileSync(a.archive));
  const index = JSON.parse(zipped.get('addons/portitor_art/resources/catalog.json'));
  for(const asset of index.assets){
    const history=JSON.parse(fs.readFileSync(path.join(fixture.root,asset.origin.history_path),'utf8'));
    assert.equal(typeof asset.name,'string','selected original display name is missing: '+asset.uid);
    assert.equal(asset.name,history.name,'display name must come verbatim from the selected fixed history: '+asset.uid);
  }
  const wrongName=structuredClone(index);wrongName.assets[0].name=42;
  assert.throws(()=>lib.validateCatalog(wrongName,zipped),/name/,'optional public asset name must be a String');
  assert.equal(index.assets.length, 221);
  assert.equal(index.assets.filter(x => x.kind === 'sprite').length, 178);
  assert.equal(index.assets.filter(x => x.native.native === 'reference_only').length, 13);
  assert.equal(index.audio.length, 32);
  assert.ok(index.audio.every(x => x.version === 2 && x.uid.startsWith('sfx:')));
  assert.ok(index.assets.every(x => x.approved && !x.placeholder && !x.uid.endsWith('portitor_alt')));
  assert.ok(index.assets.every(x => x.native.evidence_stage === 'source_inventory' && !x.native.verified));
  assert.equal(manifest.producer.commit, fixture.sourceCommit);
  assert.equal(manifest.assets_base.commit, '4976323c7bd1d7706602d4d4c3dfbc11e673d10b');
  assert.ok(!manifest.files.some(x => x.path.endsWith('/manifest.json')));
  assert.equal(zipped.size, manifest.files.length + 1);
  for (const asset of index.assets) {
    if (asset.kind !== 'sprite') {
      assert.equal(asset.texture_path, '');
      continue;
    }
    assert.deepEqual(zipped.get('addons/portitor_art/' + asset.texture_path),
      fs.readFileSync(path.join(fixture.root, asset.origin.media_path)));
  }
  for (const audio of index.audio) assert.deepEqual(zipped.get('addons/portitor_art/' + audio.path),
    fs.readFileSync(path.join(fixture.root, audio.origin.media_path)));
  for (const font of index.fonts) for (const item of font.files) assert.deepEqual(
    zipped.get('addons/portitor_art/' + item.path), fs.readFileSync(path.join(fixture.root, item.origin_path)));
  assert.equal(index.fonts.flatMap(x => x.files).length, 9);
  const rights=JSON.parse(zipped.get('addons/portitor_art/licenses/inventory.json'));
  assert.equal(rights.creation_stage,'pre-publication extraction');
  assert.equal(rights.status,undefined);
  const indexRights=rights.files.find(x=>x.path==='addons/portitor_art/resources/catalog.json');
  assert.equal(indexRights.origin.kind,'mixed_runtime_index');
  assert.equal(indexRights.origin.art.length,221);
  assert.equal(indexRights.origin.audio.length,32);
  assert.equal(indexRights.origin.fonts.length,2);
  assert.ok(!indexRights.terms.includes('MIT-documentation'));
  assert.ok(indexRights.terms.includes('sound-parameters-CC-BY-NC-SA-4.0'));
  assert.ok(![...zipped.keys()].some(x => /\.uid$|\.import$|\.godot\/|\.js$|\.mjs$|project\.godot$/.test(x)));
  const receipt={status:'pending',runtime_payload_sha256:manifest.identity.runtime_payload_sha256,reports:[]};
  fs.writeFileSync(path.join(fixture.root,'godot/verification-index.json'),JSON.stringify(receipt)+'\n');
  const receiptCommit=commit(fixture.root);
  const withReceipt=lib.buildGodotPack({...opts,sourceCommit:receiptCommit,outDir:path.join(fixture.root,'out-receipt')});
  const receiptManifest=JSON.parse(fs.readFileSync(withReceipt.manifest,'utf8'));
  assert.equal(receiptManifest.producer.commit,receiptCommit);
  assert.deepEqual(receiptManifest.candidate_verification,receipt);
  assert.equal(receiptManifest.identity.runtime_payload_sha256,manifest.identity.runtime_payload_sha256);
  assert.notEqual(withReceipt.manifest_sha256,a.manifest_sha256);
  const binding={tested_producer_commit:fixture.sourceCommit,tested_manifest_sha256:a.manifest_sha256,...manifest.identity,verifier_commit:fixture.sourceCommit,fixture_sha256:lib.sha256(Buffer.from('explicit synthetic receipt fixture')),godot:'4.7.2.stable.official.ed1daf0bf',platform:'macos-arm64',backend:'gl_compatibility',scope:['public-contracts']};
  const body={format:'portitor.art.native-test-report/1',binding,completed:true,failures:0,cases:[{id:'synthetic.schema',scope:'public-contracts',status:'passed',checks:1,failures:0}],artifacts:[],run_summary:[],known_limits:['Synthetic producer-to-Catalog schema fixture; no real GPU/PCK result.']};
  const reportBytes=lib.canonical(body),record={report_path:'godot/verification/synthetic-schema.json',report_sha256:lib.sha256(reportBytes),...binding,completed:true,failures:0,case_ids:['synthetic.schema']};
  fs.mkdirSync(path.join(fixture.root,'godot/verification'),{recursive:true});fs.writeFileSync(path.join(fixture.root,record.report_path),reportBytes);
  fs.writeFileSync(path.join(fixture.root,'godot/verification-index.json'),lib.canonical({status:'recorded',runtime_payload_sha256:manifest.identity.runtime_payload_sha256,reports:[record]}));
  const recordedCommit=commit(fixture.root),recorded=lib.buildGodotPack({...opts,sourceCommit:recordedCommit,outDir:path.join(fixture.root,'out-recorded')});
  const recordedManifest=JSON.parse(fs.readFileSync(recorded.manifest));assert.equal(recordedManifest.candidate_verification.status,'recorded');assert.equal(recordedManifest.identity.runtime_payload_sha256,manifest.identity.runtime_payload_sha256);
  if (process.env.PORTITOR_T7_TEST_OUTPUT) {
    fs.mkdirSync(process.env.PORTITOR_T7_TEST_OUTPUT, {recursive:true});
    fs.copyFileSync(withReceipt.archive, path.join(process.env.PORTITOR_T7_TEST_OUTPUT, 'fixture.zip'));
    fs.copyFileSync(withReceipt.manifest, path.join(process.env.PORTITOR_T7_TEST_OUTPUT, 'fixture.manifest.json'));
    fs.copyFileSync(recorded.archive,path.join(process.env.PORTITOR_T7_TEST_OUTPUT,'recorded-fixture.zip'));
  }
  mutateJson(fixture.root,'godot/verification-index.json',x=>{x.runtime_payload_sha256='0'.repeat(64);});
  const badReceiptCommit=commit(fixture.root);
  assert.throws(()=>lib.buildGodotPack({...opts,sourceCommit:badReceiptCommit,outDir:path.join(fixture.root,'out-bad-receipt')}),/another runtime payload/);
  const marker = path.join(fixture.root, 'godot/addons/portitor_art/runtime/render/palette_raster.gd');
  fs.appendFileSync(marker, '\n# dirty ignored by the committed source reader\n');
  const c = lib.buildGodotPack({...opts, outDir: path.join(fixture.root, 'out-c')});
  assert.deepEqual(fs.readFileSync(c.archive), fs.readFileSync(a.archive));
});

test('malformed paths, duplicate records, ZIP metadata and self listing are rejected', async () => {
  const lib = await import(libPath);
  for (const name of ['/tmp/x', '../x', 'a/../x', 'a\\x', 'a//x', 'a/./x', 'a:x', 'a\nx'])
    assert.throws(() => lib.validatePath(name));
  for (const names of [['a', 'a'], ['A', 'a'], ['a', 'a/b']])
    assert.throws(() => lib.validateFiles(names.map(p => ({path: 'addons/portitor_art/' + p, bytes: 0, sha256: '0'.repeat(64)}))));
  assert.throws(() => lib.validateFiles([{path: 'addons/portitor_art/manifest.json', bytes: 0, sha256: '0'.repeat(64)}]));
  const zip = lib.writeStoreZip(new Map([['addons/portitor_art/a.txt', Buffer.from('x')]]));
  const corrupt = Buffer.from(zip);
  corrupt.writeUInt16LE(8, 8); // STORE local method becomes deflate without a matching profile.
  assert.throws(() => lib.readStoreZip(corrupt));
  assert.throws(() => lib.readStoreZip(Buffer.concat([zip, Buffer.from('tail')])));
});

test('missing approval, changed confirmed bytes, unknown dependency and links fail in isolated commits', async t => {
  const lib = await import(libPath);
  for (const kind of ['approval', 'media', 'dependency', 'coverage_provenance', 'link', 'private_reference', 'license']) {
    const f = sourceFixture(t);
    if (kind === 'approval') mutateJson(f.root, 'art/approvals.json', x => {x.records[0].items.pop();});
    if (kind === 'media') fs.appendFileSync(path.join(f.root, 'art/export/approved/obj.crate_wood@v1.png'), 'changed');
    if (kind === 'dependency') mutateJson(f.root, 'godot/native-coverage.json', x => {x.entries[0].uid = 'art:unknown';});
    if (kind === 'coverage_provenance') mutateJson(f.root,'godot/native-coverage.json',x=>{x.notes.push('a changed producer input with an unchanged mapping');});
    if (kind === 'link') fs.symlinkSync('palette_raster.gd', path.join(f.root, 'godot/addons/portitor_art/runtime/render/evil.gd'));
    if (kind === 'private_reference') fs.appendFileSync(path.join(f.root, 'godot/addons/portitor_art/api/catalog.gd'), '\nconst BAD = preload("res://app/private.gd")\n');
    if (kind === 'license') fs.unlinkSync(path.join(f.root, 'godot/addons/portitor_art/resources/fonts/fusion-pixel-12px/LICENSES/cubic-11/OFL.txt'));
    const sourceCommit = commit(f.root);
    assert.throws(() => lib.buildGodotPack({root: f.root, sourceCommit, packageVersion: '1.0.0-rc.1', outDir: path.join(f.root, 'out')}), kind==='coverage_provenance'?/recorded mapping/:undefined, kind);
    assert.ok(!fs.existsSync(path.join(f.root, 'out/portitor-art-godot-1.0.0-rc.1.zip')), 'failed producer writes no final archive');
  }
});

test('literal file-based extends belongs to the declared closure', async t => {
  const lib=await import(libPath);
  for(const parent of ['not_present.gd','../../../../private.gd']){
    const f=sourceFixture(t);
    const target=path.join(f.root,'godot/addons/portitor_art/api/catalog.gd');
    fs.writeFileSync(target,fs.readFileSync(target,'utf8').replace('extends RefCounted','extends "'+parent+'"'));
    const sourceCommit=commit(f.root);
    assert.throws(()=>lib.buildGodotPack({root:f.root,sourceCommit,packageVersion:'1.0.0-rc.1',outDir:path.join(f.root,'out')}),/script reference/);
  }
});

test('shader include fragments are traversed to the second-level dependency', async t => {
  const lib=await import(libPath),f=sourceFixture(t);
  const input={
    'godot/addons/portitor_art/runtime/render/terrain/fixture-a.gdshader':'shader_type canvas_item;\n#include "fixture-b.gdshaderinc"\nvoid fragment(){COLOR=vec4(1.0);}\n',
    'godot/addons/portitor_art/runtime/render/terrain/fixture-b.gdshaderinc':'#include "missing-second-level.gdshaderinc"\n'
  };
  for(const [rel,text]of Object.entries(input))fs.writeFileSync(path.join(f.root,rel),text);
  const sourceCommit=commit(f.root);
  // The declared extraction is itself a real earlier commit in this fixture.
  mutateJson(f.root,'godot/source-map.json',map=>{
    for(const [rel,text]of Object.entries(input)){const hash=lib.sha256(Buffer.from(text));map.files.push({source_repository:'isolated fixture',source_commit:sourceCommit,source_path:rel,source_sha256:hash,target_path:rel,target_sha256:hash,transformation:'byte_copy'});}
  });
  const mappedCommit=commit(f.root);
  assert.throws(()=>lib.buildGodotPack({root:f.root,sourceCommit:mappedCommit,packageVersion:'1.0.0-rc.1',outDir:path.join(f.root,'out')}),/script reference/);
});
