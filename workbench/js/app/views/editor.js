/* View 3 · Edit & compare. Pixel editor for sprite assets. Every stroke is
 * auto-saved to this browser as a local draft (never to the repository); the
 * Export view turns drafts into a file that tools/art.mjs imports. */
(function (root) {
  "use strict";
  const PB = root.PB, store = root.PBStore, el = root.PBStage.el;
  let id = null, frames = null, frameIdx = 0, color = "z", tool = "pen", undo = [], redo = [], zoom = 20;
  let compareWith = "repo", showDiff = false, preview = null;

  function pickAsset(listBox) {
    listBox.textContent = "";
    listBox.append(el("div", { class: "group-title", text: "可编辑的像素资产" }));
    for (const a of store.assets().filter((x) => x.kind === "sprite")) {
      const st = store.status(a.id);
      listBox.append(el("button", { class: "list-btn", type: "button", "aria-current": String(a.id === id), onclick: () => { location.hash = "#edit/" + a.id; } }, [el("span", { text: a.name }), el("span", { class: "badge " + st, text: store.statusLabel(st) })]));
    }
  }

  function setPixel(x, y, code) {
    const row = frames[frameIdx][y];
    if (row[x] === code) return false;
    frames[frameIdx][y] = row.slice(0, x) + code + row.slice(x + 1);
    return true;
  }
  function fill(x, y, code) {
    const target = frames[frameIdx][y][x]; if (target === code) return false;
    const a = store.asset(id), [w, h] = a.size, stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cy < 0 || cx >= w || cy >= h || frames[frameIdx][cy][cx] !== target) continue;
      setPixel(cx, cy, code); stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    return true;
  }
  function snapshot() { return frames.map((f) => f.slice()); }
  function commit() {
    if (JSON.stringify(store.original(id).frames) === JSON.stringify(frames)) { if (store.drafts()[id]) store.discardDraft(id); }
    else store.setDraft(id, snapshot());
    status(); drawAll();
  }

  function drawEditor(canvas) {
    const a = store.asset(id), [w, h] = a.size;
    canvas.width = w * zoom + 1; canvas.height = h * zoom + 1;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = frames[frameIdx][y][x];
      ctx.fillStyle = c === "." ? ((x + y) % 2 ? "#9a9a9a" : "#b8b8b8") : PB.PALETTE[c];
      ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
      if (showDiff) {
        const base = baseFrames()[frameIdx];
        if (base && base[y][x] !== c) { ctx.strokeStyle = "#ff0044"; ctx.lineWidth = 2; ctx.strokeRect(x * zoom + 2, y * zoom + 2, zoom - 4, zoom - 4); }
      }
    }
    ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 1;
    for (let x = 0; x <= w; x++) { ctx.beginPath(); ctx.moveTo(x * zoom + .5, 0); ctx.lineTo(x * zoom + .5, h * zoom); ctx.stroke(); }
    for (let y = 0; y <= h; y++) { ctx.beginPath(); ctx.moveTo(0, y * zoom + .5); ctx.lineTo(w * zoom, y * zoom + .5); ctx.stroke(); }
    ctx.strokeStyle = "rgba(255,0,68,.6)";
    ctx.beginPath(); ctx.moveTo(a.anchor[0] * zoom + .5, (a.anchor[1] - .3) * zoom); ctx.lineTo(a.anchor[0] * zoom + .5, a.anchor[1] * zoom); ctx.stroke();
  }

  function baseFrames() {
    if (compareWith === "repo") return store.original(id).frames;
    const h = store.history(compareWith); return h ? h.frames : store.original(id).frames;
  }
  function frameCanvas(rows, z) {
    const a = store.asset(id), c = document.createElement("canvas");
    c.width = a.size[0]; c.height = a.size[1];
    const r = new PB.Raster(a.size[0], a.size[1]); r.blitRows(rows, 0, 0, false);
    c.getContext("2d").putImageData(new ImageData(r.data, r.w, r.h), 0, 0);
    c.style.width = a.size[0] * z + "px"; c.style.height = a.size[1] * z + "px"; c.style.imageRendering = "pixelated";
    c.style.background = "#3a4466";
    return c;
  }

  let ui = {};
  function drawAll() {
    drawEditor(ui.canvas);
    ui.compare.textContent = "";
    const base = baseFrames()[frameIdx];
    for (const z of [1, 4]) {
      ui.compare.append(el("figure", {}, [frameCanvas(base, z), el("figcaption", { text: (compareWith === "repo" ? "仓库版本" : compareWith) + ` · ${z}×` })]));
      ui.compare.append(el("figure", {}, [frameCanvas(frames[frameIdx], z), el("figcaption", { text: `当前编辑 · ${z}×` })]));
    }
    ui.frames.textContent = "";
    frames.forEach((f, i) => ui.frames.append(el("button", { type: "button", "aria-current": String(i === frameIdx), title: "帧 " + i, onclick: () => { frameIdx = i; drawAll(); } }, [frameCanvas(f, 2)])));
    if (preview) preview.refresh();
  }
  function status() {
    const d = store.drafts()[id];
    ui.status.textContent = d ? `已自动暂存在本浏览器（${d.saved_at.slice(11, 19)}），尚未导出到仓库。` : "与仓库版本一致。";
    ui.status.className = d ? "note small" : "note info-note small";
  }

  function show(newId) {
    const rootEl = document.getElementById("edit-root");
    const sprites = store.assets().filter((x) => x.kind === "sprite");
    if (newId && store.asset(newId) && store.asset(newId).kind === "sprite") id = newId;
    if (!id) id = sprites[0].id;
    const a = store.asset(id), eff = store.effective(id);
    frames = eff.frames.map((f) => f.slice()); frameIdx = Math.min(frameIdx, frames.length - 1); undo = []; redo = [];
    compareWith = "repo";
    zoom = Math.max(8, Math.min(24, Math.floor(420 / Math.max(a.size[0], a.size[1]))));
    rootEl.textContent = "";
    const side = el("aside", { class: "side" }); pickAsset(side);
    const work = el("div", { class: "work" });
    const info = el("aside", { class: "info" });
    rootEl.append(side, work, info);

    // Tools and palette.
    const tools = el("div", { class: "seg", role: "group", "aria-label": "工具" });
    for (const [t, label, keyHint] of [["pen", "画笔", "B"], ["erase", "橡皮", "E"], ["pick", "取色", "I"], ["fill", "填充", "F"]]) {
      tools.append(el("button", { type: "button", "aria-pressed": String(tool === t), title: `${label}（${keyHint}）`, text: label, "data-tool": t, onclick: () => setTool(t) }));
    }
    const pal = el("div", { class: "palette", role: "group", "aria-label": "调色板" });
    for (const c of [".", ...PB.CODES]) {
      const b = el("button", { type: "button", "aria-pressed": String(c === color), title: c === "." ? "透明" : `${c} ${PB.PALETTE[c]}`, "data-code": c, class: c === "." ? "transparent" : "", onclick: () => setColor(c) });
      if (c !== ".") b.style.background = PB.PALETTE[c];
      pal.append(b);
    }
    ui.canvas = el("canvas", { class: "editor-canvas", "aria-label": "像素画布" });
    ui.frames = el("div", { class: "frames", "aria-label": "帧" });
    ui.status = el("p", {});
    const zoomSel = el("select", { "aria-label": "画布放大", onchange: () => { zoom = Number(zoomSel.value); drawAll(); } });
    for (const z of [8, 12, 16, 20, 24, 32]) zoomSel.append(el("option", { value: String(z), text: z + "×" }));
    zoomSel.value = String([8, 12, 16, 20, 24, 32].reduce((p, z) => (Math.abs(z - zoom) < Math.abs(p - zoom) ? z : p), 8)); zoom = Number(zoomSel.value);
    const undoBtn = el("button", { class: "btn", type: "button", text: "撤销", title: "Ctrl+Z", onclick: doUndo });
    const redoBtn = el("button", { class: "btn", type: "button", text: "重做", title: "Ctrl+Shift+Z", onclick: doRedo });
    const resetBtn = el("button", { class: "btn danger", type: "button", text: "放弃本地修改", onclick: () => { if (!store.drafts()[id] || confirm("放弃此资产在本浏览器中的全部修改？")) { store.discardDraft(id); show(id); } } });
    work.append(el("div", { class: "btn-row" }, [el("h2", { text: `${a.name}` }), el("span", { class: "mono", text: `${a.id} · 基于 v${a.version}` })]),
      el("div", { class: "btn-row" }, [tools, undoBtn, redoBtn, el("label", { class: "small muted" }, ["画布 ", zoomSel]), resetBtn]),
      ui.status, el("div", { class: "stage-frame" }, [ui.canvas]), el("h3", { text: "帧（点击切换）" }), ui.frames);
    side.prepend(el("div", { class: "group-title", text: "颜色（ENDESGA 32）" }), pal, el("p", { class: "small muted", text: "左键绘制，右键取色。快捷键：B 画笔、E 橡皮、I 取色、F 填充、[ ] 切换帧。" }));

    // Compare + live preview.
    const cmpSel = el("select", { "aria-label": "对比对象", onchange: () => { compareWith = cmpSel.value; drawAll(); } });
    cmpSel.append(el("option", { value: "repo", text: `仓库当前版本 v${a.version}` }));
    for (const v of a.approved_versions || []) cmpSel.append(el("option", { value: `${a.id}@v${v.version}`, text: `已确认 v${v.version}` }));
    const diffBtn = el("button", { class: "btn", type: "button", "aria-pressed": "false", text: "标出差异", onclick: () => { showDiff = !showDiff; diffBtn.setAttribute("aria-pressed", String(showDiff)); drawAll(); } });
    ui.compare = el("div", { class: "compare" });
    const animHost = el("div", { class: "stage-host" });
    info.append(el("h2", { text: "对比" }), el("div", { class: "btn-row" }, [cmpSel, diffBtn]), ui.compare, el("h3", { text: "动画预览（含本地修改）" }), animHost);
    const names = Object.keys(a.animations); let anim = names[0];
    const animSel = el("select", { "aria-label": "动画", onchange: () => { anim = animSel.value; if (preview) preview.setTick(0); } });
    for (const n of names) animSel.append(el("option", { value: n, text: n }));
    if (preview) preview.destroy();
    preview = root.PBStage.create(animHost, { width: a.size[0], height: a.size[1], animated: true, backgrounds: ["dark", "checker", "light"], maxHeight: 160, maxFit: 8, extras: [animSel],
      frameKey: tick => PB.sprites.frameAt(a, anim, tick),
      stepTicks: () => (a.animations[anim].fps ? Math.round(60 / a.animations[anim].fps) : 60),
      draw: (r, tick) => r.blitRows(frames[PB.sprites.frameAt(a, anim, tick)], 0, 0, false) });

    // Painting.
    let painting = false;
    const cell = (e) => { const b = ui.canvas.getBoundingClientRect(); return [Math.floor((e.clientX - b.left) / (b.width / a.size[0])), Math.floor((e.clientY - b.top) / (b.height / a.size[1]))]; };
    const apply = (e) => {
      const [x, y] = cell(e); if (x < 0 || y < 0 || x >= a.size[0] || y >= a.size[1]) return false;
      if (e.button === 2 || tool === "pick") { setColor(frames[frameIdx][y][x]); return false; }
      if (tool === "fill") return fill(x, y, color);
      return setPixel(x, y, tool === "erase" ? "." : color);
    };
    ui.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    ui.canvas.addEventListener("pointerdown", (e) => {
      const before = snapshot();
      if (apply(e)) { undo.push(before); redo = []; drawAll(); }
      painting = e.button === 0 && (tool === "pen" || tool === "erase");
      if (painting) { ui.canvas.setPointerCapture(e.pointerId); ui.pending = before; }
      else if (store.drafts()[id] !== undefined || undo.length) commit();
    });
    ui.canvas.addEventListener("pointermove", (e) => { if (painting && apply(e)) drawEditor(ui.canvas); });
    ui.canvas.addEventListener("pointerup", () => { if (painting) { painting = false; commit(); } });
    status(); drawAll();
  }
  function setTool(t) { tool = t; for (const b of document.querySelectorAll("[data-tool]")) b.setAttribute("aria-pressed", String(b.dataset.tool === t)); }
  function setColor(c) { color = c; if (tool === "erase" || tool === "pick") setTool("pen"); for (const b of document.querySelectorAll("[data-code]")) b.setAttribute("aria-pressed", String(b.dataset.code === c)); }
  function doUndo() { if (!undo.length) return; redo.push(snapshot()); frames = undo.pop(); commit(); }
  function doRedo() { if (!redo.length) return; undo.push(snapshot()); frames = redo.pop(); commit(); }
  function onKey(e) {
    if (e.target.closest("input, select, textarea")) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === "z") { e.shiftKey ? doRedo() : doUndo(); e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && k === "y") { doRedo(); e.preventDefault(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === "b") setTool("pen"); else if (k === "e") setTool("erase"); else if (k === "i") setTool("pick"); else if (k === "f") setTool("fill");
    else if (k === "[") { frameIdx = (frameIdx + frames.length - 1) % frames.length; drawAll(); }
    else if (k === "]") { frameIdx = (frameIdx + 1) % frames.length; drawAll(); }
  }
  root.PBEditor = { show, onKey, hide: () => preview && preview.setVisible(false), wake: () => preview && preview.setVisible(true) };
})(window);
