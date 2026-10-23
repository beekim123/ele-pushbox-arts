/* Screen inventory, page inspector and flow SVG share generated public metadata. */
(function(root){
 'use strict';
 const el=root.PBStage.el,store=root.PBStore,data=root.PB_SCREENS,all=data.screens;
 const byId=new Map(all.map(s=>[s.id,s])),flows=['开始','关卡内','配送一局','剧情','伙计','设置与帮助'];
 const nativeLabels={implemented:'已实现',reference_only:'只有参考图',missing:'没有条目'};
 let stage=null,query='',current=null,art=null,hintTier=2;
 function link(id,text){return el('a',{href:'#screen/'+id,text:text||byId.get(id)?.name||id});}
 function target(t){return byId.has(t.to)?link(t.to):el('span',{text:{'@return':'返回来源页','@quit':'退出游戏','@stay':'留在本页'}[t.to]});}
 function from(id){return all.flatMap(s=>s.transitions.filter(t=>t.to===id).map(t=>({screen:s,transition:t})));}
 function identify(id){return all.find(s=>s.art===id||s.variants.includes(id));}
 function coverage(entry,host){host.hidden=false;host.textContent=entry?JSON.stringify(entry,null,2):'没有条目';}
 function progress(s,host,detail,selectedArt){
  const variant=s.variantsProgress.find(v=>v.art===selectedArt),steps=variant?{design:true,...variant.steps,game:s.steps.game}:s.steps,entry=variant?variant.coverage:s.coverage;
  const items=[['design','设计',true],['html','HTML 画面',steps.html],['approved','用户确认',steps.approved],['godot','Godot · '+nativeLabels[steps.godot],steps.godot==='implemented'],['game','游戏接入',steps.game]];
  const bar=el('div',{class:'screen-progress','aria-label':'五步进度'});
  for(const [step,label,ok]of items){const attrs={class:'screen-step '+(ok?'done':'pending'),'data-step':step,title:label+'：'+(ok?'已完成':'未完成'),text:(ok?'● ':'○ ')+label};
   if(step==='html')bar.append(el('a',{...attrs,href:'#screen/'+s.id}));
   else if(step==='godot')bar.append(el('button',{...attrs,type:'button',onclick:()=>coverage(entry,detail)}));
   else bar.append(el('span',attrs));
  }
  host.append(bar);
 }
 function list(box){
  box.append(el('h1',{text:'界面清单'}),el('p',{class:'muted',text:`${data.totals.pages} 个页面 · 主画面与变体覆盖全部界面资源。进度由清单、资源 manifest 和 native coverage 生成；游戏接入人工维护。`}));
  const search=el('input',{id:'screen-search',type:'search','aria-label':'搜索界面',placeholder:'搜索页面名称、编号或流程',value:query,oninput:()=>{query=search.value;filter();}});
  box.append(search);
  const detail=el('pre',{id:'screen-list-coverage',class:'screen-coverage',hidden:true,'aria-live':'polite'}),wrap=el('div',{class:'screen-table-wrap'}),table=el('table',{id:'screen-list',class:'screen-table'});
  table.append(el('thead',{},[el('tr',{},['页面','五步进度','所属模式','从哪里跳来','能跳到哪里'].map(text=>el('th',{scope:'col',text})))]));
  const rows=[];
  for(const flow of flows){const body=el('tbody',{'data-flow':flow});body.append(el('tr',{class:'screen-flow-heading'},[el('th',{colspan:5,scope:'rowgroup',text:flow})]));
   for(const s of all.filter(s=>s.flow===flow)){
    const name=el('td',{},[link(s.id,s.name),el('div',{class:'mono small muted',text:s.id})]);
    if(s.art)name.prepend(el('a',{href:'#screen/'+s.id,tabindex:-1,'aria-hidden':'true'},[el('img',{src:'../art/export/preview/'+s.art+'.png',alt:'',width:128,height:72,loading:'lazy',decoding:'async'})]));
    const steps=el('td');progress(s,steps,detail,s.art);
    const incoming=[...new Map(from(s.id).map(x=>[x.screen.id,x.screen])).values()],outgoing=[...new Set(s.transitions.map(t=>t.to))];
    const ingress=el('td',{class:'screen-links'});for(const x of incoming)ingress.append(link(x.id));if(!incoming.length)ingress.textContent='—';
    const egress=el('td',{class:'screen-links'});for(const to of outgoing)egress.append(target({to}));if(!outgoing.length)egress.textContent='尚未登记';
    const row=el('tr',{'data-screen-row':s.id},[name,steps,el('td',{text:'未标'}),ingress,egress]);rows.push({s,row,body});body.append(row);
   }table.append(body);
  }
  function filter(){const q=query.toLowerCase();for(const {s,row}of rows)row.hidden=!`${s.name} ${s.id} ${s.art} ${s.variants.join(' ')} ${s.flow}`.toLowerCase().includes(q);for(const body of table.tBodies)body.hidden=![...body.querySelectorAll('[data-screen-row]')].some(r=>!r.hidden);}
  wrap.append(table);box.append(wrap,detail);filter();
 }
 function detail(box,id){
  const s=byId.get(id);if(!s){box.append(el('h1',{text:'没有这个页面'}),el('a',{href:'#scenes',text:'返回界面清单'}));return;}
  current=s;art=s.art;hintTier=2;
  box.append(el('a',{href:'#scenes',text:'← 界面清单'}),el('h1',{text:s.name}),el('p',{class:'mono small muted',text:s.id+' · '+s.flow+' · 所属模式：未标'}));
  const host=el('div',{id:'screen-stage',class:'stage-host'}),steps=el('div',{id:'screen-progress'}),native=el('pre',{id:'screen-coverage',class:'screen-coverage',hidden:true,'aria-live':'polite'});
  const select=el('select',{'aria-label':'画面变体',onchange:()=>{art=select.value;render();}});for(const a of [s.art,...s.variants].filter(Boolean))select.append(el('option',{value:a,text:(a===s.art?'主图 · ':'变体 · ')+(store.asset(a)?.name||a)}));
  const tier=el('select',{'aria-label':'提示级别',onchange:()=>{hintTier=Number(tier.value);stage.refresh();}});for(const n of [0,1,2])tier.append(el('option',{value:n,text:'提示 '+(n+1)+'/3'}));tier.value='2';
  const note=el('p',{id:'screen-variant-note',class:'note small'});box.append(el('div',{class:'btn-row'},[el('label',{},['画面 ',select]),...(id==='hint'?[el('label',{},['提示级别 ',tier])]:[])]),host,note,steps,native,el('p',{class:'small muted',text:s.notes}));
  function render(){
   if(stage)stage.destroy();steps.replaceChildren();native.hidden=true;progress(s,steps,native,art);
   const variant=art!==s.art;note.textContent=variant?'当前为外观变体。下方跳转只对应主图；变体菜单可能不同，尚未登记其游戏行为。':'下方跳转对应主图。画面是代码绘制的公开示例，局内展示不能游玩。';
   const a=store.asset(art);if(!a){host.textContent='尚无 HTML 画面';return;}
   stage=root.PBStage.create(host,{width:320,height:180,animated:true,autoplay:true,label:s.name,draw:(r,tick)=>{
    if(id==='play')root.PB.scene.renderLevel(r,root.PB.scene.SHOWCASE,null,{tick,hud:false});
    const preview=id==='hint'?{...a,params:{...a.params,level:hintTier+1}}:a;
    root.PB.ui.render(r,preview,tick,{focus:id==='hint'?hintTier:0,specs:Object.fromEntries(store.levels().map(l=>[l.id,l])),levelSpec:store.level('M05'),ruleSpec:store.level('M03'),animate:true});
   },disclaimer:'界面外观参考；交互以清单中的主图跳转为准。'});
  }
  render();
  box.append(el('h2',{text:'从哪里跳来'}));const incoming=el('ul',{id:'screen-incoming'});
  for(const x of from(id)){const t=x.transition;incoming.append(el('li',{},[link(x.screen.id),` · ${t.key||'自动'} · ${t.label}${t.when?'（'+t.when+'）':''}`]));}if(!incoming.childNodes.length)incoming.append(el('li',{text:'尚未登记入口'}));box.append(incoming,el('h2',{text:'主图能跳到哪里'}));
  const outgoing=el('ul',{id:'screen-outgoing'});for(const t of s.transitions)outgoing.append(el('li',{},[el('span',{class:'mono small',text:(t.key||'自动')+(t.focus===undefined?'':' · 菜单 '+t.focus)}),` ${t.label}${t.when?'（'+t.when+'）':''} → `,target(t)]));if(!s.transitions.length)outgoing.append(el('li',{text:'尚未登记跳转，待 WB-13'}));box.append(outgoing);
 }
 function flow(box){
  box.append(el('h1',{text:'界面流程图'}),el('p',{class:'muted',text:'按流程分列；点击页面打开详情。箭头包含条件分支，悬停可读操作与条件。空白跳转留待后续工作包。'}));
  const ns='http://www.w3.org/2000/svg',make=(name,attrs,text)=>{const n=document.createElementNS(ns,name);for(const [k,v]of Object.entries(attrs||{}))n.setAttribute(k,v);if(text)n.textContent=text;return n;};
  const groups=flows.map(f=>all.filter(s=>s.flow===f)),height=Math.max(...groups.map(g=>g.length))*82+180,width=flows.length*230;
  const svg=make('svg',{viewBox:`0 0 ${width} ${height}`,width,height,role:'img','aria-label':'界面跳转流程图'}),defs=make('defs'),marker=make('marker',{id:'screen-arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:5,markerHeight:5,orient:'auto-start-reverse'});marker.append(make('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'currentColor'}));defs.append(marker);svg.append(defs);
  const points=new Map();groups.forEach((g,col)=>{svg.append(make('text',{x:col*230+20,y:28,class:'screen-svg-heading'},flows[col]));g.forEach((s,row)=>points.set(s.id,{x:col*230+20,y:55+row*82}));});
  const edges=make('g',{class:'screen-svg-edges'});all.forEach(s=>s.transitions.forEach((t,i)=>{const p=points.get(s.id),q=points.get(t.to);let d;
   if(q)d=`M ${p.x+90} ${p.y+48} C ${p.x+205+i*3} ${p.y+66}, ${q.x+205+i*3} ${q.y-22}, ${q.x+90} ${q.y}`;
   else d=`M ${p.x+180} ${p.y+18} C ${p.x+218} ${p.y-6}, ${p.x+220} ${p.y+65}, ${p.x+180} ${p.y+38}`;
   const edge=make('path',{d,'data-transition':s.id+':'+i,'marker-end':'url(#screen-arrow)'});edge.append(make('title',{},`${s.name} · ${t.key||'自动'} ${t.label}${t.when?'（'+t.when+'）':''} → ${byId.get(t.to)?.name||t.to}`));edges.append(edge);
  }));svg.append(edges);
  for(const s of all){const p=points.get(s.id),a=make('a',{href:'#screen/'+s.id,'data-screen-node':s.id});a.append(make('rect',{x:p.x,y:p.y,width:180,height:48,rx:5,class:s.game==='in_use'?'in-use':''}),make('text',{x:p.x+10,y:p.y+20},s.name),make('text',{x:p.x+10,y:p.y+37,class:'screen-svg-id'},s.id));svg.append(a);}
  const wrapper=el('div',{id:'screen-flow',class:'screen-flow',tabindex:0});wrapper.append(svg);box.append(wrapper);
 }
 function show(id){if(stage){stage.destroy();stage=null;}current=null;const box=document.getElementById('screens-root');box.replaceChildren();if(id==='flow')flow(box);else if(id)detail(box,id);else list(box);}
 root.PBScreens={show,identify,hide:()=>{if(stage){stage.destroy();stage=null;}},where:id=>({key:'scenes',trail:['场景与界面',id==='flow'?'流程图':byId.get(id)?.name||'界面清单']})};
})(window);
