#!/usr/bin/env node
// Immutable, offline resource inventory. Publication is an explicit separate step.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));
const cfg=read('tools/pack-files.json');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const matches=(p,rules)=>rules.some(r=>new RegExp('^'+r.split('**').map(s=>s.split('*').map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('[^/]*')).join('.*')+'$').test(p));
function walk(dir,prefix='') {
  return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{
    if(e.name==='.git'||e.name==='node_modules')return [];
    const p=prefix+e.name, f=path.join(dir,e.name);
    const wanted=[...cfg.include,...cfg.snapshots,...cfg.fixtures.files];
    if(!matches(p,wanted)&&!wanted.some(r=>r.startsWith(p+'/')||p.startsWith(r.split('*')[0])))return [];
    if(matches(p,cfg.exclude)&&!matches(p,cfg.snapshots)&&!cfg.fixtures.files.includes(p))return [];
    if(e.isSymbolicLink())throw Error('符号链接不能进入资源版本: '+p);
    return e.isDirectory()?walk(f,p+'/'):[p];
  });
}
const packed=p=>matches(p,cfg.include)&&!matches(p,cfg.exclude);
const inventory=()=>walk(root).filter(packed).sort().map(p=>({path:p,bytes:fs.statSync(path.join(root,p)).size,sha256:sha(fs.readFileSync(path.join(root,p)))}));
function versionOK(v) {
  const m=/^(\d{4})\.(\d{2})\.(\d{2})\.([1-9]\d*)$/.exec(v||'');
  if(!m)return false;
  const d=new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===`${m[1]}-${m[2]}-${m[3]}`;
}
try {
  const args=process.argv.slice(2),cmd=args[0];
  if(cmd==='build') {
    const version=args[args.indexOf('--version')+1];if(!args.includes('--version')||!versionOK(version))throw Error('version must be YYYY.MM.DD.N with a valid date');
    for(const name of ['art','audio'])execFileSync(process.execPath,[`tools/${name}.mjs`,'verify'],{cwd:root,stdio:'pipe'});
    const art=read('art/export/manifest.json'),audio=read('audio/export/manifest.json');
    const snapshotCommit=/来源提交：([a-f0-9]{40})/.exec(fs.readFileSync(path.join(root,'SNAPSHOT.md'),'utf8'))?.[1];
    if(!snapshotCommit)throw Error('SNAPSHOT.md has no source commit');
    const snapshots=walk(root).filter(p=>matches(p,cfg.snapshots)||cfg.fixtures.files.includes(p)).sort().map(p=>({path:p,sha256:sha(fs.readFileSync(path.join(root,p)))}));
    const pack={format:'pushbox.art-pack/1',version,tag:'art-v'+version,source:cfg.source,built:new Date().toISOString(),files:inventory(),
      summary:{assets:art.assets.length,current_approved:art.assets.filter(a=>a.current_is_approved).length,latest_art_approval:read('art/approvals.json').records.at(-1)?.id||null,latest_audio_approval:read('audio/approvals.json').records.at(-1)?.id||null,audio_current_approved:audio.entries.filter(e=>e.current_is_approved).length,snapshot_commit:snapshotCommit},
      assets:art.assets,excludes:cfg.exclude,snapshots};
    fs.writeFileSync(path.join(root,'art-pack.json'),JSON.stringify(pack,null,1)+'\n');
    console.log(`pack build: ${pack.tag}; ${pack.files.length} files; ${pack.summary.current_approved}/${pack.summary.assets} current art approved`);
    console.log(`Next: node tools/pack.mjs check\ngit add -A\ngit commit -m "资源版本 ${pack.tag}"\ngit tag -a ${pack.tag} -m "资源版本 ${pack.tag}"`);
  } else if(cmd==='check') {
    const pack=read('art-pack.json');
    if(pack.format!=='pushbox.art-pack/1'||!versionOK(pack.version)||pack.tag!=='art-v'+pack.version||pack.source!==cfg.source)throw Error('invalid pack identity');
    if(JSON.stringify(inventory())!==JSON.stringify(pack.files))throw Error('resource files differ from art-pack.json');
    console.log(`pack check: ok; ${pack.tag}; ${pack.files.length} files`);
  } else throw Error('usage: node tools/pack.mjs build --version YYYY.MM.DD.N | check');
} catch(e) {console.error(e.message);process.exitCode=1;}
