#!/usr/bin/env node
// Bundle public design documents for both file:// and HTTP workbench use.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Markdown from '../workbench/js/app/markdown.js';

export const GROUPS={'':'美术与界面',gameplay:'玩法设计'};
const BUNDLE='workbench/data/docs.js';
const compare=(a,b)=>a<b?-1:a>b?1:0;
export function collect(root){
 const docs=[],directory=path.join(root,'docs/design');
 function scan(dir){
  if(!fs.existsSync(dir))return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>compare(a.name,b.name))){
   const file=path.join(dir,entry.name);
   if(entry.isDirectory())scan(file);
   else if(entry.isFile()&&/\.md$/i.test(entry.name)){
    const relative=path.relative(root,file).split(path.sep).join('/'),text=fs.readFileSync(file,'utf8'),sub=relative.slice('docs/design/'.length).split('/'),key=sub.length>1?sub[0]:'';
    const title=Markdown.render(text,{path:relative}).headings.find(item=>item.level===1)?.text||entry.name.replace(/\.md$/i,'');
    docs.push({path:relative,group:GROUPS[key]||key,title,text});
   }
  }
 }
 scan(directory);
 const groupRank=group=>group===GROUPS['']?0:group===GROUPS.gameplay?1:2;
 docs.sort((a,b)=>groupRank(a.group)-groupRank(b.group)||compare(a.group,b.group)||compare(a.path,b.path));
 return {docs};
}
export function bundle(data){
 return 'window.PB_DOCS = '+JSON.stringify(data,null,2).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+';\n';
}
export function build(root){
 const data=collect(root),file=path.join(root,BUNDLE),text=bundle(data),changed=!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==text;
 if(changed){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
 return {data,changed};
}
export function check(root){
 const data=collect(root),errors=[],warnings=[],file=path.join(root,BUNDLE),repo=fs.realpathSync(root);
 if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==bundle(data))errors.push('stale or missing docs bundle; run node tools/docs.mjs build');
 for(const doc of data.docs)for(const link of Markdown.links(doc.text)){
  const target=Markdown.resolve(link.target,doc.path),message=doc.path+' → '+link.target;
  if(target.kind==='outside'){warnings.push('repository-external link: '+message);continue;}
  if(target.kind!=='local')continue;
  const resolved=path.join(root,target.path);
  if(!fs.existsSync(resolved)){errors.push('missing local '+(link.image?'image':'link')+': '+message);continue;}
  const actual=fs.realpathSync(resolved),relative=path.relative(repo,actual);
  if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))warnings.push('repository-external link: '+message);
 }
 return {data,errors,warnings};
}
function main(){
 const [command,...args]=process.argv.slice(2),at=args.indexOf('--root');
 if(!['build','check'].includes(command)||args.length!==(at<0?0:2)||at>0||(at===0&&!args[1]))throw Error('Usage: node tools/docs.mjs build|check [--root fixture-directory]');
 const root=at<0?path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'):path.resolve(args[1]);
 if(command==='build'){const result=build(root);console.log('docs build: '+(result.changed?'wrote '+BUNDLE:'unchanged')+'; '+result.data.docs.length+' documents');return;}
 const result=check(root);for(const warning of result.warnings)console.warn('warning: '+warning);
 if(result.errors.length)throw Error(result.errors.join('\n'));
 console.log('docs check: '+result.data.docs.length+' documents; '+result.warnings.length+' warnings');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))try{main();}catch(error){console.error(error.message);process.exitCode=1;}
