#!/usr/bin/env node
// Public screen inventory only: no art generation, approval, or game data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const keys=new Set(['Enter','Esc','H','Z','R','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab','Q','2']);
const flows=new Set(['开始','关卡内','配送一局','剧情','伙计','设置与帮助']);
export function validate(source,manifest){
 const errors=[], screens=source.screens||[], ids=new Set(), assets=new Set((manifest.assets||[]).map(a=>a.id)), covered=new Set();
 if(source.format!=='pushbox.screens/1'||!Array.isArray(source.screens)||!Array.isArray(source.unlisted))errors.push('invalid screens format');
 for(const s of screens){
  if(typeof s.id!=='string'||!s.id||ids.has(s.id))errors.push('invalid or duplicate screen id: '+s.id);ids.add(s.id);
 }
 const reference=(id,from)=>{if(typeof id!=='string'||!assets.has(id))errors.push('missing art: '+id+' ('+from+')');else covered.add(id);};
 for(const s of screens){
  if('owner'in s)errors.push('owner must remain in ART-07 ownership metadata: '+s.id);
  if(!s.name||!flows.has(s.flow)||!['in_use','not_yet'].includes(s.game)||typeof s.notes!=='string')errors.push('invalid page fields: '+s.id);
  if(s.art!==null)reference(s.art,s.id);
  if(!Array.isArray(s.variants))errors.push('invalid variants: '+s.id);else for(const id of s.variants)reference(id,s.id);
  if(!Array.isArray(s.transitions)){errors.push('invalid transitions: '+s.id);continue;}
  let transitions=s.transitions;
  if(s.variantTransitions!==undefined){
   if(!s.variantTransitions||typeof s.variantTransitions!=='object'||Array.isArray(s.variantTransitions))errors.push('invalid variant transitions: '+s.id);
   else for(const [art,items]of Object.entries(s.variantTransitions)){
    if(!s.variants?.includes(art)||!Array.isArray(items))errors.push('invalid variant transitions: '+s.id+' / '+art);
    else transitions=transitions.concat(items);
   }
  }
  for(const t of transitions){
   if(t.mode!==undefined&&!['lab','delivery'].includes(t.mode))errors.push('invalid mode: '+s.id);
   if(t.art!==undefined&&!screens.find(p=>p.id===t.to)?.variants?.includes(t.art))errors.push('invalid target art: '+s.id+' → '+t.art);
   const automatic=t.key===undefined&&t.label==='过关'&&t.when==='关卡完成'&&t.to==='complete';
   if(!keys.has(t.key)&&!automatic)errors.push('invalid key: '+s.id);
   if(!t.label||(!ids.has(t.to)&&!['@return','@quit','@stay'].includes(t.to)))errors.push('invalid destination or label: '+s.id+' → '+t.to);
   if(t.focus!==undefined&&(!Number.isInteger(t.focus)||t.focus<0))errors.push('invalid focus: '+s.id);
   const h=t.hotspot;
   if((t.focus!==undefined||h!==undefined)&&(!Array.isArray(h)||h.length!==4||!h.every(Number.isFinite)||h[0]<0||h[1]<0||h[2]<=0||h[3]<=0||h[0]+h[2]>320||h[1]+h[3]>180))errors.push('invalid hotspot: '+s.id);
  }
 }
 for(const u of source.unlisted||[]){if(!u.reason)errors.push('unlisted needs reason: '+u.art);reference(u.art,'unlisted');}
 for(const id of assets)if(id.startsWith('ui.screen.')&&!covered.has(id))errors.push('uncovered screen: '+id);
 return errors;
}
export function build(source,manifest,coverage){
 const assets=new Map(manifest.assets.map(a=>[a.id,a])),native=new Map(coverage.entries.map(e=>[e.uid.replace(/^art:/,''),e]));
 const progress=id=>({html:assets.has(id),approved:assets.get(id)?.current?.status==='approved',godot:native.get(id)?.native||'missing'});
 const screens=source.screens.map(s=>({...s,steps:{design:true,...progress(s.art),game:s.game==='in_use'},coverage:native.get(s.art)||null,variantsProgress:s.variants.map(art=>({art,steps:progress(art),coverage:native.get(art)||null}))}));
 const totals={pages:screens.length,design:screens.length,html:0,approved:0,implemented:0,reference_only:0,missing:0,in_use:0,not_yet:0};
 for(const s of screens){if(s.steps.html)totals.html++;if(s.steps.approved)totals.approved++;totals[s.steps.godot]++;totals[s.game]++;}
 return {format:source.format,screens,unlisted:source.unlisted,totals};
}
function main(){
 const [command,...args]=process.argv.slice(2),at=args.indexOf('--root'),root=at<0?path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'):path.resolve(args[at+1]);
 if(!['check','build'].includes(command))throw Error('Usage: node tools/screens.mjs build|check [--root fixture-directory]');
 const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
 const source=read('content/screens/screens.json'),manifest=read('art/export/manifest.json'),coverage=read('godot/native-coverage.json');
 const errors=validate(source,manifest);if(errors.length)throw Error(errors.join('\n'));
 const data=build(source,manifest,coverage);
 if(command==='build'){
  const file=path.join(root,'workbench/data/screens.js'),text='window.PB_SCREENS = '+JSON.stringify(data,null,2)+';\n';
  if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);console.log('screens build: wrote workbench/data/screens.js');}else console.log('screens build: unchanged');
 }
 console.log('screens '+command+': '+JSON.stringify(data.totals));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main();}catch(e){console.error(e.message);process.exitCode=1;}}
