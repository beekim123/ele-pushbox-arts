// Minimal T7 headless harness; consumes an actual ZIP rather than source copies.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readStoreZip,parseJson,sha256,payloadDigest,validateFiles} from '../../tools/lib/godot-pack.mjs';
const args=process.argv.slice(2),value=name=>args[args.indexOf('--'+name)+1];
const archive=value('archive'),godot=value('godot');
if(!args.includes('--archive')||!args.includes('--godot'))throw Error('usage: node tests/native/run-catalog.mjs --archive <fixed.zip> --godot <4.7.2 executable>');
const files=readStoreZip(fs.readFileSync(archive)),manifestBytes=files.get('addons/portitor_art/manifest.json'),manifest=parseJson(manifestBytes);
validateFiles(manifest.files);
if(files.size!==manifest.files.length+1||payloadDigest(manifest.files)!==manifest.identity.runtime_payload_sha256)throw Error('archive set/payload mismatch');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'portitor-catalog-'));
try{
  for(const item of manifest.files){const bytes=files.get(item.path);if(!bytes||bytes.length!==item.bytes||sha256(bytes)!==item.sha256)throw Error('archive bytes mismatch');}
  for(const [name,bytes]of files){const target=path.join(root,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});}
  fs.copyFileSync(new URL('./catalog_test.gd',import.meta.url),path.join(root,'catalog_test.gd'));
  fs.writeFileSync(path.join(root,'project.godot'),'config_version=5\n[application]\nconfig/name="Native Catalog Checks"\n[display]\nwindow/size/viewport_width=320\nwindow/size/viewport_height=180\nwindow/stretch/mode="canvas_items"\nwindow/stretch/scale_mode="integer"\n[rendering]\nrenderer/rendering_method="gl_compatibility"\ntextures/canvas_textures/default_texture_filter=0\n[threading]\nworker_pool/max_threads=1\n');
  const result=spawnSync(godot,['--headless','--path',root,'--script','res://catalog_test.gd'],{env:{...process.env,OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',MKL_NUM_THREADS:'1',VECLIB_MAXIMUM_THREADS:'1',UV_THREADPOOL_SIZE:'1',PORTITOR_MANIFEST_SHA256:sha256(manifestBytes)},encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
  process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
  if(result.error)throw result.error;
  if(result.status!==0||!result.stdout.includes('"completed":true')||/SCRIPT ERROR|Parse Error|ERROR:/.test(result.stderr))process.exitCode=1;
}finally{fs.rmSync(root,{recursive:true,force:true});}
