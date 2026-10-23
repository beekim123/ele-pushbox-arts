/* View 2 · Assets & animation: browse every asset, inspect frames and
 * animations at native size or integer zoom on different backgrounds. */
(function (root) {
  "use strict";
  const PB = root.PB, store = root.PBStore, el = root.PBStage.el;
  const CAT = { avatar: "头像", cargo: "货物", monster: "怪物", scene: "整幅场景", theme: "主题（地形·背景·生态）", fauna: "小动物", deco: "植物与装饰", character: "角色", object: "箱子与物件", mechanism: "机关", item: "物品", fx: "特效", ui: "界面元素", screen: "界面画面", terrain: "地形与背景", material: "材料（第 2–5 章）" };
  const filt = { cat:'all',status:'all',q:'',mode:'all',theme:'all',group:'all',shared:true };
  let query='', eligible=new Set();
  function setQuery(value){query=value;const p=new URLSearchParams(value);Object.assign(filt,{cat:p.get('category')||'all',status:p.get('status')||'all',q:p.get('q')||'',mode:p.get('mode')||'all',theme:p.get('theme')||'all',group:p.get('group')||'all',shared:p.get('shared')!=='0'});}
  function address(id){const p=new URLSearchParams();for(const [key,value] of Object.entries({mode:filt.mode,theme:filt.theme,group:filt.group,category:filt.cat,status:filt.status,q:filt.q}))if(value&&value!=='all')p.set(key,value);if(!filt.shared)p.set('shared','0');if(id)p.set('id',id);return '#library'+(p.size?'?'+p:'');}
  function navigate(){location.hash=address();}

  let selected = null, stage = null, anim = null;

  const warned = new Set(), cards = new Map();
  let searchTimer = 0;
  function canvasThumb(a) {
    const c = document.createElement("canvas"), sprite = a.kind === "sprite";
    c.width = sprite ? a.size[0] : 320; c.height = sprite ? a.size[1] : 180;
    const r = new PB.Raster(c.width, c.height);
    if (sprite) r.blitRows(a.frames[firstFrame(a)], 0, 0, false); else drawProcedural(r, a, 0);
    c.getContext("2d").putImageData(new ImageData(r.data, r.w, r.h), 0, 0);
    return c;
  }
  function thumb(a, maxW, maxH) {
    const sprite = a.kind === "sprite", w = sprite ? a.size[0] : 320, h = sprite ? a.size[1] : 180;
    const z = Math.max(1, Math.min(Math.floor(maxW / w), Math.floor(maxH / h)));
    const width = sprite ? w * z : maxW >= 320 ? 320 : 144, height = sprite ? h * z : maxW >= 320 ? 180 : 81;
    if (a._draft) {
      const c = canvasThumb(a); c.style.width = width + "px"; c.style.height = height + "px"; return c;
    }
    const wrapper = el("span", { class: "asset-png-thumb" });
    wrapper.style.width = width + "px"; wrapper.style.height = height + "px";
    wrapper.style.setProperty("--thumb-frame", sprite ? firstFrame(a) : 0);
    const img = el("img", { src: "../art/export/preview/" + a.id + ".png", alt: "", loading: "lazy", decoding: "async", width: sprite ? w * a.frames.length : w, height: h });
    img.style.width = (sprite ? a.frames.length * 100 : 100) + "%";
    img.addEventListener("error", () => {
      if (!warned.has(a.id)) { warned.add(a.id); console.warn("预览 PNG 加载失败，改用代码绘制：" + a.id); }
      const c = canvasThumb(a); c.style.width = "100%"; c.style.height = "100%"; wrapper.replaceChildren(c);
    }, { once: true });
    wrapper.append(img); return wrapper;
  }
  function firstFrame(a) { const n = Object.values(a.animations || {})[0]; return n ? n.frames[0] : 0; }
  function drawProcedural(r, a, tick) {
    if (a.category === "theme") PB.scene.renderLevel(r, PB.scene.SHOWCASE, null, { tick, theme: a.id, hud: false });
    else if (a.category === "material") PB.matter.swatches(r);
    else PB.ui.render(r, a, tick, { focus: 0, specs: Object.fromEntries(store.levels().map((l) => [l.id, l])), levelSpec: store.level("M05"), ruleSpec: store.level("M03") });
  }

  function matches(a) {
    if (!eligible.has(a.id)) return false;
    if (filt.cat !== "all" && a.category !== filt.cat) return false;
    const st = store.status(a.id);
    if (filt.status !== "all" && st !== filt.status) return false;
    if (filt.q) { const q = filt.q.toLowerCase(); if (!(a.id.toLowerCase().includes(q) || a.name.includes(filt.q) || (a.usage || "").includes(filt.q))) return false; }
    return true;
  }

  function renderFilters() {
    const cats = document.getElementById("asset-categories"), sts = document.getElementById("asset-status");
    cats.textContent = ''; sts.textContent = '';
    const controls=document.getElementById('library-filters');controls.textContent='';
    const choose=(label,value,options,change)=>{const select=el('select',{'aria-label':label,onchange:()=>{change(select.value);navigate();}});for(const [id,name]of options)select.append(el('option',{value:id,text:name}));select.value=value;controls.append(el('label',{class:'library-control'},[el('span',{text:label}),select]));};
    choose('模式',filt.mode,[['all','全部模式'],['level','关卡模式'],['delivery','配送模式']],v=>{filt.mode=v;filt.theme='all';});
    const themes=new Map();for(const m of filt.mode==='all'?['level','delivery']:[filt.mode])for(const s of root.PBModeCatalog.sections(m,store.assets()).filter(s=>s.id.startsWith('theme.')))themes.set(s.id.slice(6),s.name);
    choose('主题',filt.theme,[['all','全部主题'],...themes],v=>filt.theme=v);
    choose('用途分组',filt.group,[['all','全部用途'],['characters','角色与生物'],['items','物品与装饰'],['mechanisms','机关与特效'],['screens','界面与引导'],['hub','渡口·伙计·剧情']],v=>filt.group=v);
    const shared=el('input',{type:'checkbox',checked:filt.shared,onchange:()=>{filt.shared=shared.checked;navigate();}});controls.append(el('label',{class:'library-control'},[shared,'包括通用资源']));
    controls.append(el('a',{class:'btn small',href:'#library',text:'清除筛选'}));
    document.getElementById('asset-search').value=filt.q;

    const counts = {};
    for (const a of store.assets()) counts[a.category] = (counts[a.category] || 0) + 1;
    const chip = (box, key, val, label) => box.append(el("button", { class: "chip", type: "button", "aria-pressed": String(filt[key] === val), text: label, onclick: () => { filt[key] = val; navigate(); } }));
    chip(cats, "cat", "all", `全部 ${store.assets().length}`);
    for (const c of Object.keys(counts)) chip(cats, "cat", c, `${CAT[c] || c} ${counts[c]}`);
    for (const [v, l] of [["all", "全部状态"], ["review", "待确认"], ["approved", "已确认"], ["draft", "草稿"], ["local", "本地修改"]]) chip(sts, "status", v, l);
  }

  function renderCards() {
    const box = document.getElementById("asset-cards");
    const list = store.assets().map((a) => store.effective(a.id));
    eligible=new Set(root.PBModeCatalog.library(store.assets(),filt).map(a=>a.id));
    let count = 0;
    for (const a of list) {
      const st = store.status(a.id), key = a.frames || a;
      let entry = cards.get(a.id);
      if (!entry || entry.key !== key || entry.status !== st) {
        const node = el("button", { class: "card" + (a.size?.[0]>=320 || a.kind!=="sprite" ? " large-asset" : ""), "data-resource-id": a.id, type: "button", onclick: () => { root.PBDetailDrawer.origin("asset-inspector", () => cards.get(a.id).node); if (location.hash === address(a.id)) show(a.id); else location.hash = address(a.id); } }, [
          el("div", { class: "thumb" }, [thumb(a, a.size?.[0]>=320 || a.kind!=="sprite" ? 320 : 128, a.size?.[0]>=320 || a.kind!=="sprite" ? 180 : 96)]),
          el("div", { class: "name", text: a.name }),
          el("div", { class: "row" }, [el("span", { class: "id", text: `${a.id} v${a.version}` }), el("span", { class: "badge " + st, text: store.statusLabel(st) })]),
        ]);
        if (entry) entry.node.replaceWith(node); else box.append(node);
        entry = { node, key, status: st }; cards.set(a.id, entry);
      }
      entry.node.setAttribute("aria-current", String(selected === a.id));
      entry.node.hidden = !matches(a); if (!entry.node.hidden) count++;
    }
    document.getElementById("asset-count").textContent = count ? `${count} 项` : "没有符合条件的资产。";
  }

  function renderInspector() {
    const box = document.getElementById("asset-inspector");
    box.textContent = "";
    if (stage) { stage.destroy(); stage = null; }
    if (!selected) { box.append(el("p", { class: "muted", text: "选择左侧的一项资产查看详情。" })); return; }
    const a = store.effective(selected), st = store.status(selected);
    box.append(el("h2", { text: a.name }), el("div", { class: "btn-row" }, [el("span", { class: "mono", text: `art:${a.id} · v${a.version}` }), el("span", { class: "badge " + st, text: store.statusLabel(st) })]));
    const screen=root.PBScreens.identify(a.id);
    if(screen)box.append(el("a",{class:"btn small",href:"#screen/"+screen.id,text:"在界面清单中打开"}));
    const host = el("div", { class: "stage-host" });
    box.append(host);
    if (a.kind === "sprite") {
      const names = Object.keys(a.animations);
      anim = names.includes(anim) ? anim : names[0];
      const animSel = el("select", { "aria-label": "动画", onchange: () => { anim = animSel.value; stage.setTick(0); strip(); } });
      for (const n of names) animSel.append(el("option", { value: n, text: `${n}（${a.animations[n].frames.length} 帧${a.animations[n].fps ? " · " + a.animations[n].fps + " fps" : ""}）` }));
      animSel.value = anim;
      const anchorBtn = el("button", { class: "btn", type: "button", "aria-pressed": "false", text: "锚点", onclick: () => { anchorBtn.setAttribute("aria-pressed", String(anchorBtn.getAttribute("aria-pressed") !== "true")); stage.refresh(); } });
      const pad = 4;
      const frames = el("div", { class: "frames", "aria-label": "帧" });
      stage = root.PBStage.create(host, {
        width: a.size[0] + pad * 2, height: a.size[1] + pad * 2, animated: true, backgrounds: ["checker", "dark", "light"], maxHeight: 240, maxFit: 12, label: a.name,
        extras: [animSel, anchorBtn],
        frameKey: tick => PB.sprites.frameAt(a, anim, tick),
        stepTicks: () => { const A = a.animations[anim]; return A.fps ? Math.round(60 / A.fps) : 60; },
        draw: (r, tick) => {
          const A = a.animations[anim]; const f = PB.sprites.frameAt(a, anim, tick);
          r.blitRows(a.frames[f], pad, pad, false);
          if (anchorBtn.getAttribute("aria-pressed") === "true") { r.set(pad + a.anchor[0], pad + a.anchor[1], "A"); r.set(pad + a.anchor[0] - 1, pad + a.anchor[1], "A"); }
          highlight(f);
        },
      });
      box.append(el("h3", { text: "帧" }), frames);
      function strip() {
        frames.textContent = "";
        [...new Set(a.animations[anim].frames)].forEach((fi) => {
          const k = a.animations[anim].frames.indexOf(fi);
          const c = document.createElement("canvas"); c.width = a.size[0]; c.height = a.size[1];
          const r = new PB.Raster(a.size[0], a.size[1]); r.blitRows(a.frames[fi], 0, 0, false);
          c.getContext("2d").putImageData(new ImageData(r.data, r.w, r.h), 0, 0);
          const z = a.size[0] <= 16 ? 3 : 2; c.style.width = a.size[0] * z + "px"; c.style.height = a.size[1] * z + "px";
          frames.append(el("button", { type: "button", "data-frame": String(fi), title: `帧 ${fi}`, onclick: () => { const A = a.animations[anim]; stage.setPlaying(false); stage.setTick(A.fps ? Math.round((k * 60) / A.fps) : 0); } }, [c]));
        });
      }
      function highlight(f) { for (const b of frames.children) b.setAttribute("aria-current", String(Number(b.dataset.frame) === f)); }
      strip();
      box.append(el("h3", { text: "规格" }), el("dl", { class: "meta" }, [
        el("dt", { text: "尺寸" }), el("dd", { text: `${a.size[0]}×${a.size[1]}，共 ${a.frames.length} 帧` }),
        el("dt", { text: "锚点" }), el("dd", { text: `(${a.anchor[0]}, ${a.anchor[1]})` }),
        el("dt", { text: "图层" }), el("dd", { text: a.layer }),
        a.ninepatch ? el("dt", { text: "九宫格" }) : null, a.ninepatch ? el("dd", { text: a.ninepatch.join(" / ") }) : null,
        el("dt", { text: "内容哈希" }), el("dd", { class: "mono", text: (a.content_hash || "").slice(0, 16) }),
        el("dt", { text: "导出文件" }), el("dd", { class: "mono", text: `art/export/preview/${a.id}.png` }),
        el("dt", { text: "游戏路径" }), el("dd", { class: "mono", text: (store.idEntry("art:" + a.id) || {}).game || "—" }),
      ]));
    } else {
      stage = root.PBStage.create(host, { width: 320, height: 180, animated: true, maxHeight: 200, label: a.name, draw: (r, tick) => drawProcedural(r, a, tick) });
      box.append(el("h3", { text: "参数" }), el("pre", { class: "mono small", text: JSON.stringify(a.params, null, 1).slice(0, 1600) }));
    }
    box.append(el("h3", { text: "用途" }), el("p", { class: "small", text: a.usage || "—" }));
    if (a.notes) box.append(el("p", { class: "small muted", text: a.notes }));
    const av = a.approved_versions || [];
    box.append(el("h3", { text: "确认记录" }), el("p", { class: "small", text: av.length ? av.map((v) => `v${v.version} · ${v.approval} · ${v.date.slice(0, 10)}`).join("；") : "尚无确认记录。" }));
    const actions = el("div", { class: "btn-row" });
    if (a.kind === "sprite") actions.append(el("a", { class: "btn", href: "#edit/" + a.id, text: "编辑与对比" }));
    const inList = !!store.review().selected[a.id];
    if (st === "review") actions.append(el("button", { class: "btn" + (inList ? "" : " primary"), type: "button", text: inList ? "已加入确认清单" : "加入确认清单", onclick: () => { store.toggleSelected(a.id, !inList); renderInspector(); } }));
    box.append(el("h3", { text: "操作" }), actions);
    if (a._draft) box.append(el("p", { class: "note small", text: "正在显示本浏览器中尚未导出的修改。确认清单只接受仓库中的版本。" }));
  }

  function show(id) {
    clearTimeout(searchTimer);
    selected = id && store.asset(id) ? id : null;
    document.getElementById('view-assets').classList.toggle('has-detail',!!selected);
    if(!selected&&!query)document.querySelector('#view-assets .work').scrollTop=0;
    renderFilters(); renderCards(); renderInspector();
    root.PBDetailDrawer.origin("asset-inspector", () => cards.get(selected)?.node);
    root.PBDetailDrawer.show("asset-inspector", !!id);
    document.getElementById("asset-search").oninput = (e) => { clearTimeout(searchTimer); const value = e.target.value.trim(); searchTimer = setTimeout(() => { filt.q = value; navigate(); }, 150); };
  }
  root.PBAssets = { show, setQuery, hide: () => { root.PBDetailDrawer.hide("asset-inspector"); if (stage) stage.setVisible(false); }, wake: () => stage && stage.setVisible(true), CAT, thumb, drawProcedural };
})(window);
