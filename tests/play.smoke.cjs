// WB-12: real standalone input, exact live-workbench RGBA parity, URLs and lifecycle.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const ROOT=path.resolve(__dirname,'..'),inventory=JSON.parse(fs.readFileSync(path.join(ROOT,'content/screens/screens.json'))).screens;
const LAB_IDS=['lobby','chapters','levels','play','pause','hint','rulecard','complete','settings','controls','dialogue'];
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
 let page=await browser.newPage({viewport:{width:1280,height:800}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
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

 async function backlog(){for(const s of inventory.filter(s=>s.art===null)){await open(s.id);assert.equal(await page.locator('#play-placeholder').isVisible(),true,'backlog placeholder '+s.id);const text=await page.locator('#play-placeholder').innerText();assert.ok(text.includes('此页还没画：'+s.name+'（'+s.id+'）'));assert.ok(text.includes(s.notes),'placeholder retains public source '+s.id);assert.equal(await page.locator('#play-gallery').isVisible(),false,'missing designs never request a null PNG');}console.log('WB-16 all backlog placeholders retain sources');}
 if(process.env.WB_PLAY_BACKLOG_ONLY==='1'){await backlog();assert.deepEqual(errors,[]);return;}
 await backlog();
 // WB-13 extends the standalone consumer; the WB-12 cases below remain intact.
 async function delivery(){
  await open('lobby');await page.keyboard.press('i');
  assert.equal(await page.getByRole('option',{name:'配送 / 剧情 / 伙计'}).evaluate(e=>e.disabled),false,'delivery mode is enabled');
  await page.getByLabel('预览模式',{exact:true}).selectOption('delivery');
  assert.equal((await state()).id,'reels','selecting delivery begins at the reels');
  assert.equal(await page.evaluate(()=>document.body.dataset.mode),'delivery','delivery mode is carried by the route');
  assert.ok((await page.url()).includes('mode=delivery'),'mode is shareable');
  await page.keyboard.press('i');
  const openMode=async(id,focus=0,art)=>{await page.goto(base+'?deliveryCase='+(++caseNumber)+'#'+id+'?focus='+focus+'&mode=delivery'+(art?'&art='+encodeURIComponent(art):''));await page.waitForFunction(id=>document.body.dataset.page===id,id);};
  let walls=0,large=0;
  const galleryPages=inventory.filter(s=>s.art!==null&&!LAB_IDS.includes(s.id));
  for(const s of galleryPages){
   await openMode(s.id);
   const wall=page.locator('#play-gallery');assert.equal(await wall.isVisible(),true,s.id+' opens its flow wall');
   const groupOf=x=>x.art&&!LAB_IDS.includes(x.id)&&!['配送一局','剧情','伙计'].includes(x.flow)?'配送一局':x.flow;const group=inventory.filter(x=>x.art!==null&&groupOf(x)===groupOf(s));assert.equal(await wall.locator('[data-gallery-page]').count(),group.length,s.flow+' includes every page');
   for(const item of group)assert.equal(await wall.locator('[data-gallery-page="'+item.id+'"] img').getAttribute('src'),'../art/export/preview/'+item.art+'.png','export PNG '+item.id);
   await wall.locator('[data-gallery-page="'+s.id+'"] img').evaluate(async img=>{await img.decode();});assert.equal(await wall.locator('[data-gallery-page="'+s.id+'"] img').evaluate(img=>img.complete&&img.naturalWidth>0),true,'gallery PNG really loaded '+s.id);
   assert.equal(await page.locator('#play-stage canvas').count(),0,'wall has no live painters');
   await wall.locator('[data-gallery-page="'+s.id+'"]').click();
   assert.equal(await page.locator('#play-stage canvas').count(),1,s.id+' opens one code-drawn large view');
   assert.equal((await state()).id,s.id);assert.equal(await page.locator('#play-gallery').isVisible(),false);
   const before=await state();for(const key of ['Enter','c','z','ArrowDown','Tab'])await page.keyboard.press(key);
   assert.deepEqual(await state(),before,'gallery painting does not execute old game transitions '+s.id);
   await page.keyboard.press('i');assert.ok(!(await page.locator('#play-info').innerText()).includes('待定'),'gallery info omits pending routes '+s.id);await page.keyboard.press('i');
   await page.getByRole('button',{name:'返回缩略图墙',exact:true}).click();assert.equal(await wall.isVisible(),true,'large view returns to its wall '+s.id);walls++;large++;
  }
  await openMode('delivery_hud');await page.locator('[data-gallery-page="delivery_hud"]').click();
  await page.locator('#play-gallery-back').click();await page.goBack();await page.waitForFunction(()=>document.body.dataset.mode==='delivery');assert.equal(await page.evaluate(()=>document.body.dataset.mode),'delivery','browser history preserves mode');assert.equal((await state()).id,'delivery_hud','browser history restores gallery page');assert.equal(await page.evaluate(()=>document.body.dataset.art),'ui.screen.delivery_hud','browser history restores gallery art');
  const hud=await state();await page.keyboard.press('z');assert.deepEqual(await state(),hud,'HUD does not implement gameplay input');
  await page.evaluate(()=>{window.unregisteredKeys={};window.addEventListener('keydown',e=>{if(['q','1','2','3'].includes(e.key))unregisteredKeys[e.key]=e.defaultPrevented;},true);});for(const key of ['q','1','2','3'])await page.keyboard.press(key);assert.deepEqual(await page.evaluate(()=>unregisteredKeys),{q:false,1:false,2:false,3:false},'new shortcuts are captured only when the current transition table registers them');
  await page.keyboard.press('i');await page.getByLabel('预览模式',{exact:true}).selectOption('lab');assert.equal((await state()).id,'lobby','lab mode starts at the original lobby');assert.equal(await page.evaluate(()=>document.body.dataset.art),'ui.screen.lobby');
  assert.equal(await page.getByLabel('预览模式',{exact:true}).inputValue(),'lab');assert.equal(await page.getByLabel('大厅画面',{exact:true}).locator('option').count(),4,'registered lobby variants are available from the info panel');await page.getByLabel('大厅画面',{exact:true}).selectOption('ui.screen.lobby_story');assert.equal(await page.evaluate(()=>document.body.dataset.art),'ui.screen.lobby_story');assert.equal(await page.locator('[data-step="godot"]').getAttribute('class'),'pending','story lobby uses its own missing native status');assert.equal(await page.locator('[data-step="game"]').getAttribute('class'),'pending');assert.ok((await page.locator('[data-step="game"]').textContent()).includes('未登记'),'variant game integration is not inherited from primary');await page.getByLabel('大厅画面',{exact:true}).selectOption('ui.screen.lobby');assert.equal(await page.evaluate(()=>document.body.dataset.mode),'lab');assert.equal(await page.locator('[data-step="godot"]').getAttribute('class'),'done','primary progress is restored');await page.keyboard.press('i');
  // Keep URL normalization, variant isolation and progress independent of removed flows.
  await open('lobby',3,1,'ui.screen.lobby_story');assert.ok(!(await page.url()).includes('art='));await page.keyboard.press('Enter');assert.equal((await state()).id,'@quit','old unmarked variant URL retains primary behavior');
  await openMode('lobby',3,'ui.screen.lobby_story');assert.equal(await page.evaluate(()=>document.body.dataset.art),'ui.screen.lobby_story');
  await page.reload();await page.waitForFunction(()=>document.body.dataset.focus==='3');assert.ok((await page.url()).includes('art=ui.screen.lobby_story'),'reload keeps registered variant');
  await openMode('lobby',3,'ui.screen.pause_help');assert.equal(await page.evaluate(()=>document.body.dataset.art),'ui.screen.lobby','unregistered variant cannot borrow primary transitions');assert.ok(!(await page.url()).includes('art='));
  await openMode('lobby',0,'ui.screen.lobby_story');await page.keyboard.press('i');assert.ok(!(await page.locator('#play-info').innerText()).includes('待定'),'variant info omits unused pending transitions');await page.keyboard.press('i');
  // The new mode uses the same frozen painter inputs; focus never edits stored assets.
  await openMode('reels');await page.locator('[data-gallery-page="reels"]').click();const focusEvidence=await page.evaluate(labIds=>{const rows=[];for(const s of PB_SCREENS.screens.filter(s=>s.art!==null&&!labIds.includes(s.id)||s.variantTransitions))for(const art of [s.art,...Object.keys(s.variantTransitions||{})]){const a=PBStore.asset(art),before=JSON.stringify(a),renders=[0,1].map(focus=>{const r=new PB.Raster(320,180);PBScreenRenderer.draw(r,s,a,31,{interactive:true,model:true,focus});return r.data;});rows.push({id:s.id,art,equal:renders[0].every((v,i)=>v===renders[1][i]),unchanged:before===JSON.stringify(a)});}return rows;},LAB_IDS);
  assert.ok(focusEvidence.every(x=>x.unchanged),'interactive focus never mutates painter params');
  for(const art of ['ui.screen.confirm','ui.screen.delivery_help','ui.screen.delivery_pause','ui.screen.crew_pick','ui.screen.story_board','ui.screen.lobby_story'])assert.equal(focusEvidence.find(x=>x.art===art).equal,false,'painted focus changes '+art);
  for(const art of ['ui.screen.delivery_hud','ui.screen.run_door','ui.screen.story_letter','ui.screen.crew_joined'])assert.equal(focusEvidence.find(x=>x.art===art).equal,true,'display painter deliberately ignores focus '+art);
  const evidence=process.env.WB_EVIDENCE_DIR;if(evidence){fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,'play-focus-evidence.json'),JSON.stringify(focusEvidence,null,2)+'\n');await page.setViewportSize({width:1280,height:800});await openMode('reels');await page.screenshot({path:path.join(evidence,'delivery-wall.png')});await page.locator('[data-gallery-page="reels"]').click();await page.screenshot({path:path.join(evidence,'delivery-large.png')});}
  console.log('WB-14 gallery coverage '+JSON.stringify({walls,large,focusEvidence}));
  await open('levels',2);
 }
 if(process.env.WB_PLAY_DELIVERY_ONLY==='1'){await delivery();assert.deepEqual(errors,[]);console.log('WB-13 delivery smoke passed');return;}


 async function embedded(){
  await open('pause');const back=page.getByRole('link',{name:'返回工作台',exact:true});assert.equal(await back.isVisible(),true,'standalone always offers mouse return');assert.equal(await back.getAttribute('href'),'index.html#screen/pause');
  await back.click();await page.waitForFunction(()=>location.hash==='#screen/pause');
  await page.goto(base.replace('play.html','index.html')+'#scenes/play/lobby');await page.waitForSelector('#embedded-play');
  const frame=page.frameLocator('#embedded-play');await frame.locator('#play-stage canvas').waitFor();
  assert.equal(await frame.getByRole('link',{name:'返回工作台',exact:true}).count(),0,'embed replaces return with full screen');
  assert.equal(await frame.getByRole('link',{name:'全屏',exact:true}).isVisible(),true);
  assert.equal(await page.locator('#embedded-play-progress [data-step]').count(),5);
  // Every original lab assertion below runs again against this real iframe.
  let child=page.frames().find(f=>f!==page.mainFrame());const embeddedState=()=>child.evaluate(()=>({id:document.body.dataset.page,focus:Number(document.body.dataset.focus),tier:Number(document.body.dataset.tier)}));
  await child.locator('#play-stage .stage-frame').focus();await page.keyboard.press('s');await page.keyboard.press('Space');
  await page.waitForFunction(()=>document.getElementById('embedded-play-name').textContent==='章节选择');
  assert.equal(await page.getByRole('link',{name:'在界面清单中打开',exact:true}).getAttribute('href'),'#screen/chapters','internal navigation updates parent metadata');
  await page.evaluate(()=>window.postMessage({type:'pb-play-page',id:'settings',art:'ui.screen.settings'},'*'));
  assert.equal(await page.locator('#embedded-play-name').innerText(),'章节选择','unrelated window messages cannot change frame metadata');
  await child.goto(base+'?embed=1#lobby?focus=3');await child.locator('#play-stage .stage-frame').focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.getElementById('embedded-play-name').textContent==='已退出（预览）');
  assert.equal(await page.locator('#embedded-play-progress [data-step]').count(),0,'quit clears parent progress');assert.equal(await page.locator('[data-preview-page][aria-current="true"]').count(),0,'quit clears parent page highlight');assert.equal(await page.getByRole('link',{name:'在界面清单中打开',exact:true}).getAttribute('href'),'#scenes','quit links back to inventory');
  await child.goto(base+'?embed=1#lobby');await child.locator('#play-stage .stage-frame').focus();await page.keyboard.press('i');await child.getByLabel('大厅画面',{exact:true}).selectOption('ui.screen.lobby_story');
  await page.waitForFunction(()=>document.querySelector('#embedded-play-progress [data-step="game"]').classList.contains('pending'));
  assert.ok((await page.locator('#embedded-play-progress [data-step="game"]').innerText()).includes('游戏接入'),'variant parent progress stays independent');
  const outer=page,frameNode=outer.locator('#embedded-play');
  const savedStyle=await frameNode.getAttribute('style');
  await frameNode.evaluate(node=>{node.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:9999;';});
  const adapter=new Proxy(child,{get(target,key){
   if(key==='keyboard')return outer.keyboard;if(key==='mouse')return outer.mouse;
   if(key==='goto')return async url=>{const u=new URL(url);u.searchParams.set('embed','1');const r=await target.goto(u.href);const focus=target.locator('#play-stage .stage-frame');if(await focus.count())await focus.focus();return r;};
   if(key==='setViewportSize')return size=>outer.setViewportSize(size);
   if(key==='screenshot')return options=>outer.screenshot(options);
   if(key==='reload')return ()=>Promise.all([target.waitForNavigation({waitUntil:'load'}),target.evaluate(()=>location.reload())]);
   if(key==='goBack')return ()=>target.evaluate(()=>new Promise(resolve=>{addEventListener('popstate',()=>resolve(),{once:true});history.back();setTimeout(resolve,2000);}));
   const value=target[key];return typeof value==='function'?value.bind(target):value;
  }});
  page=adapter;try{await lab('embedded');}finally{page=outer;await frameNode.evaluate((node,style)=>{if(style===null)node.removeAttribute('style');else node.setAttribute('style',style);},savedStyle);}
  await page.locator('[data-preview-page="settings"]').click();await frame.locator('body[data-page="settings"]').waitFor();child=page.frames().find(f=>f!==page.mainFrame());
  assert.equal(await page.locator('#embedded-play-name').innerText(),inventory.find(s=>s.id==='settings').name);assert.equal(await page.getByRole('link',{name:'在界面清单中打开',exact:true}).getAttribute('href'),'#screen/settings');
  const before=await embeddedState();await page.getByRole('heading',{name:'原样预览',exact:true}).click();await page.keyboard.press('ArrowDown');assert.deepEqual(await embeddedState(),before,'parent keyboard does not control an unfocused iframe');
  const popupPromise=page.waitForEvent('popup');await frame.getByRole('link',{name:'全屏',exact:true}).click();const popup=await popupPromise;await popup.waitForFunction(()=>document.body.dataset.page==='settings');assert.equal(await popup.getByRole('link',{name:'返回工作台',exact:true}).getAttribute('href'),'index.html#screen/settings');await popup.getByRole('link',{name:'返回工作台',exact:true}).click();await popup.waitForFunction(()=>location.hash==='#screen/settings');await popup.close();
  const evidence=process.env.WB_EVIDENCE_DIR;if(evidence){fs.mkdirSync(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,'embedded-preview.png')});await open('pause');await page.screenshot({path:path.join(evidence,'fullscreen-return.png')});}
  await page.goto(base.replace('play.html','index.html')+'#home');assert.equal(await page.locator('#embedded-play').count(),0,'leaving preview unloads iframe');
  console.log('WB-14 all original lab assertions re-run in actual iframe');
 }
 if(process.env.WB_PLAY_EMBED_ONLY==='1'){await embedded();assert.deepEqual(errors,[]);console.log('WB-14 embedded smoke passed');return;}

 async function condition(when){if(!when||when.startsWith('第 ')||when==='关卡完成')return;await page.keyboard.press('i');await page.getByLabel(when,{exact:true}).check();await page.getByLabel(when,{exact:true}).focus();await page.keyboard.press('i');assert.equal(await page.locator('#play-info').isVisible(),false,'I closes from checkbox');}
 async function lab(context='standalone'){
 let keyboard=0,mouse=0;
 for(const s of inventory.filter(s=>LAB_IDS.includes(s.id)))for(const t of s.transitions){
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
 await page.keyboard.press('i');assert.equal(await page.locator('#play-info').isVisible(),true);assert.equal(await page.locator('[data-step]').count(),5);assert.equal(await page.getByRole('option',{name:'配送 / 剧情 / 伙计'}).evaluate(e=>e.disabled),false);assert.ok((await page.getByRole('link',{name:'在工作台打开'}).getAttribute('href')).endsWith('#screen/lobby'));await page.keyboard.press('i');
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
  if(s.art!==null&&!LAB_IDS.includes(s.id))await page.locator('[data-gallery-page="'+s.id+'"]').click();
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
 const evidence=process.env.WB_EVIDENCE_DIR;if(evidence){fs.mkdirSync(evidence,{recursive:true});await page.setViewportSize({width:1280,height:800});for(const s of inventory.filter(s=>LAB_IDS.includes(s.id))){await open(s.id);await page.screenshot({path:path.join(evidence,context+'-play-'+s.id+'.png')});}await open('lobby');let i=0;const shot=async()=>page.screenshot({path:path.join(evidence,context+'-flow-'+String(i++).padStart(2,'0')+'-'+(await state()).id+'.png')});await shot();for(const key of ['Enter','Enter','Enter','c','Escape','Escape','Escape']){await page.keyboard.press(key);await shot();}}
 assert.deepEqual(errors,[]);console.log('WB-12 play smoke passed '+JSON.stringify({context,transport:process.env.WB_HTTP==='1'?'HTTP':'file',keyboard,mouse,pixels}));
 }
 await lab();await delivery();await embedded();
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));});
