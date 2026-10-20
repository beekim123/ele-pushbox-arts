/* Chapter 2-5 materials, devices and effects (docs/design/art-direction.md §11).
 *
 * Additive to terrain.js and scene.js, so chapter 1 and every approved render
 * stay pixel-identical. Like terrain.js, this file IS the specification for the
 * game's look of these materials: a pixel's colour depends only on the material,
 * the pixel position hash, same-material neighbours and time (integer ticks).
 * Materials look the same in every theme on purpose: they carry rules.
 * Device and effect sprites come from art/source (mechanism/*, fx/*). */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const h32 = PB.h32, S = () => PB.sprites, TM = () => PB.tilemodel;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  // Renderer names for the design-model terrain codes. Chapter 1 kinds are drawn
  // by terrain.js; they appear here only as neighbours.
  let KIND = null;
  function kindOf(t) {
    if (!KIND) {
      const T = TM().T;
      KIND = { [T.EMPTY]: "empty", [T.ROCK]: "solid", [T.CRACKED]: "solid", [T.EARTH]: "solid", [T.DOOR]: "empty", [T.SAND]: "sand", [T.WATER]: "water",
        [T.GRAVEL]: "gravel", [T.FUSE]: "fuse", [T.ACID]: "acid", [T.LIME_A]: "limeA", [T.LIME_B]: "limeB", [T.HARD]: "hard",
        [T.SMOKE]: "smoke", [T.FOG]: "fog", [T.PLUG]: "plug", [T.WOOD]: "wood", [T.ICE]: "ice" };
    }
    return KIND[t] || "empty";
  }
  const OWN = { gravel: 1, fuse: 1, acid: 1, limeA: 1, limeB: 1, hard: 1, smoke: 1, fog: 1, plug: 1, wood: 1, ice: 1 };
  const GAS = { smoke: 1, fog: 1 }, LIQUID = { water: 1, acid: 1 };
  const isOwn = (t) => !!OWN[kindOf(t)];
  const open = (m) => m === "empty" || !!GAS[m];

  // Framed rule blocks: outline where the neighbour differs, bevel on the lit side.
  function frame(c, px, py, n, self, line, bevel) {
    if ((px === 0 && n.left !== self) || (px === 15 && n.right !== self) || (py === 0 && n.up !== self) || (py === 15 && n.down !== self)) return line;
    if (bevel && ((px === 1 && n.left !== self) || (py === 1 && n.up !== self))) return bevel;
    return c;
  }
  // Smooth puff field in [0, 1]: overlapping round blobs on an 8-px world grid.
  function puff(X, Y, seed) {
    const cx = Math.floor(X / 8), cy = Math.floor(Y / 8);
    let v = 0;
    for (let gy = cy - 1; gy <= cy + 1; gy++) for (let gx = cx - 1; gx <= cx + 1; gx++) {
      const k = h32(gx, gy, seed), bx = gx * 8 + (k & 7), by = gy * 8 + ((k >>> 3) & 7), rad = 4 + ((k >>> 6) % 4);
      const d2 = (X - bx) * (X - bx) + (Y - by) * (Y - by);
      if (d2 < rad * rad) v = Math.max(v, 1 - d2 / (rad * rad));
    }
    return v;
  }
  // Carved tag mark shared by every etchable stone (same mark = same tag).
  function carved(px, py) {
    const x = px - 8, y = py - 8, d = Math.abs(x) + Math.abs(y);
    return d === 3 || (x === 0 && y === 0);
  }

  const SHADE = {
    // Slow powder: loose rounded pebbles (greys with a few brown ones), dark gaps, bumpy top.
    gravel(wx, wy, px, py, n) {
      const row = (wy / 4) | 0, off = (row & 1) * 3, col = ((wx + off) / 5) | 0, lx = (wx + off) % 5, ly = wy & 3;
      const k = h32(col, row, 601);
      const corner = (lx === 0 || lx === 4) && (ly === 0 || ly === 3);
      if (lx === 4 && ly !== 1 && ly !== 2 || ly === 3 && lx !== 1 && lx !== 2 || corner) {
        if ((open(n.up) || LIQUID[n.up]) && py < 3) return null;
        return k & 2 ? "y" : "z";
      }
      const body = ["w", "v", "w", "x", "v", "w", "F", "x", "v", "w", "x", "v"][k % 12];
      let c = body;
      if (ly === 0 || (lx === 0 && ly === 1)) c = body === "F" ? "d" : body === "x" ? "w" : "u";
      else if (ly === 3 || lx === 3 && ly === 2) c = body === "F" ? "e" : "x";
      return c;
    },
    // Fuse: a twisted red cord running through a dark powder block; cords join across tiles.
    fuse(wx, wy, px, py, n) {
      let c = h32(wx, wy, 611) % 11 === 0 ? "k" : (wx + wy) & 1 ? "g" : "f";
      if (py >= 5 && py <= 10) {
        const t = (wx + (py - 5) * 2) % 6;
        c = py === 5 || py === 10 ? "z" : t < 2 ? "b" : t < 4 ? "a" : "h";
        if (py === 6 && t === 0) c = "k";
      }
      return frame(c, px, py, n, "fuse", "z", null);
    },
    // Acid: glowing lime liquid, wavy bright surface, bubble rings rising, darker depth.
    acid(wx, wy, px, py, n, time) {
      const top = n.up !== "acid" && !LIQUID[n.up];
      let c = "m";
      if (!top || py > 3) { const deep = n.down === "acid" ? 4 : Math.max(0, py - 9); if (BAYER[(wy & 3) * 4 + (wx & 3)] < deep * 2) c = "n"; }
      if (top) {
        const wave = ((wx + (time >> 1)) % 12) < 6 ? 0 : 1;
        if (py < wave) return null;
        if (py === wave) c = "l";
        else if (py === wave + 1 && (wx + time) % 7 === 0) c = "t";
      }
      const bx = (wx >> 3) * 8 + 3 + (h32(wx >> 3, 0, 613) & 1), by = 15 - ((time + (h32(wx >> 3, 1, 613) % 16)) % 16);
      const dx = (wx & 15) - (bx & 15), dy = py - by;
      if (!(top && py < 3) && Math.abs(dx) + Math.abs(dy) === 1) c = "l";
      return c;
    },
    // Soft stone A: chalky cream with faint strata and the carved tag mark.
    limeA(wx, wy, px, py, n) {
      let c = "c";
      if ((wy + (h32(wx >> 3, 0, 621) % 3)) % 5 === 0) c = "E";
      if (h32(wx, wy, 623) % 31 === 0) c = "d";
      if (carved(px, py)) c = "F";
      return frame(c, px, py, n, "limeA", "F", "t");
    },
    // Soft stone A, second look (same tag): grey-violet slate, same carved mark.
    limeB(wx, wy, px, py, n) {
      let c = "u";
      if ((wy + (h32(wx >> 2, 1, 625) % 2)) % 4 === 0) c = "v";
      if (carved(px, py)) c = "w";
      return frame(c, px, py, n, "limeB", "w", "t");
    },
    // Hard stone (not etchable): dark basalt columns, no mark.
    hard(wx, wy, px, py, n) {
      const band = (wy >> 3) & 1, col = (wx + band * 4) & 7;
      let c = col === 0 ? "w" : col === 7 ? "z" : "x";
      if (h32(wx, wy, 631) % 37 === 0) c = "v";
      return frame(c, px, py, n, "hard", "z", "w");
    },
    // Light gas: soft pale puffs (dithered) drifting upwards; nothing drawn between puffs.
    smoke(wx, wy, px, py, n, time) {
      const v = puff(wx, wy + time, 641), b = BAYER[(wy & 3) * 4 + (wx & 3)];
      if (v * 12 > b + 6) return v > 0.8 ? "t" : "u";
      return b < 2 && v > 0 ? "v" : null;
    },
    // Sinking gas: violet haze sliding sideways, a thin even veil plus denser rolls.
    fog(wx, wy, px, py, n, time) {
      const v = puff(wx + (time >> 1), wy, 643), b = BAYER[(wy & 3) * 4 + (wx & 3)];
      if (v * 16 > b + 4) return v > 0.6 ? "C" : "B";
      return b < 3 ? "B" : null;
    },
    // Fungus plug: pink cap flesh with pale spots, plum outline.
    plug(wx, wy, px, py, n) {
      const cx = (wx >> 2) * 4 + 1 + (h32(wx >> 2, wy >> 2, 651) & 1), cy = (wy >> 2) * 4 + 1 + (h32(wx >> 2, wy >> 2, 653) & 1);
      let c = "C";
      if (h32(wx >> 2, wy >> 2, 655) % 3 === 0 && Math.abs(wx - cx) + Math.abs(wy - cy) <= 1) c = wx === cx && wy === cy ? "E" : "D";
      return frame(c, px, py, n, "plug", "B", "D");
    },
    // Wooden palisade: vertical stakes with two cross rails; pointed tops when open above.
    wood(wx, wy, px, py, n) {
      const lx = wx & 3, stake = wx >> 2;
      let c = h32(stake, 0, 661) & 1 ? "e" : "b";
      if (lx === 3) c = "f"; else if (lx === 0) c = "F";
      else if (lx === 2 && h32(stake, wy >> 1, 663) % 5 === 0) c = "f";
      if (py === 4 || py === 11) c = (px & 7) === 2 ? "g" : "f";
      if (py === 3 || py === 10) c = "F";
      if (open(n.up) || LIQUID[n.up]) {
        if (py === 0 && lx !== 1 && lx !== 2) return null;
        if (py === 0) c = "d";
      }
      if ((px === 0 && n.left !== "wood") || (px === 15 && n.right !== "wood")) c = "g";
      return c;
    },
    // Device ice: translucent blue block, lit top band, short diagonal glints.
    ice(wx, wy, px, py, n) {
      let c = py < 3 && n.up !== "ice" ? "s" : "r";
      const g = (wx - wy + 64) & 15;
      if (g < 2 && ((wx + wy) & 15) < 6 && px > 1 && py > 1) c = g ? "s" : "t";
      if (h32(wx, wy, 671) % 53 === 0) c = "u";
      return frame(c, px, py, n, "ice", "q", "t");
    },
  };

  // map: {w, h, at(tx, ty) -> kind name}. Draws only this file's materials.
  function drawMaterials(r, map, ox, oy, time) {
    for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < map.w; tx++) {
      const m = map.at(tx, ty);
      if (!OWN[m]) continue;
      const n = { up: map.at(tx, ty - 1), down: map.at(tx, ty + 1), left: map.at(tx - 1, ty), right: map.at(tx + 1, ty), tx, ty };
      for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
        const wx = tx * 16 + px, wy = ty * 16 + py;
        const c = SHADE[m](wx, wy, px, py, n, time | 0);
        if (c) r.set(ox + wx, oy + wy, c);
      }
    }
  }
  function mapOf(L, s) {
    return { w: L.w, h: L.h, at: (x, y) => (x < 0 || y < 0 || x >= L.w || y >= L.h ? "solid" : kindOf(s.terrain[y * L.w + x])) };
  }

  // ---------- devices (docs/design/game-design.md §6.5) ----------
  const cellX = (ox, x) => ox + x * 16 + 8, cellY = (oy, y) => oy + y * 16 + 16;
  function binFill(d, L, s) {
    const T = TM().T, want = { water: T.WATER, sand: T.SAND, gravel: T.GRAVEL, acid: T.ACID, smoke: T.SMOKE, fog: T.FOG }[d.material];
    const [x0, y0, w, h] = d.rect;
    let tiles = 0;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (s.terrain[y * L.w + x] === want) tiles++;
    const cells = tiles * 256, need = Math.max(1, d.need || 256);
    return { level: Math.min(4, Math.floor((cells * 4) / need)), full: cells >= need };
  }
  // Device states come from the design model (s.dev, tilemodel.js); `preview`
  // only seeds them for showcases.
  function drawDevices(r, spec, L, s, ox, oy, tick) {
    const list = spec.devices || [];
    const st = (d) => s.dev ? s.dev[list.indexOf(d)] : (d.preview && d.preview.on ? 1 : 0);
    const on = (d) => !!st(d);
    const occupied = (x, y) => (s.player.x === x && s.player.y === y) || !!TM().crateAt(s, x, y);
    for (const d of list) {
      if (d.type === "lift") {
        const [a, b] = d.stops, w = d.width || 1, top = Math.min(a[1], b[1]), bot = Math.max(a[1], b[1]);
        for (let y = top; y <= bot; y++) {
          S().draw(r, "mech.lift", "rail", 0, cellX(ox, a[0]), cellY(oy, y));
          S().draw(r, "mech.lift", "rail", 0, cellX(ox, a[0] + w - 1), cellY(oy, y), true);
        }
      }
    }
    for (const d of list) {
      const pv = d.preview || {};
      if (d.type === "lift") {
        const [x, y] = d.stops[s.dev ? st(d) : pv.stop || 0];
        for (let k = 0; k < (d.width || 1); k++) S().draw(r, "mech.lift", "deck", 0, cellX(ox, x + k), cellY(oy, y));
        if (d.button) { const [bx, by] = d.button; S().draw(r, "mech.button", occupied(bx, by) ? "down" : "up", 0, cellX(ox, bx), cellY(oy, by)); }
      } else if (d.type === "portal") {
        const sym = d.symbol || ["circle", "triangle", "square"][list.filter((e) => e.type === "portal").indexOf(d) % 3];
        for (const [x, y] of d.pads) {
          const lit = (s.warped || []).includes(y * L.w + x);
          S().draw(r, "mech.portal", lit ? "glow" : "idle", tick, cellX(ox, x), cellY(oy, y));
          if (!occupied(x, y)) S().draw(r, "mech.link_symbol", sym, 0, cellX(ox, x), cellY(oy, y) - 7);
        }
      } else if (d.type === "bridge") {
        if (on(d)) continue; // collapsed
        const cap = d.capacity || 1, load = TM().bridgeLoad ? TM().bridgeLoad(L, s, list.indexOf(d)) : 0;
        for (const [x, y] of d.cells) S().draw(r, "mech.bridge", load >= cap ? "strained" : "intact", 0, cellX(ox, x), cellY(oy, y));
        // Load notches carved in the slab face: dark = free, yellow = weight on it, red = full.
        const [x0, y0] = d.cells[0], span = d.cells.length * 16, px0 = ox + x0 * 16 + ((span - (cap * 3 - 2)) >> 1), py = oy + y0 * 16 + 1;
        for (let k = 0; k < cap; k++) {
          const c = k < load ? (load >= cap ? "i" : "l") : "F";
          for (let j = 0; j < 3; j++) r.set(px0 + k * 3, py + j, c);
        }
      } else if (d.type === "bin") {
        const [x0, y0, w, h] = d.rect;
        for (let y = y0; y < y0 + h; y++) { S().draw(r, "mech.bin", "left", 0, cellX(ox, x0), cellY(oy, y)); S().draw(r, "mech.bin", "right", 0, cellX(ox, x0 + w - 1), cellY(oy, y)); }
        for (let x = x0; x < x0 + w; x++) S().draw(r, "mech.bin", "bottom", 0, cellX(ox, x), cellY(oy, y0 + h - 1));
        const f = binFill(d, L, s);
        S().draw(r, "mech.bin_gauge", f.full || on(d) ? "full" : String(f.level), 0, ox + (x0 + w) * 16 + 3, cellY(oy, y0 + h - 1));
      } else if (d.type === "lever") {
        S().draw(r, "mech.lever", on(d) ? "on" : "off", 0, cellX(ox, d.at[0]), cellY(oy, d.at[1]));
      } else if (d.type === "torch") {
        S().draw(r, "mech.torch", on(d) ? "lit" : "off", tick, cellX(ox, d.at[0]), cellY(oy, d.at[1]));
      } else if (d.type === "frost_vent" || d.type === "heat_vent") {
        S().draw(r, d.type === "frost_vent" ? "mech.frost_vent" : "mech.heat_vent", on(d) ? "active" : "idle", tick, cellX(ox, d.at[0]), cellY(oy, d.at[1]));
      } else if (d.type === "vine") {
        const [x, y] = d.root;
        if (pv.grown) for (let k = 0; k < d.height; k++) S().draw(r, "mech.vine", k === d.height - 1 ? "top" : "stem", 0, cellX(ox, x), cellY(oy, y - k));
        S().draw(r, "mech.vine", "root", 0, cellX(ox, x), cellY(oy, y));
      }
    }
  }

  // Wood crate resting on a water surface: drawn 3 px lower with a ripple.
  function floating(L, s, c) {
    const T = TM().T;
    if (c.kind !== "wood" || c.y + 1 >= L.h) return false;
    return s.terrain[c.y * L.w + c.x] !== T.WATER && s.terrain[(c.y + 1) * L.w + c.x] === T.WATER;
  }

  // Illustration effects listed in spec.fx (workbench scenes only, never in level specs):
  // {sprite, at: [x, y], anim, tick: offset, every: replay period in ticks}.
  function drawFx(r, spec, ox, oy, tick) {
    for (const f of spec.fx || []) {
      const a = S().get(f.sprite), [x, y] = f.at, t = tick + (f.tick || 0);
      const bottom = a.anchor[1] >= a.size[1];
      S().draw(r, f.sprite, f.anim, f.every ? t % f.every : t, cellX(ox, x), bottom ? cellY(oy, y) : oy + y * 16 + 8);
    }
  }

  // ---------- observe mode ----------
  const ICON = { gravel: "slow", smoke: "rise", fog: "sink", fuse: "burn", wood: "burn", limeA: "etch", limeB: "etch", ice: "freeze" };
  const CLASS = { acid: "water", plug: "solid", hard: "solid", fuse: "solid", limeA: "solid", limeB: "solid", wood: "solid", ice: "solid", gravel: "sand" };
  function dashedRect(r, x, y, w, h, c) {
    for (let k = 0; k < w; k++) if ((k >> 1) % 2 === 0) { r.set(x + k, y, c); r.set(x + k, y + h - 1, c); }
    for (let k = 0; k < h; k++) if ((k >> 1) % 2 === 0) { r.set(x, y + k, c); r.set(x + w - 1, y + k, c); }
  }
  function dotted(r, x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k += 2) r.set(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), c);
  }
  function drawObserve(r, spec, L, s, ox, oy) {
    for (let i = 0; i < L.w * L.h; i++) {
      const m = kindOf(s.terrain[i]); if (!OWN[m]) continue;
      const tx = i % L.w, ty = (i / L.w) | 0;
      if (CLASS[m]) S().draw(r, "ui.class_icon", CLASS[m], 0, ox + tx * 16 + 5, oy + ty * 16 + 8);
      if (ICON[m]) S().draw(r, "ui.rule_icon", ICON[m], 0, ox + tx * 16 + (CLASS[m] ? 11 : 8), oy + ty * 16 + 8);
    }
    const list = spec.devices || [];
    const AREA = { torch: "j", frost_vent: "s", heat_vent: "k" };
    const centre = (d) => d.type === "lift" ? d.stops[0] : d.type === "bin" ? [d.rect[0], d.rect[1]] : d.type === "release" || d.type === "bridge" ? d.cells[0] : d.type === "portal" ? d.pads[0] : d.at || d.root;
    for (const d of list) {
      if (AREA[d.type]) { const [x, y, w, h] = d.area; dashedRect(r, ox + x * 16, oy + y * 16, w * 16, h * 16, AREA[d.type]); }
      if (d.type === "release") for (const [x, y] of d.cells) dashedRect(r, ox + x * 16 + 1, oy + y * 16 + 1, 14, 14, "C");
      if (d.type === "bin") { const [x, y, w, h] = d.rect; dashedRect(r, ox + x * 16, oy + y * 16, w * 16, h * 16, "l"); }
      if (d.type === "lift" && d.button) { const [bx, by] = d.button, [sx, sy] = d.stops[s.dev ? s.dev[list.indexOf(d)] : (d.preview && d.preview.stop) || 0]; dotted(r, cellX(ox, bx), cellY(oy, by) - 4, cellX(ox, sx), oy + sy * 16 + 4, "s"); }
      if (d.type === "portal") { const [[ax, ay], [bx, by]] = d.pads; dotted(r, cellX(ox, ax), oy + ay * 16 + 8, cellX(ox, bx), oy + by * 16 + 8, "s"); }
      if (d.type === "bin" && d.trigger && list[d.trigger.device]) { const c = centre(list[d.trigger.device]); dotted(r, ox + d.rect[0] * 16 + 8, oy + d.rect[1] * 16 + 8, cellX(ox, c[0]), oy + c[1] * 16 + 8, "s"); }
      if (d.type === "lever" && d.action) {
        if (d.action.link !== undefined && L.groups && L.groups[d.action.link]) {
          for (const i of L.groups[d.action.link].doors) dotted(r, cellX(ox, d.at[0]), cellY(oy, d.at[1]) - 6, ox + (i % L.w) * 16 + 8, oy + ((i / L.w) | 0) * 16 + 8, "s");
          continue;
        }
        const t = list[d.action.device !== undefined ? d.action.device : d.action.release];
        const c = t && centre(t);
        if (c) dotted(r, cellX(ox, d.at[0]), cellY(oy, d.at[1]) - 6, cellX(ox, c[0]), oy + c[1] * 16 + 8, "s");
      }
    }
  }

  // ---------- material swatch (the "material.chapter2_5" asset render) ----------
  function swatches(r) {
    const T = TM().T;
    r.rect(0, 0, 320, 180, "y");
    const items = [["gravel", T.GRAVEL], ["fuse", T.FUSE], ["acid", T.ACID], ["stone A", T.LIME_A], ["stone A'", T.LIME_B], ["hard", T.HARD], ["smoke", T.SMOKE], ["fog", T.FOG], ["plug", T.PLUG], ["wood", T.WOOD], ["ice", T.ICE]];
    items.forEach(([label, t], k) => {
      // A 2x2 block of the material on a rock floor, so tops, sides and joins show.
      const col = k % 6, row = (k / 6) | 0, x0 = 10 + col * 52, y0 = 14 + row * 84, W = 2, H = 3;
      const terr = [t, t, t, t, T.ROCK, T.ROCK];
      const map = { w: W, h: H, at: (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? "empty" : kindOf(terr[y * W + x])) };
      r.rect(x0, y0 + 32, 32, 16, "x"); r.hline(x0, y0 + 32, 32, "w");
      drawMaterials(r, map, x0, y0, 0);
      if (PB.text) PB.text.draw(r, label, x0, y0 + 52, "u");
    });
  }

  // ---------- chapter showcases ----------
  // One representative scene per chapter (2-5), drawn in that chapter's theme:
  // every new material, device and effect of the chapter on one screen. Like
  // PB.scene.SHOWCASE these are illustrations, not playable levels; `preview`
  // and `fx` fields exist only here.
  const SHOWCASES = {
    ruins: {
      id: "showcase.ruins", chapter: "ruins", showcase: true, codeKey: "showcase.code", bag: {},
      map: [
        "####################",
        "#.......#....#.....#",
        "#.......|..X.#~~~~~#",
        "#..#############~###",
        "#...............~..#",
        "#............#..~.##",
        "#.......B.I..#..~.##",
        "#.B..P#~~~~~##~~~~##",
        "#..#################",
        "####################"],
      links: [{ plates: [[10, 7]], doors: [[8, 2]], symbol: "circle" }],
      devices: [
        { type: "lift", stops: [[1, 8], [1, 3]], button: [4, 7], width: 2 },
        { type: "bin", rect: [14, 5, 4, 3], material: "water", need: 2048, latch: true },
      ],
      fx: [{ sprite: "fx.splash", at: [16, 6], anim: "play", tick: 0, every: 40 }],
    },
    cave: {
      id: "showcase.cave", chapter: "cave", showcase: true, codeKey: "showcase.code", bag: { bomb: 2 },
      map: [
        "####################",
        "#......#gggg#......#",
        "#......#gggg#......#",
        "#......#gggg#......#",
        "#......#%%%%#......#",
        "#...%%.............#",
        "#...%%..........%..#",
        "#.P.%%..gg..ffff%.X#",
        "####################"],
      fx: [
        { sprite: "fx.explosion", at: [9, 5], anim: "play", tick: 6, every: 90 },
        { sprite: "fx.rubble", at: [8, 4], anim: "play", tick: 4, every: 90 },
        { sprite: "fx.rubble", at: [11, 4], anim: "play", tick: 10, every: 90 },
        { sprite: "fx.fire", at: [12, 7], anim: "burn" },
      ],
    },
    forest: {
      id: "showcase.forest", chapter: "forest", showcase: true, codeKey: "showcase.code", bag: {},
      map: [
        "####################",
        "##aaa#.#^^^^#......#",
        "##aaa#.#^^^^#......#",
        "##ppp#.#....#....X.#",
        "#.LMR..#....#...####",
        "#.LMR..#....#......#",
        "#......#.vv.#......#",
        "#....P.#vvvv##~~~###",
        "####################"],
      devices: [
        { type: "release", cells: [[2, 3], [3, 3], [4, 3]], to: "plug_decay" },
        { type: "lever", at: [3, 7], action: { release: 0 } },
        { type: "bin", rect: [8, 1, 4, 2], material: "smoke", need: 2048, latch: true },
        { type: "bin", rect: [8, 6, 4, 2], material: "fog", need: 2048, latch: true },
        { type: "vine", root: [15, 7], height: 4, need: 512, preview: { grown: true } },
      ],
    },
    sky: {
      id: "showcase.sky", chapter: "sky", showcase: true, codeKey: "showcase.code", bag: {},
      map: [
        "####################",
        "#..................#",
        "#............#~~~#.#",
        "#............#~~~#.#",
        "#....w.......##i##.#",
        "#....w.............#",
        "#P...w...........X.#",
        "########iiii########",
        "########~~~~########",
        "####################"],
      devices: [
        { type: "torch", at: [2, 6], area: [4, 4, 2, 3], temperature: 600, phase_ticks: 180, preview: { on: true } },
        { type: "lever", at: [3, 6], action: { device: 0 }, preview: { on: true } },
        { type: "frost_vent", at: [7, 6], area: [8, 7, 4, 1], layer: "cold", value: 255, preview: { on: true } },
        { type: "lever", at: [6, 6], action: { device: 2 }, preview: { on: true } },
        { type: "heat_vent", at: [14, 6], area: [15, 4, 1, 1], layer: "heat", value: 255 },
        { type: "lever", at: [12, 6], action: { device: 4 } },
      ],
      fx: [
        { sprite: "fx.fire", at: [5, 6], anim: "burn" },
        { sprite: "fx.fire", at: [5, 5], anim: "burn", tick: 7 },
        { sprite: "fx.fire", at: [5, 4], anim: "burn", tick: 13 },
        { sprite: "fx.frost", at: [9, 7], anim: "play", every: 60 },
      ],
    },
  };
  // Assets each chapter showcase draws (for reference "uses" lists).
  const USES = {
    ruins: ["mech.lift", "mech.button", "mech.bin", "mech.bin_gauge", "fx.splash", "fx.ripple", "mech.plate", "mech.door", "mech.link_symbol", "obj.crate_wood", "obj.crate_iron"],
    cave: ["fx.explosion", "fx.rubble", "fx.fire", "item.bomb"],
    forest: ["mech.lever", "mech.bin", "mech.bin_gauge", "mech.vine", "ui.rule_icon"],
    sky: ["mech.torch", "mech.lever", "mech.frost_vent", "mech.heat_vent", "fx.fire", "fx.frost", "ui.rule_icon"],
  };

  PB.matter = { SHOWCASES, USES, kindOf, isOwn, drawMaterials, mapOf, drawDevices, floating, drawFx, drawObserve, swatches, SHADE };
})(typeof window !== "undefined" ? window : globalThis);
