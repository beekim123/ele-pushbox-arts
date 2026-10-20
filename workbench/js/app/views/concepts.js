/* View · 地图概念 (WB-05, workbench.md 6.2): one concept card per map of
 * content/concepts/maps.json (PB_CONTENT.concepts, built by tools/content.mjs).
 * Routes: #concepts (all maps in one table), #concepts/<id> (the card).
 * Concept scene interface: a script runs
 *   window.PB_CONCEPT_SCENES = window.PB_CONCEPT_SCENES || {};
 *   PB_CONCEPT_SCENES["<id>"] = { draw(ctx, tick) { … } };
 * ctx is the 2D context of a 320×180 canvas, tick grows by 8 per second (one
 * draw every 125 ms). The card shows a scene only when one is registered; scene
 * scripts may load after this file, the card picks them up when they appear. */
(function (root) {
  "use strict";
  const store = root.PBStore, el = root.PBStage.el;
  const W = 320, H = 180, ZOOM = 3, STEP = 125, THUMB = 320;
  const VERDICT = { 待看: "cv-wait", 满意: "cv-ok", 不满意: "cv-no" };
  let mapId = null, timer = 0, tick = 0, playing = true, scene = null, host = null, ctx = null, failed = null, big = null;
  let bigCtx = null, fitBig = null, returnFocus = null;

  const data = () => store.content().concepts || null;
  const maps = () => { const c = data(); return c && Array.isArray(c.maps) ? c.maps : []; };
  const find = (id) => maps().find((m) => m.id === id) || null;
  const scenes = () => root.PB_CONCEPT_SCENES || {};
  const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  // images[].file is a path from the repository root (art/concepts/<id>/…); this page is workbench/index.html.
  const src = (file) => new URL(file, new URL("../", location.href)).href;
  const code = (t) => el("code", { text: t });
  const badge = (text, cls) => el("span", { class: "badge " + cls, text: text || "—" });

  function copy(text) {
    const done = () => root.PBMain && root.PBMain.toast("已复制提示词");
    const fallback = () => {
      const ta = el("textarea", { class: "concept-copy-buffer", readonly: true }); ta.value = text;
      document.body.append(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { /* nothing more to try */ }
      ta.remove();
    };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  }

  // ---- #concepts: every map in one table ----
  function showAll(box) {
    box.append(el("h2", { text: "地图概念" }),
      el("p", { class: "muted", text: "新地图先出概念：会动的概念场景、文字说明和静态概念图；用户满意了再做详细设计和全部美术。概念图只用来挑方向，不进游戏。" }),
      el("p", { class: "small muted" }, ["数据：", code("content/concepts/maps.json"), "；概念图：", code("art/concepts/<id>/"), "；概念场景：", code("workbench/js/concepts/<id>.js"), "。"]));
    const t = el("table", { class: "grid concepts" });
    t.append(el("thead", {}, [el("tr", {}, ["名字", "阶段", "文化", "一句话", "概念图", "用户评价"].map((x) => el("th", { text: x })))]));
    const tb = el("tbody");
    for (const m of maps()) tb.append(el("tr", { "data-id": m.id }, [
      el("td", {}, [el("a", { href: "#concepts/" + m.id, text: m.name || m.id })]),
      el("td", { text: m.stage || "—" }),
      el("td", { text: m.culture || "—" }),
      el("td", { class: "small", text: m.pitch || "" }),
      el("td", { class: "num", text: String(list(m.images).length) }),
      el("td", {}, [badge(m.verdict, VERDICT[m.verdict] || "")]),
    ]));
    t.append(tb);
    box.append(t);
  }

  // ---- #concepts/<id>: the card ----
  function value(v) {
    const xs = list(v).filter((x) => x !== "" && x != null);
    if (!xs.length) return el("span", { class: "muted", text: "—" });
    if (xs.length === 1) return el("span", { text: String(xs[0]) });
    return el("ul", { class: "concept-list" }, xs.map((x) => el("li", { text: String(x) })));
  }
  function mechanisms(ids) {
    if (!list(ids).length) return value(null);
    const out = el("span");
    list(ids).forEach((id, i) => {
      const m = store.mechanism(id);
      if (i) out.append("、");
      out.append(el("a", { href: "#mechanisms/" + id, text: m ? m.name : id }));
    });
    return out;
  }
  function prompt(text) {
    if (!text) return value(null);
    return el("div", {}, [el("pre", { class: "concept-prompt", text }),
      el("button", { class: "btn small", type: "button", id: "concept-copy", text: "复制", onclick: () => copy(text) })]);
  }

  function images(m) {
    const imgs = list(m.images);
    if (!imgs.length) return el("p", { class: "note concept-noimg" }, ["还没有概念图：把图放进 ", code(`art/concepts/${m.id}/`), "，再在 ", code("content/concepts/maps.json"), " 的 ", code("images"), " 里登记一行"]);
    const row = el("div", { class: "concept-images" });
    for (const it of imgs) {
      const file = (it && it.file) || "", note = (it && it.note) || "";
      const img = el("img", { alt: note || file, src: src(file) });
      // Original size times a whole number, nearest neighbour (CSS image-rendering: pixelated).
      img.addEventListener("load", () => { const k = Math.max(1, Math.min(ZOOM, Math.floor(THUMB / img.naturalWidth))); img.style.width = img.naturalWidth * k + "px"; img.style.height = img.naturalHeight * k + "px"; img.dataset.zoom = String(k); });
      img.addEventListener("error", () => { img.replaceWith(el("span", { class: "small", text: "图片打不开：" + file })); });
      row.append(el("button", { class: "concept-thumb", type: "button", title: "看大图", onclick: () => openBig(file, note) },
        [img, el("span", { class: "small", text: note || file })]));
    }
    return row;
  }

  function openBig(file, note) {
    closeBig();
    const img = el("img", { alt: note || file, src: src(file) });
    const fit = () => { if (!img.naturalWidth) return; const k = Math.max(1, Math.floor(Math.min((innerWidth - 48) / img.naturalWidth, (innerHeight - 96) / img.naturalHeight))); img.style.width = img.naturalWidth * k + "px"; img.style.height = img.naturalHeight * k + "px"; img.dataset.zoom = String(k); };
    if (img.complete) fit(); else img.addEventListener("load", fit);
    big = el("div", { class: "concept-lightbox", role: "dialog", "aria-modal": "true", "aria-label": "概念图大图", onclick: closeBig },
      [img, el("p", { class: "small", text: [note, file, "点任意处或按 Esc 关闭"].filter(Boolean).join(" · ") })]);
    document.body.append(big);
    document.addEventListener("keydown", onKey, true);
  }
  function closeBig() {
    if (big) { if (typeof big.close === "function") big.close(); big.remove(); big = null; }
    bigCtx = null;
    if (fitBig) { root.removeEventListener("resize", fitBig); fitBig = null; }
    document.removeEventListener("keydown", onKey, true);
    if (returnFocus && returnFocus.isConnected) returnFocus.focus();
    returnFocus = null;
  }
  function onKey(e) { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeBig(); } }

  function togglePlaying() {
    playing = !playing;
    for (const id of ["concept-play", "concept-big-play"]) {
      const btn = document.getElementById(id);
      if (btn) btn.textContent = playing ? "暂停" : "播放";
    }
  }
  function openSceneBig() {
    if (!scene || !ctx || failed) return;
    closeBig(); returnFocus = document.activeElement;
    const canvas = el("canvas", { width: W, height: H, "aria-label": "放大的概念场景" });
    bigCtx = canvas.getContext("2d"); bigCtx.imageSmoothingEnabled = false;
    const viewport = el("div", { class: "concept-scene-large" }, [canvas]);
    const caption = el("span", { class: "small muted", text: "按 Esc 关闭" });
    big = el("dialog", { class: "concept-scene-lightbox", "aria-label": "概念场景大图" }, [
      el("div", { class: "btn-row" }, [el("h3", { text: (find(mapId) || {}).name || "地图概念" }),
        el("button", { class: "btn small", type: "button", id: "concept-big-play", text: playing ? "暂停" : "播放", onclick: togglePlaying }),
        el("button", { class: "btn small", type: "button", text: "关闭大图", onclick: closeBig })]),
      viewport, caption,
    ]);
    fitBig = () => {
      const zoom = Math.max(1, Math.floor(Math.min(viewport.clientWidth / W, viewport.clientHeight / H)));
      canvas.style.width = W * zoom + "px"; canvas.style.height = H * zoom + "px";
      caption.textContent = `放大 ${zoom} 倍 · 按 Esc 关闭`;
    };
    big.addEventListener("cancel", e => { e.preventDefault(); closeBig(); });
    big.addEventListener("click", e => { if (e.target === big) closeBig(); });
    document.body.append(big); big.showModal(); fitBig(); draw();
    root.addEventListener("resize", fitBig);
    document.addEventListener("keydown", onKey, true);
  }

  // The scene area follows the registry: placeholder until PB_CONCEPT_SCENES[id] exists.
  function syncScene(force) {
    if (!host || !mapId) return;
    const s = scenes()[mapId], use = s && typeof s.draw === "function" ? s : null;
    if (!force && use === scene) return;
    scene = use; failed = null; tick = 0; ctx = null; host.textContent = "";
    if (!scene) {
      host.append(el("div", { class: "concept-scene-empty", text: "还没有概念场景" }));
      return;
    }
    const canvas = el("canvas", { class: "concept-scene", width: W, height: H, "aria-label": "概念场景", role: "button", tabindex: 0, title: "点击放大预览",
      onclick: openSceneBig, onkeydown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSceneBig(); } } });
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const btn = el("button", { class: "btn small", type: "button", id: "concept-play", text: playing ? "暂停" : "播放",
      onclick: togglePlaying });
    host.append(el("div", { class: "concept-scene-frame" }, [canvas]),
      el("div", { class: "btn-row" }, [btn,
        el("button", { class: "btn small", type: "button", id: "concept-enlarge", text: "放大预览", onclick: openSceneBig }),
        el("span", { class: "small muted", text: `${W}×${H}，放大 ${ZOOM} 倍，每秒 ${1000 / STEP} 帧` })]));
    draw();
  }
  function draw() {
    if (!scene || !ctx || failed) return;
    ctx.save();
    try {
      ctx.clearRect(0, 0, W, H); scene.draw(ctx, tick);
      if (bigCtx) { bigCtx.clearRect(0, 0, W, H); bigCtx.drawImage(ctx.canvas, 0, 0); }
    }
    catch (e) { failed = e; host.append(el("p", { class: "note", text: "概念场景出错：" + (e && e.message ? e.message : String(e)) })); }
    finally { ctx.restore(); }
  }
  function onTick() {
    const sec = document.getElementById("view-concepts");
    if (!sec || sec.hidden) { stop(); return; }
    syncScene(false);
    if (scene && playing && !failed) { tick++; draw(); }
  }
  function start() { if (!timer) timer = setInterval(onTick, STEP); }
  function stop() { if (timer) { clearInterval(timer); timer = 0; } }

  function showCard(box, m) {
    box.append(el("p", { class: "small" }, [el("a", { href: "#concepts", text: "‹ 全部地图概念" })]),
      el("h2", {}, [m.name || m.id, " ", el("span", { class: "small muted mono", text: m.id })]),
      el("div", { class: "btn-row" }, [badge("阶段 · " + (m.stage || "—"), "cv-stage"), badge("用户评价 · " + (m.verdict || "—"), VERDICT[m.verdict] || ""), m.culture ? el("span", { class: "small muted", text: m.culture }) : null]));
    if (m.stage === "暂停") box.append(el("p", { class: "note concept-paused", text: m.pause_note || "这张地图暂时搁置，保留概念预览，详细房间设计以后再做。" }));
    host = el("div", { class: "concept-scene-host", id: "concept-scene" });
    box.append(el("h3", { text: "概念场景" }), host);
    syncScene(true);
    box.append(el("h3", { text: "静态概念图" }), images(m), el("h3", { text: "说明" }));
    const dl = el("dl", { class: "meta sheet concept-sheet" });
    const row = (label, node) => dl.append(el("dt", { text: label }), el("dd", {}, [node]));
    row("一句话", value(m.pitch));
    row("画面", value(m.look));
    row("地标", value(m.landmarks));
    row("环境效果", value(m.ambient));
    row("怪物和动物", value(m.fauna));
    row("角色", value(m.cast));
    row("机制", mechanisms(m.mechanisms));
    row("为什么选它", value(m.why));
    row("生成提示词", prompt(m.prompt));
    row("已有设计文档", m.doc ? el("span", { class: "mono", text: m.doc }) : value(null));
    box.append(dl);
  }

  function show(id) {
    stop(); closeBig();
    host = null; scene = null; ctx = null; mapId = null; failed = null;
    const box = document.getElementById("concepts-root");
    box.textContent = "";
    if (!data()) { box.append(el("h2", { text: "地图概念" }), el("p", { class: "note", text: "没有找到概念数据。请在仓库根目录运行 node tools/content.mjs build。" })); return; }
    const key = (id || "").split("/")[0];
    if (!key) { showAll(box); return; }
    const m = find(key);
    if (!m) { box.append(el("h2", { text: "地图概念" }), el("p", { class: "note" }, ["没有这张地图：", code(key), "。", el("a", { href: "#concepts", text: "看全部地图概念" })])); return; }
    mapId = m.id; playing = true; tick = 0;
    showCard(box, m);
    start();
  }
  function hide() { stop(); closeBig(); }
  // Menu item and breadcrumb (main.js → PBNav.setCurrent): 「全部」 or the map's own item.
  function where(id) {
    const m = id ? find(id.split("/")[0]) : null;
    return m ? { key: "concepts/" + m.id, trail: [m.name || m.id] } : { key: "concepts", trail: [id || "全部"] };
  }

  root.PBConcepts = { show, hide, where, state: () => ({ mapId, scene: !!scene, playing, tick, failed: failed ? String(failed.message || failed) : null }) };
})(window);
