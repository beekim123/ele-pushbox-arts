// Public art workbench smoke test; fresh profile, one browser renderer.
const fs=require('fs'), path=require('path'), assert=require('assert/strict');
// Fast route contract also runs without a browser while UI work is in progress.
if(process.env.WB_PLAY_ROUTE_ONLY==='1'){
  const vm=require('vm'),window={},document={documentElement:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../workbench/js/app/nav.js'),'utf8'),{window,document,URLSearchParams,localStorage:{getItem:()=>null}});
  assert.deepEqual(JSON.parse(JSON.stringify(window.PBNav.resolve('#scenes/play/settings'))),{hash:'#scenes/play/settings',view:'screens',id:'play/settings',nav:'scenes'},'embedded route stays inside scene workspace');
  console.log('WB-14 embedded route passed');process.exit(0);
}
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
  await docsRegression(page,url);
  if(process.env.WB_DOCS_ONLY==='1'){assert.deepEqual(errors,[]);console.log('WB-15 focused document checks passed');return;}
  if(process.env.WB_BACKLOG_ONLY==='1'){await backlogRegression(page,url);assert.deepEqual(errors,[]);console.log('WB-16 focused backlog checks passed');return;}
  await backlogRegression(page,url);
  await screensRegression(page,url);
  if(process.env.WB_SCREENS_ONLY==='1'){assert.deepEqual(errors,[]);console.log('WB-11 focused screen checks passed');return;}
  if(process.env.WB_VISIBLE_ONLY==='1'){await visibleContentRegression(page,url);assert.deepEqual(errors,[]);return;}
  await libraryRegression(page,url);
  if(process.env.WB_LIBRARY_ONLY==='1'||process.env.WB_MODE_ONLY==='1'){assert.deepEqual(errors,[]);console.log('WB-10 focused library checks passed');return;}
  await page.goto(url+'#scenes/references'); await page.waitForTimeout(100);
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
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(async()=>{if(browser) await browser.close();if(server) await new Promise(resolve=>server.close(resolve));});


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
    await go('#scenes/preview');
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
  assert.equal(await page.locator('#nav a').count(),7,'concept maps stay out of the seven-entry navigation');
  assert.equal(await textGroup.locator('.concept-card').count(),expected.length);
  assert.ok((await page.locator('#concepts-root').innerText()).includes('完整度'));
  await shot('concepts-table-and-nav');
  await textGroup.locator('summary').scrollIntoViewIfNeeded();
  await shot('concepts-text-collapsed');
  await textGroup.locator('summary').click();
  assert.equal(await textGroup.locator('.concept-card:visible').count(),expected.length);
  await shot('concepts-text-expanded');
  await go('#concepts/'+expected[0]);
  assert.equal(await page.locator('a[href^="#mechanisms/"]').count(),0);
  const empty=await page.locator('.concept-scene-empty').boundingBox();
  assert.ok(empty&&empty.height<60,'missing concept scene occupies one line');
  await go('#maps');
  assert.equal(await page.evaluate(()=>location.hash),'#maps','unknown maps address uses normal fallback without rooms redirect');
  assert.ok(await page.locator('#view-home').isVisible());
  // Inject one fake status into this browser only; restore it even on failure.
  await page.evaluate(()=>{window.__wb09Status=PBStore.status;window.__wb09Pending=PBStore.assets().find(a=>PBStore.status(a.id)==='approved').id;PBStore.status=id=>id===window.__wb09Pending?'review':window.__wb09Status(id);});
  try {
    await go('#review');
    assert.equal(await page.locator('#review-status').inputValue(),'review');
    assert.equal(await page.locator('#review-results .review-card:visible').count(),1);
    assert.equal(await page.locator('#review-empty-notice').count(),0);
    await shot('review-injected-pending');
  } finally {await page.evaluate(()=>{PBStore.status=window.__wb09Status;delete window.__wb09Status;delete window.__wb09Pending;});}
  await go('#scenes/preview');
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

// WB-10 baseline exported from the unmodified browser page; sorted IDs hashed independently.
async function libraryRegression(page,url){
  const baseline={"all":[304,"5226d2afc1843048f8eabe2df097ee0faeb81be8c5156c931786429dd28e7846"],"level/all/true":[108,"424b2c9137904c0a8a3d3297fc54bddedff8e64e7f2df6f9f798f0a32422cac8"],"level/all/false":[108,"424b2c9137904c0a8a3d3297fc54bddedff8e64e7f2df6f9f798f0a32422cac8"],"level/theme.dungeon/true":[84,"f110b0b1009700b1a2de769a6980a28b272a66f6590ba9d9fb4657a7ddcbd16e"],"level/theme.dungeon/false":[5,"12024b168c9d7ce4973d819b76a9d7fad8afe2979f4b38b1d0e8d4e10d88f8cc"],"level/theme.ruins/true":[83,"fcfa117baa0d2224b43ff25176df66d45606feee2acb3efa54e8ef4cc5e9a1fb"],"level/theme.ruins/false":[4,"1b02a40e88915bb47966b8263f85f8516b405c3083ff61bd1521f872d1ef6014"],"level/theme.cave/true":[83,"32387bbbf7c12cfc36af24e7c7ffcf6631bbe4ecfa1d4bb586a9378d3fd5c1f7"],"level/theme.cave/false":[4,"776b7424ca0aeba13b817f88169aa841a5337791aea21b70631847705db9ceef"],"level/theme.forest/true":[84,"975ca60d8b7686939de55a4768561065cc469cda55676b60849193e255f0c50d"],"level/theme.forest/false":[5,"bc1faf76500ce52585b7989c6f423803855bacb4c5a520303b71b049337b5680"],"level/theme.sky/true":[83,"d413ebdd65c45b6a0f15978cb27ef185801a528149a28cbd77b75bde1ca8e5bd"],"level/theme.sky/false":[4,"4e8ec93fdf3843b7aa82b1e0792021a7a4a428db46fbe5dcbff4752fa0f73b86"],"level/theme.cosmos/true":[82,"689ba013ee9d054c4a3eafa8716e70e61ec3e46aaf2a567afd7902b148ca262c"],"level/theme.cosmos/false":[3,"d40996ca3797d409cede7fba837c92fbcbdd68794e6edae7b1a588318cde93af"],"level/characters/true":[13,"670f0fc7aa88054f4186d0c6bccb75440f8111a3dd88b693365362e319b75e93"],"level/characters/false":[13,"670f0fc7aa88054f4186d0c6bccb75440f8111a3dd88b693365362e319b75e93"],"level/items/true":[17,"f11b7337ca8dba5f7e44cd4c54bc479c12a27e5f37d321b71072df5b54a245c0"],"level/items/false":[17,"f11b7337ca8dba5f7e44cd4c54bc479c12a27e5f37d321b71072df5b54a245c0"],"level/mechanisms/true":[35,"1d440248f4949eb3cab8429b7450c6e75d5261cdacfb4c43eb7cf192ccd90f6a"],"level/mechanisms/false":[35,"1d440248f4949eb3cab8429b7450c6e75d5261cdacfb4c43eb7cf192ccd90f6a"],"level/screens/true":[36,"d891ff45ac31e264227594b2ab839aec0895df6f7d65c9612cc2915acab620a5"],"level/screens/false":[36,"d891ff45ac31e264227594b2ab839aec0895df6f7d65c9612cc2915acab620a5"],"delivery/all/true":[279,"471bb18eaaea4ad441148d71809251e2d00080bc3ed093bce656e66fc44b4517"],"delivery/all/false":[279,"471bb18eaaea4ad441148d71809251e2d00080bc3ed093bce656e66fc44b4517"],"delivery/theme.dungeon/true":[184,"c15f9141c9c84c6a5a36d4a1227cd49250b672a80b8c9020ddffe2c5dbb0c4c7"],"delivery/theme.dungeon/false":[16,"9a2bdf6a12cd9137cdab2c1198647d40fef69301e6c2744186e44b79883ec42d"],"delivery/theme.diyu/true":[193,"2b42fb620f83548a075a1e6beadfdf942f80ea847528737be5003aec20c7dcc7"],"delivery/theme.diyu/false":[25,"ea926b12a4d1928d62ff2944c24cd7f4b5212ae762fc684a580df37a670553bd"],"delivery/theme.jeju/true":[188,"9f668af34fdbb908eeb0e74215055189f36088d047ee4534cb7e5d81ad090ac0"],"delivery/theme.jeju/false":[20,"6d6dbd076383ab636d65759fe6f6016a3d2c8fef2d573e487bcac08dca02304c"],"delivery/theme.polar/true":[186,"b85f15d9d12a51d12a957c38f6e2cbbeb50176592e00c9b12a46c6f371a6a11b"],"delivery/theme.polar/false":[18,"3e230fbd66e5e8d040a25bccac8699c63482cf720840cf89c11080b08e4be1d0"],"delivery/theme.candy/true":[188,"8eba69eada694a44dc7ff42e748c3dc261c1d1619bf670748931f96201b9072b"],"delivery/theme.candy/false":[20,"0f4f5a6f20a0085c4f0d20c4cd3e73a2c610cbbbdc14685dc12dfc71b6074a5f"],"delivery/characters/true":[90,"fb068befc5e9c9e84ef84d64b4850ec7cc659e10227fe0daecc0ec01fbf1d496"],"delivery/characters/false":[90,"fb068befc5e9c9e84ef84d64b4850ec7cc659e10227fe0daecc0ec01fbf1d496"],"delivery/items/true":[79,"13f46287f561038944b863f9f2e900f165250c9c761cf03b25d912a5c6dc81c9"],"delivery/items/false":[79,"13f46287f561038944b863f9f2e900f165250c9c761cf03b25d912a5c6dc81c9"],"delivery/mechanisms/true":[44,"783a805598dc85e164e27a40aebb85cf61a2b3536e8138a975667c4c86ff2192"],"delivery/mechanisms/false":[44,"783a805598dc85e164e27a40aebb85cf61a2b3536e8138a975667c4c86ff2192"],"delivery/screens/true":[55,"6e0ee89c0e47b5711fd5ced40cab8f86d9ed9fee9f7f2eaf5d85a0d412269ef7"],"delivery/screens/false":[55,"6e0ee89c0e47b5711fd5ced40cab8f86d9ed9fee9f7f2eaf5d85a0d412269ef7"],"delivery/hub/true":[37,"bf8eef337cbcdc317fbe3c53a55b44c4da7e248025afe8be932143039d3c2148"],"delivery/hub/false":[37,"bf8eef337cbcdc317fbe3c53a55b44c4da7e248025afe8be932143039d3c2148"]};
  const hashes=await page.evaluate(()=>{const out={};for(const mode of ['all','level','delivery']){const groups=mode==='all'?[{id:'all'}]:PBModeCatalog.sections(mode,PBStore.assets()).filter(s=>s.id!=='sounds');for(const s of groups)for(const shared of (mode==='all'?[true]:[true,false])){const filter={mode,shared};if(s.id.startsWith('theme.'))filter.theme=s.id.slice(6);else filter.group=s.id;out[mode==='all'?'all':mode+'/'+s.id+'/'+shared]=PBModeCatalog.library(PBStore.assets(),filter).map(a=>a.id).sort();}}return out;});
  for(const [key,[count,hash]] of Object.entries(baseline)){assert.equal(hashes[key].length,count,key+' count');assert.equal(require('crypto').createHash('sha256').update(JSON.stringify(hashes[key])).digest('hex'),hash,key+' exact IDs');}
  const themeCases=await page.evaluate(()=>{const all=PBStore.assets(),C=PBModeCatalog;return [...new Set(Object.values(C.MODES).flatMap(m=>m.themes))].flatMap(theme=>[true,false].map(shared=>({theme,shared,actual:C.library(all,{mode:'all',theme,shared}).map(a=>a.id).sort(),expected:[...new Set(Object.keys(C.MODES).filter(mode=>C.MODES[mode].themes.includes(theme)).flatMap(mode=>C.assets(mode,'theme.'+theme,all,{shared}).map(a=>a.id)))].sort()})));});
  for(const row of themeCases)assert.deepEqual(row.actual,row.expected,'all-mode '+row.theme+' shared='+row.shared+' supports only matching modes');
  for(const [key,[count,hash]] of Object.entries(baseline)){
    const [mode,section,shared]=key==='all'?['all','all','true']:key.split('/'),p=new URLSearchParams();
    if(mode!=='all')p.set('mode',mode);if(section.startsWith('theme.'))p.set('theme',section.slice(6));else if(section!=='all')p.set('group',section);if(shared==='false')p.set('shared','0');
    await page.goto(url+'#library'+(p.size?'?'+p:''));
    await page.waitForFunction(({count,mode,section,shared})=>document.querySelector('#asset-count').textContent===count+' 项'&&document.querySelector('[aria-label="模式"]').value===mode&&document.querySelector('[aria-label="主题"]').value===(section.startsWith('theme.')?section.slice(6):'all')&&document.querySelector('[aria-label="用途分组"]').value===(section.startsWith('theme.')?'all':section)&&document.querySelector('#library-filters input').checked===(shared==='true'),{count,mode,section,shared});
    const actual=await page.locator('#asset-cards .card:not([hidden])').evaluateAll(nodes=>nodes.map(n=>n.dataset.resourceId).sort());
    assert.equal(require('crypto').createHash('sha256').update(JSON.stringify(actual)).digest('hex'),hash,key+' rendered exact IDs');
  }
  await page.goto(url);assert.ok(await page.locator('#view-home').isVisible(),'home is default');
  assert.deepEqual(await page.locator('.home-batch').evaluateAll(nodes=>nodes.map(n=>n.dataset.approval)),await page.evaluate(()=>PBStore.approvals().slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3).map(b=>b.id)),'home recent batches are actual confirmation records');
  const recentRecord=await page.locator('.home-batch').first().getAttribute('data-approval');
  await page.locator('.home-batch').first().click();
  await page.waitForFunction(id=>document.getElementById('approval-'+id)?.open,recentRecord);
  assert.ok(await page.locator('details[id^="approval-"][open]').count());

  assert.deepEqual(await page.evaluate(()=>PBNav.MENU.map(m=>m.label)),['总览','资源库','场景与界面','确认','地图概念','声音','文档']);
  assert.equal(await page.locator('#nav a').count(),7);
  const routes=[['#level-art','#library?mode=level'],['#delivery-art','#library?mode=delivery'],['#assets','#library'],['#assets/char.portitor','#library?id=char.portitor'],['#edit','#edit'],['#edit/char.portitor','#edit/char.portitor'],['#export','#review/export'],['#ui-proposals','#scenes/screens'],['#concepts/cenote','#concepts/cenote'],['#audio/sfx','#audio/sfx'],['#audio/music','#audio/music'],['#audio/maps','#audio/maps']];
  for(const mode of ['level','delivery'])for(const s of await page.evaluate(mode=>PBModeCatalog.sections(mode,PBStore.assets()).filter(s=>s.id!=='all').map(s=>s.id),mode))routes.push(['#'+mode+'-art/'+s,'#library?mode='+mode+'&'+(s.startsWith('theme.')?'theme='+s.slice(6):'group='+s)]);
  for(const [old,next] of routes){await page.goto(url+old);await page.waitForFunction(hash=>location.hash===hash,next);assert.ok(await page.locator('main > section:not([hidden])').count()===1,old+' has one live destination');if(old.startsWith('#assets/'))assert.ok(await page.locator('#asset-inspector h2').isVisible());}
  await page.goto(url+'#library?mode=delivery&theme=diyu');
  assert.equal(await page.locator('#asset-cards [data-resource-id="char.yama"]:visible').count(),1);
  assert.equal(await page.locator('#asset-cards [data-resource-id="char.haenyeo"]:visible').count(),0);
  await page.getByLabel('包括通用资源',{exact:true}).uncheck();await page.waitForFunction(()=>location.hash.includes('shared=0')&&document.querySelector('#asset-count').textContent==='25 项');
  assert.equal(await page.locator('#asset-cards [data-resource-id="obj.crate_wood"]:visible').count(),0);
  await page.goto(url+'#library');await page.evaluate(()=>window.__card=document.querySelector('#asset-cards .card'));
  await page.getByLabel('搜索资产',{exact:true}).fill('ui.screen.run_door');await page.waitForFunction(()=>location.hash.includes('q=')&&document.querySelector('#asset-count').textContent==='2 项');
  assert.equal(await page.locator('#asset-cards .card:visible').count(),2);
  await page.goBack();await page.waitForFunction(()=>location.hash==='#library'&&document.querySelector('#asset-count').textContent==='304 项');
  assert.ok(await page.evaluate(()=>window.__card===document.querySelector('#asset-cards .card')),'URL filtering preserves PNG card identity');
  await page.goto(url+'#library?mode=delivery&status=draft');
  const draftIds=await page.locator('#asset-cards .card:visible').evaluateAll(cards=>cards.map(c=>c.dataset.resourceId));
  for(const a of JSON.parse(fs.readFileSync(path.join(ROOT,'art/review/OFFLINE-ART-20261020/receipt.json'))).assets.filter(a=>a.stage==='draft'))assert.ok(draftIds.includes(a.id),a.id+' draft discoverable');
  await page.goto(url+'#library?mode=delivery&group=hub');await page.locator('[data-resource-id="scene.hub_post"]').click();await page.locator('#asset-inspector').getByLabel('动画',{exact:true}).selectOption('after');
  for(const width of [1440,1280,1024,390]){await page.setViewportSize({width,height:900});for(const view of ['home','library','concepts']){await page.goto(url+'#'+view);await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),view+' fits '+width);if(width===1440&&view==='library')assert.ok(await page.locator('#asset-cards .card:visible').evaluateAll(cards=>cards.filter(c=>{const r=c.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;}).length)>=12,'12 fully visible cards');if(process.env.WB_EVIDENCE_DIR){const dir=path.join(process.env.WB_EVIDENCE_DIR,'screenshots');fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:path.join(dir,view+'-'+width+'.png')});}}}
  // WB-10 native procedural PNG geometry: independent of the sprite-only perf sample.
  const proceduralIds=await page.evaluate(()=>{const samples=new Map();for(const a of PBStore.assets())if(a.kind!=='sprite'&&!samples.has(a.category))samples.set(a.category,a.id);return [...samples.values()];});
  for(const width of [1440,1280,390]){
    await page.setViewportSize({width,height:900});await page.goto(url+'#library');
    for(const id of proceduralIds){
      const card=page.locator('#asset-cards [data-resource-id="'+id+'"]');await card.scrollIntoViewIfNeeded();
      await card.locator('.asset-png-thumb img').waitFor();
      await page.waitForFunction(id=>{const image=document.querySelector('#asset-cards [data-resource-id="'+id+'"] img');return image&&image.complete&&image.naturalWidth>0;},id);
      const geometry=await card.evaluate(card=>{
        const wrapper=card.querySelector('.asset-png-thumb'),image=wrapper.querySelector('img'),frame=card.querySelector('.thumb');
        const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
        const outer=rect(card),view=rect(frame),png=rect(wrapper),pixels=rect(image),style=getComputedStyle(card);
        const inner={left:outer.left+parseFloat(style.borderLeftWidth)+parseFloat(style.paddingLeft),right:outer.right-parseFloat(style.borderRightWidth)-parseFloat(style.paddingRight)};
        return {png,pixels,native:[image.naturalWidth,image.naturalHeight],view,outer,inner,viewport:innerWidth};
      });
      const tag=id+' at '+width+' '+JSON.stringify(geometry);
      assert.deepEqual(geometry.native,[320,180],'procedural preview PNG has native 320x180 pixels: '+tag);
      assert.ok(Math.abs(geometry.png.width-320)<0.5&&Math.abs(geometry.png.height-180)<0.5,'procedural wrapper renders native 320x180 at 1x: '+tag);
      assert.ok(Math.abs(geometry.pixels.width-320)<0.5&&Math.abs(geometry.pixels.height-180)<0.5,'procedural PNG image renders native 320x180 at 1x: '+tag);
      assert.ok(geometry.png.left>=geometry.view.left-0.5&&geometry.png.right<=geometry.view.right+0.5&&geometry.png.top>=geometry.view.top-0.5&&geometry.png.bottom<=geometry.view.bottom+0.5,'procedural PNG is not clipped by thumbnail frame: '+tag);
      assert.ok(geometry.png.left>=geometry.inner.left-0.5&&geometry.png.right<=geometry.inner.right+0.5,'span-two card content accommodates 320 pixels and its own padding: '+tag);
      assert.ok(geometry.outer.left>=-0.5&&geometry.outer.right<=geometry.viewport+0.5,'large card fits viewport without horizontal clipping: '+tag);
    }
  }
  await page.setViewportSize({width:1280,height:800});await page.goto(url+'#concepts');const text=page.locator('#concept-text-only');assert.equal(await text.getAttribute('open'),null);const allCount=await page.locator('.concept-card').count();await page.getByLabel('完整度',{exact:true}).selectOption('scene');assert.ok(await page.locator('.concept-card:visible').count()<allCount);await page.getByLabel('完整度',{exact:true}).selectOption('all');
  await page.goto(url+'#delivery-art/sounds');assert.equal(await page.evaluate(()=>PBWBAudio.player.snapshot().sfx.length),0,'mode sounds do not autoplay');assert.equal(await page.locator('[data-sound-id="sfx:delivery_arrive"]').count(),1);await page.locator('#delivery-art-root [data-preview-sound="sfx:push"]').click();await page.waitForFunction(()=>document.querySelector('[data-mode-audio-status="delivery"]').textContent.includes('已试听：'));await page.locator('#delivery-art-root [data-preview-sound="sfx:reel_spin"]').click();await page.waitForFunction(()=>PBWBAudio.player.snapshot().sfx.some(v=>v.uid==='sfx:reel_spin'));await page.goto(url+'#library');await page.waitForFunction(()=>PBWBAudio.player.snapshot().sfx.length===0);
  check(true,'WB-10 baseline IDs, six entries, legacy routes, URL filters, compact PNG cards and concept wall');
}

// WB-11 screens share one inventory across list, details and SVG; no new renderer loop.
async function screensRegression(page,url){
  const go=async hash=>{await page.goto(url+hash);await page.waitForTimeout(120);};
  const shot=async name=>{if(process.env.WB_EVIDENCE_DIR){const dir=path.join(process.env.WB_EVIDENCE_DIR,'screenshots');fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:path.join(dir,name+'.png')});}};
  await go('#scenes');assert.ok(await page.locator('#view-screens').isVisible(),'screen inventory is default scenes tab');
  assert.equal(await page.locator('[data-screen-row]').count(),await page.evaluate(()=>PB_SCREENS.screens.length));
  assert.equal(await page.locator('#screen-list canvas').count(),0,'screen list has no live canvases');await shot('screens-inventory');
  await page.getByLabel('搜索界面',{exact:true}).fill('lobby');assert.equal(await page.locator('[data-screen-row]:visible').count(),2);assert.deepEqual(await page.locator('[data-screen-row]:visible').evaluateAll(nodes=>nodes.map(n=>n.dataset.screenRow).sort()),['lobby','lobby_modes']);
  await go('#screen/lobby');assert.ok(await page.locator('#screen-stage canvas').isVisible());assert.equal(await page.locator('#screen-outgoing li').count(),5);await shot('screens-single');
  await page.getByLabel('画面变体',{exact:true}).selectOption('ui.screen.lobby_story');assert.ok((await page.locator('#screen-variant-note').innerText()).includes('主图'));
  const variant=await page.getByLabel('画面变体',{exact:true}).inputValue();assert.equal(variant,'ui.screen.lobby_story');
  await page.locator('#screen-progress [data-step="godot"]').click();assert.ok(await page.locator('#screen-coverage').isVisible());assert.ok((await page.locator('#screen-coverage').innerText()).includes('没有条目'));
  await go('#screen/hint');await page.locator('#screen-stage').getByRole('button',{name:'暂停',exact:true}).click();
  const hintPixels=[];
  for(const tier of ['0','1','2']){await page.getByLabel('提示级别',{exact:true}).selectOption(tier);hintPixels.push(await page.locator('#screen-stage canvas').evaluate(c=>c.toDataURL()));if(process.env.WB_EVIDENCE_DIR){await page.locator('#screen-stage canvas').screenshot({path:path.join(process.env.WB_EVIDENCE_DIR,'screenshots','hint-tier-'+(Number(tier)+1)+'.png')});}}
  assert.equal(new Set(hintPixels).size,3,'paused tier selection changes existing renderer pixels instead of retaining fixed params.level=3');
  // The logical levels screen must preserve the existing scenes preview's fifth-row focus.
  // Capture only the public stage API in this browser; no production test hooks are added.
  await page.evaluate(()=>{
    window.__wb11StageCreate=PBStage.create;
    PBStage.create=function(host,options){const stage=window.__wb11StageCreate(host,options);if(host.id==='screen-stage')window.__wb11ScreenStage=stage;return stage;};
    location.hash='#screen/levels';
  });
  try {
    await page.waitForFunction(()=>location.hash==='#screen/levels'&&!!window.__wb11ScreenStage);
    const canonicalLevels=await page.evaluate(()=>{
      window.__wb11ScreenStage.setTick(0);
      const r=new PB.Raster(320,180);
      PB.ui.render(r,PBStore.asset('ui.screen.levels'),0,{focus:4,specs:Object.fromEntries(PBStore.levels().map(l=>[l.id,l])),levelSpec:PBStore.level('M05'),ruleSpec:PBStore.level('M03'),animate:true});
      const actual=document.querySelector('#screen-stage canvas').getContext('2d').getImageData(0,0,320,180).data;
      return actual.every((value,index)=>value===r.data[index]);
    });
    assert.ok(canonicalLevels,'#screen/levels frozen-tick pixels preserve canonical focus4 selected row and its measured Enter hotspot');
  } finally {
    await page.evaluate(()=>{PBStage.create=window.__wb11StageCreate;delete window.__wb11StageCreate;delete window.__wb11ScreenStage;});
  }
  await go('#scenes/flow');assert.equal(await page.locator('#screen-flow svg [data-screen-node]').count(),await page.evaluate(()=>PB_SCREENS.screens.length));
  assert.equal(await page.locator('#screen-flow svg path[data-transition]').count(),await page.evaluate(()=>PB_SCREENS.screens.reduce((n,s)=>n+s.transitions.length,0)));await shot('screens-flow');
  await page.locator('#screen-flow [data-screen-node="pause"]').click();await page.waitForFunction(()=>location.hash==='#screen/pause');
  await go('#library?id=ui.screen.pause_help');await page.getByRole('link',{name:'在界面清单中打开',exact:true}).click();await page.waitForFunction(()=>location.hash==='#screen/pause');
  for(const width of [1280,390]){await page.setViewportSize({width,height:800});await go('#screen/pause');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'screen detail fits '+width);await go('#scenes');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'screen list fits '+width);}
  await page.setViewportSize({width:1280,height:800});
  await go('#home');const text=await page.locator('#home-root').innerText();const totals=await page.evaluate(()=>PB_SCREENS.totals);assert.ok(text.includes('Godot 未实现的界面 '+(totals.pages-totals.implemented)+' 个'));assert.ok(text.includes('游戏未接入 '+totals.not_yet+' 个'));
}

// WB-15: offline bundled documents, safe internal navigation and static image previews.
async function docsRegression(page,url){
  const go=async hash=>{await page.goto(url+hash);await page.locator('#docs-article h1').waitFor();};
  const shot=async name=>{if(process.env.WB_EVIDENCE_DIR){const dir=path.join(process.env.WB_EVIDENCE_DIR,'screenshots');fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:path.join(dir,name+'.png')});}};
  await page.setViewportSize({width:1280,height:800});
  await page.goto(url+'#home');
  const count=await page.evaluate(()=>PB_DOCS.docs.length);
  assert.ok((await page.locator('#home-root').innerText()).includes('设计文档 '+count+' 份'),'home counts bundled design documents');
  await page.locator('#home-root').getByRole('link',{name:'文档',exact:true}).click();
  await page.locator('#docs-article h1').waitFor();
  assert.equal(await page.locator('#nav a[aria-current="page"]').innerText(),'文档');
  assert.equal(await page.locator('#docs-list [data-doc-path]').count(),count,'directory lists every bundled document');
  for(const file of ['art-direction.md','art-pipeline.md','audio.md','ui-style.md','workbench.md']){
    const source=fs.readFileSync(path.join(ROOT,'docs/design',file),'utf8');
    await go('#docs/design/'+file);
    assert.equal(await page.locator('#docs-article').getAttribute('data-doc-path'),'docs/design/'+file);
    assert.equal(await page.locator('#docs-article h1').first().innerText(),source.match(/^# (.+)$/m)[1]);
    assert.ok(await page.locator('#docs-toc a').count()>1,file+' includes a section directory');
  }
  await go('#docs/design/art-direction.md');
  await shot('docs-directory-and-body');
  assert.ok(await page.locator('#docs-article table').count()>0,'Markdown tables appear in document');
  await page.locator('#docs-article table').first().scrollIntoViewIfNeeded();
  await shot('docs-table');
  const section=await page.locator('#docs-toc a').nth(1).getAttribute('href');
  await page.evaluate(()=>{window.__wb15Article=document.querySelector('#docs-article').firstElementChild;});
  await page.locator('#docs-toc a').nth(1).click();
  await page.waitForFunction(hash=>decodeURIComponent(location.hash)===hash,decodeURIComponent(section));
  assert.equal(await page.locator('#docs-article h1').first().innerText(),'美术规范（AD-1）','section route preserves whole current document');
  assert.ok(await page.evaluate(()=>window.__wb15Article===document.querySelector('#docs-article').firstElementChild),'section jump retains rendered document nodes');
  await page.locator('#docs-article').getByRole('link',{name:'美术流程',exact:true}).click();
  await page.waitForFunction(()=>location.hash==='#docs/design/art-pipeline.md');
  assert.equal(await page.locator('#docs-article h1').first().innerText(),'美术流程：源数据、版本、确认与交付');
  await go('#docs/design/ui-style.md');
  const image=page.locator('#docs-article img[src*="ui-style/lobby/overview.png"]').first();
  await image.scrollIntoViewIfNeeded();
  const imageState=await image.evaluate(async node=>{await node.decode();return {width:node.naturalWidth,height:node.naturalHeight,pixels:getComputedStyle(node).imageRendering};});
  assert.ok(imageState.width>0&&imageState.height>0,'ui-style repository image actually decodes');
  assert.equal(imageState.pixels,'pixelated');
  await shot('docs-image');
  await image.click();assert.ok(await page.locator('#docs-lightbox[open] img').isVisible(),'document image opens a large preview');
  await page.getByRole('button',{name:'关闭文档大图',exact:true}).click();
  assert.ok(await image.evaluate(node=>document.activeElement===node.closest('button')),'closing image restores its preview button focus');
  const search=page.getByRole('searchbox',{name:'搜索文档',exact:true});
  await search.fill('调色板');
  assert.ok(await search.evaluate(node=>document.activeElement===node),'document search keeps focus '+JSON.stringify(await page.evaluate(()=>({active:document.activeElement?.outerHTML,dialog:document.querySelector('#docs-lightbox')?.open}))));
  assert.ok(await page.locator('#docs-list [data-doc-path="docs/design/art-direction.md"]').isVisible(),'body search finds the art direction');
  assert.ok((await page.locator('#docs-list').innerText()).includes('调色板'),'body search shows a matching snippet');
  await shot('docs-search');
  await page.locator('#docs-list [data-doc-path="docs/design/art-direction.md"]').click();
  await page.waitForFunction(()=>location.hash==='#docs/design/art-direction.md');
  assert.equal(await search.inputValue(),'调色板','opening search result preserves the current query');
  for(const width of [1280,390]){
    await page.setViewportSize({width,height:800});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'documents fit '+width);
  }
  const oldScroll=await page.evaluate(()=>{
    const readers=[document.querySelector('main'),document.getElementById('view-docs')];
    for(const node of readers)node.scrollTop=node.scrollHeight;
    const old=Math.max(...readers.map(node=>node.scrollTop));location.hash='#docs/design/art-pipeline.md';return old;
  });
  await page.waitForFunction(()=>document.getElementById('docs-article').dataset.docPath==='docs/design/art-pipeline.md');
  assert.ok(oldScroll>0,'narrow document has a real outer scrolling position');
  assert.ok(await page.evaluate(()=>document.querySelector('main').scrollTop===0&&document.getElementById('view-docs').scrollTop===0),'opening another document resets narrow reader scroll');
  await page.setViewportSize({width:1280,height:800});
  console.log('WB-15 document directory, five bodies, sections, image decode, links and body search passed');
}

// WB-16: real inventory states, symbols, sources, and preview placeholder.
async function backlogRegression(page,url){
 const shot=async name=>{if(process.env.WB_EVIDENCE_DIR){const dir=path.join(process.env.WB_EVIDENCE_DIR,'screenshots');fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:path.join(dir,name+'.png')});}};
 await page.setViewportSize({width:1280,height:1000});await page.goto(url+'#scenes');await page.waitForSelector('#screen-backlog');
 const pending=await page.evaluate(()=>PB_SCREENS.screens.filter(s=>s.art===null));assert.equal(pending.length,6);
 assert.equal(await page.locator('#screen-list tbody').first().getAttribute('id'),'screen-backlog');assert.ok((await page.locator('#screen-backlog').innerText()).includes('待设计（6）'));
 for(const s of pending){const row=page.locator('[data-screen-row="'+s.id+'"]');assert.equal(await row.locator('[data-step]').count(),5);assert.equal(await row.locator('[data-step="design"]').getAttribute('data-state'),'missing');assert.equal(await row.locator('[data-state="pending"]').count(),4);assert.ok((await row.innerText()).includes(s.notes));}
 for(const theme of ['light','dark']){await page.locator('#appearance').selectOption(theme);const legend=await page.locator('#screen-progress-legend .screen-step').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent,color:getComputedStyle(n).color})));assert.equal(legend.length,4);assert.equal(new Set(legend.map(n=>n.color)).size,4,'four legible state colors '+theme);assert.ok(legend.some(n=>n.text.includes('✓'))&&legend.some(n=>n.text.includes('◐'))&&legend.some(n=>n.text.includes('○'))&&legend.some(n=>n.text.includes('!')));await shot('backlog-'+theme);}
 assert.equal(await page.locator('[data-screen-row="play"] [data-step="game"]').getAttribute('data-state'),'partial');assert.ok((await page.locator('[data-screen-row="play"] [data-game="frozen_v1"]').innerText()).includes('v1 已冻结'));
 await page.goto(url+'#home');const totals=await page.evaluate(()=>PB_SCREENS.totals),text=await page.locator('#home-root').innerText();for(const part of ['待设计 '+totals.missing_design+' 个','Godot 未实现的界面 '+(totals.pages-totals.implemented)+' 个','游戏未接入 '+totals.not_yet+' 个','v1 已冻结 '+totals.frozen_v1+' 个'])assert.ok(text.includes(part),part);await shot('home-gaps');
 await page.goto(url+'#scenes/play/new_controls');const frame=page.frameLocator('#embedded-play');await frame.locator('#play-placeholder').waitFor();assert.ok((await frame.locator('#play-placeholder').innerText()).includes('来源：docs/design/gameplay/README.md'));await shot('backlog-placeholder');
 await page.locator('#appearance').selectOption('light');await page.setViewportSize({width:1280,height:800});
}
