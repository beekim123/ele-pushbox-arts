/* Six visible workspace destinations plus an internal tool-route registry.
 * Loaded in <head> so a collapsed left column never flashes open. */
(function (root) {
  "use strict";

  // { view, label, module } is a page; { group, label, items } is a category.
  // badge: id of a count shown after the label (filled by main.js).
  // href: where the item goes inside its page (default "#" + view).
  // { maps2: view }: one item per format-2 map of slices.json, in its order and
  // named by its short_name (workbench.md 6.1), opening #<view>/map/<map id>.
  // { concepts: view }: one item per map of content/concepts/maps.json, in its order
  // and named by its name (workbench.md 6.2), opening #<view>/<map id>.
  // Six visible destinations; tools remain addressable through a separate registry.
  const MENU = [
    {view:'home',label:'总览',module:'PBHome'},
    {view:'assets',href:'#library',label:'资源库',module:'PBAssets',badge:'drafts-count',tone:'warn'},
    {view:'scenes',label:'场景与界面',module:'PBScenes'},
    {view:'review',label:'确认',module:'PBReview',badge:'review-count'},
    {view:'concepts',label:'地图概念',module:'PBConcepts'},
    {view:'audio',href:'#audio/sfx',label:'声音',module:'PBWBAudio'},
  ];
  const TOOLS = [
    {view:'screens',label:'界面清单',module:'PBScreens'},
    {view:'edit',label:'编辑与对比',module:'PBEditor'},
    {view:'export',label:'导出',module:'PBExport'},
    {view:'ui-proposals',label:'界面风格提案',module:'PBUiProposals'},
    {view:'level-art',label:'关卡音效',module:'PBLevelArt'},
    {view:'delivery-art',label:'配送音效',module:'PBDeliveryArt'},
  ];
  function resolve(hash) {
    let raw=(hash||'').replace(/^#/,''), canonical=raw||'home';
    const [path,query='']=canonical.split('?'), [view,...rest]=path.split('/'), id=rest.join('/');
    if(view==='level-art'||view==='delivery-art') {
      const params=new URLSearchParams({mode:view==='level-art'?'level':'delivery'});
      if(id&&id!=='all') params.set(id.startsWith('theme.')?'theme':'group',id.startsWith('theme.')?id.slice(6):id);
      canonical='library?'+params;
    } else if(view==='assets') canonical='library'+(id?'?id='+encodeURIComponent(id):'');
    else if(view==='export') canonical='review/export';
    else if(view==='ui-proposals'||(view==='scenes'&&id==='ui-proposals')) canonical='scenes/screens';
    else if(view==='scenes'&&id==='references') canonical='scenes/references';
    else if(view==='scenes'&&id?.startsWith('ui.screen.')) { const s=root.PBScreens?.identify(id); if(s) canonical='screen/'+s.id; }
    const [next,params='']=canonical.split('?'), [name,...parts]=next.split('/');
    if(name==='library') {
      const q=new URLSearchParams(params), mode=q.get('mode');
      return {hash:'#'+canonical,view:q.get('group')==='sounds'&&['level','delivery'].includes(mode)?mode+'-art':'assets',id:q.get('group')==='sounds'?'sounds':q.get('id'),query:params,nav:'assets'};
    }
    if(next==='review/export')return {hash:'#'+canonical,view:'export',id:null,nav:'review'};
    if(next==='scenes/references')return {hash:'#'+canonical,view:'ui-proposals',id:null,nav:'scenes'};
    if(name==='screen')return {hash:'#'+canonical,view:'screens',id:parts.join('/'),nav:'scenes'};
    if(['scenes','scenes/screens','scenes/flow'].includes(next))return {hash:'#'+canonical,view:'screens',id:next==='scenes/flow'?'flow':null,nav:'scenes'};
    if(next==='scenes/preview')return {hash:'#'+canonical,view:'scenes',id:null,nav:'scenes'};
    return {hash:'#'+canonical,view:name,id:parts.join('/')||null,query:params,nav:name==='edit'?'assets':name};
  }

  const KEY = "pb.wb.nav.v1";
  const NARROW = "(max-width: 720px)";
  const doc = document.documentElement;

  // Remembered state; any storage failure falls back to defaults for this page.
  const state = { collapsed: false, groups: { level: false, delivery: false } };
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && typeof v === "object") {
      state.collapsed = v.collapsed === true;
      if (v.groups && typeof v.groups === "object") for (const k of Object.keys(v.groups)) state.groups[k] = v.groups[k] !== false;
    }
  } catch (e) { /* storage unavailable or unreadable */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ } }
  if (state.collapsed) doc.setAttribute("data-nav", "collapsed");

  const PAGES = TOOLS.slice();
  for (const m of MENU) {
    if (m.items) { for (const it of m.items) if (it.view) PAGES.push(Object.assign({ group: m.group, groupLabel: m.label }, it)); }
    else PAGES.push(Object.assign({ group: null, groupLabel: null }, m));
  }

  // Menu items of one category; the generated ones need the content data, so this runs at init.
  function itemsOf(m) {
    const out = [];
    for (const it of m.items || [m]) {
      if (it.resourceSections) {
        const catalog = root.PBModeCatalog, all = root.PBStore ? root.PBStore.assets() : [];
        for (const section of catalog ? catalog.sections(it.mode, all).filter(s=>s.id!=="all") : [])
          out.push({view:it.resourceSections,key:it.resourceSections+"/"+section.id,
            href:"#"+it.resourceSections+"/"+section.id,label:section.name,group:m.group,groupLabel:m.label});
      } else if (it.maps2) {
        const slices = (root.PBStore && root.PBStore.catalog("slices")) || [];
        for (const s of slices.filter((x) => x.format === 2))
          out.push({ view: it.maps2, key: it.maps2 + "/map/" + s.id, href: "#" + it.maps2 + "/map/" + s.id, label: s.short_name || String(s.name || s.id).replace(/^配送地图 · /, ""), group: m.group || null, groupLabel: m.items ? m.label : null });
      } else if (it.concepts) {
        const c = root.PBStore && root.PBStore.content ? root.PBStore.content().concepts : null;
        for (const x of c && Array.isArray(c.maps) ? c.maps : [])
          out.push({ view: it.concepts, key: it.concepts + "/" + x.id, href: "#" + it.concepts + "/" + x.id, label: x.name || x.id, group: m.group || null, groupLabel: m.items ? m.label : null });
      } else out.push(Object.assign({ group: m.items ? m.group : null, groupLabel: m.items ? m.label : null }, it, { key: it.href ? it.href.slice(1) : it.view, href: it.href || "#" + it.view }));
    }
    return out;
  }

  let nav = null, toggle = null, scrim = null, crumb = null, media = null, current = null, currentKey = null;
  const links = new Map(), heads = new Map(), items = [];

  function h(tag, attrs, kids) {
    const e = document.createElement(tag);
    for (const k of Object.keys(attrs || {})) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "text") e.textContent = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const c of kids || []) if (c) e.append(c);
    return e;
  }

  const isOpen = (g) => state.groups[g] !== false;
  const narrow = () => !!(media && media.matches);
  const drawerOpen = () => doc.getAttribute("data-drawer") === "open";

  function link(p) {
    const a = h("a", { href: p.href, "data-view": p.view, "data-key": p.key, class: p.group ? null : "nav-link" }, [h("span", { text: p.label })]);
    if (p.badge) a.append(h("span", { class: "count" + (p.tone ? " " + p.tone : ""), id: p.badge, hidden: true }));
    links.set(p.key, a);
    return a;
  }

  function render() {
    nav.textContent = "";
    nav.append(h("div", { class: "nav-drawer-head" }, [
      h("strong", { text: "渡界人" }),
      h("button", { class: "btn small nav-close", type: "button", text: "关闭", onclick: () => setDrawer(false, true) }),
    ]));
    links.clear(); heads.clear(); items.length = 0;
    for (const m of MENU) {
      const own = itemsOf(m);
      items.push(...own);
      if (!m.items) { nav.append(link(own[0])); continue; }
      const listId = "nav-list-" + m.group;
      const dot = h("span", { class: "nav-dot", hidden: true });
      const head = h("button", { class: "nav-head", type: "button", "data-group": m.group, "aria-controls": listId, onclick: () => setGroup(m.group, !isOpen(m.group)) },
        [h("span", { class: "nav-head-label", text: m.label }), dot, h("span", { class: "chev", "aria-hidden": "true" })]);
      const textOnly = own.filter(p => p.view === "concepts" && p.key !== "concepts" && !(root.PB_CONCEPT_SCENES || {})[p.key.slice("concepts/".length)]);
      const textKeys = new Set(textOnly.map(p => p.key));
      const list = h("ul", { class: "nav-list", id: listId, role: "list" }, own.filter(p => !textKeys.has(p.key)).map((p) => h("li", {}, [link(p)])));
      if (textOnly.length) list.append(h("li", {}, [h("details", { id: "nav-concept-text-only", class: "nav-subgroup" }, [
        h("summary", { text: "只有文字（" + textOnly.length + "）" }),
        h("ul", { class: "nav-list", role: "list" }, textOnly.map(p => h("li", {}, [link(p)]))),
      ])]));
      nav.append(h("div", { class: "nav-group", "data-group": m.group }, [head, list]));
      heads.set(m.group, { head, list, dot, pages: PAGES.filter((p) => p.group === m.group) });
      applyGroup(m.group);
    }
  }

  function applyGroup(g) {
    const x = heads.get(g), open = isOpen(g);
    x.head.setAttribute("aria-expanded", String(open));
    x.list.hidden = !open;
    updateDots();
  }
  function setGroup(g, open) { state.groups[g] = !!open; save(); applyGroup(g); }

  // A folded category still shows that one of its pages has a count.
  function updateDots() {
    for (const [g, x] of heads) {
      const shown = x.pages.filter((p) => p.badge && document.getElementById(p.badge) && !document.getElementById(p.badge).hidden);
      x.dot.hidden = isOpen(g) || !shown.length;
      x.dot.title = shown.map((p) => `${p.label} ${document.getElementById(p.badge).textContent}`).join(" · ");
    }
  }
  function setBadge(id, n, title) {
    const b = document.getElementById(id);
    if (!b) return;
    b.hidden = !n; b.textContent = String(n || 0);
    if (title) b.title = title; else b.removeAttribute("title");
    updateDots();
  }

  function syncToggle() {
    if (!toggle) return;
    const shown = narrow() ? drawerOpen() : !state.collapsed;
    toggle.setAttribute("aria-expanded", String(shown));
    toggle.title = narrow() ? (shown ? "关闭菜单" : "打开菜单") : (shown ? "收起左栏" : "展开左栏");
  }
  function setCollapsed(c) {
    state.collapsed = !!c; save();
    if (state.collapsed) doc.setAttribute("data-nav", "collapsed"); else doc.removeAttribute("data-nav");
    syncToggle();
    window.dispatchEvent(new Event("resize")); // stages re-fit to the new width
  }
  function setDrawer(open, focusBack) {
    const was = drawerOpen();
    open = !!open && narrow();
    if (open) doc.setAttribute("data-drawer", "open"); else doc.removeAttribute("data-drawer");
    scrim.hidden = !open;
    for (const el of document.querySelectorAll("body > .topbar, body > main")) el.inert = open;
    syncToggle();
    if (open && !was) {
      const a = links.get(currentKey);
      (a && a.offsetParent ? a : nav.querySelector(".nav-close")).focus();
    } else if (!open && was && focusBack) toggle.focus();
  }

  // at (from the page's where(id), optional): { key: the menu item to highlight,
  // trail: breadcrumb after the category, e.g. ["地府·酆都", "奈何桥"] }.
  function setCurrent(view, at) {
    const changed = view !== current;
    current = view;
    const p = PAGES.find((x) => x.view === view) || null;
    const own = items.filter((x) => x.view === view), it = (at && own.find((x) => x.key === at.key)) || own[0] || null;
    currentKey = it ? it.key : null;
    for (const [k, a] of links) { if (k === currentKey) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); }
    for (const [g, x] of heads) x.head.classList.toggle("has-current", !!p && p.group === g);
    // Entering a page opens its category; moving inside the same page keeps the user's folding.
    if (changed && p && p.group && !isOpen(p.group)) setGroup(p.group, true);
    const trail = (at && at.trail && at.trail.length ? at.trail : [it ? it.label : p ? p.label : ""]).filter(Boolean);
    const parts = (p && p.groupLabel ? [p.groupLabel] : []).concat(trail);
    if (crumb) crumb.replaceChildren(...(p ? parts.map((t, i) => (i < parts.length - 1 ? h("span", { text: t + " › " }) : h("b", { text: t }))) : []));
    if (changed && drawerOpen()) setDrawer(false, false);
  }

  function init() {
    nav = document.getElementById("nav");
    toggle = document.getElementById("nav-toggle");
    scrim = document.getElementById("nav-scrim");
    crumb = document.getElementById("nav-crumb");
    media = root.matchMedia ? root.matchMedia(NARROW) : null;
    render();
    toggle.addEventListener("click", () => { if (narrow()) setDrawer(!drawerOpen(), true); else setCollapsed(!state.collapsed); });
    scrim.addEventListener("click", () => setDrawer(false, true));
    nav.addEventListener("click", (e) => { if (e.target.closest("a[href]") && drawerOpen()) setDrawer(false, true); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drawerOpen()) { e.preventDefault(); setDrawer(false, true); } });
    if (media) {
      const onChange = () => { setDrawer(false, false); syncToggle(); };
      if (media.addEventListener) media.addEventListener("change", onChange); else if (media.addListener) media.addListener(onChange);
    }
    syncToggle();
    // Concept renderers follow main.js in the offline document; group after registration.
    root.addEventListener("DOMContentLoaded", () => { const key = currentKey; render(); setCurrent(current, { key }); root.PBMain.updateBadges(); });
  }

  root.PBNav = {
    MENU, init, setCurrent, setBadge, resolve,
    pages: () => PAGES.slice(),
    links: () => items.map(({ key, href, view, label }) => ({ key, href, view, label })),
    drawerOpen,
    collapsed: () => state.collapsed,
  };
})(window);
