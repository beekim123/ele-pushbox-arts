/* Workbench menu: left category menu, folding, left-column collapse and the
 * narrow-screen drawer. MENU is the only list of pages: the menu is drawn from
 * it and main.js builds its router from it. To add a page, add one entry to a
 * category here (plus the page's own <section id="view-…"> and view script).
 * A page may have more than one menu item (href: a place inside the page); the
 * delivery v2 maps are items generated from slices.json (workbench.md 6.1).
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
  const MENU = [
    { group: "concepts", label: "地图概念", items: [
      { view: "concepts", label: "全部", module: "PBConcepts" },
      { concepts: "concepts" },
    ] },
    { group: "art", label: "美术", items: [
      { view: "scenes", label: "场景", module: "PBScenes" },
      { view: "assets", label: "资产与动画", module: "PBAssets" },
      { view: "edit", label: "编辑与对比", module: "PBEditor" },
      { view: "review", label: "确认", module: "PBReview", badge: "review-count" },
      { view: "export", label: "导出", module: "PBExport", badge: "drafts-count", tone: "warn" },
      { view: "ui-proposals", label: "界面风格提案", module: "PBUiProposals" },
    ] },
    { group: "audio", label: "声音", items: [
      { view: "audio", href: "#audio/sfx", label: "音效", module: "PBWBAudio" },
      // 音乐、按地图 are hidden while background music is shelved (user 2026-10-17); #audio/music and #audio/maps still open.
    ] },
  ];

  const KEY = "pb.wb.nav.v1";
  const NARROW = "(max-width: 720px)";
  const doc = document.documentElement;

  // Remembered state; any storage failure falls back to defaults for this page.
  const state = { collapsed: false, groups: {} };
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && typeof v === "object") {
      state.collapsed = v.collapsed === true;
      if (v.groups && typeof v.groups === "object") for (const k of Object.keys(v.groups)) state.groups[k] = v.groups[k] !== false;
    }
  } catch (e) { /* storage unavailable or unreadable */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ } }
  if (state.collapsed) doc.setAttribute("data-nav", "collapsed");

  const PAGES = [];
  for (const m of MENU) {
    if (m.items) { for (const it of m.items) if (it.view) PAGES.push(Object.assign({ group: m.group, groupLabel: m.label }, it)); }
    else PAGES.push(Object.assign({ group: null, groupLabel: null }, m));
  }

  // Menu items of one category; the generated ones need the content data, so this runs at init.
  function itemsOf(m) {
    const out = [];
    for (const it of m.items || [m]) {
      if (it.maps2) {
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
      const list = h("ul", { class: "nav-list", id: listId, role: "list" }, own.map((p) => h("li", {}, [link(p)])));
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
  }

  root.PBNav = {
    MENU, init, setCurrent, setBadge,
    pages: () => PAGES.slice(),
    links: () => items.map(({ key, href, view, label }) => ({ key, href, view, label })),
    drawerOpen,
    collapsed: () => state.collapsed,
  };
})(window);
