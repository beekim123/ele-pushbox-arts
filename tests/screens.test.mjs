import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const TOOL=path.join(ROOT,'tools/screens.mjs');
function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pb-screens-'));
 const write=(name,data)=>{const f=path.join(dir,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(data));};
 const screens={format:'pushbox.screens/1',screens:[{id:'lobby',art:'ui.screen.lobby',variants:['ui.screen.alt'],name:'大厅',flow:'开始',game:'in_use',notes:'公开示例',transitions:[{key:'Enter',focus:0,label:'继续',to:'@stay',hotspot:[0,0,320,180]}]}],unlisted:[]};
 const manifest={assets:[{id:'ui.screen.lobby',current:{status:'approved',version:2}},{id:'ui.screen.alt',current:{status:'review',version:1}}]};
 const coverage={entries:[{uid:'art:ui.screen.lobby',native:'implemented',evidence:['U']},{uid:'art:ui.screen.alt',native:'reference_only',evidence:['R-U']}]};
 const save=()=>{write('content/screens/screens.json',screens);write('art/export/manifest.json',manifest);write('godot/native-coverage.json',coverage);};save();
 return {dir,screens,manifest,coverage,save,run:cmd=>spawnSync(process.execPath,[TOOL,cmd,'--root',dir],{encoding:'utf8'}),clean:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
test('build derives progress from manifest and coverage and never rewrites identical output',()=>{const f=fixture();try{const out=f.run('build');assert.equal(out.status,0,out.stderr);const file=path.join(f.dir,'workbench/data/screens.js'),first=fs.readFileSync(file,'utf8'),stat=fs.statSync(file);const data=JSON.parse(first.slice('window.PB_SCREENS = '.length).trim().replace(/;$/,''));assert.equal(data.screens[0].steps.approved,true);assert.equal(data.screens[0].steps.godot,'implemented');assert.equal(data.screens[0].variantsProgress[0].steps.approved,false);assert.equal(data.screens[0].variantsProgress[0].steps.godot,'reference_only');assert.equal(f.run('build').status,0);assert.equal(fs.statSync(file).mtimeMs,stat.mtimeMs);}finally{f.clean();}});
for(const [name,mutate,message]of [
 ['missing art',f=>f.screens.screens[0].art='ui.screen.missing',/missing art/],
 ['missing variant',f=>f.screens.screens[0].variants=['ui.screen.missing'],/missing art/],
 ['unknown destination',f=>f.screens.screens[0].transitions[0].to='missing',/destination/],
 ['out of bounds',f=>f.screens.screens[0].transitions[0].hotspot=[319,0,2,5],/hotspot/],
 ['missing menu hotspot',f=>delete f.screens.screens[0].transitions[0].hotspot,/hotspot/],
 ['uncovered screen',f=>f.manifest.assets.push({id:'ui.screen.uncovered'}),/uncovered/],
 ['unsupported key',f=>f.screens.screens[0].transitions[0].key='Space',/invalid key/],
 ['owner belongs to ART-07',f=>f.screens.screens[0].owner='lab',/owner/],
])test('check rejects '+name+' in temporary fixtures',()=>{const f=fixture();try{mutate(f);f.save();const out=f.run('check');assert.notEqual(out.status,0);assert.match(out.stderr,message);}finally{f.clean();}});
test('automatic completion is the only transition allowed without a key',()=>{const f=fixture();try{f.screens.screens.push({id:'complete',art:null,variants:[],name:'过关',flow:'关卡内',game:'not_yet',notes:'公开示例',transitions:[]});f.screens.screens[0].transitions=[{label:'过关',when:'关卡完成',to:'complete'}];f.save();assert.equal(f.run('check').status,0);f.screens.screens[0].transitions[0].label='继续';f.save();assert.notEqual(f.run('check').status,0);}finally{f.clean();}});

test('keyboard-only actions do not invent button hotspots',()=>{const f=fixture();try{f.screens.screens[0].transitions=[{key:'H',label:'下一级提示',when:'第 1–2 级',to:'@stay'}];f.save();assert.equal(f.run('check').status,0);}finally{f.clean();}});

// Independent transcription of every WB-11 lab table operation and condition.
// Menu text/rectangles are checked separately against the public primary artwork.
const expectedLab={
 lobby:[['Enter',0,'play','有上次关卡'],['Enter',0,'chapters','没有上次关卡'],['Enter',1,'chapters'],['Enter',2,'settings'],['Enter',3,'@quit']],
 chapters:[['ArrowLeft',null,'@stay'],['ArrowRight',null,'@stay'],['Enter',null,'levels','章节已开放'],['Esc',null,'lobby']],
 levels:[['ArrowUp',null,'@stay'],['ArrowDown',null,'@stay'],['Enter',null,'rulecard','有没看过的规则'],['Enter',null,'play','没有没看过的规则'],['Esc',null,'chapters']],
 play:[['Esc',null,'pause'],['H',null,'hint','第 1 级'],['Z',null,'@stay'],['R',null,'@stay'],[null,null,'complete','关卡完成']],
 pause:[['Enter',0,'play'],['Enter',1,'hint'],['Enter',2,'play'],['Enter',3,'levels'],['Enter',4,'levels'],['Enter',5,'settings'],['Enter',6,'lobby'],['Esc',null,'play']],
 hint:[['H',null,'@stay','第 1–2 级'],['Enter',null,'@stay','第 1–2 级'],['H',0,'play','第 3 级'],['H',1,'play','第 3 级'],['Enter',0,'play','第 3 级'],['Enter',1,'play','第 3 级'],['Esc',null,'play']],
 rulecard:[['Enter',null,'rulecard','还有规则卡'],['Enter',null,'play','没有更多规则卡'],['Esc',null,'rulecard','还有规则卡'],['Esc',null,'play','没有更多规则卡']],
 complete:[['Enter',0,'play','有下一关'],['Enter',0,'levels','没有下一关'],['Enter',1,'levels'],['Esc',null,'levels']],
 settings:[['ArrowUp',null,'@stay'],['ArrowDown',null,'@stay'],['ArrowLeft',null,'@stay'],['ArrowRight',null,'@stay'],['Esc',null,'@return']],
 controls:[['Esc',null,'lobby']],dialogue:[['Esc',null,'lobby']],
};
const source=JSON.parse(fs.readFileSync(path.join(ROOT,'content/screens/screens.json'),'utf8'));
const normalize=t=>[t.key??null,t.focus??null,t.to,t.when??null];
for(const [id,expected]of Object.entries(expectedLab))test('public lab behavior table: '+id,()=>{
 const screen=source.screens.find(s=>s.id===id);assert.equal(screen.game,'in_use');
 assert.deepEqual(screen.transitions.map(normalize),expected.map(([key,focus,to,when])=>[key,focus,to,when??null]));
});
test('42 logical pages reference all 49 public art screens, while future pages have no invented transitions',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'art/export/manifest.json'),'utf8'));
 const actual=source.screens.flatMap(s=>[s.art,...s.variants]).filter(Boolean).sort();
 assert.deepEqual(actual,manifest.assets.filter(a=>a.id.startsWith('ui.screen.')).map(a=>a.id).sort());assert.equal(actual.length,49);
 assert.equal(source.screens.length,42);assert.equal(source.screens.filter(s=>s.game==='in_use').length,11);
 for(const s of source.screens.filter(s=>s.game==='not_yet'))assert.deepEqual(s.transitions,[],s.id);assert.ok(source.screens.every(s=>!('owner'in s)));
});
test('primary menu text and measured click regions stay bound to the correct focus',()=>{
 const page=id=>source.screens.find(s=>s.id===id);
 const menus={lobby:[['继续',[16,87,126,15]],['选择章节',[16,108,105,15]],['设置',[16,128,105,15]],['退出',[16,148,105,14]]],pause:['继续','提示','重开','跳过此关','选关','设置','返回大厅'].map((label,i)=>[label,[103,48+15*i,115,15]]),complete:[['下一关',[93,79,62,17]],['选关',[165,79,63,17]]],hint:[['演示',[117,162,39,14]],['回到正确位置',[160,162,86,14]]]};
 for(const [id,items]of Object.entries(menus))for(const t of page(id).transitions.filter(t=>t.focus!==undefined)){assert.equal(t.label,items[t.focus][0]);assert.deepEqual(t.hotspot,items[t.focus][1]);}
 assert.deepEqual(page('lobby').variants,['ui.screen.hub_start','ui.screen.lobby_generic','ui.screen.lobby_story']);
 assert.equal(page('play').transitions.find(t=>t.label==='过关').key,undefined);assert.equal(page('play').transitions.find(t=>t.label==='过关').hotspot,undefined);
});
