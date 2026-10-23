// WB-12: real standalone input, exact live-workbench RGBA parity, URLs and lifecycle.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const ROOT=path.resolve(__dirname,'..'),inventory=JSON.parse(fs.readFileSync(path.join(ROOT,'content/screens/screens.json'))).screens;
let browser,server;
(async()=>{
 assert.ok(fs.existsSync(path.join(ROOT,'workbench/play.html')),'standalone preview page exists');
 const scripts=file=>[...fs.readFileSync(file,'utf8').matchAll(/<script src="((?:data|js\/core)\/[^\"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(scripts(path.join(ROOT,'workbench/play.html')),scripts(path.join(ROOT,'workbench/index.html')),'identical core/data scripts and ordering');
 let base=require('url').pathToFileURL(path.join(ROOT,'workbench/play.html')).href;
 if(process.env.WB_HTTP==='1'){
  server=require('http').createServer((req,res)=>{const rel=decodeURIComponent(req.url.split(/[?#]/)[0]),file=path.resolve(ROOT,'.'+rel);if(rel==='/favicon.ico'){res.writeHead(204);res.end();return;}if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port+'/workbench/play.html';
 }
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--renderer-process-limit=1','--num-raster-threads=1']});
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let caseNumber=0;
 async function open(id,focus=0,tier=1,art){await page.goto(base+'?case='+(++caseNumber)+'#'+id+'?focus='+focus+(id==='hint'?'&tier='+tier:'')+(art?'&art='+encodeURIComponent(art):''));await page.waitForFunction(id=>document.body.dataset.page===id,id);}
 const state=()=>page.evaluate(()=>({id:document.body.dataset.page,focus:Number(document.body.dataset.focus),tier:Number(document.body.dataset.tier)}));
 async function lifecycle(){
  await open('levels',2);const result=await page.evaluate(async()=>{const old=PBPlay.stage();window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));const stopped=old.tick();await new Promise(r=>setTimeout(r,220));const oldStopped=old.tick()===stopped;window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));const next=PBPlay.stage(),start=next.tick();await new Promise(r=>setTimeout(r,400));return{oldStopped,recreated:old!==next,playing:next.playing(),advanced:next.tick()>start,id:document.body.dataset.page,focus:document.body.dataset.focus,canvases:document.querySelectorAll('#play-stage canvas').length};});
  assert.deepEqual(result,{oldStopped:true,recreated:true,playing:true,advanced:true,id:'levels',focus:'2',canvases:1},'BFCache restores one live stage and preserves route/focus');
 }
 if(process.env.WB_PLAY_LIFECYCLE_ONLY==='1'){await lifecycle();console.log('WB-12 BFCache lifecycle passed');return;}
 async function model(){
  await open('play');const result=await page.evaluate(()=>{const stage=PBPlay.stage(),calls=[],render=PB.scene.renderLevel;stage.setPlaying(false);PB.scene.renderLevel=function(r,spec,...args){calls.push(spec.id);return render.call(this,r,spec,...args);};try{stage.setTick(31);}finally{PB.scene.renderLevel=render;}return{last:calls[calls.length-1],calls};});assert.equal(result.last,'M05','last actual scene rendered under play HUD is M05: '+JSON.stringify(result.calls));
 }
 if(process.env.WB_PLAY_MODEL_ONLY==='1'){await model();console.log('WB-12 M05 HUD model passed');return;}


 async function condition(when){if(!when||when.startsWith('第 ')||when==='关卡完成')return;await page.keyboard.press('i');await page.getByLabel(when,{exact:true}).check();await page.getByLabel(when,{exact:true}).focus();await page.keyboard.press('i');assert.equal(await page.locator('#play-info').isVisible(),false,'I closes from checkbox');}
 let keyboard=0,mouse=0;
 for(const s of inventory.filter(s=>s.game==='in_use'))for(const t of s.transitions){
  const tier=t.when==='第 3 级'?3:1,focus=t.focus||0;
  for(const mode of ['keyboard',...(t.hotspot?['mouse']:[])]){
   await open(s.id,focus,tier);await condition(t.when);const limit=await page.evaluate(()=>{const s=PB_SCREENS.screens.find(s=>s.id===document.body.dataset.page),p=PBStore.asset(s.art).params;return s.id==='hint'?(Number(document.body.dataset.tier)===3?2:1):s.id==='complete'?2:s.id==='settings'?p.items.filter(x=>x.key!=='settings.ui_style').length:Math.max(1,(p.chapters||p.levels||p.items||[]).length);});
   if(mode==='keyboard')await page.keyboard.press(t.key==='Esc'?'Escape':t.key||'c');
   else {const box=await page.locator('#play-stage canvas').boundingBox(),[x,y,w,h]=t.hotspot;await page.mouse.move(box.x+(x+w/2)*box.width/320,box.y+(y+h/2)*box.height/180);if(t.focus!==undefined)assert.equal((await state()).focus,t.focus,'hover focus '+s.id);await page.mouse.click(box.x+(x+w/2)*box.width/320,box.y+(y+h/2)*box.height/180);}
   const expected=t.to==='@stay'?s.id:t.to==='@return'?'lobby':t.to==='@quit'?'@quit':t.to;
   await page.waitForFunction(id=>document.body.dataset.page===id,expected,{timeout:3000}).catch(async e=>{throw new Error(s.id+' '+mode+' '+t.key+' '+t.label+' when '+t.when+' expected '+expected+' got '+JSON.stringify(await state())+' errors '+errors+' '+e.message);});const got=await state();assert.equal(got.id,expected,s.id+' '+mode+' '+t.label);let expectedFocus=t.to==='@stay'||t.to===s.id?focus:0;if(t.to==='@stay'&&t.key?.startsWith('Arrow')&&!(s.id==='settings'&&['ArrowLeft','ArrowRight'].includes(t.key)))expectedFocus=(focus+(t.key==='ArrowUp'||t.key==='ArrowLeft'?-1:1)+limit)%limit;assert.equal(got.focus,expectedFocus,s.id+' '+mode+' '+t.label+' focus');
   if(t.to==='@stay'&&s.id==='hint')assert.equal(got.tier,2,'hint advances exactly one tier');
   if(t.to==='@stay'&&(['ArrowUp','ArrowDown'].includes(t.key)||s.id==='chapters'))assert.notEqual(got.focus,focus,s.id+' directional focus changes');
   mode==='keyboard'?keyboard++:mouse++;
  }
 }
 await open('lobby');assert.equal(await page.locator('#play-info').isVisible(),false,'overlay starts hidden');
 await page.keyboard.press('i');assert.equal(await page.locator('#play-info').isVisible(),true);assert.equal(await page.locator('[data-step]').count(),5);assert.equal(await page.getByRole('option',{name:'配送（WB-13）'}).evaluate(e=>e.disabled),true);assert.ok((await page.getByRole('link',{name:'在工作台打开'}).getAttribute('href')).endsWith('#screen/lobby'));await page.keyboard.press('i');
 await page.keyboard.press('s');assert.equal((await state()).focus,1,'WASD focus');await page.keyboard.press('Space');assert.equal((await state()).id,'chapters','Space confirms');
 await page.keyboard.press('Escape');await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.equal((await state()).id,'settings');await page.keyboard.press('Escape');assert.equal((await state()).id,'lobby','return source ignores focus URL entries');
 await open('play');await page.keyboard.press('Escape');for(let i=0;i<5;i++)await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.equal((await state()).id,'settings');await page.keyboard.press('Escape');assert.equal((await state()).id,'pause','return source from pause');assert.equal((await state()).focus,5,'return restores source focus');
 await open('levels',2);await page.reload();await page.waitForFunction(()=>document.body.dataset.page==='levels');assert.equal((await state()).focus,2,'reload preserves focus');await page.keyboard.press('ArrowDown');await page.goBack();await page.waitForFunction(()=>document.body.dataset.focus==='2');
 await page.evaluate(()=>{window.tabPrevented=null;window.addEventListener('keydown',e=>{if(e.key==='Tab')window.tabPrevented=e.defaultPrevented;});});await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>tabPrevented),false,'Tab is not captured');
 await open('play');await page.keyboard.press('z');assert.equal(await page.locator('#play-notice').textContent(),'预览不能真的玩');await page.keyboard.press('r');assert.equal((await state()).id,'play');
 // Missing art is a browser-only fixture: the repository inventory is untouched.
 await page.evaluate(()=>{PB_SCREENS.screens.find(s=>s.id==='controls').art=null;location.hash='#controls';});await page.waitForFunction(()=>document.body.dataset.page==='controls');assert.ok((await page.locator('#play-placeholder').textContent()).includes('此页还没画：操作说明（controls）'));await page.keyboard.press('Escape');assert.equal((await state()).id,'play');
 await open('lobby',3,1,'ui.screen.lobby_story');assert.ok(!(await page.url()).includes('art='),'variant URL normalizes to primary');await page.keyboard.press('Enter');assert.equal((await state()).id,'@quit');await page.keyboard.press('Enter');assert.equal((await state()).id,'lobby');
 // Every logical page and variant compares the actual workbench stage with
 // the actual standalone stage, same options, focus and tick.
 const reference=await browser.newPage({viewport:{width:1280,height:800}});reference.on('pageerror',e=>errors.push(e.message));
 await reference.goto(base.replace('play.html','index.html')+'#screen/lobby');await reference.waitForFunction(()=>window.PBScreens&&window.PBScreenRenderer);
 let pixels=0;
 for(const s of inventory)for(const art of [s.art].filter(Boolean)){
  const focus=({lobby:2,chapters:1,levels:2,pause:5,hint:1,complete:1,settings:2})[s.id]||0;await open(s.id,focus,s.id==='hint'?3:1);
  const got=await page.evaluate(()=>{PBPlay.stage().setPlaying(false);PBPlay.stage().setTick(37);return Array.from(PBPlay.stage().canvas.getContext('2d').getImageData(0,0,320,180).data);});
  const expected=await reference.evaluate(({id,art,focus})=>{PBScreens.show(id,{interactive:true,model:true,focus,hintTier:id==='hint'?3:1,art});const stage=PBScreens.stage();stage.setPlaying(false);stage.setTick(37);return Array.from(stage.canvas.getContext('2d').getImageData(0,0,320,180).data);},{id:s.id,art,focus});
  assert.deepEqual(got,expected,'exact RGBA '+s.id+' '+art);pixels++;
 }
 // Preserve the old default composition as an independent, pre-extraction reference.
 const unchanged=await reference.evaluate(()=>{const results=[];for(const s of PB_SCREENS.screens)for(const art of [s.art,...s.variants].filter(Boolean)){PBScreens.show(s.id,{art});const stage=PBScreens.stage();stage.setPlaying(false);stage.setTick(23);const a=PBStore.asset(art),r=new PB.Raster(320,180);if(s.id==='play')PB.scene.renderLevel(r,PB.scene.SHOWCASE,null,{tick:23,hud:false});const preview=s.id==='hint'?{...a,params:{...a.params,level:3}}:a;PB.ui.render(r,preview,23,{focus:s.id==='hint'?2:0,specs:Object.fromEntries(PBStore.levels().map(l=>[l.id,l])),levelSpec:PBStore.level('M05'),ruleSpec:PBStore.level('M03'),animate:true});const got=stage.canvas.getContext('2d').getImageData(0,0,320,180).data;results.push({id:s.id,equal:r.data.every((v,i)=>v===got[i])});}return results;});assert.ok(unchanged.every(r=>r.equal),'workbench default pixels unchanged '+JSON.stringify(unchanged.filter(r=>!r.equal)));await reference.close();
 // The chapter cache is extracted unchanged from the existing scene preview.
 // Independent raw painter comparisons protect its dynamic wall, focus and locale.
 await open('chapters');const chapterCache=await page.evaluate(()=>{const results=[],screen=PB_SCREENS.screens.find(s=>s.id==='chapters'),asset=PBStore.asset(screen.art),locale=PB.i18n.getLocale();for(const loc of ['zh-Hans','en']){PB.i18n.setLocale(loc);for(const focus of [0,1,3])for(const tick of [0,37,91]){const a={...asset,params:{...asset.params,focus}},raw=new PB.Raster(320,180),cached=new PB.Raster(320,180),state={focus,specs:Object.fromEntries(PBStore.levels().map(l=>[l.id,l])),levelSpec:PBStore.level('M05'),ruleSpec:PBStore.level('M03'),animate:true};PB.ui.render(raw,a,tick,state);PBScreenRenderer.draw(cached,screen,a,tick,{interactive:true,model:true,focus});results.push({loc,focus,tick,equal:raw.data.every((v,i)=>v===cached.data[i])});}}PB.i18n.setLocale(locale);return results;});assert.ok(chapterCache.every(x=>x.equal),'chapter cached/raw RGBA '+JSON.stringify(chapterCache.filter(x=>!x.equal)));
 await model();await open('play');assert.ok(await page.evaluate(()=>{const lv=PBStore.level('M05'),replay=PB.tilemodel.replay(lv,[]),last=replay.steps[replay.steps.length-1],r=new PB.Raster(320,180);PB.scene.renderLevel(r,lv,{level:replay.level,state:last.state},{tick:31,hud:false,pose:'idle',grid:false,observe:false});const hud=PBStore.asset('ui.screen.hud_keys');PB.ui.render(r,{...hud,params:{...hud.params,level:'M05'}},31,{focus:0,specs:Object.fromEntries(PBStore.levels().map(l=>[l.id,l])),levelSpec:lv,ruleSpec:PBStore.level('M03'),animate:true});const s=PBPlay.stage();s.setPlaying(false);s.setTick(31);const got=s.canvas.getContext('2d').getImageData(0,0,320,180).data;return got.every((v,i)=>v===r.data[i]);}),'M05 replay step zero plus HUD independent reference');
 await open('hint',0,3);const hint0=await page.evaluate(()=>{const s=PBPlay.stage();s.setPlaying(false);s.setTick(37);return Array.from(s.canvas.getContext('2d').getImageData(0,0,320,180).data);});await page.keyboard.press('ArrowRight');assert.equal((await state()).focus,1,'tier-three action focus is independent of hint tier');const hint1=await page.evaluate(()=>{PBPlay.stage().setTick(37);return Array.from(PBPlay.stage().canvas.getContext('2d').getImageData(0,0,320,180).data);});console.log('frozen hint action focus pixels identical: '+hint0.every((v,i)=>v===hint1[i]));await page.keyboard.press('Enter');assert.equal((await state()).id,'play','tier-three second action confirms');
 for(const [width,height]of [[1280,800],[1024,768],[1919,1000]]){await page.setViewportSize({width,height});await page.waitForTimeout(50);const b=await page.locator('#play-stage canvas').boundingBox(),z=Math.max(1,Math.floor(Math.min(width/320,height/180)));assert.equal(b.width,320*z);assert.equal(b.height,180*z);assert.equal(b.x,(width-b.width)/2);assert.equal(b.y,(height-b.height)/2);}
 await lifecycle();
 // The prior page must stop immediately, only the current stage advances.
 const clocks=await page.evaluate(async()=>{const old=PBPlay.stage();location.hash='#chapters';await new Promise(r=>setTimeout(r,180));const before=old.tick(),next=PBPlay.stage(),start=next.tick();const deadline=performance.now()+1200;while(next.tick()<=start&&performance.now()<deadline)await new Promise(r=>setTimeout(r,25));return{stopped:old.tick()===before,current:next.tick()>start,canvases:document.querySelectorAll('#play-stage canvas').length};});assert.ok(clocks.stopped&&clocks.current&&clocks.canvases===1,'exclusive current-page clock '+JSON.stringify(clocks));
 const evidence=process.env.WB_EVIDENCE_DIR;if(evidence){fs.mkdirSync(evidence,{recursive:true});await page.setViewportSize({width:1280,height:800});for(const s of inventory.filter(s=>s.game==='in_use')){await open(s.id);await page.screenshot({path:path.join(evidence,'play-'+s.id+'.png')});}await open('lobby');let i=0;const shot=async()=>page.screenshot({path:path.join(evidence,'flow-'+String(i++).padStart(2,'0')+'-'+(await state()).id+'.png')});await shot();for(const key of ['Enter','Enter','Enter','c','Escape','Escape','Escape']){await page.keyboard.press(key);await shot();}}
 assert.deepEqual(errors,[]);console.log('WB-12 play smoke passed '+JSON.stringify({transport:process.env.WB_HTTP==='1'?'HTTP':'file',keyboard,mouse,pixels}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));});
