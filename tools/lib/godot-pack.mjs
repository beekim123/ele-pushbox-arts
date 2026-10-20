// Native producer only. Consumers verify original bytes with Godot, without Node.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

export const PACKAGE_ID = 'portitor.art.godot';
export const PREFIX = 'addons/portitor_art/';
export const BASE = Object.freeze({tag:'art-v2026.10.20.1',commit:'4976323c7bd1d7706602d4d4c3dfbc11e673d10b',manifest_sha256:'a5f1747e6cd619675a0c46768378c7fae4f7a95ba74ca5e6588788b5c30ffbe8'});
export const SCHEMAS = Object.freeze({world:'portitor.art.world/1',ui:'portitor.art.ui/1',visual_cells:'visual_cells/1'});
export const HOST = Object.freeze({godot:'4.7.2',rendering_method:'gl_compatibility',viewport:[320,180],stretch_mode:'canvas_items',scale_mode:'integer',nearest:true,worker_pool:1});
export const ENTRIES = Object.freeze({catalog:'api/catalog.gd',world:'runtime/render/world_view.gd',ui:'runtime/ui/views/ui_view.gd',widgets:'runtime/ui/widgets.gd',tutorial_feedback:'runtime/ui/views/tutorial_feedback.gd'});
const HASH = /^[a-f0-9]{64}$/;
const UID = /^art:[a-z0-9_.]+$/;
const KINDS = {S:'sprite',M:'material',T:'theme',F:'feedback',U:'ui',E:'embedded_ui','R-T':'reference','R-U':'reference'};
const cmp = (a,b) => Buffer.compare(Buffer.from(a),Buffer.from(b));
export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function need(ok,message) {if(!ok)throw Error(message);}
function object(v) {return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function integer(v,min=0,max=0xffffffff) {return Number.isSafeInteger(v)&&v>=min&&v<=max;}

export function canonical(value) {
  function encode(v,depth=0){
    need(depth<=64,'JSON nesting exceeds profile');
    if(v===null||typeof v==='string'||typeof v==='boolean')return JSON.stringify(v);
    if(typeof v==='number'){need(Number.isFinite(v),'nonfinite JSON number');return JSON.stringify(v);}
    if(Array.isArray(v))return '['+v.map(x=>encode(x,depth+1)).join(',')+']';
    need(object(v)&&Object.getPrototypeOf(v)===Object.prototype,'plain JSON value required');
    return '{'+Object.keys(v).sort(cmp).map(k=>JSON.stringify(k)+':'+encode(v[k],depth+1)).join(',')+'}';
  }
  return Buffer.from(encode(value)+'\n');
}

// Detect duplicate keys before JSON.parse discards them. This is a bounded JSON
// token walk, not a second JSON codec: JSON.parse remains the syntax authority.
export function parseJson(bytes) {
  const text=Buffer.from(bytes).toString('utf8');
  need(Buffer.from(text).equals(Buffer.from(bytes))&&!text.startsWith('\ufeff'),'JSON must be lossless UTF-8 without BOM');
  let at=0;
  const ws=()=>{while(/\s/.test(text[at]||'')&&at<text.length)at++;};
  function string(){const start=at++;while(at<text.length){if(text[at++]==='"')return JSON.parse(text.slice(start,at));if(text[at-1]==='\\')at++;}throw Error('unterminated JSON string');}
  function value(depth=0){
    need(depth<=64,'JSON nesting exceeds profile');ws();
    if(text[at]==='{'){
      at++;ws();const keys=new Set();if(text[at]==='}'){at++;return;}
      while(at<text.length){ws();need(text[at]==='"','expected JSON key');const key=string();need(!keys.has(key),'duplicate JSON key: '+key);keys.add(key);ws();need(text[at++]===':','expected colon');value(depth+1);ws();const c=text[at++];if(c==='}')return;need(c===',','expected comma');}
    }else if(text[at]==='['){at++;ws();if(text[at]===']'){at++;return;}while(at<text.length){value(depth+1);ws();const c=text[at++];if(c===']')return;need(c===',','expected comma');}}
    else if(text[at]==='"')string();
    else {const m=/^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(text.slice(at));need(m,'invalid JSON token');at+=m[0].length;}
  }
  value();ws();need(at===text.length,'trailing JSON bytes');
  const parsed=JSON.parse(text);canonical(parsed);return parsed;
}

export function validatePath(name) {
  need(typeof name==='string'&&name.length>0&&Buffer.byteLength(name)<=512,'invalid path length');
  need(!/[\\:\x00-\x20\x7f]/.test(name)&&!name.startsWith('/')&&!name.endsWith('/'),'invalid path: '+name);
  need(name.split('/').length<=24&&!name.split('/').some(x=>!x||x==='.'||x==='..'),'invalid path segment: '+name);
  need(!name.split('/').some(x=>['.git','.godot','node_modules'].includes(x))&&!/\.(uid|import)$/.test(name),'cache or private path: '+name);
  need(Buffer.from(name).toString('utf8')===name&&name.normalize('NFC')===name,'path must use lossless NFC UTF-8');
  return name;
}
export function validateFiles(files,{allowManifest=false}={}) {
  need(Array.isArray(files)&&files.length>0&&files.length<=4096,'invalid file table count');
  const names=new Set(),folded=new Set();let total=0;
  for(const f of files){
    need(object(f)&&Object.keys(f).sort().join(',')==='bytes,path,sha256','invalid file record fields');
    validatePath(f.path);need(f.path.startsWith(PREFIX),'outside addon: '+f.path);
    need(allowManifest||f.path!==PREFIX+'manifest.json','manifest cannot list itself');
    need(integer(f.bytes,0,64*1024*1024)&&HASH.test(f.sha256),'invalid file size/hash');
    total+=f.bytes;need(total<=256*1024*1024,'package exceeds 256 MiB');
    need(!names.has(f.path)&&!folded.has(f.path.toLowerCase()),'duplicate/case-folded path: '+f.path);
    names.add(f.path);folded.add(f.path.toLowerCase());
  }
  for(const name of folded){const parts=name.split('/');parts.pop();while(parts.length){need(!folded.has(parts.join('/')),'file-directory prefix conflict');parts.pop();}}
  need(files.every((f,i)=>i===0||cmp(files[i-1].path,f.path)<0),'file table must use UTF-8 byte order');
  return files;
}
export function payloadDigest(files,domain='portitor.art.payload-files/1') {
  return sha256(Buffer.from(domain+'\n'+files.map(f=>f.path+'\t'+f.bytes+'\t'+f.sha256+'\n').join('')));
}
function treeTable(files){return [...files].sort(([a],[b])=>cmp(a,b)).map(([p,b])=>({path:p,bytes:b.length,sha256:sha256(b)}));}

function committed(root,commit){
  need(/^[a-f0-9]{40}$/.test(commit),'sourceCommit must be a full committed Git identity');
  const run=(...args)=>execFileSync('git',['-c','gc.auto=0','-c','maintenance.auto=false','-c','pack.threads=1',...args],{cwd:root,maxBuffer:64*1024*1024});
  need(run('rev-parse',commit+'^{commit}').toString().trim()===commit,'sourceCommit is not a commit');
  const tree=new Map();
  for(const item of run('ls-tree','-r','-z',commit).toString().split('\0').filter(Boolean)){
    const m=/^(\d+) blob ([a-f0-9]{40})\t(.+)$/.exec(item);
    if(m)tree.set(m[3],{mode:m[1],oid:m[2]});
    else {const match=/^[^\t]+\t(.+)$/.exec(item);if(match)tree.set(match[1],{mode:'unsupported'});}
  }
  const cache=new Map();
  return {tree,get(p){validatePath(p);const e=tree.get(p);need(e&&['100644','100755'].includes(e.mode),'missing/nonordinary committed file: '+p);if(!cache.has(p))cache.set(p,run('cat-file','blob',e.oid));return cache.get(p);},json(p){return parseJson(this.get(p));},run};
}
function declaredClosure(files){
  for(const [name,bytes] of files){
    if(!/\.(gd|gdshader|gdshaderinc)$/.test(name))continue;
    const text=bytes.toString('utf8');
    need(!/(?:uid:\/\/|@tool\b|\bEditorPlugin\b|\bEleWorld\b|\bPortitorSession\b|\/root\/(?:Registry|Save|Settings|Locale)|res:\/\/(?:app|gameplay|sim|presentation|bin|generated)\/)/.test(text),'private/editor dependency: '+name);
    for(const match of text.matchAll(/(?:\b(?:preload|load)\s*\(\s*|\bextends\s+|#include\s+)["']([^"']+)["']/g)){
      const ref=match[1];need(!ref.startsWith('res://')&&!ref.includes('://')&&!ref.startsWith('/'),'absolute script reference: '+name);
      const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(name),ref));
      need(resolved.startsWith(PREFIX)&&files.has(resolved),'unknown/outside script reference: '+name+' -> '+ref);
    }
  }
}

function validateNative(native){
  need(object(native)&&['implemented','reference_only'].includes(native.native),'invalid native state');
  need(native.evidence_stage==='source_inventory'&&native.verified===false,'source inventory cannot claim candidate verification');
  need(Array.isArray(native.evidence)&&native.evidence.length>0&&new Set(native.evidence).size===native.evidence.length,'invalid source evidence');
  need(native.evidence.every(e=>KINDS[e]===native.implementation_kind),'native evidence/kind mismatch');
  need(native.native==='reference_only'?native.implementation_kind==='reference':!['reference','missing'].includes(native.implementation_kind),'reference cannot bind a runnable implementation');
}
export function validateCatalog(index,files) {
  need(index.format==='portitor.art.runtime-index/1'&&index.package_id===PACKAGE_ID&&index.api_version==='1','unsupported native runtime index');
  need(canonical(index.schemas).equals(canonical(SCHEMAS))&&canonical(index.host_requirements).equals(canonical(HOST)),'runtime protocol/host requirements mismatch');
  need(canonical(index.entries).equals(canonical(ENTRIES)),'runtime entries mismatch');
  for(const ref of Object.values(index.entries))need(files.has(PREFIX+ref),'missing runtime entry: '+ref);
  need(Array.isArray(index.assets)&&index.assets.length===221,'expected 221 approved identities');
  const byUid=new Map();const artRecords=new Map(index.approval_records.art.map(r=>[r.id,r]));
  for(const a of index.assets){
    need(UID.test(a.uid)&&a.uid==='art:'+a.id&&!byUid.has(a.uid)&&a.id!=='char.portitor_alt','invalid/duplicate approved UID');byUid.set(a.uid,a);
    need(a.approved===true&&a.placeholder===false&&integer(a.version,1)&&HASH.test(a.hash)&&HASH.test(a.png_sha256),'invalid approved asset identity');
    const rec=artRecords.get(a.approval),item=rec?.items.find(x=>x.asset===a.id&&x.version===a.version&&x.hash===a.hash);
    need(item&&item.png_sha256===a.png_sha256&&item.png===a.origin.media_path,'approval record identity mismatch: '+a.uid);
    validateNative(a.native);
    need(Array.isArray(a.depends)&&a.depends.every(x=>typeof x==='string'),'invalid dependencies');
    if(a.kind==='sprite'){
      need(Array.isArray(a.size)&&a.size.length===2&&a.size.every(x=>integer(x,1,4096))&&integer(a.frame_count,1,4096),'invalid sprite dimensions');
      need(Array.isArray(a.anchor)&&a.anchor.length===2&&a.anchor.every(x=>Number.isSafeInteger(x))&&object(a.animations),'invalid sprite anchor/animation');
      const texture=files.get(PREFIX+a.texture_path);need(texture&&sha256(texture)===a.png_sha256,'missing/changed approved PNG');
      for(const anim of Object.values(a.animations))need(object(anim)&&Array.isArray(anim.frames)&&anim.frames.length>0&&anim.frames.every(x=>integer(x,0,a.frame_count-1))&&typeof anim.loop==='boolean'&&typeof anim.fps==='number'&&Number.isFinite(anim.fps)&&anim.fps>=0,'invalid animation');
    }else need(a.kind==='procedural'&&a.texture_path===''&&object(a.params),'invalid procedural/reference texture');
  }
  for(const a of index.assets)for(const id of a.depends)need(byUid.has('art:'+id),'unknown approved dependency: '+id);
  const visiting=new Set(),done=new Set();function visit(uid){need(!visiting.has(uid),'cyclic approved dependency');if(done.has(uid))return;visiting.add(uid);for(const id of byUid.get(uid).depends)visit('art:'+id);visiting.delete(uid);done.add(uid);}for(const uid of byUid.keys())visit(uid);
  need(index.assets.filter(x=>x.kind==='sprite').length===178&&index.assets.filter(x=>x.native.native==='reference_only').length===13,'native inventory differs from fixed baseline');
  const audioRecords=new Map(index.approval_records.audio.map(r=>[r.id,r])),seen=new Set();
  need(Array.isArray(index.audio)&&index.audio.length===32,'expected 32 approved sound effects');
  for(const a of index.audio){
    const rec=audioRecords.get(a.approval),item=rec?.items.find(x=>x.uid===a.uid&&x.version===a.version&&x.hash===a.hash);
    need(/^sfx:[a-z0-9_]+$/.test(a.uid)&&!seen.has(a.uid)&&a.version===2&&item&&item.wav_sha256===a.sha256&&item.wav===a.origin.media_path,'invalid approved audio identity');seen.add(a.uid);
    need(files.has(PREFIX+a.path)&&sha256(files.get(PREFIX+a.path))===a.sha256,'changed audio media');
  }
  need(index.fonts.length===2&&index.fonts.flatMap(f=>f.files).length===9,'complete frozen font notices required');
  for(const f of index.fonts)for(const item of f.files)need(files.has(PREFIX+item.path)&&sha256(files.get(PREFIX+item.path))===item.sha256,'missing/changed font or notice');
  for(const rec of [...index.approval_records.art,...index.approval_records.audio])for(const key of ['id','date','by','via','note'])need(typeof rec[key]==='string'&&rec[key].length>0,'missing original approval provenance');
  return index;
}

const FONT_DIRS=['fusion-pixel-10px','fusion-pixel-12px'];
const FONT_NAMES=['fusion-pixel-10px-proportional-sc.woff2','fusion-pixel-12px-proportional-zh_hans.otf.woff2'];
const FONT_HASHES=['20f58ce5f54e468bc6aa86944aa2445b1e19264193496e9cd57f913cdb279e72','0ebd99e6f1e9b650a793a3f759c1c3dfa99f0c5b6502e78569b48ddb43767e40'];
function collect(reader,base,version){
  const basePack=base.json('art-pack.json');need(sha256(base.get('art-pack.json'))===BASE.manifest_sha256,'assets_base manifest identity mismatch');
  const frozen=p=>{const a=reader.get(p),b=base.get(p);need(a.equals(b),'frozen source/media changed: '+p);return a;};
  for(const p of ['art-pack.json','art/approvals.json','audio/approvals.json','art/export/manifest.json'])frozen(p);
  const approvalRecords={art:reader.json('art/approvals.json').records,audio:reader.json('audio/approvals.json').records};
  const coverage=reader.json('godot/native-coverage.json');
  need(coverage.format==='portitor.art.native-coverage-input/1'&&coverage.evidence_stage==='source_inventory'&&coverage.verified===false,'expected unverified static coverage input');
  const nativeByUid=new Map();for(const e of coverage.entries){need(!nativeByUid.has(e.uid),'duplicate static capability');nativeByUid.set(e.uid,e);}
  const map=reader.json('godot/source-map.json');need(map.format==='portitor.art.source-map/1','missing extraction source map');
  const mapped=new Map(map.files.map(f=>[f.target_path,f]));need(mapped.size===map.files.length,'duplicate migration target');
  // The inventory JSON is a producer input too, not just the copied addon files.
  for(const row of map.files){
    need(row.target_path==='godot/native-coverage.json'||row.target_path.startsWith('godot/'+PREFIX),'unexpected source-map target');
    need(HASH.test(row.source_sha256)&&HASH.test(row.target_sha256)&&/^[a-f0-9]{40}$/.test(row.source_commit),'invalid extraction source identity');
    need(['byte_copy','relative_api_path_relocation'].includes(row.transformation),'unknown extraction transformation');
    need(row.transformation!=='byte_copy'||row.source_sha256===row.target_sha256,'byte-copy mapping cannot have different source/target bytes');
    need(sha256(reader.get(row.target_path))===row.target_sha256,'mapped input differs from recorded mapping: '+row.target_path);
  }
  const files=new Map();
  for(const [p,entry] of reader.tree){
    if(!p.startsWith('godot/'+PREFIX))continue;
    need(['100644','100755'].includes(entry.mode),'links/nonordinary addon input forbidden: '+p);
    need(!/\.(uid|import)$/.test(p)&&!p.includes('/.godot/'),'generated cache cannot be committed: '+p);
    need(mapped.has(p)||p==='godot/'+PREFIX+'api/catalog.gd','undeclared addon source: '+p);
    const bytes=reader.get(p);const source=mapped.get(p);
    if(source)need(sha256(bytes)===source.target_sha256&&HASH.test(source.source_sha256)&&/^[a-f0-9]{40}$/.test(source.source_commit),'relocated source differs from recorded mapping: '+p);
    files.set(p.slice('godot/'.length),bytes);
  }
  for(const p of mapped.keys())if(p.startsWith('godot/'+PREFIX))need(reader.tree.has(p),'missing relocated input: '+p);
  need(files.has(PREFIX+'api/catalog.gd'),'missing Catalog implementation');
  const assets=[];
  for(const selected of basePack.assets.filter(x=>x.approved)){
    const ap=selected.approved,id=selected.id;
    const rec=approvalRecords.art.find(r=>r.items.some(x=>x.asset===id&&x.version===ap.version&&x.hash===ap.hash&&x.png_sha256===ap.png_sha256&&x.png===ap.png));
    need(rec,'missing user approval: '+id);
    const historyPath=`art/history/${id}@v${ap.version}.json`,history=parseJson(frozen(historyPath)),png=frozen(ap.png);
    need(history.id===id&&history.version===ap.version&&history.content_hash===ap.hash&&sha256(png)===ap.png_sha256,'damaged selected approval: '+id);
    const uid='art:'+id,c=nativeByUid.get(uid);need(c&&c.version===ap.version,'missing/mismatched native coverage: '+uid);
    const native={native:c.native,implementation_kind:c.implementation_kind,evidence:c.evidence,evidence_stage:'source_inventory',verified:false};
    const texturePath=history.kind==='sprite'?`resources/sprites/${id}@v${ap.version}.png`:'';
    if(texturePath)files.set(PREFIX+texturePath,png);
    assets.push({uid,id,kind:history.kind,category:history.category,layer:history.layer,version:ap.version,hash:ap.hash,approved:true,placeholder:false,
      approval:rec.id,png_sha256:ap.png_sha256,texture_path:texturePath,size:history.size||[0,0],frame_count:history.kind==='sprite'?history.frames.length:0,
      anchor:history.anchor||[0,0],animations:history.animations||{},ninepatch:history.ninepatch||null,params:history.params||{},depends:history.depends||[],native,
      origin:{history_path:historyPath,history_sha256:sha256(reader.get(historyPath)),media_path:ap.png,renderer:history.renderer||[]}});
  }
  need(nativeByUid.size===assets.length,'static capability identity set differs from approvals');
  const audio=[];
  for(const rec of approvalRecords.audio)for(const item of rec.items){
    need(item.uid.startsWith('sfx:')&&item.version===2,'only selected sfx@v2 may ship');
    const history=parseJson(frozen(item.history)),wav=frozen(item.wav);
    need(history.format==='pushbox.audio-history/1'&&history.uid===item.uid&&history.version===item.version&&history.hash===item.hash&&history.source.content_hash===item.hash&&sha256(wav)===item.wav_sha256,'damaged audio approval');
    const target=`resources/audio/sfx/${item.uid.slice(4)}@v${item.version}.wav`;files.set(PREFIX+target,wav);
    audio.push({uid:item.uid,version:item.version,hash:item.hash,sha256:item.wav_sha256,approval:rec.id,path:target,parameters:history.source,renderer_fingerprint:history.renderer_fingerprint,origin:{history_path:item.history,history_sha256:sha256(reader.get(item.history)),media_path:item.wav}});
  }
  const fonts=[];
  for(let i=0;i<FONT_DIRS.length;i++){
    const dir=FONT_DIRS[i],fontPath=`third_party/fonts/${dir}/${FONT_NAMES[i]}`;
    need(sha256(frozen(fontPath))===FONT_HASHES[i],'font identity changed');
    const paths=[...base.tree.keys()].filter(p=>p.startsWith(`third_party/fonts/${dir}/`)).sort(cmp);
    const items=paths.map(p=>{const bytes=frozen(p),target=p.replace('third_party/fonts/','resources/fonts/');need(files.has(PREFIX+target)&&files.get(PREFIX+target).equals(bytes),'missing/reencoded font/notice: '+target);return {path:target,bytes:bytes.length,sha256:sha256(bytes),origin_path:p};});
    fonts.push({id:dir,path:fontPath.replace('third_party/fonts/','resources/fonts/'),sha256:FONT_HASHES[i],files:items});
  }
  for(const name of ['LICENSE','LICENSE-ASSETS.md'])files.set(PREFIX+'licenses/'+name,frozen(name));
  const palette=reader.json('art/export/manifest.json').palette;
  const index={format:'portitor.art.runtime-index/1',package_id:PACKAGE_ID,package_version:version,api_version:'1',schemas:SCHEMAS,entries:ENTRIES,host_requirements:HOST,
    palette,assets:assets.sort((a,b)=>cmp(a.uid,b.uid)),audio:audio.sort((a,b)=>cmp(a.uid,b.uid)),fonts,approval_records:approvalRecords};
  files.set(PREFIX+'resources/catalog.json',canonical(index));
  const origins=[];
  for(const p of [...files.keys(),PREFIX+'licenses/inventory.json'].sort(cmp)){
    const copied=mapped.get('godot/'+p),asset=assets.find(a=>PREFIX+a.texture_path===p),sound=audio.find(a=>PREFIX+a.path===p),font=fonts.flatMap(f=>f.files).find(f=>PREFIX+f.path===p);
    let origin={kind:'producer_generated',source:'tools/lib/godot-pack.mjs'},terms=['MIT-documentation'];
    if(copied){origin={kind:'game_extraction',source_commit:copied.source_commit,source_path:copied.source_path,source_sha256:copied.source_sha256,transformation:copied.transformation};terms=p.includes('/api/')?['MIT-algorithms']:['MIT-algorithms','original-visual-data-CC-BY-NC-SA-4.0','reserved-brand-or-character-parts','font-derived-glyphs-retain-font-terms','ENDESGA32-attribution'];}
    if(asset){origin={kind:'approved_art',uid:asset.uid,version:asset.version,hash:asset.hash,approval:asset.approval,source_path:asset.origin.media_path};terms=['character','avatar','monster'].includes(asset.category)?['reserved-character-rights']:['CC-BY-NC-SA-4.0'];}
    if(sound){origin={kind:'approved_sound',uid:sound.uid,version:sound.version,hash:sound.hash,approval:sound.approval,source_path:sound.origin.media_path};terms=['CC-BY-NC-SA-4.0'];}
    if(font){origin={kind:'frozen_font_or_notice',source_path:font.origin_path,source_sha256:font.sha256};terms=['original-font-notices-OFL-and-upstream'];}
    if(p.endsWith('/api/catalog.gd'))terms=['MIT-algorithms'];
    if(p===PREFIX+'resources/catalog.json'){
      origin={kind:'mixed_runtime_index',schema_code:'tools/lib/godot-pack.mjs',assets_base_commit:BASE.commit,
        art:assets.map(a=>({uid:a.uid,version:a.version,hash:a.hash,history_path:a.origin.history_path,history_sha256:a.origin.history_sha256,approval:a.approval,terms:['character','avatar','monster'].includes(a.category)?['reserved-character-rights']:['CC-BY-NC-SA-4.0']})),
        audio:audio.map(a=>({uid:a.uid,version:a.version,hash:a.hash,history_path:a.origin.history_path,history_sha256:a.origin.history_sha256,approval:a.approval,terms:['CC-BY-NC-SA-4.0']})),
        fonts:fonts.map(f=>({id:f.id,sha256:f.sha256,terms:['original-font-notices-OFL-and-upstream']})),
        palette:{creator:'ENDESGA',name:'ENDESGA 32',source:'https://lospec.com/palette-list/endesga-32'}};
      terms=['MIT-schema-container-only','art-parameters-animation-pixel-style-CC-BY-NC-SA-4.0-except-reserved','sound-parameters-CC-BY-NC-SA-4.0','reserved-brand-or-character-data','font-provenance-retains-upstream-terms','ENDESGA32-attribution-no-MIT-or-CC0-grant','approval-records-historical-facts-only'];
    }
    origins.push({path:p,origin,terms});
  }
  files.set(PREFIX+'licenses/inventory.json',canonical({format:'portitor.art.license-inventory/1',creation_stage:'pre-publication extraction',notices:['licenses/LICENSE','licenses/LICENSE-ASSETS.md','licenses/T5-SOURCES.md','licenses/T6-SOURCES.md'],palette:{creator:'ENDESGA',name:'ENDESGA 32',source:'https://lospec.com/palette-list/endesga-32',basis:'Existing project records free public use; no named MIT/CC0 grant is asserted.'},files:origins}));
  for(const required of ['licenses/T5-SOURCES.md','licenses/T6-SOURCES.md'])need(files.has(PREFIX+required),'missing mixed-rights source inventory');
  declaredClosure(files);validateCatalog(index,files);
  return {files,index};
}

export function buildGodotPack({root,sourceCommit,packageVersion,outDir}) {
  need(typeof root==='string'&&typeof outDir==='string','explicit producer and output roots required');
  need(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:[0-9A-Za-z-]+\.)*[0-9A-Za-z-]+)?$/.test(packageVersion),'invalid package SemVer');
  const reader=committed(root,sourceCommit),base=committed(root,BASE.commit);
  reader.run('merge-base','--is-ancestor',BASE.commit,sourceCommit);
  // Rebuilding a fixed commit cannot silently execute another revision's packer.
  need(reader.get('tools/lib/godot-pack.mjs').equals(fs.readFileSync(new URL(import.meta.url))),'running producer differs from sourceCommit');
  const {files,index}=collect(reader,base,packageVersion),table=treeTable(files);validateFiles(table);
  const approved=index.assets.map(a=>[a.uid,a.version,a.hash,a.approval,a.png_sha256]).concat(index.audio.map(a=>[a.uid,a.version,a.hash,a.approval,a.sha256]),index.fonts.map(f=>[f.id,f.sha256])).sort((a,b)=>cmp(a[0],b[0]));
  const renderer=table.filter(f=>/\.(gd|gdshader|gdshaderinc)$/.test(f.path)||f.path===PREFIX+'resources/catalog.json');
  let verification={status:'pending',runtime_payload_sha256:payloadDigest(table),reports:[]};
  if(reader.tree.has('godot/verification-index.json')){
    verification=reader.json('godot/verification-index.json');
    need(object(verification)&&Object.keys(verification).sort().join(',')==='reports,runtime_payload_sha256,status','unsupported verification receipt fields');
    need(verification.runtime_payload_sha256===payloadDigest(table),'verification receipt refers to another runtime payload');
    need(verification.status==='pending'&&Array.isArray(verification.reports)&&verification.reports.length===0,'T7 does not invent technical reports or upgrade static coverage');
  }
  const manifest={format:'portitor.art.godot-package/1',package_id:PACKAGE_ID,package_version:packageVersion,
    producer:{repository:'https://github.com/beekim123/ele-pushbox-arts.git',commit:sourceCommit,packer_profile:'portitor.art.store-zip/1',packer_version:'1'},assets_base:BASE,
    runtime:{index:PREFIX+'resources/catalog.json',api_version:'1',schemas:SCHEMAS},files:table,
    identity:{runtime_payload_sha256:payloadDigest(table),renderer_sha256:payloadDigest(renderer,'portitor.art.renderer-files/1'),approved_identity_sha256:sha256(Buffer.concat([Buffer.from('portitor.art.approved-identities/1\n'),canonical(approved)]))},candidate_verification:verification};
  const manifestBytes=canonical(manifest);files.set(PREFIX+'manifest.json',manifestBytes);
  const archiveBytes=writeStoreZip(files),name='portitor-art-godot-'+packageVersion;
  fs.mkdirSync(outDir,{recursive:true});
  const output={archive:path.join(outDir,name+'.zip'),manifest:path.join(outDir,name+'.manifest.json'),checksums:path.join(outDir,name+'.checksums.txt')};
  const values=[[output.archive,archiveBytes],[output.manifest,manifestBytes],[output.checksums,Buffer.from(`${sha256(archiveBytes)}  ${name}.zip\n${sha256(manifestBytes)}  ${name}.manifest.json\n`)]];
  for(const [file,bytes] of values){const temp=file+'.tmp-'+process.pid;try{fs.writeFileSync(temp,bytes,{flag:'wx'});fs.renameSync(temp,file);}finally{fs.rmSync(temp,{force:true});}}
  return {...output,sourceCommit,manifest_sha256:sha256(manifestBytes),archive_sha256:sha256(archiveBytes),runtime_payload_sha256:manifest.identity.runtime_payload_sha256};
}

const CRC_TABLE=Array.from({length:256},(_,i)=>{for(let j=0;j<8;j++)i=(i&1)?0xedb88320^(i>>>1):i>>>1;return i>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=CRC_TABLE[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
export function writeStoreZip(files){
  const table=treeTable(files);validateFiles(table,{allowManifest:true});
  const local=[],central=[];let offset=0;
  for(const f of table){const bytes=files.get(f.path),name=Buffer.from(f.path),crc=crc32(bytes),header=Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50,0);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(0,8);header.writeUInt16LE(0,10);header.writeUInt16LE(33,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(bytes.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(name.length,26);
    local.push(header,name,bytes);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(0x314,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(33,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(bytes.length,20);c.writeUInt32LE(bytes.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE((0o100644*65536)>>>0,38);c.writeUInt32LE(offset,42);central.push(c,name);offset+=30+name.length+bytes.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(table.length,8);end.writeUInt16LE(table.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}
export function readStoreZip(bytes){
  need(Buffer.isBuffer(bytes)&&bytes.length>=22&&bytes.length<=256*1024*1024,'invalid ZIP size');
  const end=bytes.length-22;need(bytes.readUInt32LE(end)===0x06054b50&&bytes.readUInt16LE(end+4)===0&&bytes.readUInt16LE(end+6)===0&&bytes.readUInt16LE(end+20)===0,'not the single-disk comment-free profile');
  const count=bytes.readUInt16LE(end+10),size=bytes.readUInt32LE(end+12),start=bytes.readUInt32LE(end+16);
  need(count===bytes.readUInt16LE(end+8)&&count>0&&count<=4096&&start+size===end,'invalid central directory');
  const files=new Map();let at=start,nextLocal=0;
  for(let i=0;i<count;i++){
    need(at+46<=end&&bytes.readUInt32LE(at)===0x02014b50,'invalid central record');
    const n=bytes.readUInt16LE(at+28),packed=bytes.readUInt32LE(at+20),length=bytes.readUInt32LE(at+24),offset=bytes.readUInt32LE(at+42),crc=bytes.readUInt32LE(at+16);
    need(at+46+n<=end&&bytes.readUInt16LE(at+4)===0x314&&bytes.readUInt16LE(at+6)===20&&bytes.readUInt16LE(at+8)===0x800&&bytes.readUInt16LE(at+10)===0&&bytes.readUInt16LE(at+12)===0&&bytes.readUInt16LE(at+14)===33&&packed===length&&length<=64*1024*1024&&bytes.readUInt16LE(at+30)===0&&bytes.readUInt16LE(at+32)===0&&bytes.readUInt16LE(at+34)===0&&bytes.readUInt16LE(at+36)===0&&bytes.readUInt32LE(at+38)===((0o100644*65536)>>>0),'unsupported ZIP profile');
    const rawName=bytes.subarray(at+46,at+46+n),name=rawName.toString('utf8');need(Buffer.from(name).equals(rawName),'invalid UTF-8 ZIP name');validatePath(name);
    need(!files.has(name)&&offset===nextLocal&&offset+30+n+length<=start,'duplicate/overlapping ZIP entry');
    need(bytes.readUInt32LE(offset)===0x04034b50&&bytes.readUInt16LE(offset+4)===20&&bytes.readUInt16LE(offset+6)===0x800&&bytes.readUInt16LE(offset+8)===0&&bytes.readUInt16LE(offset+10)===0&&bytes.readUInt16LE(offset+12)===33&&bytes.readUInt32LE(offset+14)===crc&&bytes.readUInt32LE(offset+18)===length&&bytes.readUInt32LE(offset+22)===length&&bytes.readUInt16LE(offset+26)===n&&bytes.readUInt16LE(offset+28)===0&&bytes.subarray(offset+30,offset+30+n).equals(rawName),'local/central mismatch');
    const data=bytes.subarray(offset+30+n,offset+30+n+length);need(crc32(data)===crc,'ZIP CRC mismatch');files.set(name,Buffer.from(data));nextLocal=offset+30+n+length;at+=46+n;
  }
  need(at===end&&nextLocal===start,'unindexed ZIP bytes');validateFiles(treeTable(files),{allowManifest:true});return files;
}
