// Public art workbench smoke test; fresh profile, one browser renderer.
const fs=require('fs'), path=require('path'), assert=require('assert/strict');
const { chromium }=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ROOT=path.resolve(__dirname,'..');
let server, browser, failures=[];
const check=(ok,msg)=>{ console.log((ok?'ok ':'FAIL ')+msg); if(!ok) failures.push(msg); };
(async()=>{
  let url=require('url').pathToFileURL(path.join(ROOT,'workbench/index.html')).href;
  if(process.env.WB_HTTP==='1') {
    server=require('http').createServer((req,res)=>{
      const rel=decodeURIComponent(req.url.split(/[?#]/)[0]), file=path.resolve(ROOT,'.'+rel);
      if(rel==='/favicon.ico') {res.writeHead(204);res.end();return;}
      if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()) {res.writeHead(404);res.end();return;}
      const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.png':'image/png','.wav':'audio/wav'};
      res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    url='http://127.0.0.1:'+server.address().port+'/workbench/index.html';
  }
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--renderer-process-limit=1','--num-raster-threads=1']});
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
  await page.goto(url);await page.waitForTimeout(200);
  if(process.env.WB_VISIBLE_ONLY==='1'){await visibleContentRegression(page,url);assert.deepEqual(errors,[]);return;}
  check(await page.locator('#view-scenes').isVisible(),'default opens art scenes');
  const groups=await page.evaluate(()=>PBNav.MENU.map(g=>g.label));
  assert.deepEqual(groups,['关卡模式','配送模式','地图概念','美术','声音']);
  const pages=await page.evaluate(()=>PBNav.pages().map(p=>p.view));
  for(const view of pages){await page.goto(url+'#'+view);await page.waitForTimeout(120);check(await page.locator('#view-'+view).isVisible(),'menu '+view);}
  // The restored mode entries must be actual clickable navigation, not labels.
  for(const [mode,view] of [['level','level-art'],['delivery','delivery-art']]){
    const head=page.locator('#nav button.nav-head[data-group="'+mode+'"]');
    if(await head.getAttribute('aria-expanded')==='false') await head.click();
    await page.locator('#nav a[data-key="'+view+'"]').click();
    await page.waitForFunction(view=>!document.querySelector('#view-'+view).hidden&&document.querySelector('#'+view+'-root .mode-resource-card'),view);
    const expected=await page.evaluate(mode=>PBModeCatalog.assets(mode,'all',PBStore.assets()).map(a=>a.id).sort(),mode);
    const actual=await page.locator('#'+view+'-root [data-resource-id]').evaluateAll(cards=>cards.map(c=>c.dataset.resourceId).sort());
    assert.deepEqual(actual,expected,mode+' mode overview contains all its assets');
    const links=await page.locator('#nav a[data-view="'+view+'"]').evaluateAll(list=>list.map(a=>a.hash));
    assert.ok(links.includes('#'+view+'/theme.dungeon')&&links.includes('#'+view+'/screens')&&links.includes('#'+view+'/sounds'));
    if(process.env.WB_MODE_SCREENSHOTS){
      fs.mkdirSync(process.env.WB_MODE_SCREENSHOTS,{recursive:true});
      await page.screenshot({path:path.join(process.env.WB_MODE_SCREENSHOTS,mode+'.png')});
    }
    check(true,mode+' mode menu and complete resource overview');
  }
  await page.locator('#nav a[data-key="delivery-art/theme.diyu"]').click();
  await page.waitForFunction(()=>document.querySelector('#delivery-art-root h1')?.textContent.includes('地府'));
  assert.equal(await page.locator('#delivery-art-root [data-resource-id="char.yama"]:visible').count(),1);
  assert.equal(await page.locator('#delivery-art-root [data-resource-id="char.haenyeo"]:visible').count(),0);
  await page.getByLabel('包括通用资源',{exact:true}).uncheck();
  assert.equal(await page.locator('#delivery-art-root [data-resource-id="obj.crate_wood"]:visible').count(),0);
  await page.locator('#nav a[data-key="delivery-art"]').click();
  await page.waitForFunction(()=>document.querySelector('#delivery-art-root h1')?.textContent.includes('全部资源'));
  await page.getByLabel('搜索配送模式资源',{exact:true}).fill('ui.screen.run_door');
  await page.waitForFunction(()=>[...document.querySelectorAll('#delivery-art-root [data-resource-id]')].filter(c=>!c.hidden).length===2);
  assert.equal(await page.locator('#delivery-art-root [data-resource-id]:visible').count(),2);
  await page.getByRole('button',{name:'清除筛选',exact:true}).click();
  await page.locator('#delivery-art-root').getByLabel('确认状态',{exact:true}).selectOption('draft');
  const draftIds=await page.locator('#delivery-art-root [data-resource-id]:visible').evaluateAll(cards=>cards.map(c=>c.dataset.resourceId));
  const expectedDrafts=JSON.parse(fs.readFileSync(path.join(ROOT,'art/review/OFFLINE-ART-20261020/receipt.json'))).assets.filter(a=>a.stage==='draft').map(a=>a.id);
  for(const id of expectedDrafts) assert.ok(draftIds.includes(id),id+' draft remains accessible');
  check(true,'mode search, map/common filter and draft concepts remain accessible');
  await page.locator('#nav a[data-key="delivery-art/hub"]').click();
  await page.waitForFunction(()=>document.querySelector('#delivery-art-root [data-resource-id="scene.hub_post"]'));
  await page.locator('#delivery-art-root [data-resource-id="scene.hub_post"]').getByRole('link',{name:'预览与动画',exact:true}).click();
  await page.locator('#asset-inspector').getByLabel('动画',{exact:true}).waitFor();
  await page.locator('#asset-inspector').getByLabel('动画',{exact:true}).selectOption('after');
  assert.equal(await page.locator('#asset-inspector').getByLabel('动画',{exact:true}).inputValue(),'after');
  check(true,'whole hub scene opens in the existing animation inspector');
  await page.goto(url+'#delivery-art/sounds');
  await page.waitForFunction(()=>document.querySelector('#delivery-art-root [data-preview-sound]'));
  assert.equal(await page.locator('#delivery-art-root [data-sound-id="sfx:delivery_arrive"]').count(),1);
  assert.ok(await page.locator('#delivery-art-root [data-preview-sound]').count()>0);
  assert.equal(await page.evaluate(()=>PBWBAudio.player.snapshot().sfx.length),0);
  await page.locator('#delivery-art-root [data-preview-sound="sfx:push"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-mode-audio-status="delivery"]').textContent.includes('已试听：'));
  check(true,'mode effects use the existing audio monitor and only play after a click');
  await page.locator('#delivery-art-root [data-preview-sound="sfx:reel_spin"]').click();
  await page.waitForFunction(()=>PBWBAudio.player.snapshot().sfx.some(v=>v.uid==='sfx:reel_spin'));
  await page.setViewportSize({width:390,height:844});
  await page.goto(url+'#level-art/screens');
  await page.waitForFunction(()=>!document.querySelector('#view-level-art').hidden);
  await page.waitForFunction(()=>PBWBAudio.player.snapshot().sfx.length===0);
  check(true,'leaving a mode stops the active looping reel effect');
  assert.ok(await page.locator('#level-art-root [data-resource-id="ui.screen.levels"]').count()===1);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mode resource page fits a narrow viewport');
  if(process.env.WB_MODE_SCREENSHOTS) await page.screenshot({path:path.join(process.env.WB_MODE_SCREENSHOTS,'mobile.png')});
  await page.setViewportSize({width:1280,height:800});
  if(process.env.WB_MODE_ONLY==='1'){
    check(errors.length===0,'no mode browser errors'+(errors.length?': '+errors.join('; '):''));
    assert.equal(failures.length,0,failures.join('\n'));
    console.log('mode resource checks passed (focused run; global suite not repeated)');
    return;
  }
  await page.goto(url+'#ui-proposals'); await page.waitForTimeout(100);
  check(await page.locator('#ui-proposals-root figure').count()===6,'all six G2 confirmed references are present');
  await page.goto(url+'#scenes/level.M03');await page.waitForTimeout(150);
  assert.deepEqual(await page.evaluate(()=>PBStore.levels().map(l=>l.id).sort()),['M03','M04','M05']);
  for(const id of ['M03','M04','M05']){await page.goto(url+'#scenes/level.'+id);await page.waitForTimeout(80);}
  check(true,'three example levels replay without errors');
  const {decodePng}=await import(path.join(ROOT,'tools/lib/png.mjs'));
  for(const name of ['showcase.dungeon','chapter.forest','lobby.dungeon']){
    await page.goto(url+'#scenes/'+name);await page.waitForTimeout(100);
    const got=await page.evaluate(name=>{
      const r=new PB.Raster(320,180);
      if(name.startsWith('showcase.')) PB.scene.renderLevel(r,PB.scene.SHOWCASE,null,{theme:'theme.dungeon',tick:0});
      else if(name.startsWith('chapter.')) PB.scene.renderLevel(r,PB.matter.SHOWCASES.forest,null,{tick:0});
      else PB.ui.render(r,PBStore.asset('ui.screen.lobby'),0,{theme:'theme.dungeon'});
      return Array.from(r.data);
    },name);
    const want=decodePng(fs.readFileSync(path.join(ROOT,'art/export/reference/'+name+'.png')));
    check(Buffer.from(got).equals(Buffer.from(want.data)),name+' browser pixels equal reference PNG');
  }
  await page.goto(url+'#concepts/cenote');await page.locator('#concept-play').waitFor();
  if((await page.locator('#concept-play').innerText())==='暂停') await page.locator('#concept-play').click();
  const before=await page.locator('canvas.concept-scene').screenshot();await page.waitForTimeout(160);
  check(before.equals(await page.locator('canvas.concept-scene').screenshot()),'concept pauses');
  await page.locator('#concept-play').click();await page.waitForTimeout(320);
  check(!before.equals(await page.locator('canvas.concept-scene').screenshot()),'concept plays');
  await page.locator('#concept-enlarge').click();check(await page.locator('canvas[aria-label="放大的概念场景"]').isVisible(),'concept enlarges');
  await page.getByRole('button',{name:'关闭大图',exact:true}).click();
  await page.goto(url+'#review');await page.waitForTimeout(120);
  const review=await page.locator('#review-root').innerText();check(review.includes('已确认')&&review.includes('待确认'),'review lists both confirmation states');
  await page.locator('[data-batch="offline-20261020"]').click();
  check((await page.locator('#review-root').innerText()).includes('82'),'offline batch is available in review');
  const receipt=JSON.parse(fs.readFileSync(path.join(ROOT,'art/review/OFFLINE-ART-20261020/receipt.json')));
  const reports=JSON.parse(fs.readFileSync(path.join(ROOT,'art/review/OFFLINE-ART-20261020/render-report.json')));
  const candidates=await page.evaluate(ids=>ids.map(id=>({id,status:PBStore.asset(id).status})),receipt.assets.map(a=>a.id));
  const sourceStage=new Map(receipt.assets.map(a=>[a.id,a.stage]));
  check(candidates.length===82&&candidates.every(a=>a.status===(sourceStage.get(a.id)==='review'?'approved':'draft')),
    '76 reviewed entries are approved; six delivery concepts remain draft');
  await page.locator('#review-status').selectOption('approved');
  assert.equal(await page.locator('#review-results .review-card:visible').count(),76);
  check((await page.locator('#review-root').innerText()).includes('待确认 0'),'no reviewed art remains pending');
  for(const item of reports.renders){
    const result=await page.evaluate(item=>{
      const a=structuredClone(PBStore.asset(item.id));Object.assign(a.params,item.patch);
      if(item.patch.world){a.params.room2.world=item.patch.world;a.params.theme='theme.'+item.patch.world;}
      const r=new PB.Raster(320,180),issues=PB.ui.render(r,a,0,{locale:item.locale,focus:0,env:'full'});
      return {issues,pixels:item.variant===0?Array.from(r.data):null};
    },item);
    assert.deepEqual(result.issues,[],`${item.id}/${item.locale}/${item.variant}`);
    if(item.variant===0){
      const png=decodePng(fs.readFileSync(path.join(ROOT,`art/export/reference/${item.id.slice(10)}.${item.locale}.png`)));
      assert.ok(Buffer.from(result.pixels).equals(Buffer.from(png.data)),item.id+' browser/reference mismatch');
    }
  }
  check(true,'196 offline UI states fit both locales; 46 default browser renders equal PNG references');
  await page.goto(url+'#audio/sfx');await page.waitForTimeout(120);
  check((await page.locator('#audio-root').innerText()).includes('sfx:push'),'sound page lists effects');
  await visibleContentRegression(page,url);
  check(errors.length===0,'no browser errors'+(errors.length?': '+errors.join('; '):''));
  assert.equal(failures.length,0,failures.join('\n'));
  console.log('all public workbench smoke checks passed');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{if(browser) await browser.close();if(server) await new Promise(resolve=>server.close(resolve));});


// WB-09 additions: one browser, browser-only fake pending data, no repository writes.
async function visibleContentRegression(page, url) {
  const evidence=process.env.WB_EVIDENCE_DIR;
  const shot=async name=>{if(evidence){fs.mkdirSync(path.join(evidence,'screenshots'),{recursive:true});await page.screenshot({path:path.join(evidence,'screenshots',name+'.png')});}};
  const go=async hash=>{await page.goto(url+hash);await page.waitForTimeout(150);};
  for(const width of [1024,1100,1280,1440,720]) {
    await page.setViewportSize({width,height:800});
    await go('#assets');
    const card=page.locator('#asset-cards .card:visible').first();
    await card.click();
    const panel=page.locator('#asset-inspector');
    await panel.locator('h2').waitFor();
    const rect=await panel.boundingBox();
    assert.ok(rect&&rect.y>=0&&rect.y<800&&rect.x>=0&&rect.x+rect.width<=width+1,'asset details in viewport at '+width);
    if(width<=1100){
      assert.equal(await page.locator('dialog.detail-drawer[open]').count(),1);
      if(width===720) assert.ok(rect.width>=width-2,'mobile details fill width');
    } else assert.equal(await page.locator('dialog.detail-drawer[open]').count(),0);
    if(width!==720) await shot('assets-'+width);
    if(width<=1100){
      await page.keyboard.press('Escape');
      assert.ok(await card.evaluate(n=>document.activeElement===n),'asset Escape returns to the originating card');
      await card.click();
      await page.getByRole('button',{name:'关闭详情',exact:true}).click();
      assert.ok(await card.evaluate(n=>document.activeElement===n),'asset close returns to the originating card');
    }
    await go('#scenes');
    const sceneId=await page.locator('#scene-list .list-btn').nth(1).getAttribute('data-scene');
    assert.ok(sceneId,'scene cards expose stable identity for focus restoration');
    await page.locator('#scene-list .list-btn').nth(1).click();
    await page.locator('#scene-info h2').waitFor();
    const sceneRect=await page.locator('#scene-info').boundingBox();
    assert.ok(sceneRect&&sceneRect.y>=0&&sceneRect.y<800&&sceneRect.x+sceneRect.width<=width+1,'scene details in viewport at '+width);
    if(width!==720) await shot('scenes-'+width);
    if(width<=1100){
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(()=>document.activeElement.dataset.scene),sceneId,'scene Escape restores same card after list rebuild');
      await page.locator('#scene-list [data-scene="'+sceneId+'"]').click();
      await page.getByRole('button',{name:'关闭详情',exact:true}).click();
      assert.equal(await page.evaluate(()=>document.activeElement.dataset.scene),sceneId);
    }
  }
  await page.setViewportSize({width:1280,height:800});
  await go('#assets');
  assert.ok(!/\b(avatar|cargo|monster|scene)\b/.test(await page.locator('#asset-categories').innerText()),'asset category labels are Chinese');
  await go('#review');
  assert.equal(await page.locator('#review-status').inputValue(),'all');
  assert.ok((await page.locator('#review-root').innerText()).includes('当前没有待确认的美术'));
  assert.ok(await page.locator('#review-results .review-card:visible').count()>0);
  await shot('review-no-pending');
  await page.locator('#review-status').selectOption('approved');
  await page.locator('#review-category').selectOption('character');
  assert.equal(await page.locator('#review-status').inputValue(),'approved','manual status survives this opening');
  await page.getByRole('button',{name:/^草稿 \d+ 项$/}).click();
  assert.equal(await page.locator('#review-status').inputValue(),'draft');
  assert.ok(await page.locator('#review-results .review-card:visible').count()>0);
  await go('#concepts');
  const expected=await page.evaluate(()=>PBStore.content().concepts.maps.filter(m=>!PB_CONCEPT_SCENES[m.id]).map(m=>m.id));
  const textGroup=page.locator('#concept-text-only');
  assert.equal(await textGroup.getAttribute('open'),null,'text-only concept table defaults closed');
  assert.equal(await page.locator('#nav-concept-text-only').getAttribute('open'),null,'text-only navigation defaults closed');
  assert.equal(await textGroup.locator('tbody tr').count(),expected.length);
  assert.ok((await page.locator('#concepts-root').innerText()).includes('完整度'));
  await shot('concepts-table-and-nav');
  await textGroup.locator('summary').scrollIntoViewIfNeeded();
  await page.locator('#nav-concept-text-only summary').scrollIntoViewIfNeeded();
  await shot('concepts-text-collapsed');
  await textGroup.locator('summary').click();
  assert.equal(await textGroup.locator('tbody tr:visible').count(),expected.length);
  await page.locator('#nav-concept-text-only summary').click();
  await shot('concepts-text-expanded');
  await go('#concepts/'+expected[0]);
  assert.equal(await page.locator('a[href^="#mechanisms/"]').count(),0);
  const empty=await page.locator('.concept-scene-empty').boundingBox();
  assert.ok(empty&&empty.height<60,'missing concept scene occupies one line');
  await go('#maps');
  assert.equal(await page.evaluate(()=>location.hash),'#maps','unknown maps address uses normal fallback without rooms redirect');
  assert.ok(await page.locator('#view-scenes').isVisible());
  // Inject one fake status into this browser only; restore it even on failure.
  await page.evaluate(()=>{window.__wb09Status=PBStore.status;window.__wb09Pending=PBStore.assets().find(a=>PBStore.status(a.id)==='approved').id;PBStore.status=id=>id===window.__wb09Pending?'review':window.__wb09Status(id);});
  try {
    await go('#review');
    assert.equal(await page.locator('#review-status').inputValue(),'review');
    assert.equal(await page.locator('#review-results .review-card:visible').count(),1);
    assert.equal(await page.locator('#review-empty-notice').count(),0);
    await shot('review-injected-pending');
  } finally {await page.evaluate(()=>{PBStore.status=window.__wb09Status;delete window.__wb09Status;delete window.__wb09Pending;});}
  await go('#scenes');
  // Initial late-registry menu refresh must preserve populated browser-only badges.
  const badgeRefresh=await page.evaluate(()=>{
    const draft=PBStore.assets().find(a=>a.kind==='sprite'&&!PBStore.drafts()[a.id]);
    const selected=PBStore.assets().find(a=>a.id!==draft.id&&!PBStore.review().selected[a.id]);
    const keys=['pb.wb.drafts.v1','pb.wb.review.v1'], saved=keys.map(k=>localStorage.getItem(k));
    const snapshot=()=>['drafts-count','review-count'].map(id=>{const n=document.getElementById(id);return {id,hidden:n.hidden,count:n.textContent};});
    try {
      PBStore.setDraft(draft.id,structuredClone(draft.frames));
      PBStore.toggleSelected(selected.id,true);
      const before=snapshot();
      window.dispatchEvent(new Event('DOMContentLoaded'));
      return {before,after:snapshot()};
    } finally {
      PBStore.discardDraft(draft.id); PBStore.toggleSelected(selected.id,false);
      keys.forEach((key,i)=>{if(saved[i]===null)localStorage.removeItem(key);else localStorage.setItem(key,saved[i]);});
    }
  });
  assert.ok(badgeRefresh.before.every(b=>!b.hidden&&Number(b.count)>0),'browser-local draft and selection badges start populated');
  assert.deepEqual(badgeRefresh.after,badgeRefresh.before,'late concept registration refresh preserves badge visibility and counts');
  console.log('WB-09 visible content regressions passed');
}
