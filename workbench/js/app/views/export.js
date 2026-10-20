/* View 5 · Export & handoff: local drafts → edits file; repository export status. */
(function (root) {
  "use strict";
  const store = root.PBStore, el = root.PBStage.el;

  function editsFile() {
    const drafts = store.drafts();
    return { format: "pushbox.art-edits/1", created: new Date().toISOString(),
      edits: Object.keys(drafts).sort().map((id) => ({ id, base_version: drafts[id].base_version, base_hash: drafts[id].base_hash, saved_at: drafts[id].saved_at, frames: drafts[id].frames })) };
  }

  function show() {
    const box = document.getElementById("export-root");
    box.textContent = "";
    const drafts = store.drafts(), ids = Object.keys(drafts).sort();
    box.append(el("h2", { text: "导出与交接" }));
    if (!store.storageOk()) box.append(el("p", { class: "note", text: "浏览器禁止本地存储：修改不会在刷新后保留，请及时导出。" }));

    box.append(el("h3", { text: "1. 本浏览器中的修改" }));
    if (!ids.length) box.append(el("p", { class: "muted", text: "没有未导出的修改。在「编辑与对比」中的每一笔都会自动暂存在这里。" }));
    else {
      const t = el("table", { class: "grid" });
      t.append(el("thead", {}, [el("tr", {}, ["资产", "基于版本", "最后修改", ""].map((x) => el("th", { text: x })))]));
      const tb = el("tbody");
      for (const id of ids) {
        const d = drafts[id], a = store.asset(id);
        const stale = a.version !== d.base_version;
        tb.append(el("tr", {}, [el("td", {}, [el("a", { href: "#edit/" + id, text: a.name }), el("div", { class: "mono", text: id })]),
          el("td", { class: "mono", text: `v${d.base_version}${stale ? `（仓库已是 v${a.version}）` : ""}` }),
          el("td", { class: "mono", text: d.saved_at.replace("T", " ").slice(0, 19) }),
          el("td", {}, [el("button", { class: "btn danger", type: "button", text: "放弃", onclick: () => { if (confirm(`放弃 ${a.name} 的本地修改？`)) { store.discardDraft(id); show(); } } })])]));
      }
      t.append(tb); box.append(t);
      box.append(el("div", { class: "btn-row" }, [
        el("button", { class: "btn primary", type: "button", text: `下载修改文件（${ids.length} 项）`, onclick: () => root.PBMain.download(`pushbox-art-edits-${Date.now()}.json`, JSON.stringify(editsFile())) }),
      ]));
      box.append(el("p", { class: "small muted", text: "把下载的文件交给 Claude（或在仓库根目录运行 node tools/art.mjs import <文件>）。导入后每项资产生成新版本并进入「待确认」，工作台重新构建后显示。导入成功前请不要清除浏览器数据。" }));
    }

    box.append(el("h3", { text: "2. 仓库导出状态" }));
    const counts = { approved: 0, review: 0, draft: 0 };
    for (const a of store.assets()) counts[a.status] = (counts[a.status] || 0) + 1;
    box.append(el("dl", { class: "meta" }, [
      el("dt", { text: "构建时间" }), el("dd", { class: "mono", text: store.bundle.built || "—" }),
      el("dt", { text: "已确认（可进游戏）" }), el("dd", { text: `${counts.approved} 项 → art/export/approved/` }),
      el("dt", { text: "未确认（只能当占位）" }), el("dd", { text: `${counts.review + (counts.draft || 0)} 项 → art/export/preview/` }),
      el("dt", { text: "清单" }), el("dd", { class: "mono", text: "art/export/manifest.json" }),
    ]));
    box.append(el("h3", { text: "3. 参考画面（HTML 与游戏对照用）" }));
    const t2 = el("table", { class: "grid" });
    t2.append(el("thead", {}, [el("tr", {}, ["文件", "所含资产全部已确认"].map((x) => el("th", { text: x })))]));
    const tb2 = el("tbody");
    for (const r of store.bundle.references || []) tb2.append(el("tr", {}, [el("td", { class: "mono", text: r.file }), el("td", { text: r.all_approved ? "是" : `否（${r.unapproved.length} 项未确认）` })]));
    t2.append(tb2); box.append(t2);
    box.append(el("h3", { text: "4. 交给 Godot 的规则" }), el("ul", {}, [
      el("li", { text: "只使用 manifest 中 approved 不为空的版本；发布构建遇到未确认资产时报错。" }),
      el("li", { text: "PNG 以最近邻采样导入，关闭 mipmap 与压缩；按 manifest 的帧尺寸、锚点和动画表切帧。" }),
      el("li", { text: "游戏截图与 art/export/reference/ 中的同名参考图逐像素对照（流体颗粒除外）。" }),
      el("li", {}, ["完整流程见 ", el("span", { class: "mono", text: "docs/design/art-pipeline.md" }), "。"]),
    ]));
  }
  root.PBExport = { show };
})(window);
