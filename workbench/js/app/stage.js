/* Stage: integer-zoom pixel canvas with background, play/pause and frame
 * stepping. Redraws only on change; the animation loop runs only while playing,
 * while the stage is visible and while the page is visible. */
(function (root) {
  "use strict";
  const PB = root.PB;
  const ZOOMS = [1, 2, 3, 4, 5, 6, 8, 10, 12];
  const BACKS = { checker: "透明格", dark: "深底", light: "浅底", scene: "场景" };
  const all = new Set();

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
      playing: o.animated ? (o.autoplay !== false) : false, tick: 0, visible: true, raf: 0, last: 0,
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

    const children = [bar, frame];
    if (o.disclaimer) children.push(el("p", { class: "disclaimer", text: o.disclaimer }));
    if (o.caption) children.push(el("p", { class: "stage-caption", text: o.caption }));
    for (const c of children) host.append(c);

    frame.addEventListener("keydown", (e) => {
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
      const availW = Math.max(160, frame.clientWidth - 32), availH = Math.max(160, (o.maxHeight || window.innerHeight * 0.62));
      let z = Math.floor(Math.min(availW / state.w, availH / state.h));
      return Math.max(1, Math.min(o.maxFit || 12, z));
    }
    function layout() {
      const z = effectiveZoom();
      canvas.style.width = state.w * z + "px"; canvas.style.height = state.h * z + "px";
      info.textContent = `${state.w}×${state.h} · ${z}×`;
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
      const r = new PB.Raster(state.w, state.h);
      try { o.draw(r, state.tick, state.back); }
      catch (err) { console.error(err); info.textContent = "绘制失败：" + err.message; }
      ctx.putImageData(new ImageData(r.data, state.w, state.h), 0, 0);
      if (o.onFrame) o.onFrame(state.tick);
    }
    function loop(t) {
      state.raf = 0;
      if (!running()) return;
      if (!state.last) state.last = t;
      const frameMs = 1000 / 60, dt = t - state.last;
      const steps = Math.min(6, Math.round(dt / frameMs));
      if (steps > 0) {
        state.tick += steps;
        // Keep the fractional remainder; resetting to t drops alternate RAFs
        // when a 60 Hz display lands just below the frame interval.
        state.last = dt > 6 * frameMs ? t : state.last + steps * frameMs;
        draw();
      }
      state.raf = requestAnimationFrame(loop);
    }
    function running() { return state.playing && state.visible && !document.hidden && host.isConnected; }
    function kick() { if (running() && !state.raf) { state.last = 0; state.raf = requestAnimationFrame(loop); } }
    function setPlaying(p) {
      state.playing = p;
      if (playBtn) { playBtn.textContent = p ? "暂停" : "播放"; playBtn.setAttribute("aria-pressed", String(p)); }
      if (p) kick(); else if (state.raf) { cancelAnimationFrame(state.raf); state.raf = 0; }
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
      setVisible(v) { state.visible = v; if (v) kick(); },
      wake: kick,
      setTick(t) { state.tick = t; draw(); },
      tick: () => state.tick,
      playing: () => state.playing,
      setPlaying,
      relayout: layout,
      destroy() { state.playing = false; if (state.raf) cancelAnimationFrame(state.raf); all.delete(api); },
    };
    all.add(api);
    layout(); draw(); setPlaying(state.playing);
    return api;
  }

  document.addEventListener("visibilitychange", () => { for (const s of all) s.wake(); });
  window.addEventListener("resize", () => { for (const s of all) s.relayout(); });
  root.PBStage = { create, el };
})(window);
