/* Stage: integer-zoom pixel canvas with background, play/pause and frame
 * stepping. Sprite frames redraw on change; procedural previews use a capped
 * clock. Only the active, intersecting stage in a visible page can play. */
(function (root) {
  "use strict";
  const PB = root.PB;
  const ZOOMS = [1, 2, 3, 4, 5, 6, 8, 10, 12];
  const BACKS = { checker: "透明格", dark: "深底", light: "浅底", scene: "场景" };
  const all = new Set();
  let active = null;

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      if (k === "text") e.textContent = attrs[k];
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== false) e.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
    }
    for (const c of children || []) if (c) e.append(c);
    return e;
  }

  function create(host, o) {
    host.textContent = "";
    const state = {
      w: o.width, h: o.height, zoom: o.zoom || 0, back: o.background || (o.backgrounds ? o.backgrounds[0] : null),
      playing: o.animated ? (o.autoplay !== false) : false, tick: 0, visible: true, intersecting: true, timer: 0, last: 0,
      fps: o.fps || 8, slow: 0, verySlow: 0, frameKey: undefined,
    };
    const canvas = el("canvas", { width: state.w, height: state.h, "aria-label": o.label || "像素预览" });
    const ctx = canvas.getContext("2d");
    const frame = el("div", { class: "stage-frame", tabindex: "0" }, [canvas]);
    const bar = el("div", { class: "stage-toolbar" });
    const info = el("span", { class: "small muted" });

    // Zoom control.
    const zoomSel = el("select", { "aria-label": "放大倍数", onchange: () => { state.zoom = Number(zoomSel.value); layout(); } });
    zoomSel.append(el("option", { value: "0", text: "适应窗口" }));
    for (const z of ZOOMS) zoomSel.append(el("option", { value: String(z), text: z + "×" }));
    zoomSel.value = String(state.zoom);
    bar.append(el("label", { class: "small muted" }, ["放大 ", zoomSel]));

    // Background control (sprites only).
    if (o.backgrounds) {
      const seg = el("div", { class: "seg", role: "group", "aria-label": "预览底色" });
      for (const b of o.backgrounds) {
        const btn = el("button", { type: "button", "aria-pressed": String(b === state.back), text: BACKS[b] || b, onclick: () => {
          state.back = b; for (const x of seg.children) x.setAttribute("aria-pressed", String(x === btn)); paintBack(); draw();
        } });
        seg.append(btn);
      }
      bar.append(seg);
    }

    // Playback controls.
    let playBtn = null;
    if (o.animated) {
      playBtn = el("button", { class: "btn", type: "button", onclick: () => setPlaying(!state.playing) });
      const prev = el("button", { class: "btn", type: "button", title: "上一帧（←）", text: "◀", onclick: () => step(-1) });
      const next = el("button", { class: "btn", type: "button", title: "下一帧（→）", text: "▶", onclick: () => step(1) });
      bar.append(el("div", { class: "btn-row" }, [playBtn, prev, next]));
    }
    for (const extra of o.extras || []) bar.append(extra);
    bar.append(el("span", { class: "spacer" }), info);

    const children = o.controls === false ? [frame] : [bar, frame];
    if (o.disclaimer) children.push(el("p", { class: "disclaimer", text: o.disclaimer }));
    if (o.caption) children.push(el("p", { class: "stage-caption", text: o.caption }));
    for (const c of children) host.append(c);

    frame.addEventListener("keydown", (e) => {
      if (o.keyboard === false) return;
      if (e.key === " " && o.animated) { setPlaying(!state.playing); e.preventDefault(); }
      else if (e.key === "ArrowRight" && o.animated) { step(1); e.preventDefault(); }
      else if (e.key === "ArrowLeft" && o.animated) { step(-1); e.preventDefault(); }
      else if (e.key === "+" || e.key === "=") { bumpZoom(1); e.preventDefault(); }
      else if (e.key === "-") { bumpZoom(-1); e.preventDefault(); }
    });

    function bumpZoom(d) {
      const cur = effectiveZoom(), i = ZOOMS.indexOf(cur);
      state.zoom = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? 3 : i) + d))];
      zoomSel.value = String(state.zoom); layout();
    }
    function effectiveZoom() {
      if (state.zoom) return state.zoom;
      if (o.fitWindow) return Math.max(1, Math.floor(Math.min(window.innerWidth / state.w, window.innerHeight / state.h)));
      const availW = Math.max(160, frame.clientWidth - 32), availH = Math.max(160, (o.maxHeight || window.innerHeight * 0.62));
      let z = Math.floor(Math.min(availW / state.w, availH / state.h));
      return Math.max(1, Math.min(o.maxFit || 12, z));
    }
    function layout() {
      const z = effectiveZoom();
      canvas.style.width = state.w * z + "px"; canvas.style.height = state.h * z + "px";
      info.textContent = `${state.w}×${state.h} · ${z}×` + (state.fps < (o.fps || 8) ? ` · 性能模式 · ${state.fps} fps` : "");
      paintBack(z);
    }
    function paintBack(zArg) {
      const z = zArg || effectiveZoom();
      const b = state.back;
      if (b === "checker") canvas.style.background = `repeating-conic-gradient(#8a8a8a 0 25%, #b8b8b8 0 50%) 0 0 / ${z * 8}px ${z * 8}px`;
      else if (b === "dark") canvas.style.background = "#181425";
      else if (b === "light") canvas.style.background = "#c0cbdc";
      else canvas.style.background = "transparent";
    }
    function draw() {
      const started = performance.now();
      const r = new PB.Raster(state.w, state.h);
      try { o.draw(r, state.tick, state.back); }
      catch (err) { console.error(err); info.textContent = "绘制失败：" + err.message; }
      ctx.putImageData(new ImageData(r.data, state.w, state.h), 0, 0);
      state.frameKey = o.frameKey ? o.frameKey(state.tick) : undefined;
      const ms = performance.now() - started;
      state.slow = ms > 40 ? state.slow + 1 : 0;
      state.verySlow = ms > 120 ? state.verySlow + 1 : 0;
      const cap = state.verySlow >= 3 ? 2 : state.slow >= 3 ? 4 : state.fps;
      if (cap < state.fps) { state.fps = cap; layout(); }
      if (o.onFrame) o.onFrame(state.tick);
    }
    function stopClock() {
      if (state.timer) clearTimeout(state.timer);
      state.timer = 0; state.last = 0;
    }
    function running() { return active === api && state.playing && state.visible && state.intersecting && !document.hidden && host.isConnected; }
    function loop() {
      state.timer = 0;
      if (!running()) { state.last = 0; return; }
      const now = performance.now(), delta = now - state.last;
      const steps = Math.floor(delta * 60 / 1000);
      state.tick += steps; state.last += steps * 1000 / 60;
      if (!o.frameKey || o.frameKey(state.tick) !== state.frameKey) draw();
      schedule();
    }
    function schedule() {
      if (running() && !state.timer) state.timer = setTimeout(loop, o.frameKey && state.fps === (o.fps || 8) ? 1000 / 60 : 1000 / state.fps);
    }
    function kick() {
      if (!running()) { stopClock(); return; }
      if (!state.last) state.last = performance.now();
      schedule();
    }
    function setPlaying(p) {
      if (p && active !== api) {
        if (active) active.setPlaying(false);
        active = api;
      }
      state.playing = p;
      if (playBtn) { playBtn.textContent = p ? "暂停" : "播放"; playBtn.setAttribute("aria-pressed", String(p)); }
      if (p) kick(); else stopClock();
    }
    function step(d) {
      setPlaying(false);
      state.tick = Math.max(0, state.tick + d * (o.stepTicks ? o.stepTicks() : 15));
      draw();
    }

    const api = {
      canvas, frame,
      refresh: () => { draw(); },
      resize(w, h) { state.w = w; state.h = h; canvas.width = w; canvas.height = h; layout(); draw(); },
      setVisible(v) { state.visible = v; kick(); },
      wake: kick,
      setTick(t) { state.tick = t; draw(); },
      tick: () => state.tick,
      playing: () => state.playing,
      setPlaying,
      relayout: layout,
      destroy() { state.playing = false; stopClock(); observer.disconnect(); if (active === api) active = null; all.delete(api); },
    };
    const observer = new IntersectionObserver(entries => { state.intersecting = entries[0].isIntersecting; kick(); });
    observer.observe(frame);
    all.add(api);
    layout(); draw(); setPlaying(state.playing);
    return api;
  }

  document.addEventListener("visibilitychange", () => { for (const s of all) s.wake(); });
  window.addEventListener("resize", () => { for (const s of all) s.relayout(); });
  root.PBStage = { create, el };
})(window);


// Responsive detail panels share one lifecycle; wide screens retain their grid slot.
(function (root) {
  "use strict";
  const entries = new Map(), media = root.matchMedia("(max-width: 1100px)");
  function entry(id) {
    if (entries.has(id)) return entries.get(id);
    const panel = document.getElementById(id), slot = document.createComment(id + " wide slot");
    panel.before(slot);
    const dialog = root.PBStage.el("dialog", { class: "detail-drawer", "aria-label": panel.getAttribute("aria-label") });
    const item = { panel, slot, dialog, origin: null, active: false, requested: false };
    const close = root.PBStage.el("button", { class: "btn", type: "button", text: "关闭详情", onclick: () => dismiss(item, true) });
    dialog.append(root.PBStage.el("div", { class: "detail-drawer-head" }, [root.PBStage.el("strong", { text: panel.getAttribute("aria-label") }), close]));
    dialog.addEventListener("cancel", e => { e.preventDefault(); dismiss(item, true); });
    dialog.addEventListener("click", e => { if (e.target === dialog) dismiss(item, true); });
    document.body.append(dialog); entries.set(id, item);
    return item;
  }
  function dismiss(item, focusBack) {
    item.requested = false;
    if (item.dialog.open) item.dialog.close();
    if (focusBack && item.origin) {
      const target = item.origin();
      if (target && target.isConnected) target.focus();
    }
  }
  function sync(item) {
    if (media.matches) {
      if (item.panel.parentNode !== item.dialog) item.dialog.append(item.panel);
      if ((!item.active || !item.requested) && item.dialog.open) item.dialog.close();
      if (item.active && item.requested && !item.dialog.open) {
        item.dialog.showModal(); item.panel.scrollTop = 0;
      }
    } else {
      if (item.dialog.open) item.dialog.close();
      item.slot.after(item.panel);
    }
  }
  root.PBDetailDrawer = {
    origin(id, resolve) { entry(id).origin = resolve; },
    show(id, requested) { const item = entry(id); item.active = true; item.requested = !!requested; sync(item); },
    hide(id) { const item = entries.get(id); if (item) { item.active = false; dismiss(item, false); } },
  };
  media.addEventListener("change", () => { for (const item of entries.values()) sync(item); });
})(window);
