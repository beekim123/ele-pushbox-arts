#!/usr/bin/env node
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildGodotPack} from './lib/godot-pack.mjs';
const argv=process.argv.slice(2),get=name=>{const at=argv.indexOf('--'+name);return at<0?undefined:argv[at+1];};
try {
  if(argv[0]!=='build'||!get('source-commit')||!get('version'))throw Error('usage: node tools/pack-godot.mjs build --source-commit <full committed SHA> --version <SemVer> [--out <directory>]');
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  console.log(JSON.stringify(buildGodotPack({root,sourceCommit:get('source-commit'),packageVersion:get('version'),outDir:path.resolve(get('out')||path.join(root,'dist'))}),null,2));
} catch(error){console.error(error.message);process.exitCode=1;}
