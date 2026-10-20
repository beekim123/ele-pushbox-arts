/* UI-10c: G2 delivery results and a separate generic lobby.
 * Chapter lobby skins and the shared kit remain registered as before. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const G = () => PB.uiCommon, K = () => G().kit, U = () => PB.uk;
  const t = (key, vars) => PB.i18n.t(key, vars);
  const line = (...args) => G().line(...args);
  const focus = (p, st) => p.focus != null ? p.focus : st.focus | 0;

  // These previews use the same v2 model, scene and camera as the room workbench.
  function roomBackdrop(r, tick, p, st) {
    const R = PB.rooms2, D = PB.droom2, room = p.room;
    const [from, to] = room.routes[0].split(">");
    const model = R.start(R.variant(room, false, null), from, to);
    const world = { id: room.world, theme: p.theme, exclude: p.exclude || [] };
    const scene = D.scene(model, world, { top_edge: "rock" });
    D.draw(r, scene, D.run(model, {}), { tick, view: "camera", env: st.env || "full", overlays: {} });
    U().dim(new (U().C)(r), 2);
    // The result has its own heading; omit the room workbench's title / move HUD.
    r.rect(0, 0, 320, 20, "z");
  }

  function actions(c, p, st, y) {
    const labels = [t("dlv.done.again"), t("dlv.done.hub")];
    const w = Math.max(88, ...labels.map(s => c.tw(s, 12) + 18));
    labels.forEach((s, i) => K().button(c, 160 - w - 4 + i * (w + 8), y, w, 18, s, focus(p, st) === i ? "sel" : "n"));
  }

  function wrapped(c, x, y, text, w, col, rows) {
    const lines = U().wrap(c, text, 10, w);
    // Never silently drop a translated line: the preview reports an overflow.
    lines.forEach((s, i) => line(c, x, y + i * 11, s, col, { sz: 10 }, w));
    if (lines.length > rows) line(c, x, y, text, col, { sz: 10 }, w, "result.wrap");
  }

  function settlement(r, tick, p, st) {
    roomBackdrop(r, tick, p, st);
    const c = new (U().C)(r), k = K(), u = U();
    k.panel(c, 6, 5, 308, 149);
    k.title(c, 6, 5, 308, t("dlv.done.title"));
    k.tag(c, 275, 13, String(p.rating));

    k.panel(c, 13, 32, 82, 114, true);
    u.portrait(c, 42, 39, "avatar." + p.recipient);
    const name = t(`recipient.${p.recipient}.name`);
    line(c, 54, 71, name, "t", { sz: 10, align: "c" }, 72);
    wrapped(c, 20, 87, t(`recipient.${p.recipient}.thanks`), 68, "u", 3);
    c.blit(u.frame("cargo." + p.cargo, 0), 20, 124);
    line(c, 39, 128, t(`cargo.${p.cargo}.name`), "t", { sz: 10 }, 49);

    const x = 104, right = 300;
    line(c, x, 35, t("dlv.done.integrity"), "u", { sz: 10 }, 76);
    line(c, 186, 35, p.integrity + "/" + p.max, "t", { sz: 10 }, 40);
    line(c, right, 35, "×" + (p.integrity / p.max).toFixed(2), "m", { sz: 10, align: "r" }, 58);
    line(c, x, 50, t("dlv.done.time"), "u", { sz: 10 }, 76);
    line(c, 186, 50, p.secs.toFixed(1) + "s", "t", { sz: 10 }, 48);
    line(c, right, 50, "×" + (p.timePct / 100).toFixed(2), "m", { sz: 10, align: "r" }, 58);
    line(c, x, 63, t("result.par", { n: p.par.toFixed(1) }), "u", { sz: 10 }, 196);
    line(c, x, 78, t("dlv.done.like"), "u", { sz: 10 }, 110);
    c.blit(u.frame("ui.delivery_icons", 0), 215, 75);
    line(c, right, 78, "×" + (p.likePct / 100).toFixed(2), "m", { sz: 10, align: "r" }, 58);
    c.hline(x, 91, 196, "x");
    line(c, x, 96, t("dlv.done.tip"), "u", { sz: 10 }, 70);
    line(c, 177, 96, t("dlv.done.base", { n: p.pay }), "u", { sz: 10 }, 85);
    line(c, right, 96, String(p.tip), "t", { sz: 10, align: "r" }, 32);
    line(c, x, 109, t("dlv.done.picked"), "u", { sz: 10 }, 155);
    line(c, right, 109, String(p.picked), "t", { sz: 10, align: "r" }, 32);
    c.hline(x, 123, 196, "x");
    line(c, x, 131, t("dlv.done.total"), "t", { sz: 12 }, 110);
    u.coinIcon(c, 263, 132, true);
    line(c, right, 131, String(p.total), "m", { sz: 12, align: "r" }, 28);
    actions(c, p, st, 158);
  }

  function settlementFail(r, tick, p, st) {
    roomBackdrop(r, tick, p, st);
    const c = new (U().C)(r), k = K(), u = U();
    k.panel(c, 24, 27, 272, 116);
    k.title(c, 24, 27, 272, t("dlv.fail.title"));
    k.panel(c, 33, 58, 51, 75, true);
    u.portrait(c, 46, 64, "avatar." + p.recipient);
    c.blit(u.frame("cargo." + p.cargo, p.reason === "cargo" && p.cargo === "vase" ? 1 : 0), 51, 106);
    const x = 94, w = 190;
    wrapped(c, x, 61, t(p.reason === "cargo" ? "dlv.fail.cargo" : "dlv.fail.hearts"), w, "t", 2);
    wrapped(c, x, 89, t("dlv.fail.keep", { a: p.picked, b: p.kept }), w, "u", 2);
    u.coinIcon(c, x, 119, true);
    line(c, x + 15, 117, String(p.kept), "m", { sz: 12 }, w - 15);
    actions(c, p, st, 151);
  }

  function lobbyGeneric(r, tick, p, st) {
    PB.uiStyle.backdrop(r, "theme.diyu", tick, st.env || "full", true);
    const c = new (U().C)(r), k = K();
    k.logo(c, 16, 10);
    k.coins(c, 313, 6, p.coins == null ? 1280 : p.coins);
    const items = p.items;
    const w = Math.max(104, ...items.map(it => c.tw(t(it.key), 12) + 24));
    items.forEach((it, i) => k.button(c, 22, 72 + i * 22, w, 18, t(it.key), focus(p, st) === i ? "sel" : "n", { id: it.key }));
    k.cursor(c, 19, 80 + focus(p, st) * 22);
    G().keybar(c, [[["up", "down"], t("keys.select")], [["Enter"], t("keys.confirm")]], 10, 163);
  }

  Object.assign(PB.ui.SCREENS, { settlement, settlement_fail: settlementFail, lobby_generic: lobbyGeneric });
})(typeof window !== "undefined" ? window : globalThis);
