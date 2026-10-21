/* Mode resource management reuses the public asset inspector/editor/review.
 * No gameplay catalogs, rooms, solutions or SDK are required by these pages. */
(function (root) {
  'use strict';
  const store = root.PBStore, C = root.PBModeCatalog, el = root.PBStage.el;
  const CAT = Object.assign({}, root.PBAssets.CAT, {avatar:'头像',cargo:'货物',monster:'怪物',scene:'整幅场景'});
  function create(mode) {
    const config = C.MODES[mode];
    let section = 'all', grid = null, count = null, empty = null, audioStatus = null;
    const filter = {category:'all',status:'all',query:'',shared:true};
    const getSection = id => C.sections(mode, store.assets()).find(s=>s.id===id) || {id:'all',name:'全部资源'};
    const badge = a => el('span', {class:'badge '+store.status(a.id), text:store.statusLabel(store.status(a.id))});
    function stop() { root.PBWBAudio.player.close().catch(()=>{}); }
    function artCard(a) {
      const item = store.effective(a.id), preview = root.PBAssets.thumb(item, 320, 180);
      if (a.kind !== 'sprite') { preview.style.width = '320px'; preview.style.height = '180px'; }
      const link = el('a', {class:'mode-resource-preview',href:'#assets/'+a.id,'aria-label':'查看 '+a.name}, [preview]);
      const labels = [badge(a)];
      if (C.modes(a).length > 1) labels.push(el('span', {class:'mode-resource-tag',text:'跨模式共用'}));
      else if (!C.modes(a).includes(mode)) labels.push(el('span', {class:'mode-resource-tag',text:'共用界面依赖'}));
      if (C.related(a)) labels.push(el('span', {class:'mode-resource-tag',text:'渡口 / 伙计 / 剧情关联'}));
      const actions = [el('a', {class:'btn small',href:'#assets/'+a.id,text:'预览与动画'})];
      if (a.kind === 'sprite') actions.push(el('a', {class:'btn small',href:'#edit/'+a.id,text:'编辑与对比'}));
      actions.push(el('a', {class:'btn small',href:'#review',text:'到确认页'}));
      return el('article', {class:'mode-resource-card','data-resource-id':a.id}, [
        link, el('h3',{text:a.name}), el('div',{class:'row'},labels),
        el('p',{class:'mono small',text:`${a.id} @v${a.version}`}),
        el('p',{class:'small muted',text:CAT[a.category] || a.category}), el('div',{class:'btn-row'},actions),
      ]);
    }
    function soundCard(a) {
      const current = a.current, approved = a.current_is_approved;
      const playback = el('button', {type:'button',class:'btn','data-preview-sound':a.uid,text:'试听',onclick:async()=>{
        playback.disabled = true;
        try {
          const played = await root.PBWBAudio.player.playSfx(a.uid);
          audioStatus.textContent = played ? '已试听：'+a.name : '当前未播放，请检查监听音量或稍后重试。';
        } catch (error) { audioStatus.textContent = '无法试听：'+error.message; }
        finally { playback.disabled = false; }
      }});
      return el('article',{class:'mode-resource-card mode-sound-card','data-sound-id':a.uid},[
        el('h3',{text:a.name}), el('span',{class:'badge '+(approved?'approved':'review'),text:approved?'已确认':'待确认'}),
        el('p',{class:'mono small',text:a.uid+(current?' @v'+current.version:'')}),
        current?.wav ? playback : el('p',{text:'尚无可试听文件'}),
        el('a',{class:'btn small',href:'#audio/sfx/'+a.uid,text:'打开声音管理与确认'}),
      ]);
    }
    function renderCards() {
      stop(); grid.textContent = '';
      const isSound = section === 'sounds';
      const source = isSound ? C.sounds(mode,store.audio().entries || []) : C.assets(mode,section,store.assets(),{shared:filter.shared});
      const rows = source.filter(a=> {
        const status = isSound ? (a.current_is_approved?'approved':'review') : store.status(a.id);
        return (isSound || filter.category==='all' || a.category===filter.category) &&
          (filter.status==='all' || status===filter.status) &&
          (!filter.query || (a.id+' '+a.name).toLowerCase().includes(filter.query.toLowerCase()));
      });
      count.textContent = `显示 ${rows.length} / ${source.length} 项${isSound?'音效':'美术资源'}`;
      empty.hidden = rows.length !== 0;
      for (const a of rows) grid.append(isSound?soundCard(a):artCard(a));
    }
    function select(label, value, choices, change) {
      const control = el('select',{'aria-label':label,onchange:()=>{change(control.value);renderCards();}});
      for (const [id,name] of choices) control.append(el('option',{value:id,text:name}));
      control.value = value;
      return el('label',{class:'mode-resource-control'},[el('span',{text:label}),control]);
    }
    function show(id) {
      const next = getSection(id || 'all');
      if (next.id !== section) Object.assign(filter,{category:'all',status:'all',query:'',shared:true});
      section = next.id;
      const host = document.getElementById(config.view+'-root');
      host.textContent = '';
      const all = C.assets(mode,'all',store.assets()), pending = all.filter(a=>store.status(a.id)==='review').length;
      const draft = all.filter(a=>store.status(a.id)==='draft').length;
      host.append(el('h1',{text:config.name+' · '+next.name}),
        el('p',{class:'mode-resource-summary',text:`${all.length} 项美术资源 · ${pending} 项待确认 · ${draft} 项概念 / 草稿 · ${C.sounds(mode,store.audio().entries || []).length} 项音效`}),
        el('p',{class:'small muted',text:mode==='delivery'
          ? '按地图和用途管理美术。渡口、伙计和剧情候选单列；这里展示资源，不表示对应玩法已实现或素材已确认。'
          : '按章节主题和用途管理美术。共用素材引用同一份源文件，修改与确认继续使用统一美术流程。'}));
      const sections = el('nav',{class:'mode-resource-sections','aria-label':config.name+'资源分组'});
      for (const s of C.sections(mode,store.assets())) sections.append(el('a',{
        class:'chip',href:'#'+config.view+'/'+s.id,'aria-current':String(section===s.id),text:s.name,
      }));
      host.append(sections);
      const controls = el('div',{class:'mode-resource-controls'}), isSound = section === 'sounds';
      if (!isSound) {
        const cats = [...new Set(C.assets(mode,section,store.assets()).map(a=>a.category))];
        controls.append(select('资源类别',filter.category,[['all','全部类别'],...cats.map(c=>[c,CAT[c]||c])],v=>{filter.category=v;}));
      }
      controls.append(select('确认状态',filter.status,[['all','全部状态'],['approved','已确认'],['review','待确认'],
        ...(!isSound?[['draft','概念 / 草稿'],['local','本地修改']]:[])],v=>{filter.status=v;}));
      const search = el('input',{type:'search','aria-label':'搜索'+config.name+'资源',placeholder:'搜索名称或资源 ID',value:filter.query,
        oninput:()=>{filter.query=search.value;renderCards();}});
      controls.append(search);
      if (section.startsWith('theme.')) {
        const common = el('input',{type:'checkbox',checked:filter.shared,onchange:()=>{filter.shared=common.checked;renderCards();}});
        controls.append(el('label',{class:'mode-resource-control'},[common,'包括通用资源']));
      }
      controls.append(el('button',{class:'btn',type:'button',text:'清除筛选',onclick:()=>{
        Object.assign(filter,{category:'all',status:'all',query:'',shared:true});show(section);
      }}));
      if (isSound) controls.append(el('button',{class:'btn',type:'button',text:'停止试听',onclick:()=>{
        stop(); audioStatus.textContent = '已停止试听。';
      }}));
      audioStatus = el('p',{class:'small muted','data-mode-audio-status':mode,role:'status',
        text:'试听使用声音管理页相同的监听音量与静音设置。'});
      count = el('p',{class:'result-count','aria-live':'polite'});
      grid = el('div',{class:'mode-resource-grid'});
      empty = el('p',{class:'muted',text:'没有符合条件的资源，请调整筛选。'});
      host.append(controls,count); if (isSound) host.append(audioStatus);
      host.append(empty,grid); renderCards();
    }
    function where(id) {
      const s = getSection(id || 'all');
      return {key:config.view+(s.id==='all'?'':'/'+s.id),trail:[s.name]};
    }
    return {show,where,hide:stop};
  }
  root.PBLevelArt = create('level');
  root.PBDeliveryArt = create('delivery');
})(window);
