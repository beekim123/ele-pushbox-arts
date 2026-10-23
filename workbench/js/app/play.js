/* Public screen-flow preview. This is a design model, not the playable SDK. */
(function(root){
 'use strict';
 const el=root.PBStage.el,store=root.PBStore,pages=root.PB_SCREENS.screens;
 const host=document.getElementById('play-stage'),info=document.getElementById('play-info'),placeholder=document.getElementById('play-placeholder'),notice=document.getElementById('play-notice');
 const opposite={'有上次关卡':'没有上次关卡','有没看过的规则':'没有没看过的规则','还有规则卡':'没有更多规则卡','有下一关':'没有下一关'};
 const transitions=s=>[s?.transitions||[],...Object.values(s?.variantTransitions||{})].flat();
 const conditions=Object.fromEntries(pages.flatMap(s=>transitions(s).map(t=>t.when)).filter(w=>w&&!w.startsWith('第 ')&&w!=='关卡完成').map(w=>[w,['没有上次关卡','没有没看过的规则','没有更多规则卡','有下一关','章节已开放','所选教学已开放'].includes(w)]));
 const embedded=new URLSearchParams(location.search).get('embed')==='1',gallery=document.getElementById('play-gallery'),back=document.getElementById('play-return'),fullscreen=document.getElementById('play-fullscreen'),galleryBack=document.getElementById('play-gallery-back');
 const galleryFlows=['配送一局','剧情','伙计'];
 let stage=null,route=null,trail=[],noticeTimer=0;
 function groupOf(s){return s?.game==='not_yet'&&!galleryFlows.includes(s.flow)?'配送一局':s?.flow;}
 function galleryFlow(){const s=screen();return s?.game==='not_yet'||route.mode==='delivery'&&galleryFlows.includes(groupOf(s))?groupOf(s):route.art?(route.art.includes('story')?'剧情':route.art.includes('crew')?'伙计':'配送一局'):null;}
 function large(){return !!galleryFlow()&&route.large;}
 function openPainting(s,art){trail.push({...route});route={id:s.id,focus:s.id===route.id?route.focus:0,tier:1,mode:'delivery',art:art||null,large:true};save(false);show();}
 function showWall(){
  gallery.replaceChildren(el('h1',{text:galleryFlow()+' · 缩略图墙'}));
  const list=el('div',{class:'play-gallery-grid'}),rows=pages.filter(s=>groupOf(s)===galleryFlow());
  if(route.art&&!rows.some(s=>s.id===route.id))rows.unshift(screen());
  for(const s of rows){const art=s.id===route.id&&route.art?route.art:s.art;
   list.append(el('button',{type:'button','data-gallery-page':s.id,onclick:()=>openPainting(s,art===s.art?null:art)},[el('img',{src:'../art/export/preview/'+art+'.png',alt:'',width:320,height:180,loading:'lazy',decoding:'async'}),el('span',{text:s.name})]));
  }gallery.append(list);
 }
 galleryBack.addEventListener('click',()=>{route.large=false;save(false);show();});
 // Return/fullscreen are mouse actions: Enter, Space and game keys never activate them.
 for(const link of [back,fullscreen])link.addEventListener('click',e=>{if(e.detail===0)e.preventDefault();});
 function screen(){return pages.find(s=>s.id===route.id);}
 function variant(s,art){return s?.variants.includes(art)&&Array.isArray(s.variantTransitions?.[art])?art:null;}
 function asset(){const a=store.asset(route.art||screen()?.art);return a&&root.PB.ui.SCREENS[a.params.screen]?a:null;}
 function currentTransitions(){if(galleryFlow())return [];const s=screen();return route.art?s?.variantTransitions?.[route.art]||[]:s?.transitions||[];}
 function count(){const p=asset()?.params||{};if(route.id==='hint')return route.tier===3?2:1;if(route.id==='complete')return 2;if(route.id==='settings')return Math.max(1,(p.items||[]).filter(x=>x.key!=='settings.ui_style').length);if(route.id==='delivery_help')return Math.max(1,(p.maps||[]).flatMap(m=>m.rooms||[]).length);if(route.id==='delivery_assist')return 3;if(['reels','run_wish_card'].includes(route.id))return 3;return Math.max(1,(p.chapters||p.levels||p.items||p.orders||p.crew||p.goods||[]).length,...currentTransitions().map(t=>t.focus===undefined?1:t.focus+1));}
 function parse(){const [id,query='']=decodeURIComponent(location.hash.slice(1)||'lobby').split('?'),p=new URLSearchParams(query),s=pages.find(s=>s.id===id),mode=['lab','delivery'].includes(p.get('mode'))?p.get('mode'):null,art=mode?variant(s,p.get('art')):null;return{id:s||id==='@quit'?id:'lobby',focus:Math.max(0,Number(p.get('focus'))|0),tier:Math.max(1,Math.min(3,Number(p.get('tier'))||1)),mode:id==='lobby'&&!art?'lab':s?.game==='not_yet'||art?'delivery':mode||'lab',art,large:p.get('view')==='large'};}
 function url(r){const p=new URLSearchParams({focus:String(r.focus)});if(r.id==='hint')p.set('tier',String(r.tier));if(r.mode==='delivery'||r.art)p.set('mode',r.mode||'lab');if(r.art)p.set('art',r.art);if(r.large)p.set('view','large');return'#'+r.id+'?'+p;}
 function save(replace){history[replace?'replaceState':'pushState']({pbPlay:true,route:{...route},trail:trail.map(x=>({...x}))},'',url(route));}
 function allowed(t){if(!t.when)return true;if(t.when==='第 1 级')return true;if(t.when==='第 1–2 级')return route.tier<3;if(t.when==='第 3 级')return route.tier===3;if(t.when==='关卡完成')return false;return !!conditions[t.when];}
 function enabled(){return currentTransitions().filter(allowed);}
 function updateFocus(f){route.focus=((f%count())+count())%count();save(false);stage?.refresh();sync();}
 function show(){
  if(stage){stage.destroy();stage=null;}
  route.focus=Math.min(route.focus,count()-1);const s=screen(),a=asset(),wall=!!galleryFlow()&&!large();
  host.hidden=wall;gallery.hidden=!wall;galleryBack.hidden=!large();
  placeholder.hidden=true;notice.hidden=true;clearTimeout(noticeTimer);
  if(wall){host.replaceChildren();showWall();save(true);sync();return;}
  placeholder.hidden=!!a&&route.id!=='@quit';
  placeholder.textContent=route.id==='@quit'?'已退出（预览） · 按 Enter 回大厅':'此页还没画：'+(s?.name||route.id)+'（'+route.id+'）';
  const fps=route.id==='delivery_help'?0.5:s?.game==='not_yet'?(['reels','settlement'].includes(route.id)?2:1):['chapters','pause','rulecard','complete','settings','controls'].includes(route.id)?2:4;
  stage=root.PBStage.create(host,{width:320,height:180,animated:!!a,autoplay:true,fps,controls:false,keyboard:false,fitWindow:true,label:s?.name||'已退出（预览）',draw:(r,tick)=>{if(a)root.PBScreenRenderer.draw(r,s,a,tick,{interactive:true,model:true,focus:route.focus,hintTier:route.tier});}});
  save(true);sync();
 }
 function go(id,options={}){const art=variant(pages.find(s=>s.id===id),options.art),mode=id==='lobby'&&!art?'lab':art||pages.find(s=>s.id===id)?.game==='not_yet'?'delivery':['lab','delivery'].includes(options.mode)?options.mode:route.mode||'lab';if(id===route.id&&mode===route.mode&&art===route.art){stage?.refresh();sync();return;}trail.push({...route});route={id,focus:0,tier:1,mode,art,large:false};save(false);show();}
 function toast(text){notice.textContent=text;notice.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{notice.hidden=true;},1400);}
 function apply(t){
  if(!t)return;
  if(t.focus!==undefined&&route.focus!==t.focus){route.focus=t.focus;save(true);}
  if(route.id==='play'&&['Z','R'].includes(t.key)){toast('预览不能真的玩');stage.refresh();return;}
  if(t.to==='@return'){route=trail.pop()||{id:'lobby',focus:0,tier:1,art:null};save(false);show();}
  else if(t.to==='@quit')go('@quit');
  else if(t.to==='@stay'){
   if(route.id==='hint'&&t.when==='第 1–2 级'){route.tier=Math.min(3,route.tier+1);route.focus=0;save(false);}
   if(t.notes?.includes('待定'))toast(t.notes);
   stage.refresh();sync();
  }else go(t.to,t);
 }
 function command(key){
  if(galleryFlow())return;
  if(route.id==='@quit'){if(key==='Enter')go('lobby');return;}
  if(!asset()&&key==='Esc'){route=trail.pop()||{id:'lobby',focus:0,tier:1,art:null};save(false);show();return;}
  if(key==='C'&&route.id==='play'){apply(screen().transitions.find(t=>!t.key&&t.to==='complete'));return;}
  if(key==='C'&&route.mode==='delivery'&&route.id==='delivery_hud'){go('settlement');return;}
  const candidates=enabled().filter(t=>t.key===key),t=candidates.find(t=>t.focus===undefined||t.focus===route.focus)||(key!=='Enter'&&candidates.length===1?candidates[0]:null);
  if(key.startsWith('Arrow')){
   const d=key==='ArrowUp'||key==='ArrowLeft'?-1:1;
   if((route.id==='settings'||route.id==='delivery_assist')&&(key==='ArrowLeft'||key==='ArrowRight')){apply(t);return;}
   updateFocus(route.focus+d);if(t?.to==='@stay')apply(t);return;
  }
  apply(t);
 }
 function sync(){
  document.body.dataset.page=route.id;document.body.dataset.focus=String(route.focus);document.body.dataset.tier=String(route.tier);document.body.dataset.mode=route.mode||'lab';document.body.dataset.art=route.art||screen()?.art||'';
  document.body.dataset.embed=String(embedded);
  document.body.dataset.presentation=galleryFlow()?(large()?'large':'wall'):'interactive';
  back.hidden=embedded;back.href='index.html'+(screen()? '#screen/'+route.id:'#scenes');
  fullscreen.hidden=!embedded;fullscreen.href='play.html'+url(route);
  if(embedded&&root.parent!==root)root.parent.postMessage({type:'pb-play-page',id:route.id,art:route.art||screen()?.art||null},'*');
  if(info.hidden)return;
  const s=screen();info.replaceChildren(el('button',{type:'button',text:'关闭信息（I）',onclick:()=>{info.hidden=true;stage?.frame.focus();}}),el('h1',{text:(s?.name||'已退出（预览）')+' · '+route.id}),el('p',{text:(route.mode==='delivery'?'配送':'关卡')+'模式 · 公开示例设计模型；局内不能真正游玩。'}));
  const progress=el('div',{class:'progress','aria-label':'五步进度'}),steps=route.art?{design:s?.steps?.design,...s?.variantsProgress?.find(v=>v.art===route.art)?.steps}:s?.steps||{};
  for(const [id,label,done]of [['design','设计',steps.design],['html','HTML 画面',steps.html],['approved','用户确认',steps.approved],['godot','Godot',steps.godot==='implemented'],['game',route.art&&steps.game===undefined?'游戏接入（未登记）':'游戏接入',steps.game]])progress.append(el('span',{'data-step':id,class:done?'done':'pending',text:(done?'● ':'○ ')+label}));
  info.append(progress,el('h2',{text:'本页按键'}),el('p',{text:galleryFlow()?'点缩略图查看大图 · I 信息':[...new Set(enabled().map(t=>t.key||'C（模拟过关）'))].join(' · ')+(count()>1?' · 方向键 / WASD 移焦点':'')+' · I 信息'}),el('p',{},[el('a',{href:'index.html#screen/'+route.id,text:'在工作台打开'})]),el('p',{text:'焦点 '+route.focus+(route.id==='hint'?' · 提示 '+route.tier+'/3':'')}));
  if(route.id==='lobby'&&s.variantTransitions){const select=el('select',{'aria-label':'大厅画面',onchange:()=>go('lobby',{mode:select.value===s.art?'lab':route.mode||'lab',art:select.value})});for(const art of [s.art,...Object.keys(s.variantTransitions)])select.append(el('option',{value:art,text:(art===s.art?'主图 · ':'变体 · ')+(store.asset(art)?.name||art)}));select.value=route.art||s.art;info.append(el('label',{},['大厅画面 ',select]));}
  if(route.id==='hint'){
   const tier=el('select',{'aria-label':'提示级别',onchange:()=>{route.tier=Number(tier.value);route.focus=0;save(false);stage.refresh();sync();}});
   for(const n of [1,2,3])tier.append(el('option',{value:n,text:'第 '+n+' 级'}));tier.value=String(route.tier);info.append(el('label',{},['提示级别 ',tier]));
  }
  if(route.id==='play')info.append(el('button',{type:'button',text:'模拟过关（C）',onclick:()=>command('C')}));
  if(!galleryFlow()&&route.mode==='delivery'&&route.id==='delivery_hud')info.append(el('button',{type:'button',text:'模拟送达（C）',onclick:()=>command('C')}));
  const mode=el('select',{'aria-label':'预览模式',onchange:()=>go(mode.value==='delivery'?'reels':'lobby',{mode:mode.value})},[el('option',{value:'lab',text:'关卡'}),el('option',{value:'delivery',text:'配送 / 剧情 / 伙计'})]);mode.value=route.mode||'lab';info.append(el('label',{},['模式 ',mode]),el('h2',{text:'条件开关'}));
  const fields=el('fieldset');
  for(const when of [...new Set(currentTransitions().map(t=>t.when).filter(w=>w&&w in conditions))]){
   const input=el('input',{type:'checkbox',...(conditions[when]?{checked:true}:{}),onchange:()=>{conditions[when]=input.checked;for(const [yes,no]of Object.entries(opposite)){if(when===yes)conditions[no]=!input.checked;if(when===no)conditions[yes]=!input.checked;}sync();}});fields.append(el('label',{},[input,' '+when]));
  }
  if(!fields.childNodes.length)fields.append(el('p',{text:'本页无可切换条件。'}));info.append(fields);for(const text of [...new Set(currentTransitions().map(t=>t.notes).filter(Boolean))])info.append(el('p',{text}));info.append(el('h2',{text:'跳转历史'}));const historyList=el('ol');for(const r of [...trail,route])historyList.append(el('li',{text:(pages.find(s=>s.id===r.id)?.name||r.id)+'（'+r.id+'） · '+r.focus+' · '+(r.mode==='delivery'?'配送':'关卡')+(r.art?' · '+r.art:'')}));info.append(historyList);
 }
 root.addEventListener('keydown',e=>{
  const editing=e.target.closest('input,select,textarea,button,a');
  if(e.key.toLowerCase()==='i'&&!e.ctrlKey&&!e.metaKey&&!e.altKey) {e.preventDefault();e.stopPropagation();info.hidden=!info.hidden;sync();if(info.hidden)stage?.frame.focus();return;}
  if(editing||e.ctrlKey||e.metaKey||e.altKey||galleryFlow())return;
  const keys={w:'ArrowUp',a:'ArrowLeft',s:'ArrowDown',d:'ArrowRight',Escape:'Esc',' ':'Enter'},key=keys[e.key]||keys[e.key.toLowerCase()]||(e.key.length===1?e.key.toUpperCase():e.key);
  if(key==='Tab'){if(enabled().some(t=>t.key===key)&&!e.repeat)command(key);return;}
  if(['Q','1','2','3'].includes(key)&&!enabled().some(t=>t.key===key))return;
  if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','Esc','H','Z','R','C','Q','1','2','3'].includes(key))return;
  e.preventDefault();e.stopPropagation();if(!e.repeat)command(key);
 },true);
 function hit(e){if(!stage||galleryFlow())return;const b=stage.canvas.getBoundingClientRect(),x=(e.clientX-b.left)*320/b.width,y=(e.clientY-b.top)*180/b.height;return enabled().find(t=>{const h=t.hotspot;return h&&x>=h[0]&&y>=h[1]&&x<h[0]+h[2]&&y<h[1]+h[3];});}
 host.addEventListener('pointermove',e=>{const t=hit(e);host.style.cursor=t?'pointer':'default';if(t?.focus!==undefined&&t.focus!==route.focus)updateFocus(t.focus);});
 host.addEventListener('click',e=>{const t=hit(e);if(t){if(t.focus!==undefined)route.focus=t.focus;if(t.key?.startsWith('Arrow'))command(t.key);else apply(t);}stage?.frame.focus();});
 root.addEventListener('popstate',e=>{if(e.state?.pbPlay){route={...e.state.route};trail=e.state.trail.map(x=>({...x}));show();}});
 root.addEventListener('hashchange',()=>{const next=parse();if(url(next)===url(route))return;trail.push({...route});route=next;show();});
 root.addEventListener('pagehide',()=>{stage?.destroy();clearTimeout(noticeTimer);notice.hidden=true;});
 root.addEventListener('pageshow',e=>{if(e.persisted)show();});
 store.registerAll();route=parse();if(history.state?.pbPlay&&url(history.state.route)===url(route))trail=history.state.trail.map(x=>({...x}));show();
 root.PBPlay={stage:()=>stage};
})(window);
