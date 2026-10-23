/* Entry: hash routing (#view/id), navigation state, badges, toast and downloads.
 * PBNav.pages() provides visible destinations and addressable internal tools. */
(function (root) {
  "use strict";
  const store = root.PBStore;
  const nav = root.PBNav;
  const VIEWS = {};
  for (const p of nav.pages()) {
    if (root[p.module] && document.getElementById("view-" + p.view)) VIEWS[p.view] = root[p.module];
    else console.warn(`menu page "${p.view}" has no ${p.module} script or #view-${p.view} section`);
  }
  let active = null;

  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
  }
  function download(name, text) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.download = name; document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast("已下载 " + name);
  }
  function updateBadges() {
    const n = store.draftCount(), flag = document.getElementById("drafts-flag");
    flag.hidden = !n; flag.textContent = `本地未导出修改 ${n} 项`;
    nav.setBadge("drafts-count", n, `本地未导出修改 ${n} 项`);
    nav.setBadge("review-count", Object.keys(store.review().selected).length);
  }

  function route() {
    const place = nav.resolve(location.hash);
    if(location.hash!==place.hash) history.replaceState(null,'',place.hash);
    const name = VIEWS[place.view] ? place.view : 'home';
    const id = place.id;
    root.PBAssets.setQuery(place.query || '');
    for (const v of Object.keys(VIEWS)) {
      const sec = document.getElementById("view-" + v);
      const on = v === name;
      if (!on && !sec.hidden && VIEWS[v].hide) VIEWS[v].hide();
      sec.hidden = !on;
    }
    // A page with places of its own in the menu (配送: maps, rooms; 声音: sfx, music, maps) says which item and breadcrumb fit.
    const at = VIEWS[name].where ? VIEWS[name].where(id) : name === "audio" ? { key: "audio/" + (id || "sfx").split("/")[0] } : null;
    nav.setCurrent(place.nav || name, at);
    active = name;
    VIEWS[name].show(id);
    for(const [owner,other,first,second] of [['scenes','ui-proposals','场景预览','界面风格提案'],['review','export','确认清单','导出']]) {
      const target=document.getElementById('view-'+(name===other?other:owner));
      if(name!==owner&&name!==other)continue;
      let tabs=target.querySelector('.workspace-tabs');
      if(!tabs){tabs=root.PBStage.el('nav',{class:'workspace-tabs','aria-label':owner==='scenes'?'场景与界面':'确认与导出'});target.prepend(tabs);}
      tabs.replaceChildren(...[[owner,first],[owner+'/'+other,second]].map(([route,label])=>root.PBStage.el('a',{href:'#'+route,class:'chip','aria-current':String((name===owner)===(route===owner)),text:label})));
    }
    if(name==='review'){
      const record=new URLSearchParams(place.query||'').get('record'),entry=record&&document.getElementById('approval-'+record);
      if(entry){entry.open=true;entry.scrollIntoView({block:'start'});}
    }
    updateBadges();
  }

  function init() {
    nav.init();
    if (!root.PB_BUNDLE) {
      document.querySelector("main").innerHTML = '<div class="page"><h2>缺少数据</h2><p>没有找到 data/bundle.js。请在仓库根目录运行 <code>node tools/art.mjs build</code>。</p></div>';
      return;
    }
    store.registerAll();
    const sel = document.getElementById("appearance");
    sel.value = root.PBAppearance.get();
    sel.addEventListener("change", () => root.PBAppearance.set(sel.value));
    store.on(updateBadges);
    window.addEventListener("hashchange", route);
    document.addEventListener("keydown", (e) => { if (active === "edit" && !nav.drawerOpen()) root.PBEditor.onKey(e); });
    window.addEventListener("beforeunload", (e) => {
      if (!store.storageOk() && store.draftCount()) { e.preventDefault(); e.returnValue = ""; }
    });
    route();
  }
  root.PBMain = { toast, download, updateBadges };
  init();
})(window);
