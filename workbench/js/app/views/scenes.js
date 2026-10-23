/* View 1 · Scenes: whole-screen compositions (representative scene, chapter-1
 * levels, UI screens). Level playback uses the design model, not the SDK. */
(function (root) {
  "use strict";
  const PB = root.PB, store = root.PBStore, el = root.PBStage.el;
  let stage = null, current = null, step = 0, grid = false, observe = false;

  // Chapter pictures are rendered at tick 0 by the approved composition.
  // Cache only those static backdrops; the wall and UI keep their live clock.
  const chapterPictures = new Map(), chapterLayers = new Map();
  const setFlat = PB.uiStyle.setFlat;
  PB.uiStyle.setFlat = function (...args) { chapterPictures.clear(); chapterLayers.clear(); return setFlat.apply(this, args); };
  function drawChapterScreen(r, asset, tick, state) {
    const backdrop = PB.uiStyle.backdrop;
    PB.uiStyle.backdrop = function (target, theme, pictureTick, env, props) {
      if (pictureTick !== 0 || props !== true) return backdrop.apply(this, arguments);
      const key = theme + "|" + env + "|" + target.data.length;
      const saved = chapterPictures.get(key);
      if (saved) { target.data.set(saved.pixels); return saved.theme; }
      const result = backdrop.apply(this, arguments);
      chapterPictures.set(key, { pixels: target.data.slice(), theme: result });
      return result;
    };
    const wall = PB.uiStyle.wall, dim = PB.uk.dim;
    const key = JSON.stringify([asset.params, state.focus, state.env, state.showIssues, PB.i18n.getLocale()]);
    try {
      if (!chapterLayers.has(key)) {
        const pixels = new PB.Raster(r.w, r.h), shades = [];
        PB.uiStyle.wall = () => {};
        PB.uk.dim = function(c, amount, box) {
          if (c.r === pixels) shades.push({ amount, box: box && box.slice() });
          return dim.apply(this, arguments);
        };
        try { PB.ui.render(pixels, asset, tick, state); }
        finally { PB.uiStyle.wall = wall; PB.uk.dim = dim; }
        chapterLayers.set(key, { pixels, shades });
      }
      const layer = chapterLayers.get(key), canvas = new PB.uk.C(r);
      wall(canvas, "theme.dungeon", tick, state.env);
      // Preserve the approved cards' dimming of the background at their edges.
      for (const shade of layer.shades) dim(canvas, shade.amount, shade.box);
      r.blit(layer.pixels, 0, 0);
    } finally { PB.uiStyle.backdrop = backdrop; }
  }

  function sceneList() {
    const list = [];
    for (const t of PB.scene.THEMES) {
      const a = store.asset(t);
      if (a) list.push({ group: "代表场景（全要素 × 六主题）", id: "showcase." + t.slice(6), name: a.params.title, kind: "showcase", theme: t, asset: a });
    }
    const lobby = store.assets().find((x) => x.id === "ui.screen.lobby");
    if (lobby) for (const t of PB.scene.THEMES) {
      const a = store.asset(t);
      if (a) list.push({ group: "大厅（随主题切换）", id: "lobby." + t.slice(6), name: "大厅 · " + a.params.title, kind: "screen", asset: lobby, theme: t });
    }
    for (const [key, spec] of Object.entries(PB.matter.SHOWCASES)) {
      const t = PB.scene.CHAPTER_THEME[key], a = store.asset(t);
      if (a) list.push({ group: "第 2–5 章代表场景（新材料与机关）", id: "chapter." + key, name: a.params.title + " · " + PB.i18n.t("level." + spec.id + ".title").replace(/^.*· */, ""), kind: "chapter", theme: t, spec, asset: store.asset("material.chapter2_5") });
    }
    for (const lv of store.levels().filter((l) => Array.isArray(l.map) && l.map.length)) {
      const g = store.group(lv.group), m = g && store.mode(g.mode);
      list.push({ group: g ? `${m ? m.name : ""} · ${g.name}（设计模型）` : "关卡（设计模型）", id: "level." + lv.id, name: lv.id + " " + lv.title, kind: "level", level: lv });
    }
    for (const a of store.assets().filter((x) => x.category === "screen" && x.id !== "ui.screen.lobby")) list.push({ group: "游戏界面", id: a.id, name: a.name, kind: "screen", asset: a });
    return list;
  }

  function renderList(listEl) {
    listEl.textContent = "";
    let group = null;
    for (const s of sceneList()) {
      if (s.group !== group) { group = s.group; listEl.append(el("div", { class: "group-title", text: group })); }
      const badge = s.asset ? statusBadge(s.asset.id) : null;
      listEl.append(el("button", { class: "list-btn", type: "button", "aria-current": String(current && current.id === s.id), "data-scene": s.id, onclick: () => { if (location.hash === "#scenes/" + s.id) show(s.id); else location.hash = "#scenes/" + s.id; } }, [el("span", { text: s.name }), badge]));
    }
  }
  function statusBadge(id) { const st = store.status(id); return el("span", { class: "badge " + st, text: store.statusLabel(st) }); }

  function replayState(lv, n) {
    const res = PB.tilemodel.replay(lv, lv.solution.slice(0, n));
    const last = res.steps[res.steps.length - 1];
    return { parsed: { level: res.level, state: last.state }, action: last.action, result: last.result };
  }

  function poseFor(action, result) {
    if (!action) return { pose: "idle" };
    const facing = /L$/.test(action) ? "left" : /R$/.test(action) ? "right" : undefined;
    const kind = result && result.kind;
    const pose = kind === "push" ? "push" : kind === "dig" ? "dig" : kind === "pour" ? "pour" : kind === "climb" ? "climb" : kind === "walk" || kind === "step" ? "walk" : "idle";
    return { pose, facing };
  }

  // Target highlight for the next author action (dig / pour / bomb).
  function nextTarget(lv, parsed) {
    const a = lv.solution[step];
    const m = a && /^(DIG|POUR|BOMB)_([LRD])$/.exec(a);
    if (!m) return null;
    const d = { L: [-1, 0], R: [1, 0], D: [0, 1] }[m[2]], p = parsed.state.player;
    return { kind: m[1].toLowerCase(), x: p.x + d[0], y: p.y + d[1] };
  }

  let showIssues = false, envMode = "default";

  const LOCALES = [["zh-Hans", "简体中文"], ["en", "English"], ["qps", "伪本地化（长度测试）"]];
  // "default" = the level / theme setting; "lite" = lighting only; "off"; or a weather name.
  function envOpts() {
    if (envMode === "default") return {};
    if (envMode === "lite" || envMode === "off") return { env: envMode };
    return { weather: envMode };
  }
  function themeOfCurrent() {
    const s = current; if (!s) return null;
    return s.theme || (s.level ? PB.scene.themeFor(s.level) : s.asset && s.asset.params.theme) || "theme.dungeon";
  }
  function screenState(s) {
    return { focus: s.asset.params.screen === "hint" ? 2 : s.asset.params.screen === "levels" ? 4 : 0, specs: Object.fromEntries(store.levels().map((l) => [l.id, l])), levelSpec: store.level("M05"), ruleSpec: store.level("M03"), theme: s.theme, showIssues, animate: true, env: envMode === "lite" || envMode === "off" ? envMode : "full" };
  }
  function outline(r, issues) {
    if (!showIssues) return;
    for (const it of issues) { const q = it.rect; r.hline(q.x, q.y, q.w, "A"); r.hline(q.x, q.y + q.h, q.w, "A"); r.vline(q.x, q.y, q.h, "A"); r.vline(q.x + q.w, q.y, q.h + 1, "A"); }
  }

  function draw(r, tick) {
    const s = current;
    PB.i18n.takeIssues();
    if (s.kind === "showcase") { PB.scene.renderLevel(r, PB.scene.SHOWCASE, null, Object.assign({ tick, theme: s.theme, grid, observe, pose: "idle" }, envOpts())); outline(r, PB.i18n.takeIssues()); }
    else if (s.kind === "chapter") { PB.scene.renderLevel(r, s.spec, null, Object.assign({ tick, grid, observe, pose: "idle" }, envOpts())); outline(r, PB.i18n.takeIssues()); }
    else if (s.kind === "level" && root.PBOnboarding && root.PBOnboarding.on()) { root.PBOnboarding.draw(r, tick, Object.assign({ grid, observe }, envOpts())); outline(r, PB.i18n.takeIssues()); }   // UX-03 引导 (onboarding-layer.js)
    else if (s.kind === "level") {
      const st = replayState(s.level, step), p = poseFor(st.action, st.result);
      const won = step === s.level.solution.length && PB.tilemodel.won(st.parsed.level, st.parsed.state);
      PB.scene.renderLevel(r, s.level, st.parsed, Object.assign({ tick, grid, observe, pose: won ? "win" : p.pose, facing: p.facing, target: nextTarget(s.level, st.parsed) }, envOpts()));
      outline(r, PB.i18n.takeIssues());
    } else {
      if (s.asset.params.screen === "chapters") drawChapterScreen(r, s.asset, tick, screenState(s));
      else PB.ui.render(r, s.asset, tick, screenState(s));
    }
  }

  function info(s) {
    const box = document.getElementById("scene-info");
    box.textContent = "";
    if (s.kind === "level") {
      const lv = s.level, mc = store.modelCheck(lv.id);
      box.append(el("h2", { text: `${lv.id} ${lv.title}` }),
        el("p", { text: "绘制示例关：可回放作者解；不包含私有教学说明、验收与验证报告。" }),
        el("p", { class: "mono small", text: `content/levels/${lv.mode}/${lv.group}/${lv.id}.json` }));
    } else if (s.kind === "screen") {
      const a = s.asset;
      box.append(el("h2", { text: a.name }), el("p", { class: "small mono", text: `${a.id} @v${a.version}` }), statusBadge(a.id), el("p", { text: a.usage }), el("p", { class: "small muted", text: a.notes }));
      box.append(el("h3", { text: "用到的资产" }));
      const ul = el("ul"); for (const d of a.depends || []) ul.append(el("li", {}, [el("a", { href: "#assets/" + d, text: d }), " ", statusBadge(d)])); box.append(ul);
      box.append(el("h3", { text: "文字排版检查" }));
      const ul2 = el("ul", { class: "small" });
      for (const [loc, name] of LOCALES) {
        const st = Object.assign(screenState(s), { locale: loc, showIssues: false });
        const issues = PB.ui.render(new PB.Raster(320, 180), a, 0, st);
        ul2.append(el("li", { text: `${name}：` + (issues.length ? `${issues.length} 处放不下（${[...new Set(issues.map((i) => i.key))].slice(0, 4).join("、")}）` : "全部放得下") }));
      }
      box.append(ul2, el("p", { class: "small muted", text: "放不下的文字会被省略或截断，打开「标出溢出」可在画面上看到红框。伪本地化把英文拉长约 40%，用来提前发现以后其他语言的排版问题，只作参考。" }));
      box.append(el("p", { class: "note small", text: "界面中的数字和进度为样例数据。确认的是布局方式、配色和元素样式；文字来自 content/i18n，各语言共用同一套布局规则。" }));
    } else if (s.kind === "chapter") {
      box.append(el("h2", { text: s.name }), el("p", { text: "把这一章新增的材料、机关和特效放进本章主题里，检查它们与地形、人物、HUD 是否协调、是否一眼能分清。" }));
      box.append(el("p", { class: "small muted", text: "画面只作示意，不是可玩关卡；机关的开关状态、燃烧和爆炸是摆好的插图状态（preview / fx 字段，只在工作台使用）。流体、气体、爆炸、酸蚀和冷热的真实表现以 SDK 运行结果为准。打开「观察模式」可看到规则图标、作用区虚线框和开关连线。" }));
      box.append(el("h3", { text: "这一章用到的新资产" }));
      const ul = el("ul");
      for (const id of ["material.chapter2_5", ...PB.matter.USES[s.id.slice(8)]]) if (store.asset(id)) ul.append(el("li", {}, [el("a", { href: "#assets/" + id, text: id }), " ", statusBadge(id)]));
      box.append(ul);
      box.append(el("h3", { text: "地形主题" }), el("p", {}, [el("a", { href: "#assets/" + s.theme, text: s.theme }), " ", statusBadge(s.theme)]));
      box.append(el("p", { class: "note small", text: "场景数据：workbench/js/core/matter.js 的 SHOWCASES；材料着色同一文件的 SHADE。" }));
    } else {
      box.append(el("h2", { text: s.name }), el("p", { text: "把基础组（原第 1 章）的人物、箱子、机关、材料和 HUD 放在同一画面中检查整体协调、层级和可读性。" }));
      box.append(el("p", { class: "small muted", text: "画面中的布局只作示意，不是可玩关卡。水与沙的颗粒在游戏中会随 SDK 的格子移动，这里按格子静态绘制。" }));
      box.append(el("h3", { text: "地形主题" }), el("p", {}, [el("a", { href: "#assets/" + s.theme, text: s.theme }), " ", statusBadge(s.theme)]));
      box.append(el("h3", { text: "生态与环境" }), el("p", { class: "small", text: "本场景为了审稿显示该主题的全部小动物；实际关卡中每张图最多出现 1 只会动的小动物，约三分之一的关卡才有。光照只作用在背景上，不改变地形、箱子和机关的颜色；天气每关最多一种，可在上方「环境」中切换预览。" }));
    }
  }

  function steps(s) {
    const box = document.getElementById("scene-steps");
    box.textContent = "";
    if (s.kind !== "level") return;
    const n = s.level.solution.length;
    const label = el("span", { class: "mono" });
    const range = el("input", { type: "range", min: "0", max: String(n), value: String(step), "aria-label": "作者解步骤", oninput: () => { step = Number(range.value); update(); } });
    const prev = el("button", { class: "btn", type: "button", text: "上一步", onclick: () => { step = Math.max(0, step - 1); range.value = step; update(); } });
    const next = el("button", { class: "btn", type: "button", text: "下一步", onclick: () => { step = Math.min(n, step + 1); range.value = step; update(); } });
    function update() {
      const a = step ? s.level.solution[step - 1] : "开局";
      label.textContent = `第 ${step}/${n} 步 · ${a}`;
      stage.refresh();
    }
    box.append(el("div", { class: "steps" }, [prev, range, next, label]));
    box.append(el("p", { class: "disclaimer", text: "这是格子规则模型对作者解的推演，用来看布局与流程；沙、水等材料的真实表现以 SDK 运行结果为准。" }));
    update();
  }

  function show(id) {
    chapterPictures.clear(); chapterLayers.clear();
    const list = sceneList();
    current = list.find((s) => s.id === id) || list[0];
    step = 0;
    renderList(document.getElementById("scene-list"));
    const host = document.getElementById("scene-stage");
    if (stage) stage.destroy();
    const gridBtn = el("button", { class: "btn", type: "button", "aria-pressed": String(grid), text: "网格", onclick: () => { grid = !grid; gridBtn.setAttribute("aria-pressed", String(grid)); stage.refresh(); } });
    const obsBtn = el("button", { class: "btn", type: "button", "aria-pressed": String(observe), text: "观察模式", title: "游戏中按住 Tab 时的画面", onclick: () => { observe = !observe; obsBtn.setAttribute("aria-pressed", String(observe)); stage.refresh(); } });
    const locSel = el("select", { "aria-label": "界面语言", onchange: () => { PB.i18n.setLocale(locSel.value); store.setPref("locale", locSel.value); stage.refresh(); } });
    for (const [v, n] of LOCALES) locSel.append(el("option", { value: v, text: n }));
    locSel.value = PB.i18n.getLocale();
    const T = PB.sprites.get(themeOfCurrent()).params, envSel = el("select", { "aria-label": "环境效果", onchange: () => { envMode = envSel.value; stage.refresh(); } });
    const wDefault = (T.env && T.env.weather) || "none";
    envSel.append(el("option", { value: "default", text: "默认（" + (wDefault === "none" ? "只有光照" : "光照 + " + PB.env.NAMES[wDefault]) + "）" }));
    for (const w of (T.env && T.env.weathers) || []) if (w !== wDefault) envSel.append(el("option", { value: w, text: "光照 + " + PB.env.NAMES[w] }));
    envSel.append(el("option", { value: "lite", text: "只要光照" }), el("option", { value: "off", text: "关闭环境效果" }));
    if (![...envSel.options].some((o) => o.value === envMode)) envMode = "default";
    envSel.value = envMode;
    const issueBtn = el("button", { class: "btn", type: "button", "aria-pressed": String(showIssues), text: "标出溢出", title: "用红框标出放不下而被省略的文字", onclick: () => { showIssues = !showIssues; issueBtn.setAttribute("aria-pressed", String(showIssues)); stage.refresh(); } });
    stage = root.PBStage.create(host, {
      width: 320, height: 180, animated: true, autoplay: true, draw, label: current.name,
      extras: (current.kind === "screen" ? [] : [gridBtn, obsBtn]).concat([el("label", { class: "small muted" }, ["环境 ", envSel]), el("label", { class: "small muted" }, ["语言 ", locSel]), issueBtn]).concat(root.PBOnboarding && current.kind === "level" ? root.PBOnboarding.controls(current.level) : []),
      disclaimer: current.kind === "screen" ? "界面为布局与外观参考；交互在游戏中实现。" : "视觉示意，不代表 SDK 物理结果。",
    });
    if (root.PBOnboarding) root.PBOnboarding.attach(current.kind === "level" ? current.level : null, stage);   // UX-03 引导
    info(current); steps(current);
    root.PBDetailDrawer.origin("scene-info", () => document.querySelector('#scene-list [data-scene="' + current.id + '"]'));
    root.PBDetailDrawer.show("scene-info", !!id);
  }

  root.PBScenes = { show, hide: () => { root.PBDetailDrawer.hide("scene-info"); if (stage) stage.setVisible(false); }, wake: () => stage && stage.setVisible(true) };
})(window);
