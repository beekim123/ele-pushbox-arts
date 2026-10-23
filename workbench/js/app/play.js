/* Public screen-flow preview. This is a design model, not the playable SDK. */
(function(root){
 'use strict';
 const el=root.PBStage.el,store=root.PBStore,pages=root.PB_SCREENS.screens;
 const host=document.getElementById('play-stage'),info=document.getElementById('play-info'),placeholder=document.getElementById('play-placeholder'),notice=document.getElementById('play-notice');
 const opposite={'有上次关卡':'没有上次关卡','有没看过的规则':'没有没看过的规则','还有规则卡':'没有更多规则卡','有下一关':'没有下一关'};
 const conditions=Object.fromEntries(pages.flatMap(s=>s.transitions.map(t=>t.when)).filter(w=>w&&!w.startsWith('第 ')&&w!=='关卡完成').map(w=>[w,['没有上次关卡','没有没看过的规则','没有更多规则卡','有下一关','章节已开放'].includes(w)]));
 let stage=null,route=null,trail=[],noticeTimer=0;
 function screen(){return pages.find(s=>s.id===route.id);}
 function asset(){const a=store.asset(screen()?.art);return a&&root.PB.ui.SCREENS[a.params.screen]?a:null;}
 function count(){const p=asset()?.params||{};if(route.id==='hint')return route.tier===3?2:1;if(route.id==='complete')return 2;if(route.id==='settings')return Math.max(1,(p.items||[]).filter(x=>x.key!=='settings.ui_style').length);return Math.max(1,(p.chapters||p.levels||p.items||[]).length);}
 function parse(){const [id,query='']=decodeURIComponent(location.hash.slice(1)||'lobby').split('?'),p=new URLSearchParams(query);return{id:pages.some(s=>s.id===id)||id==='@quit'?id:'lobby',focus:Math.max(0,Number(p.get('focus'))|0),tier:Math.max(1,Math.min(3,Number(p.get('tier'))||1)),art:null};}
 function url(r){const p=new URLSearchParams({focus:String(r.focus)});if(r.id==='hint')p.set('tier',String(r.tier));return'#'+r.id+'?'+p;}
 function save(replace){history[replace?'replaceState':'pushState']({pbPlay:true,route:{...route},trail:trail.map(x=>({...x}))},'',url(route));}
 function allowed(t){if(!t.when)return true;if(t.when==='第 1 级')return true;if(t.when==='第 1–2 级')return route.tier<3;if(t.when==='第 3 级')return route.tier===3;if(t.when==='关卡完成')return false;return !!conditions[t.when];}
 function enabled(){return(screen()?.transitions||[]).filter(allowed);}
 function updateFocus(f){route.focus=((f%count())+count())%count();save(false);stage?.refresh();sync();}
 function show(){
  if(stage){stage.destroy();stage=null;}
  route.focus=Math.min(route.focus,count()-1);const s=screen(),a=asset();
  placeholder.hidden=!!a&&route.id!=='@quit';
  placeholder.textContent=route.id==='@quit'?'已退出（预览） · 按 Enter 回大厅':'此页还没画：'+(s?.name||route.id)+'（'+route.id+'）';
  const fps=['chapters','pause','rulecard','complete','settings','controls'].includes(route.id)?2:4;
  stage=root.PBStage.create(host,{width:320,height:180,animated:!!a,autoplay:true,fps,controls:false,keyboard:false,fitWindow:true,label:s?.name||'已退出（预览）',draw:(r,tick)=>{if(a)root.PBScreenRenderer.draw(r,s,a,tick,{interactive:true,model:true,focus:route.focus,hintTier:route.tier});}});
  save(true);sync();
 }
 function go(id){if(id===route.id){stage?.refresh();sync();return;}trail.push({...route});route={id,focus:0,tier:1,art:null};save(false);show();}
 function toast(text){notice.textContent=text;notice.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{notice.hidden=true;},1400);}
 function apply(t){
  if(!t)return;
  if(t.focus!==undefined&&route.focus!==t.focus){route.focus=t.focus;save(true);}
  if(route.id==='play'&&['Z','R'].includes(t.key)){toast('预览不能真的玩');stage.refresh();return;}
  if(t.to==='@return'){route=trail.pop()||{id:'lobby',focus:0,tier:1,art:null};save(false);show();}
  else if(t.to==='@quit')go('@quit');
  else if(t.to==='@stay'){
   if(route.id==='hint'&&t.when==='第 1–2 级'){route.tier=Math.min(3,route.tier+1);route.focus=0;save(false);}
   stage.refresh();sync();
  }else go(t.to);
 }
 function command(key){
  if(route.id==='@quit'){if(key==='Enter')go('lobby');return;}
  if(!asset()&&key==='Esc'){route=trail.pop()||{id:'lobby',focus:0,tier:1,art:null};save(false);show();return;}
  if(key==='C'&&route.id==='play'){apply(screen().transitions.find(t=>!t.key&&t.to==='complete'));return;}
  const candidates=enabled().filter(t=>t.key===key),t=candidates.find(t=>t.focus===undefined||t.focus===route.focus);
  if(key.startsWith('Arrow')){
   const d=key==='ArrowUp'||key==='ArrowLeft'?-1:1;
   if(route.id==='settings'&&(key==='ArrowLeft'||key==='ArrowRight')){apply(t);return;}
   updateFocus(route.focus+d);if(t?.to==='@stay')apply(t);return;
  }
  apply(t);
 }
 function sync(){
  document.body.dataset.page=route.id;document.body.dataset.focus=String(route.focus);document.body.dataset.tier=String(route.tier);
  if(info.hidden)return;
  const s=screen();info.replaceChildren(el('button',{type:'button',text:'关闭信息（I）',onclick:()=>{info.hidden=true;host.querySelector('.stage-frame').focus();}}),el('h1',{text:(s?.name||'已退出（预览）')+' · '+route.id}),el('p',{text:'关卡模式 · 公开示例设计模型；局内不能真正游玩。'}));
  const progress=el('div',{class:'progress','aria-label':'五步进度'}),steps=s?.steps||{};
  for(const [id,label,done]of [['design','设计',steps.design],['html','HTML 画面',steps.html],['approved','用户确认',steps.approved],['godot','Godot',steps.godot==='implemented'],['game','游戏接入',steps.game]])progress.append(el('span',{'data-step':id,class:done?'done':'pending',text:(done?'● ':'○ ')+label}));
  info.append(progress,el('h2',{text:'本页按键'}),el('p',{text:[...new Set(enabled().map(t=>t.key||'C（模拟过关）'))].join(' · ')+(count()>1?' · 方向键 / WASD 移焦点':'')+' · I 信息'}),el('p',{},[el('a',{href:'index.html#screen/'+route.id,text:'在工作台打开'})]),el('p',{text:'焦点 '+route.focus+(route.id==='hint'?' · 提示 '+route.tier+'/3':'')}));
  if(route.id==='hint'){
   const tier=el('select',{'aria-label':'提示级别',onchange:()=>{route.tier=Number(tier.value);route.focus=0;save(false);stage.refresh();sync();}});
   for(const n of [1,2,3])tier.append(el('option',{value:n,text:'第 '+n+' 级'}));tier.value=String(route.tier);info.append(el('label',{},['提示级别 ',tier]));
  }
  if(route.id==='play')info.append(el('button',{type:'button',text:'模拟过关（C）',onclick:()=>command('C')}));
  const mode=el('select',{'aria-label':'预览模式'},[el('option',{value:'lab',text:'关卡'}),el('option',{value:'delivery',disabled:true,text:'配送（WB-13）'})]);info.append(el('label',{},['模式 ',mode]),el('h2',{text:'条件开关'}));
  const fields=el('fieldset');
  for(const when of [...new Set((s?.transitions||[]).map(t=>t.when).filter(w=>w&&w in conditions))]){
   const input=el('input',{type:'checkbox',...(conditions[when]?{checked:true}:{}),onchange:()=>{conditions[when]=input.checked;for(const [yes,no]of Object.entries(opposite)){if(when===yes)conditions[no]=!input.checked;if(when===no)conditions[yes]=!input.checked;}sync();}});fields.append(el('label',{},[input,' '+when]));
  }
  if(!fields.childNodes.length)fields.append(el('p',{text:'本页无可切换条件。'}));info.append(fields,el('h2',{text:'跳转历史'}));const historyList=el('ol');for(const r of [...trail,route])historyList.append(el('li',{text:(pages.find(s=>s.id===r.id)?.name||r.id)+'（'+r.id+'） · '+r.focus}));info.append(historyList);
 }
 root.addEventListener('keydown',e=>{
  const editing=e.target.closest('input,select,textarea,button,a');
  if(e.key.toLowerCase()==='i'&&!e.ctrlKey&&!e.metaKey&&!e.altKey) {e.preventDefault();e.stopPropagation();info.hidden=!info.hidden;sync();if(info.hidden)stage.frame.focus();return;}
  if(editing||e.ctrlKey||e.metaKey||e.altKey)return;
  const keys={w:'ArrowUp',a:'ArrowLeft',s:'ArrowDown',d:'ArrowRight',Escape:'Esc',' ':'Enter'},key=keys[e.key]||keys[e.key.toLowerCase()]||(e.key.length===1?e.key.toUpperCase():e.key);
  if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','Esc','H','Z','R','C'].includes(key))return;
  e.preventDefault();e.stopPropagation();if(!e.repeat)command(key);
 },true);
 function hit(e){const b=stage.canvas.getBoundingClientRect(),x=(e.clientX-b.left)*320/b.width,y=(e.clientY-b.top)*180/b.height;return enabled().find(t=>{const h=t.hotspot;return h&&x>=h[0]&&y>=h[1]&&x<h[0]+h[2]&&y<h[1]+h[3];});}
 host.addEventListener('pointermove',e=>{const t=hit(e);host.style.cursor=t?'pointer':'default';if(t?.focus!==undefined&&t.focus!==route.focus)updateFocus(t.focus);});
 host.addEventListener('click',e=>{const t=hit(e);if(t){if(t.focus!==undefined)route.focus=t.focus;if(t.key?.startsWith('Arrow'))command(t.key);else apply(t);}stage.frame.focus();});
 root.addEventListener('popstate',e=>{if(e.state?.pbPlay){route={...e.state.route};trail=e.state.trail.map(x=>({...x}));show();}});
 root.addEventListener('hashchange',()=>{const next=parse();if(url(next)===url(route))return;trail.push({...route});route=next;show();});
 root.addEventListener('pagehide',()=>{stage?.destroy();clearTimeout(noticeTimer);notice.hidden=true;});
 root.addEventListener('pageshow',e=>{if(e.persisted)show();});
 store.registerAll();route=parse();if(history.state?.pbPlay&&url(history.state.route)===url(route))trail=history.state.trail.map(x=>({...x}));show();
 root.PBPlay={stage:()=>stage};
})(window);
