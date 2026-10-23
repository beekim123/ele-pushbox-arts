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
 for(const s of source.screens.filter(s=>s.game==='not_yet'))assert.deepEqual(s.transitions.map(normalizeFuture),expectedFuture[s.id],s.id);assert.ok(source.screens.every(s=>!('owner'in s)));
});
test('primary menu text and measured click regions stay bound to the correct focus',()=>{
 const page=id=>source.screens.find(s=>s.id===id);
 const menus={lobby:[['继续',[16,87,126,15]],['选择章节',[16,108,105,15]],['设置',[16,128,105,15]],['退出',[16,148,105,14]]],pause:['继续','提示','重开','跳过此关','选关','设置','返回大厅'].map((label,i)=>[label,[103,48+15*i,115,15]]),complete:[['下一关',[93,79,62,17]],['选关',[165,79,63,17]]],hint:[['演示',[117,162,39,14]],['回到正确位置',[160,162,86,14]]]};
 for(const [id,items]of Object.entries(menus))for(const t of page(id).transitions.filter(t=>t.focus!==undefined)){assert.equal(t.label,items[t.focus][0]);assert.deepEqual(t.hotspot,items[t.focus][1]);}
 assert.deepEqual(page('lobby').variants,['ui.screen.hub_start','ui.screen.lobby_generic','ui.screen.lobby_story']);
 assert.equal(page('play').transitions.find(t=>t.label==='过关').key,undefined);assert.equal(page('play').transitions.find(t=>t.label==='过关').hotspot,undefined);
});


// Independent WB-13 transcription from the measured public primary PNGs.
// Only destination bindings justified by the cited design are active; uncertain
// buttons remain @stay. A selection card is not an invented extra menu button.
const normalizeFuture=t=>[t.key??null,t.focus??null,t.label,t.to,t.hotspot??null,t.when??null];
const expectedFuture={
 confirm:[['Enter',0,'放弃','@stay',[48,109,106,20],null],['Enter',1,'再想想','@stay',[166,109,106,20],null],['Esc',null,'返回','@stay',null,null]],
 crew_joined:[['Enter',null,'确认','@stay',null,null]],
 crew_pick:[['Enter',0,'派出','@stay',[19,55,86,66],null],['Enter',1,'派出','@stay',[117,55,86,66],null],['Enter',2,'派出','@stay',[215,55,86,66],null],['Esc',null,'返回','@stay',null,null]],
 crew_room:[['ArrowLeft',null,'选择','@stay',null,null],['ArrowRight',null,'选择','@stay',null,null],['Esc',null,'返回','@stay',null,null]],
 delivery_assist:[['ArrowUp',null,'选择','@stay',null,null],['ArrowDown',null,'选择','@stay',null,null],['ArrowLeft',null,'调整','@stay',null,null],['ArrowRight',null,'调整','@stay',null,null],['Esc',null,'返回','@stay',null,null]],
 delivery_help:[['Enter',null,'练习一下','delivery_practice',[125,132,99,17],'所选教学已开放'],['Esc',null,'返回','@stay',[230,132,65,17],null]],
 delivery_hud:[['Esc',null,'暂停','delivery_pause',null,null]],
 delivery_pause:[['Enter',0,'继续','delivery_hud',[81,58,158,17],null],['Enter',1,'重来这个房间','delivery_hud',[81,75,158,17],null],['Enter',2,'放弃这一单','confirm',[81,92,158,17],null],['Enter',3,'设置','settings',[81,109,158,17],null],['Enter',4,'返回大厅','lobby',[81,126,158,17],null],['Esc',null,'返回','@stay',null,null]],
 delivery_practice:[['R',null,'重置','@stay',null,null],['Tab',null,'教学列表','delivery_help',null,null],['Esc',null,'返回准备','@stay',null,null]],
 hint_animal:[],observe:[['Tab',null,'返回','@stay',null,null]],
 reels:[['ArrowLeft',null,'选择','@stay',null,null],['ArrowRight',null,'选择','@stay',null,null],['R',null,'重转','@stay',null,null],['Enter',null,'出发','delivery_hud',null,null]],
 run_door:[],run_door_skull:[['2',null,'重抽','@stay',null,null]],
 run_event:[['Enter',0,'喝','@stay',[134,82,82,18],null],['Enter',1,'不喝','@stay',[220,82,82,18],null]],
 run_lucky:[['Enter',null,'出发','@stay',null,null]],run_map:[],
 run_quit:[['Enter',0,'收工','@stay',[48,128,106,20],null],['Enter',1,'再想想','@stay',[166,128,106,20],null],['Esc',null,'返回','@stay',null,null]],
 run_rest:[['Enter',0,'恢复生命','@stay',[120,43,186,28],'样张中不可用'],['Enter',1,'修复货物','@stay',[120,73,186,28],null],['Enter',2,'领取补给','@stay',[120,103,186,28],null],['Enter',3,'收工','@stay',[220,140,94,18],null],['Q',3,'收工','@stay',[220,140,94,18],null],['Esc',null,'离开','@stay',null,null]],
 run_result:[['Enter',0,'再送一单','@stay',[68,158,88,18],null],['Enter',1,'回大厅','@stay',[164,158,88,18],null]],
 run_shelf:[['Enter',0,'购买','@stay',[14,41,42,46],null],['Enter',1,'购买','@stay',[60,41,42,46],null],['Enter',2,'购买','@stay',[116,41,42,46],null],['Enter',3,'购买','@stay',[162,41,42,46],null],['Enter',4,'购买','@stay',[208,41,42,46],null],['Enter',5,'购买','@stay',[264,41,42,46],null],['Enter',6,'换一批','@stay',[179,98,66,27],null],['R',6,'换一批','@stay',[179,98,66,27],null],['Enter',7,'恢复生命','@stay',[248,98,66,27],'样张中不可用'],['Enter',8,'修复货物','@stay',[179,129,66,27],null],['Enter',9,'收工','@stay',[248,129,66,27],null],['Q',9,'收工','@stay',[248,129,66,27],null],['Esc',null,'离开','@stay',null,null]],
 run_wish_card:[['ArrowLeft',null,'选择','@stay',null,null],['ArrowRight',null,'选择','@stay',null,null],['R',null,'重转','@stay',null,null],['Enter',null,'出发','@stay',null,null]],
 run_wish_give:[['Enter',null,'下一页','@stay',null,null]],
 settlement:[['Enter',0,'再送一单','@stay',[68,158,88,18],null],['Enter',1,'回大厅','lobby',[164,158,88,18],null]],
 settlement_fail:[['Enter',0,'再送一单','@stay',[68,151,88,18],null],['Enter',1,'回大厅','@stay',[164,151,88,18],null]],
 shop:[['Enter',0,'购买','@stay',[97,32,212,20],null],['Enter',1,'购买','@stay',[97,53,212,20],null],['Enter',2,'购买','@stay',[97,74,212,20],'样张中不可用'],['Enter',3,'购买','@stay',[97,95,212,20],'样张中不可用'],['Esc',null,'离开','@stay',null,null]],
 story_board:[['ArrowLeft',null,'选择','@stay',null,null],['ArrowRight',null,'选择','@stay',null,null],['Enter',0,'打开','@stay',[11,28,70,124],null],['Enter',1,'打开','@stay',[87,28,70,124],null],['Enter',2,'打开','@stay',[163,28,70,124],'样张中未开放'],['Enter',3,'打开','@stay',[239,28,70,124],'样张中未开放'],['Esc',null,'返回','@stay',null,null]],
 story_chapter:[['ArrowUp',null,'选择','@stay',null,null],['ArrowDown',null,'选择','@stay',null,null],['Enter',0,'打开','@stay',[18,77,284,18],null],['Enter',1,'打开','@stay',[18,97,284,18],null],['Enter',2,'打开','@stay',[18,117,284,18],'样张中未开放'],['Enter',3,'打开','@stay',[18,137,284,18],'样张中未开放'],['Esc',null,'返回','@stay',null,null]],
 story_complete:[['Enter',null,'确认','@stay',null,null]],story_letter:[['Enter',null,'收进邮局','@stay',null,null]],
 story_order:[['Enter',0,'出发','@stay',[80,135,76,18],null],['Enter',1,'返回','@stay',[164,135,76,18],null]],
};
const expectedPending={confirm:['P02','P03'],crew_joined:['P23'],crew_pick:['P23'],crew_room:['P23'],delivery_assist:['P20'],delivery_help:['P21'],delivery_hud:['P04','P05','P06'],delivery_pause:['P26'],delivery_practice:['P25'],hint_animal:['P15'],observe:['P14'],reels:['P25'],run_door:['P16'],run_door_skull:['P16'],run_event:['P17'],run_lucky:['P18'],run_map:['P13'],run_quit:['P09'],run_rest:['P08'],run_result:['P10'],run_shelf:['P06','P07'],run_wish_card:['P18'],run_wish_give:['P19'],settlement:['P12'],settlement_fail:['P11'],shop:['P06','P07'],story_board:['P22'],story_chapter:['P22'],story_complete:['P22'],story_letter:['P22'],story_order:['P22']};
test('WB-13 independent primary action and pending tables cover all 31 future pages',()=>{
 const future=source.screens.filter(s=>s.game==='not_yet');
 assert.deepEqual(future.map(s=>s.id).sort(),Object.keys(expectedFuture).sort());
 assert.equal(future.length,31);
 for(const s of future){
  assert.deepEqual(s.transitions.map(normalizeFuture),expectedFuture[s.id],s.id);
  assert.match(s.notes,/待定 P24/,'game usage remains explicitly unconfirmed: '+s.id);
  for(const id of expectedPending[s.id])assert.ok((s.notes+' '+s.transitions.map(t=>t.notes||'').join(' ')).includes('待定 '+id),s.id+' missing '+id);
  for(const t of s.transitions){assert.ok(t.sources?.length,s.id+' source missing');for(const c of t.sources){assert.equal(typeof c.file,'string');assert.equal(typeof c.section,'string');}if(t.to==='@stay'&&!['选择','调整','重转','重置'].includes(t.label))assert.match(t.notes||'',/待定 P\d+/);}
 }
 assert.equal(source.screens.find(s=>s.id==='delivery_hud').transitions.some(t=>t.key==='C'),false,'C completion belongs only to the preview simulator');
});
const expectedKnownSources=[
 ['reels','出发','delivery_hud','docs/design/delivery-slice.md','2 一局的流程'],
 ['reels','重转','@stay','docs/design/mode-delivery.md','3.2 玩家能做什么'],
 ['delivery_help','练习一下','delivery_practice','docs/design/delivery-run.md','3.7 首次教学与教学回顾'],
 ['delivery_practice','教学列表','delivery_help','docs/design/delivery-run.md','3.7 首次教学与教学回顾'],
 ['delivery_practice','重置','@stay','docs/design/delivery-run.md','3.7 首次教学与教学回顾'],
 ['delivery_hud','暂停','delivery_pause','docs/design/delivery-slice.md','11 HUD 与操作'],
 ['delivery_pause','继续','delivery_hud','docs/design/delivery-slice.md','2 一局的流程'],
 ['delivery_pause','重来这个房间','delivery_hud','docs/design/delivery-slice.md','2 一局的流程'],
 ['delivery_pause','放弃这一单','confirm','docs/design/mode-delivery.md','4 时间与操作'],
 ['delivery_pause','设置','settings','docs/design/delivery-slice.md','2 一局的流程'],
 ['delivery_pause','返回大厅','lobby','docs/design/delivery-slice.md','2 一局的流程'],
 ['settlement','回大厅','lobby','docs/design/delivery-slice.md','2 一局的流程'],
];
test('WB-13 confirmed destinations retain their independent design citations',()=>{
 for(const [id,label,to,file,section]of expectedKnownSources){const t=source.screens.find(s=>s.id===id).transitions.find(t=>t.label===label);assert.equal(t?.to,to,id+' '+label);assert.ok(t.sources.some(c=>c.file===file&&c.section===section),id+' '+label+' citation');}
});
const expectedVariants={
 'ui.screen.hub_start':[['Enter',0,'开始游戏','@stay',[20,86,120,13],null],['Enter',1,'选择章节','chapters',[12,107,110,13],null],['Enter',2,'设置','settings',[12,126,110,13],null],['Enter',3,'退出','@quit',[12,145,110,13],null]],
 'ui.screen.lobby_generic':[['Enter',0,'关卡模式','@stay',[22,72,104,18],null],['Enter',1,'配送','@stay',[22,94,104,18],null],['Enter',2,'设置','settings',[22,116,104,18],null],['Enter',3,'退出','@quit',[22,138,104,18],null]],
 'ui.screen.lobby_story':[['Enter',0,'关卡模式','@stay',[22,65,104,18],null],['Enter',1,'配送','@stay',[22,84,104,18],null],['Enter',2,'剧情','@stay',[22,103,104,18],null],['Enter',3,'设置','settings',[22,122,104,18],null],['Enter',4,'退出','@quit',[22,141,104,18],null]],
};
test('WB-13 lobby variants use their own measured menus without changing primary lab behavior',()=>{
 const lobby=source.screens.find(s=>s.id==='lobby');assert.deepEqual(Object.keys(lobby.variantTransitions).sort(),Object.keys(expectedVariants).sort());
 for(const [art,expected]of Object.entries(expectedVariants)){assert.deepEqual(lobby.variantTransitions[art].map(normalizeFuture),expected,art);for(const t of lobby.variantTransitions[art]){assert.ok(t.sources?.length);if(t.to==='@stay')assert.match(t.notes,/待定 P01/);}}
});
for(const key of ['Tab','Q','2'])test('WB-13 validates measured extra key '+key,()=>{const f=fixture();try{f.screens.screens[0].transitions=[{key,label:'公开按键',to:'@stay'}];f.save();assert.equal(f.run('check').status,0);}finally{f.clean();}});
for(const [name,mutate,message]of [
 ['variant menu unknown destination',f=>f.screens.screens[0].variantTransitions['ui.screen.alt'][0].to='missing',/destination/],
 ['variant menu unknown key',f=>f.screens.screens[0].variantTransitions['ui.screen.alt'][0].key='Space',/invalid key/],
 ['variant menu missing hotspot',f=>delete f.screens.screens[0].variantTransitions['ui.screen.alt'][0].hotspot,/hotspot/],
 ['variant menu out of bounds',f=>f.screens.screens[0].variantTransitions['ui.screen.alt'][0].hotspot=[319,0,2,5],/hotspot/],
 ['variant menu negative focus',f=>f.screens.screens[0].variantTransitions['ui.screen.alt'][0].focus=-1,/focus/],
 ['variant menu art not listed',f=>f.screens.screens[0].variantTransitions['ui.screen.lobby']=[],/variant/],
 ['variant menu not an array',f=>f.screens.screens[0].variantTransitions['ui.screen.alt']={},/variant/],
 ['variant menu invalid mode',f=>f.screens.screens[0].variantTransitions['ui.screen.alt'][0].mode='story',/mode/],
 ['variant menu mismatched target art',f=>f.screens.screens[0].variantTransitions['ui.screen.alt'][0].art='ui.screen.lobby',/target art/],
])test('WB-13 rejects '+name+' through full transition validation',()=>{const f=fixture();try{f.screens.screens[0].variantTransitions={'ui.screen.alt':[{key:'Enter',focus:0,label:'继续',to:'lobby',art:'ui.screen.alt',mode:'delivery',hotspot:[1,2,30,10]}]};mutate(f);f.save();const out=f.run('check');assert.notEqual(out.status,0);assert.match(out.stderr,message);}finally{f.clean();}});
test('WB-13 build preserves valid variant routing metadata',()=>{const f=fixture();try{f.screens.screens[0].variantTransitions={'ui.screen.alt':[{key:'Enter',focus:0,label:'继续',to:'lobby',art:'ui.screen.alt',mode:'delivery',hotspot:[1,2,30,10]}]};f.save();const out=f.run('build');assert.equal(out.status,0,out.stderr);const data=JSON.parse(fs.readFileSync(path.join(f.dir,'workbench/data/screens.js'),'utf8').slice('window.PB_SCREENS = '.length).trim().replace(/;$/,''));assert.deepEqual(data.screens[0].variantTransitions,f.screens.screens[0].variantTransitions);}finally{f.clean();}});
