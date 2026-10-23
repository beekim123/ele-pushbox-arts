/* Lightweight overview: repository facts and browser drafts remain distinct. */
(function(root){
  'use strict';
  const store=root.PBStore,el=root.PBStage.el;
  function show(){
    const box=document.getElementById('home-root'),all=store.assets(),maps=store.content().concepts?.maps||[];
    box.replaceChildren(el('h1',{text:'美术工作台'}),el('p',{class:'muted',text:'从资源、场景或确认清单开始。'}),el('p',{class:'muted',text:'设计文档 '+(root.PB_DOCS?.docs.length||0)+' 份'}));
    const stats=el('div',{class:'home-stats'});
    for(const [label,value,href]of [['资源总数',all.length,'#library'],['已确认',all.filter(a=>store.status(a.id)==='approved').length,'#library?status=approved'],['待确认',all.filter(a=>store.status(a.id)==='review').length,'#library?status=review'],['草稿',all.filter(a=>store.status(a.id)==='draft').length,'#library?status=draft'],['声音条数',store.audio().entries.length,'#audio/sfx']])stats.append(el('a',{class:'home-stat',href},[el('strong',{text:String(value)}),el('span',{text:label})]));
    box.append(stats,el('h2',{text:'最近 3 个确认批次'}));
    const batches=store.approvals().slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
    const batchList=el('div',{class:'home-batches'});for(const b of batches)batchList.append(el('a',{class:'home-batch',href:'#review?record='+encodeURIComponent(b.id),'data-approval':b.id},[el('strong',{text:b.id+' · '+b.date.slice(0,10)}),el('span',{text:b.items.length+' 项 · '+(b.scope||'已记录的确认')})]));box.append(batchList);
    box.append(el('h2',{text:'内容缺口'}),el('p',{text:'只有文字的地图概念 '+maps.filter(m=>!(root.PB_CONCEPT_SCENES||{})[m.id]).length+' 张'}),el('p',{class:'muted',id:'home-screen-gaps',text:'待设计 '+root.PB_SCREENS.totals.missing_design+' 个 · Godot 未实现的界面 '+(root.PB_SCREENS.totals.pages-root.PB_SCREENS.totals.implemented)+' 个 · 游戏未接入 '+root.PB_SCREENS.totals.not_yet+' 个 · v1 已冻结 '+root.PB_SCREENS.totals.frozen_v1+' 个'}),el('h2',{text:'快捷入口'}));
    box.append(el('div',{class:'btn-row'},[['原样预览','#scenes/play'],['资源库','#library'],['场景与界面','#scenes'],['确认与导出','#review'],['地图概念','#concepts'],['声音','#audio/sfx'],['文档','#docs']].map(([text,href])=>el('a',{class:'btn',href,text}))));
  }
  root.PBHome={show};
  root.addEventListener('DOMContentLoaded',()=>{if(!document.getElementById('view-home').hidden)show();});
})(window);
