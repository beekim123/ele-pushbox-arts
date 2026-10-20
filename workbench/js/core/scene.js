/* Level scene composition and in-game HUD (320x180). Used for the workbench
 * stage and for reference renders in art/export/reference/. Visual illustration
 * only: positions come from the design model (tilemodel.js), never from the SDK. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const S = () => PB.sprites, TX = () => PB.text, TM = () => PB.tilemodel, TR = () => PB.terrain;
  const W = 320, H = 180, HUD_H = 20;

  function themeOf(id) { return S().get(id).params; }
  // Device cells (levers, buttons, pads, bridge planks): keep plants and critters off them.
  function deviceAt(spec, x, y) {
    for (const d of spec.devices || []) {
      const cells = d.type === "portal" ? d.pads : d.type === "bridge" ? d.cells : d.type === "lift" ? (d.button ? [d.button] : []) : d.at ? [d.at] : [];
      if (cells.some(([cx, cy]) => cx === x && cy === y)) return true;
    }
    return false;
  }

  // Chapter -> visual theme (docs/design/game-design.md §6.1). Themes are skins only.
  const CHAPTER_THEME = { dungeon: "theme.dungeon", ruins: "theme.ruins", cave: "theme.cave", forest: "theme.forest", sky: "theme.sky", cosmos: "theme.cosmos" };
  const THEMES = ["theme.dungeon", "theme.ruins", "theme.cave", "theme.forest", "theme.sky", "theme.cosmos"];
  function themeFor(spec, o) { return (o && o.theme) || CHAPTER_THEME[spec.chapter] || "theme.dungeon"; }
  const openingCache = new Map();
  function opening(spec) {
    const key = spec.id + "|" + spec.map.join("");
    if (!openingCache.has(key)) openingCache.set(key, TM().parse(spec));
    return openingCache.get(key);
  }

  function toMat(t) {
    const T = TM().T, M = TR().MAT;
    return t === T.ROCK ? M.ROCK : t === T.CRACKED ? M.CRACKED : t === T.EARTH ? M.EARTH : t === T.SAND ? M.SAND : t === T.WATER ? M.WATER : M.EMPTY;
  }

  // opts: {theme, tick, hud: {title, code}, pose, facing, grid, observe}
  function renderLevel(r, spec, state, opts) {
    const o = opts || {};
    const L = state ? state.level : TM().parse(spec).level;
    const s = state ? state.state : TM().parse(spec).state;
    const theme = themeOf(themeFor(spec, o));
    const tick = o.tick || 0;
    const ox = (W - L.w * 16) >> 1, oy = HUD_H + ((H - HUD_H - L.h * 16) >> 1);
    TR().drawBackground(r, theme, 0, 0, W, H, tick);
    const map = { w: L.w, h: L.h, at: (x, y) => (x < 0 || y < 0 || x >= L.w || y >= L.h ? TR().MAT.EMPTY : toMat(s.terrain[y * L.w + x])) };
    // Ambient life is placed from the opening layout so it never jumps when things move.
    const first = opening(spec), s0 = first.state;
    const map0 = { w: L.w, h: L.h, at: (x, y) => (x < 0 || y < 0 || x >= L.w || y >= L.h ? TR().MAT.EMPTY : toMat(s0.terrain[y * L.w + x])) };
    // Chapter 2-5 materials (matter.js) count as EMPTY for terrain.js; keep plants and critters out of them.
    const own = (st, tx, ty) => !!PB.matter && tx >= 0 && ty >= 0 && tx < L.w && ty < L.h && PB.matter.isOwn(st.terrain[ty * L.w + tx]);
    const occupied = (tx, ty) => L.marker[ty * L.w + tx] !== TM().M.NONE || !!TM().crateAt(s0, tx, ty) || (s0.player.x === tx && s0.player.y === ty) || L.doors.includes(ty * L.w + tx) || own(s0, tx, ty) || own(s0, tx, ty + 1) || (!spec.showcase && deviceAt(spec, tx, ty));
    const alive = (tx, ty) => !own(s, tx, ty) && !own(s, tx, ty + 1) && (map.at(tx, ty) === TR().MAT.EMPTY && !TM().crateAt(s, tx, ty) && map.at(tx, ty + 1) !== TR().MAT.EMPTY || map.at(tx, ty - 1) !== TR().MAT.EMPTY && map.at(tx, ty) === TR().MAT.EMPTY && !TM().crateAt(s, tx, ty));
    const area = { x: ox + 16, y: oy + 16, w: Math.max(32, (L.w - 2) * 16), h: Math.max(32, (L.h - 2) * 16) };
    const lights = [], amb = { mode: spec === SHOWCASE || spec.showcase ? "full" : "sparse", seed: PB.ambient.seedOf(spec.id), out: lights };
    const envCtx = { tick, area: { x: ox, y: oy, w: L.w * 16, h: L.h * 16 }, lights, weather: o.weather !== undefined ? o.weather : spec.weather, level: o.env || "full" };
    if (o.ambient !== false) for (const layer of ["back", "front"]) PB.ambient.draw(r, theme, map0, ox, oy, tick, layer, occupied, area, alive, Object.assign({}, amb, { dry: true }));
    if (PB.env) PB.env.draw(r, theme, "back", envCtx);
    amb.out = null;
    if (o.ambient !== false) PB.ambient.draw(r, theme, map0, ox, oy, tick, "back", occupied, area, alive, amb);
    TR().drawTerrain(r, map, theme, ox, oy, tick >> 3);
    if (PB.matter) PB.matter.drawMaterials(r, PB.matter.mapOf(L, s), ox, oy, tick >> 3);
    if (o.ambient !== false) PB.ambient.draw(r, theme, map0, ox, oy, tick, "front", occupied, area, alive, amb);
    if (PB.env) PB.env.draw(r, theme, "light", envCtx);
    const M = TM().M, sym = (i) => (L.symbol && L.symbol[i]) || 0;
    // Background markers.
    for (let i = 0; i < L.w * L.h; i++) {
      const tx = i % L.w, ty = (i / L.w) | 0, px = ox + tx * 16 + 8, py = oy + ty * 16 + 16;
      const crate = TM().crateAt(s, tx, ty);
      if (L.marker[i] === M.LADDER) S().draw(r, "mech.ladder", "default", 0, px, py);
      if (L.marker[i] === M.SOCKET && !crate) S().draw(r, "mech.socket", "idle", tick, px, py);
      if (L.marker[i] === M.EXIT) S().draw(r, "mech.exit_flag", "idle", tick, px, py);
      if (L.marker[i] === M.PLATE) {
        const pressed = (s.player.x === tx && s.player.y === ty) || !!crate;
        S().draw(r, "mech.plate", pressed ? "down" : "up", 0, px, py);
        if (!pressed) S().draw(r, "mech.link_symbol", sym(i), 0, px, py - 7);
      }
    }
    if (PB.matter) PB.matter.drawDevices(r, spec, L, s, ox, oy, tick);
    for (const i of L.doors) {
      const px = ox + (i % L.w) * 16 + 8, py = oy + ((i / L.w) | 0) * 16 + 16;
      S().draw(r, "mech.door", TM().doorClosed(L, s, i) ? "closed" : "open", 0, px, py);
      S().draw(r, "mech.link_symbol", sym(i), 0, px, py - 12);
    }
    for (const c of s.crates) {
      const px = ox + c.x * 16 + 8, py = oy + c.y * 16 + 16;
      const float = !!PB.matter && PB.matter.floating(L, s, c);
      S().draw(r, c.kind === "iron" ? "obj.crate_iron" : "obj.crate_wood", "default", 0, px, py + (float ? 3 : 0));
      if (float) S().draw(r, "fx.ripple", "float", tick, px, py + 2);
      if (L.marker[c.y * L.w + c.x] === M.SOCKET) S().draw(r, "mech.socket_lit", "lit", tick, px, py);
    }
    const p = s.player;
    S().draw(r, "char.portitor", o.pose || "idle", tick, ox + p.x * 16 + 8, oy + p.y * 16 + 16, o.facing === "left");
    if (PB.matter) PB.matter.drawFx(r, spec, ox, oy, tick);
    if (PB.env) PB.env.draw(r, theme, "front", envCtx);
    if (o.target) {
      const t = o.target;
      S().draw(r, "ui.target", t.kind, 0, ox + t.x * 16 + 8, oy + t.y * 16 + 16);
    }
    if (o.observe) { drawObserve(r, L, s, ox, oy); if (PB.matter) PB.matter.drawObserve(r, spec, L, s, ox, oy); }
    if (o.grid || o.observe) drawGrid(r, L, ox, oy);
    if (o.hud !== false) drawHud(r, spec, L, s, tick, o.hud || {});
    return { ox, oy };
  }

  // Observe mode: dim everything, then show rule classes and plate-door links.
  function drawObserve(r, L, s, ox, oy) {
    r.remap(ox, oy, L.w * 16, L.h * 16, PB.DIM);
    const T = TM().T;
    const icon = { [T.ROCK]: "solid", [T.CRACKED]: "solid", [T.DOOR]: "solid", [T.EARTH]: "earth", [T.SAND]: "sand", [T.WATER]: "water" };
    for (let i = 0; i < L.w * L.h; i++) {
      const name = icon[TM().doorClosed(L, s, i) ? T.DOOR : s.terrain[i]];
      if (!name) continue;
      const tx = i % L.w, ty = (i / L.w) | 0;
      S().draw(r, "ui.class_icon", name, 0, ox + tx * 16 + 8, oy + ty * 16 + 8);
    }
    for (const g of L.groups) for (const p of g.plates) for (const d of g.doors) {
      let x0 = ox + (p % L.w) * 16 + 8, y0 = oy + ((p / L.w) | 0) * 16 + 12;
      const x1 = ox + (d % L.w) * 16 + 8, y1 = oy + ((d / L.w) | 0) * 16 + 8;
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let k = 0; k <= n; k += 2) r.set(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), "s");
    }
  }

  function drawGrid(r, L, ox, oy) {
    for (let ty = 0; ty <= L.h; ty++) for (let x = 0; x < L.w * 16; x += 2) r.set(ox + x, oy + ty * 16 - (ty === L.h ? 1 : 0), "v");
    for (let tx = 0; tx <= L.w; tx++) for (let y = 0; y < L.h * 16; y += 2) r.set(ox + tx * 16 - (tx === L.w ? 1 : 0), oy + y, "v");
  }

  function drawHud(r, spec, L, s, tick, hud) {
    r.rect(0, 0, W, HUD_H, "z");
    r.hline(0, HUD_H - 1, W, "y");
    // Right side first (fixed icons), then the title takes whatever room is left.
    const goals = TM().goals(L, s);
    let rx = W - 4;
    for (const name of ["pause", "hint", "restart", "undo"]) { rx -= 13; S().draw(r, "ui.icons", S().get("ui.icons").animations[name].frames[0], 0, rx, 4); }
    rx -= 8;
    for (let i = goals.length - 1; i >= 0; i--) { rx -= 10; S().draw(r, "ui.goal_lamp", goals[i].lit ? 1 : 0, 0, rx, 5); }
    rx -= 6;
    const bombs = s.bag.bomb, sand = s.bag.sand;
    if (bombs > 0) { rx -= 16; S().draw(r, "item.bomb", 0, 0, rx, 2); if (bombs > 1) { rx -= 12; TX().draw(r, "×" + bombs, rx, 3, "u"); } rx -= 2; }
    const canDig = spec.map.some((row) => /[es]/.test(row));
    const shown = Math.min(3, Math.max(sand, (spec.bag && spec.bag.sand) || 0, canDig ? 1 : 0));
    if (sand > 3) { rx -= 14; TX().draw(r, "×" + sand, rx, 3, "u"); }
    for (let i = shown - 1; i >= 0; i--) { rx -= 15; S().draw(r, "item.sandbag", i < sand ? 0 : 1, 0, rx, 2); }
    const code = hud.code || (spec.codeKey && PB.i18n ? PB.i18n.t(spec.codeKey) : spec.code || spec.id);
    let x = 5;
    x += TX().draw(r, code, x, 3, "k", "g") + 6;
    const key = "level." + spec.id + ".title";
    const title = hud.title || (PB.i18n && PB.i18n.has(key) ? PB.i18n.t(key) : spec.title || "");
    if (PB.ui) PB.ui.label(r, title, x, 3, rx - x - 8, "u", "y", key); else TX().draw(r, title, x, 3, "u", "y");
  }

  // Representative scene: every chapter-1 element plus water and cracked rock
  // so the whole art set can be judged together. Not a playable level.
  const SHOWCASE = {
    id: "showcase", showcase: true, codeKey: "showcase.code", title: "", map: [
      "####################",
      "#.........#........#",
      "#H........#.....X..#",
      "#H...ee...|...######",
      "#H...ee...|...%%...#",
      "#H.PBee._o#.I.%%.b.#",
      "##########~~~~ss####",
      "##########~~~~ss####",
      "####################"],
    bag: { sand: 2, bomb: 1 },
  };

  PB.scene = { renderLevel, drawHud, SHOWCASE, W, H, HUD_H, CHAPTER_THEME, THEMES, themeFor };
})(typeof window !== "undefined" ? window : globalThis);
