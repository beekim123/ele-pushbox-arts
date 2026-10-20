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
  check(await page.locator('#view-scenes').isVisible(),'default opens art scenes');
  const groups=await page.evaluate(()=>PBNav.MENU.map(g=>g.label));
  assert.deepEqual(groups,['地图概念','美术','声音']);
  const pages=await page.evaluate(()=>PBNav.pages().map(p=>p.view));
  for(const view of pages){await page.goto(url+'#'+view);await page.waitForTimeout(120);check(await page.locator('#view-'+view).isVisible(),'menu '+view);}
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
  await page.goto(url+'#audio/sfx');await page.waitForTimeout(120);
  check((await page.locator('#audio-root').innerText()).includes('sfx:push'),'sound page lists effects');
  check(errors.length===0,'no browser errors'+(errors.length?': '+errors.join('; '):''));
  assert.equal(failures.length,0,failures.join('\n'));
  console.log('all public workbench smoke checks passed');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{if(browser) await browser.close();if(server) await new Promise(resolve=>server.close(resolve));});
