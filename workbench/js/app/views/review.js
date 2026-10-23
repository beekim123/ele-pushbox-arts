/* View 4 · Review & approve. The page cannot write to the repository: it builds
 * an exact list of asset@version#hash that the user sends in chat (or as a file),
 * and only `node tools/art.mjs approve` turns that into an approval record. */
(function (root) {
  "use strict";
  const PB = root.PB, store = root.PBStore, el = root.PBStage.el;
  const ORDER = ["character", "monster", "avatar", "object", "mechanism", "item", "cargo", "fx", "ui", "terrain", "material", "screen"];

  function approvalText() {
    const sel = store.review().selected, fb = store.review().feedback;
    const lines = [];
    const ids = Object.keys(sel).sort();
    if (ids.length) {
      lines.push("美术确认：通过以下 " + ids.length + " 项（版本与哈希必须一致）");
      for (const id of ids) lines.push(`- ${id}@v${sel[id].version} #${sel[id].hash.slice(0, 12)}`);
    }
    const fids = Object.keys(fb).sort();
    if (fids.length) {
      if (lines.length) lines.push("");
      lines.push("美术需修改：");
      for (const id of fids) lines.push(`- ${id}@v${fb[id].version}：${fb[id].text}`);
    }
    return lines.join("\n");
  }
  function requestFile() {
    const sel = store.review().selected, fb = store.review().feedback;
    return { format: "pushbox.approval-request/1", created: new Date().toISOString(), note: "由工作台生成；由 `node tools/art.mjs approve --via workbench` 记录后才算确认。",
      approve: Object.keys(sel).sort().map((id) => ({ asset: id, version: sel[id].version, hash: sel[id].hash })),
      changes: Object.keys(fb).sort().map((id) => ({ asset: id, version: fb[id].version, request: fb[id].text })) };
  }

  const PREF_KEY = "pushbox.review.preferences.v1", ZOOMS = [2, 3, 4, 6];
  const CAT = Object.assign({}, root.PBAssets.CAT, { monster: "怪物", avatar: "头像", cargo: "货物" });
  const prefs = { batch: "all", status: "review", cat: "all", q: "", zooms: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(PREF_KEY) || "null");
    if (saved && typeof saved === "object") {
      for (const key of ["batch", "status", "cat", "q"]) if (typeof saved[key] === "string") prefs[key] = saved[key];
      if (saved.zooms && typeof saved.zooms === "object") for (const [id, z] of Object.entries(saved.zooms)) if (ZOOMS.includes(z)) prefs.zooms[id] = z;
    }
  } catch (e) { /* Storage may be unavailable on file:// or in private browsing. */ }
  function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* Keep working without persistence. */ } }

  let lightbox = null, searchTimer = 0;
  function closeLightbox() {
    if (!lightbox) return;
    const old = lightbox; lightbox = null;
    old.preview.destroy(); old.dialog.close(); old.dialog.remove();
    root.removeEventListener("resize", old.fit);
  }
  root.addEventListener("hashchange", () => { if (location.hash.split("/")[0] !== "#review") closeLightbox(); });

  function makePreview(a, z, live) {
    const w = a.kind === "sprite" ? a.size[0] : 320, h = a.kind === "sprite" ? a.size[1] : 180;
    let action = Object.keys(a.animations || {})[0], stage = null;
    const canvas = live ? el("div", { class: "stage-host" }) : root.PBAssets.thumb(a, w, h);
    if (live) {
      stage = root.PBStage.create(canvas, { width: w, height: h, animated: true, maxFit: 12,
        frameKey: a.kind === "sprite" ? tick => PB.sprites.frameAt(a, action, tick) : null,
        draw: (r, tick) => {
          if (a.kind === "sprite") r.blitRows(a.frames[PB.sprites.frameAt(a, action, tick)], 0, 0, false);
          else root.PBAssets.drawProcedural(r, a, tick);
        } });
    }
    return { canvas, width: w, height: h,
      zoom: n => {
        const target = stage ? stage.canvas : canvas;
        target.style.width = w * n + "px"; target.style.height = h * n + "px";
      },
      action: name => {
        action = name;
        if (stage) stage.setTick(0);
        else if (canvas.tagName === "CANVAS") {
          const r = new PB.Raster(w, h); r.blitRows(a.frames[a.animations[name].frames[0]], 0, 0, false);
          canvas.getContext("2d").putImageData(new ImageData(r.data, w, h), 0, 0);
        } else canvas.style.setProperty("--thumb-frame", a.animations[name].frames[0]);
      },
      destroy: () => { if (stage) stage.destroy(); },
    };
  }
  function actionSelect(a, preview) {
    const names = Object.keys(a.animations || {});
    if (!names.length) return null;
    const select = el("select", { "aria-label": "动作 " + a.name, onchange: () => preview.action(select.value) });
    for (const name of names) select.append(el("option", { value: name, text: name }));
    return el("label", { class: "review-control", text: "动作 " }, [select]);
  }
  function enlarge(a) {
    closeLightbox();
    const dialog = el("dialog", { class: "review-lightbox", "aria-label": "大图 " + a.name });
    const preview = makePreview(a, 1, true), host = el("div", { class: "review-large-preview" }, [preview.canvas]);
    const caption = el("p", { class: "small muted" });
    const fit = () => {
      const z = Math.max(1, Math.floor(Math.min(host.clientWidth / preview.width, host.clientHeight / preview.height)));
      preview.zoom(z); caption.textContent = `${a.name} · ${a.id} · ×${z} · Esc 关闭`;
    };
    dialog.append(el("div", { class: "review-heading" }, [el("h2", { text: a.name }),
      el("button", { class: "btn", type: "button", text: "关闭大图", onclick: closeLightbox })]), host,
      el("div", { class: "btn-row" }, [actionSelect(a, preview), caption]));
    lightbox = { dialog, preview, fit };
    dialog.addEventListener("cancel", e => { e.preventDefault(); closeLightbox(); });
    dialog.addEventListener("click", e => { if (e.target === dialog) closeLightbox(); });
    document.getElementById("review-root").append(dialog); dialog.showModal(); fit();
    root.addEventListener("resize", fit);
  }

  function show() {
    clearTimeout(searchTimer); closeLightbox();
    store.pruneReview();
    const box = document.getElementById("review-root");
    box.textContent = "";
    const assets = store.assets().slice().sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category) || a.id.localeCompare(b.id));
    const data = (root.PB_BUNDLE || {}).reviewBatches || [];
    const batches = (Array.isArray(data) ? data : data.batches || []).map(b => ({ id: b.id, name: b.name, about: b.about, assets: assets.filter(a => b.assets.includes(a.id)) }));
    const assigned = new Set(batches.flatMap(b => b.assets.map(a => a.id)));
    batches.push({ id: "other", name: "其他", about: "尚未归入批次的资产", assets: assets.filter(a => !assigned.has(a.id)) });
    if (prefs.batch !== "all" && !batches.some(b => b.id === prefs.batch)) prefs.batch = "all";
    if (!["review", "approved", "all"].includes(prefs.status)) prefs.status = "review";
    const categories = [...new Set(assets.map(a => a.category))];
    if (prefs.cat !== "all" && !categories.includes(prefs.cat)) prefs.cat = "all";
    const counts = { approved: 0, review: 0, draft: 0, local: 0 };
    for (const a of assets) counts[store.status(a.id)]++;
    box.append(el("h2", { text: "确认美术" }),
      el("p", { class: "muted", text: `共 ${assets.length} 项：待确认 ${counts.review}、已确认 ${counts.approved}、草稿 ${counts.draft}、本地修改 ${counts.local}。` }),
      el("p", { class: "note small", text: "勾选你实际看过并认可的具体版本，再复制确认文字或下载文件交回。勾选不等于确认；只有用户确认并记录进 art/approvals.json 的版本才能进入游戏。修改意见会一起交回。" }));

    const sidebar = el("nav", { class: "review-batches", "aria-label": "美术批次" });
    const content = el("div", { class: "review-content" });
    const filters = el("div", { class: "review-filters" }), results = el("div", { id: "review-results" });
    const status = el("select", { id: "review-status", onchange: () => { prefs.status = status.value; changed(); } });
    for (const [value, name] of [["review", "待确认"], ["approved", "已确认"], ["all", "全部"]]) status.append(el("option", { value, text: name }));
    status.value = prefs.status;
    const cat = el("select", { id: "review-category", onchange: () => { prefs.cat = cat.value; changed(); } });
    cat.append(el("option", { value: "all", text: "全部类别" }));
    for (const key of categories) cat.append(el("option", { value: key, text: CAT[key] || key }));
    cat.value = prefs.cat;
    const search = el("input", { id: "review-search", type: "search", placeholder: "搜索名字 / 编号", value: prefs.q,
      oninput: () => { clearTimeout(searchTimer); const value = search.value; searchTimer = setTimeout(() => { prefs.q = value; changed(); }, 150); } });
    filters.append(el("label", { class: "review-control", text: "状态 " }, [status]), el("label", { class: "review-control", text: "类别 " }, [cat]),
      el("label", { class: "review-search", text: "搜索 " }, [search]));
    content.append(filters, results);
    box.append(el("div", { class: "review-layout" }, [sidebar, content]));

    const out = el("textarea", { readonly: true, "aria-label": "确认文字" });
    const copy = el("button", { class: "btn primary", type: "button", text: "复制确认文字", onclick: async () => {
      try { await navigator.clipboard.writeText(out.value); root.PBMain.toast("已复制，请粘贴到聊天里。"); }
      catch (e) { out.closest("details").open = true; out.focus(); out.select(); root.PBMain.toast("浏览器不允许自动复制，已选中文字，请按 Ctrl/⌘+C。"); }
    } });
    const dl = el("button", { class: "btn", type: "button", text: "下载确认文件", onclick: () => root.PBMain.download(`pushbox-approval-request-${Date.now()}.json`, JSON.stringify(requestFile(), null, 2)) });
    const sum = el("p", { id: "review-summary", role: "status" });
    const clear = el("button", { class: "btn", type: "button", text: "清空勾选与意见", onclick: () => { store.clearReview(); renderResults(); summary(); } });
    function summary() {
      const n = Object.keys(store.review().selected).length, m = Object.keys(store.review().feedback).length;
      out.value = approvalText() || "（尚未勾选或填写意见）";
      sum.textContent = `已勾选 ${n} 项、意见 ${m} 条`;
      copy.disabled = dl.disabled = !(n || m);
      root.PBMain.updateBadges();
    }
    function matches(a) {
      if (prefs.status !== "all" && store.status(a.id) !== prefs.status) return false;
      if (prefs.cat !== "all" && a.category !== prefs.cat) return false;
      const q = prefs.q.trim().toLowerCase();
      return !q || a.id.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
    }
    function changed() { savePrefs(); renderResults(); }
    const groups = new Map();
    const noResults = el("p", { class: "muted", text: "没有符合条件的资产。可以切换状态、类别或清空搜索。" });
    function renderResults() {
      closeLightbox(); sidebar.textContent = "";
      sidebar.append(el("h3", { text: "按批次查看" }));
      const batchButton = (id, name, list) => sidebar.append(el("button", { class: "list-btn", type: "button", "data-batch": id, "aria-current": String(prefs.batch === id),
        text: `${name} · ${list.filter(matches).length} / ${list.length}`, onclick: () => { prefs.batch = id; changed(); } }));
      batchButton("all", "全部批次", assets);
      for (const b of batches) batchButton(b.id, b.name, b.assets);
      let shown = 0;
      for (const b of batches) {
        let group = groups.get(b.id);
        if (!group) {
          const pending = b.assets.filter(a => store.status(a.id) === "review");
          const selectAll = el("button", { class: "btn", type: "button", text: "全选这一批待确认的", disabled: !pending.length,
            onclick: () => { for (const a of pending) store.toggleSelected(a.id, true); renderResults(); summary(); } });
          const node = el("section", { class: "review-group", "aria-label": b.name }), heading = el("h3");
          node.append(el("div", { class: "review-heading" }, [heading, selectAll]), el("p", { class: "small muted", text: b.about || "" }));
          if (b.id === "onboarding") node.append(el("p", { class: "note small" }, [document.createTextNode("这 6 项是关卡里的按键提示、目标发光等。在「美术 › 场景」查看 "),
            el("a", { href: "#scenes/level.M01", text: "M01–M07 的使用效果（打开 M01）" })]));
          const container = el("div", { class: "review-cards" });
          for (const a of b.assets) container.append(card(a));
          node.append(container); results.append(node);
          group = { node, heading, container }; groups.set(b.id, group);
        }
        const inBatch = prefs.batch === "all" || prefs.batch === b.id;
        let count = 0;
        for (const node of group.container.children) {
          node.hidden = !inBatch || !matches(store.asset(node.dataset.asset));
          if (!node.hidden) count++;
          node.querySelector('input[type="checkbox"]').checked = !!store.review().selected[node.dataset.asset];
          node.querySelector('.feedback-input').value = (store.review().feedback[node.dataset.asset] || {}).text || "";
        }
        group.heading.textContent = `${b.name}（${count}）`;
        group.node.hidden = !inBatch || (!count && prefs.batch === "all"); shown += count;
      }
      if (!noResults.isConnected) results.append(noResults);
      noResults.hidden = shown !== 0;
    }
    function card(a) {
      const st = store.status(a.id), effective = store.effective(a.id);
      const cb = el("input", { type: "checkbox", "aria-label": "通过 " + a.name, disabled: st !== "review",
        onchange: () => { store.toggleSelected(a.id, cb.checked); summary(); } });
      cb.checked = !!store.review().selected[a.id];
      const fb = el("input", { class: "feedback-input", type: "text", placeholder: "需要修改时填写", value: (store.review().feedback[a.id] || {}).text || "", "aria-label": "修改意见 " + a.name,
        oninput: () => { store.setFeedback(a.id, fb.value.trim()); summary(); } });
      const preview = makePreview(effective, prefs.zooms[a.id] || 3);
      preview.zoom(prefs.zooms[a.id] || 3);
      const zoom = el("select", { class: "review-zoom", "aria-label": "放大倍数 " + a.name, onchange: () => { prefs.zooms[a.id] = Number(zoom.value); preview.zoom(Number(zoom.value)); savePrefs(); } });
      for (const z of ZOOMS) zoom.append(el("option", { value: String(z), text: "×" + z }));
      zoom.value = String(prefs.zooms[a.id] || 3);
      const usage = Array.from(a.usage || "");
      const why = st === "local" ? "有本地未导出的修改，先导出并重新构建" : st === "approved" ? "已确认" : st === "draft" ? "草稿，尚未提交确认" : "勾选通过这个版本";
      return el("article", { class: "review-card", "data-asset": a.id, "data-status": st }, [
        el("div", { class: "review-heading" }, [el("h4", { text: a.name }), el("span", { class: "badge " + st, text: store.statusLabel(st) })]),
        el("div", { class: "mono", text: a.id }), el("div", { class: "mono muted", text: `v${a.version} #${(a.content_hash || "").slice(0, 8)}` }),
        el("button", { class: "review-preview", type: "button", "aria-label": "放大预览 " + a.name, title: "点击看大图", onclick: () => enlarge(effective) }, [preview.canvas]),
        el("div", { class: "btn-row" }, [el("label", { class: "review-control", text: "放大 " }, [zoom]), actionSelect(effective, preview)]),
        el("p", { class: "review-usage small", title: a.usage || "", text: usage.slice(0, 60).join("") + (usage.length > 60 ? "…" : "") || "暂无用途说明" }),
        el("a", { class: "small", href: "#assets/" + a.id, text: "在资产页打开" }),
        el("label", { class: "review-approve", title: why }, [cb, document.createTextNode(" 通过")]),
        el("label", { class: "small", text: "修改意见" }, [fb]),
      ]);
    }
    box.append(el("details", { class: "review-output" }, [el("summary", { text: "查看将发送给 Claude 的确认文字" }), out]));
    box.append(el("div", { class: "review-bar" }, [sum, el("div", { class: "btn-row" }, [copy, dl, clear])]));
    renderResults(); summary();

    box.append(el("h3", { text: "已记录的确认" }));
    const recs = store.approvals();
    if (!recs.length) box.append(el("p", { class: "muted", text: "还没有任何确认记录。" }));
    for (const r of recs) box.append(el("details", {}, [el("summary", { text: `${r.id} · ${r.date.slice(0, 10)} · ${r.by}（${r.via === "chat" ? "聊天" : "工作台文件"}）· ${r.items.length} 项${r.scope ? " · " + r.scope : ""}` }),
      el("ul", {}, r.items.map((i) => el("li", { class: "mono", text: `${i.asset}@v${i.version} #${i.hash.slice(0, 12)} → ${i.png}` }))), r.note ? el("p", { class: "small", text: r.note }) : null]));
  }
  root.PBReview = { show };
})(window);
