/* Public G2 references use approved PNGs; the private proposal renderer stays private. */
(function(root) {
  "use strict";
  const el = root.PBStage.el;
  function show(id) {
    const page = document.getElementById("ui-proposals-root"); page.textContent = "";
    page.append(el("h2", { text: "界面风格 · G2 深蓝圆角" }),
      el("p", { text: "已选定风格的确认版参考图。点击图片查看原尺寸；完整风格规范见 docs/design/ui-style.md。" }));
    const names = ["pause", "hint", "settings", "rule", "levels", "settlement"];
    for (const name of names.filter(n => !id || n === id)) {
      const a = root.PBStore.asset("ui.screen." + (name === "rule" ? "rulecard" : name)), approved = (a && a.approved_versions || []).slice().sort((x,y) => y.version-x.version)[0];
      if (!approved) continue;
      const src = "../" + approved.png;
      page.append(el("figure", {}, [el("a", { href: src, target: "_blank" }, [el("img", { src, width: 640, height: 360, style: "image-rendering:pixelated;max-width:100%;height:auto", alt: a.name })]),
        el("figcaption", { text: `${a.name} @v${approved.version} · ${approved.approval}` })]));
    }
  }
  root.PBUiProposals = { show };
})(window);
