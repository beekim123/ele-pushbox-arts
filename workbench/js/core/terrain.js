/* Terrain and background rendering. This file IS the specification for the
 * game's terrain shader (docs/design/art-direction.md §5): static materials are
 * coloured from material, pixel position hash and same-material neighbours only.
 * Theme parameters come from procedural art sources (art/source/terrain/*.json). */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const h32 = PB.h32;

  // Material ids used by the renderer (independent of the design model codes).
  const MAT = { EMPTY: 0, ROCK: 1, CRACKED: 2, EARTH: 3, SAND: 4, WATER: 5 };
  const SEED = { 1: 11, 2: 23, 3: 37, 4: 41, 5: 53 };

  function pick(list, n) { return list[n % list.length]; }

  // map: {w, h, at(tx, ty) -> MAT}. Draws tiles at (ox, oy) in pixels.
  function drawTerrain(r, map, theme, ox, oy, time) {
    const T = theme;
    for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < map.w; tx++) {
      const m = map.at(tx, ty);
      if (m === MAT.EMPTY) continue;
      const up = map.at(tx, ty - 1), down = map.at(tx, ty + 1), left = map.at(tx - 1, ty), right = map.at(tx + 1, ty);
      for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
        const wx = tx * 16 + px, wy = ty * 16 + py;
        const c = shade(T, m, wx, wy, px, py, { up, down, left, right, tx, ty }, time | 0);
        if (c) r.set(ox + wx, oy + wy, c);
      }
    }
  }

  function solidish(m) { return m === MAT.ROCK || m === MAT.CRACKED || m === MAT.EARTH; }

  function shade(T, m, wx, wy, px, py, n, time) {
    const hash = h32(wx, wy, SEED[m]);
    if (m === MAT.ROCK) return rock(T.rock, wx, wy, px, py, n, hash);
    if (m === MAT.EARTH) {
      const P = T.earth;
      let c = pick(P.base, (hash >>> 3) % 5 === 0 ? 1 : 0);
      const clump = h32(wx >> 2, wy >> 2, 5) % 9;
      if (clump === 0) c = P.clump;
      if (hash % 37 === 0) c = P.pebble;
      else if (h32(wx, wy - 1, SEED[m]) % 37 === 0) c = P.pebbleShade;
      if (n.up !== MAT.EARTH && n.up !== MAT.ROCK) {
        if (py === 0) c = P.crust; else if (py === 1 && hash % 3) c = P.crust2;
      }
      if (py === 15 && n.down === MAT.EMPTY) c = P.dark;
      if ((px === 0 && n.left === MAT.EMPTY) || (px === 15 && n.right === MAT.EMPTY)) c = P.dark;
      return blockFrame(c, px, py, n, MAT.EARTH, P.frame, P.bevel);
    }
    if (m === MAT.CRACKED) {
      const P = T.cracked;
      let c = pick(P.base, hash % 7 === 0 ? 1 : 0);
      if (crack(n.tx, n.ty, px, py)) c = P.crack;
      else if (crack(n.tx, n.ty, px - 1, py)) c = P.crackLight;
      if (py === 0 && n.up === MAT.EMPTY) c = P.light;
      if (py === 15 && n.down === MAT.EMPTY) c = P.dark;
      return blockFrame(c, px, py, n, MAT.CRACKED, P.frame, P.bevel);
    }
    if (m === MAT.SAND) {
      const P = T.sand;
      let c = pick(P.base, hash % 3);
      if (hash % 17 === 0) c = P.grain;
      if (py === 0 && n.up !== MAT.SAND) c = P.top;
      return c;
    }
    if (m === MAT.WATER) {
      const P = T.water;
      let c = py < 4 && n.up === MAT.WATER ? P.body : py < 6 ? P.upper : P.body;
      if (n.up !== MAT.WATER && n.up !== MAT.SAND) {
        if (py === 0) c = P.surface;
        else if (py === 1 && ((wx + time) % 7 === 0 || (wx + time * 2) % 11 === 0)) c = P.glint;
        else if (py < 4) c = P.upper;
      }
      if (n.up === MAT.WATER && h32(wx, wy, 3 + (time >> 1)) % 97 === 0) c = P.glint;
      return c;
    }
    return null;
  }


  // Bedrock looks differ per theme ("pattern"); edges follow the same rules everywhere.
  function rock(P, wx, wy, px, py, n, hash) {
    const openUp = n.up === MAT.EMPTY || n.up === MAT.WATER || n.up === MAT.SAND;
    let c, seam = false;
    if (P.pattern === "block") {
      const row = Math.floor(wy / 8), off = (row & 1) * 8, col = Math.floor((wx + off) / 16);
      seam = wy % 8 === 7 || (wx + off) % 16 === 15;
      c = seam ? P.seam : pick(P.base, h32(col, row, 7) % 3 === 0 ? 1 : 0);
      // carved glyph in some blocks
      const gx = (wx + off) % 16, gy = wy % 8;
      if (!seam && h32(col, row, 9) % 5 === 0 && gy >= 2 && gy <= 4 && (gx === 5 || gx === 9 || (gy === 3 && gx > 5 && gx < 9))) c = P.seam;
      if (!seam && hash % 37 === 0) c = P.speck;
    } else if (P.pattern === "rough") {
      // Large irregular strata with sparse cracks and crystal specks.
      const band = (wy + (h32(wx >> 3, 0, 11) % 4)) >> 2;
      c = pick(P.base, h32(wx >> 4, band, 13) % 3 === 0 ? 1 : 0);
      if (h32(wx >> 2, band, 17) % 11 === 0 && (wy & 3) === 0) c = P.seam;
      if (hash % 97 === 0) c = P.speck;
    } else if (P.pattern === "grass") {
      c = pick(P.base, h32(wx >> 1, wy >> 2, 13) % 4 === 0 ? 1 : 0);
      if (h32(wx, wy >> 1, 19) % 23 === 0) c = P.seam;
      if (hash % 41 === 0) c = P.speck;
    } else if (P.pattern === "marble") {
      // Polished slabs (16x8) with a thin vein now and then.
      const row = wy >> 3, col = (wx + (row & 1) * 8) >> 4;
      c = P.base[0];
      if ((wy & 7) === 7 || ((wx + (row & 1) * 8) & 15) === 15) c = P.base[1];
      else if (h32(col, row, 15) % 3 === 0 && (wx + wy * 2 + (h32(col, row, 16) % 9)) % 17 === 0) c = P.seam;
    } else if (P.pattern === "cloud") {
      return cloud(P, wx, wy, px, py, n, hash);
    } else if (P.pattern === "panel") {
      const ex = px === 0 || px === 15, ey = py === 0 || py === 15;
      seam = ex || ey;
      c = seam ? P.seam : py < 8 ? P.base[0] : P.base[1];
      if ((px === 2 || px === 13) && (py === 2 || py === 13)) c = P.speck;
      if (!seam && px > 3 && px < 12 && py === 7) c = P.seam;
    } else {
      const row = Math.floor(wy / 6), off = (row & 1) * 5, col = Math.floor((wx + off) / 10);
      seam = wy % 6 === 5 || (wx + off) % 10 === 9;
      c = seam ? P.seam : pick(P.base, h32(col, row, 7) % 4 === 0 ? 1 : 0);
      if (!seam && hash % 29 === 0) c = P.speck;
    }
    // Top surface treatment.
    if (openUp) {
      if (P.pattern === "grass") {
        const blade = h32(wx, 0, 21) % 4;
        if (py === 0) c = blade === 0 ? P.light2 : P.top;
        else if (py === 1) c = P.top;
        else if (py === 2) c = blade < 2 ? P.light2 : c;
        else if (py === 3 && blade === 0) c = P.light2;
      } else if (P.pattern === "panel") {
        if (P.trim === "hazard") { if (py <= 2) c = ((wx + py) >> 2) & 1 ? P.top : "z"; }
        else if (py === 0) c = P.light; else if (py === 1) c = (wx & 7) === 3 ? P.top : P.light2;
      } else if (P.pattern === "marble" || P.pattern === "block") {
        if (py === 0) c = P.top; else if (py === 1) c = P.light;
      } else if (P.pattern === "rough") {
        if (py === 0) c = h32(wx, 1, 23) % 3 ? P.top : P.light; else if (py === 1 && h32(wx, 1, 23) % 3 === 0) c = P.top;
      } else {
        if (py === 0) c = P.light; else if (py === 1 && !seam) c = P.light2;
      }
    }
    if (n.down === MAT.EMPTY) {
      if (P.pattern === "marble" && P.under) {
        const bump = 13 - (h32(wx >> 2, 0, 29) % 3);
        if (py >= bump) c = py === 15 ? P.dark : P.under;
      } else if (P.pattern === "rough") {
        if (py === 15 || (py === 14 && h32(wx, 2, 31) % 4 === 0)) c = P.dark;
      } else if (py === 15) c = P.dark;
    }
    if ((px === 0 && n.left === MAT.EMPTY && py > 0) || (px === 15 && n.right === MAT.EMPTY && py > 0)) c = P.edge;
    return c;
  }

  // Rule materials (packed earth, cracked rock) carry their own block outline so they
  // read as "a block you can act on" against any theme's natural ground.
  function blockFrame(c, px, py, n, self, frame, bevel) {
    if (!frame) return c;
    if ((px === 0 && n.left !== self) || (px === 15 && n.right !== self) || (py === 0 && n.up !== self) || (py === 15 && n.down !== self)) return frame;
    if (bevel && ((px === 1 && n.left !== self) || (py === 1 && n.up !== self))) return bevel;
    return c;
  }

  // True for pixels cut away to round an exposed corner of radius rad.
  function corner(n, px, py, rad) {
    const E = (m) => m === MAT.EMPTY;
    const u = E(n.up), d = E(n.down), l = E(n.left), r = E(n.right);
    return (u && l && px + py < rad) || (u && r && 15 - px + py < rad) || (d && l && px + 15 - py < rad) || (d && r && 30 - px - py < rad);
  }

  // Sky platforms are solid clouds: white puffs, scalloped top, shaded underside, round corners.
  function cloud(P, wx, wy, px, py, n, hash) {
    const E = (m) => m === MAT.EMPTY || m === MAT.WATER;
    if (corner(n, px, py, 4)) return null;
    const bumpTop = h32(wx >> 2, 0, 33) % 2;          // 0..1 px dips along an exposed top
    const bumpBot = 1 + (h32(wx >> 2, 1, 33) % 3);    // 1..3 px scallops along an exposed bottom
    if (E(n.up) && py < bumpTop) return null;
    if (E(n.down) && py > 15 - bumpBot) return null;
    if (E(n.left) && px < (h32(0, wy >> 2, 35) % 2)) return null;
    if (E(n.right) && px > 15 - (h32(1, wy >> 2, 35) % 2)) return null;
    let c = P.base[0];
    // Stacked puffs: each 8-px layer has a scalloped, lightly shaded lower edge.
    const layer = wy >> 3, scallop = 6 - (h32(wx >> 2, layer, 39) % 3);
    if ((wy & 7) >= scallop && (wy & 7) <= scallop + 1 && h32(wx >> 3, layer, 41) % 4 !== 0) c = P.base[1];
    if (E(n.down)) { const fromBottom = 15 - bumpBot - py; if (fromBottom <= 0) c = P.dark; else if (fromBottom <= 3) c = P.base[1]; }
    if (E(n.right) && px >= 14) c = c === P.dark ? P.dark : P.base[1];
    if (E(n.up) && py === bumpTop) c = P.light;
    return c;
  }

  // Deterministic crack polyline for one cracked tile.
  function crack(tx, ty, px, py) {
    if (px < 0 || px > 15) return false;
    const a = h32(tx, ty, 91);
    const x0 = 3 + (a % 6), x1 = 6 + ((a >>> 4) % 6), x2 = 4 + ((a >>> 8) % 8);
    // main line from top (x0,0) to middle (x1,8) to bottom (x2,15)
    const lerp = (xa, ya, xb, yb) => py >= ya && py <= yb && px === Math.round(xa + (xb - xa) * (py - ya) / Math.max(1, yb - ya));
    if (lerp(x0, 0, x1, 8) || lerp(x1, 8, x2, 15)) return true;
    // branch
    const bx = (a >>> 12) % 2 ? 1 : -1;
    return py >= 8 && py <= 11 && px === x1 + bx * (py - 8);
  }

  // ---------- backgrounds ----------
  // Backgrounds stay lower in contrast than terrain and contain nothing shaped
  // like an interactive object. "time" is in 1/60 s ticks.
  function drawBackground(r, theme, x0, y0, w, h, time) {
    const B = theme.background, x1 = x0 + w, y1 = y0 + h;
    const px = (x, y, c) => { if (x >= x0 && y >= y0 && x < x1 && y < y1) r.set(x, y, c); };
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const hash = h32(x >> 1, y >> 1, 401);
      let c = B.base[0];
      if (B.style === "sky") {
        // Bayer-dithered gradient from deep to pale sky.
        const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5][(y & 3) * 4 + (x & 3)];
        const level = Math.floor(((y - y0) * 32) / h);
        c = level < 12 ? B.base[0] : level < 28 ? (bayer < (level - 12) ? B.base[1] : B.base[0]) : B.base[1];
        r.set(x, y, c); continue;
      }
      if (B.style === "dungeon") {
        const row = Math.floor(y / 12), off = (row & 1) * 12;
        const mortar = y % 12 === 11 || (x + off) % 24 === 23;
        c = mortar ? B.base[0] : h32(Math.floor((x + off) / 24), row, 41) % 5 === 0 ? B.detail : B.base[1];
        if (!mortar && hash % 53 === 0) c = B.speck;
      } else if (B.style === "cosmos") {
        const band = (x + y * 2) % 140;
        if (band < 30 && hash % 3 === 0) c = B.base[1];
        if (band < 12 && hash % 5 === 0) c = B.accent;
      } else {
        const band = (y + ((h32(x >> 3, 0, 405) % 5) - 2) + ((x >> 4) % 3)) % 13;
        if (band === 0 && hash % 3) c = B.base[1];
        else if (h32(x >> 2, y >> 2, 403) % 11 === 0 && hash % 2) c = B.base[1];
        if (hash % 47 === 0) c = B.speck;
      }
      r.set(x, y, c);
    }
    const S = B.style;
    if (S === "dungeon") {
      for (let cx = x0 + 40; cx < x1; cx += 112) for (let y = y0; y < y0 + 46; y++) {
        const link = (y >> 2) & 1;
        px(cx, y, link ? B.detail : B.speck); if (link) { px(cx - 1, y, B.base[0]); px(cx + 1, y, B.base[0]); }
      }
    } else if (S === "ruins") {
      for (let cx = x0 + 20; cx < x1 + 20; cx += 64) {
        for (let y = y0 + 14; y < y1; y++) for (let k = 0; k < 14; k++) px(cx + k, y, k === 0 || k === 13 ? B.base[0] : k % 4 === 2 ? B.detail : B.accent);
        for (let k = -3; k < 17; k++) { px(cx + k, y0 + 12, B.detail); px(cx + k, y0 + 13, B.accent); px(cx + k, y0 + 14, B.detail); }
      }
    } else if (S === "cave") {
      for (let sx = x0 + 6; sx < x1; sx += 23) {
        const len = 10 + (h32(sx, 0, 51) % 22);
        for (let d = 0; d < len; d++) { const half = Math.max(0, Math.floor(((len - d) * 4) / len) - 1); for (let k = -half; k <= half; k++) px(sx + k, y0 + d, k === -half ? B.speck : B.detail); }
      }
      for (let i = 0; i < 9; i++) { const vx = x0 + (h32(i, 3, 53) % w), vy = y0 + 40 + (h32(i, 4, 53) % (h - 60)); for (let k = 0; k < 6; k++) px(vx + k, vy - (k >> 1), B.accent); }
    } else if (S === "forest") {
      for (let i = 0; i < 9; i++) {
        const tx = x0 + ((i * 41 + (h32(i, 0, 61) % 20)) % (w + 20)) - 10, tw = 6 + (h32(i, 1, 61) % 7);
        for (let y = y0 + 20; y < y1; y++) for (let k = 0; k < tw; k++) px(tx + k, y, k === 0 ? B.base[0] : k === 2 && (y >> 3) % 3 ? B.detail : B.accent);
      }
      for (let y = y0; y < y0 + 34; y++) for (let x = x0; x < x1; x++) {
        const blob = h32(x >> 3, y >> 2, 63) % 4;
        if (y < y0 + 18 + (h32(x >> 3, 9, 63) % 12) && blob) px(x, y, (x + y) & 1 ? B.detail : B.base[0]);
      }
    } else if (S === "sky") {
      // Distant floating islands.
      for (let i = 0; i < 3; i++) {
        const ix = x0 + 30 + i * 110 + (h32(i, 0, 71) % 30), iy = y0 + 110 + (h32(i, 1, 71) % 30), iw = 30 + (h32(i, 2, 71) % 20);
        for (let k = 0; k < iw; k++) { const depth = Math.max(1, Math.floor(((iw / 2 - Math.abs(k - iw / 2)) * 3) / 4)); for (let d = 0; d < depth; d++) px(ix + k, iy + d, d === 0 ? "n" : B.detail); }
      }
      // Clouds drifting slowly.
      for (let i = 0; i < 5; i++) {
        const cw = 26 + (h32(i, 5, 73) % 30), cy = y0 + 14 + i * 22 + (h32(i, 6, 73) % 10);
        const cx = x0 + (((h32(i, 7, 73) % (w + 60)) + (time >> (4 + (i & 1)))) % (w + 60)) - 40;
        for (let k = 0; k < cw; k++) { const top = Math.floor(Math.abs(k - cw / 2) / 3) - (h32(k >> 2, i, 75) % 2); for (let d = Math.max(0, top); d < 6; d++) px(cx + k, cy + d, d >= 4 ? B.accent : B.speck); }
      }
    } else if (S === "cosmos") {
      for (let i = 0; i < 70; i++) {
        const sx = x0 + (h32(i, 0, 81) % w), sy = y0 + (h32(i, 1, 81) % h), tw = (time >> 4) + i;
        px(sx, sy, h32(tw, i, 83) % 7 === 0 ? "v" : h32(i, 2, 81) % 4 === 0 ? "t" : "u");
      }
      const pcx = x0 + w - 60, pcy = y0 + 42, pr = 20;
      for (let dy = -pr; dy <= pr; dy++) for (let dx = -pr; dx <= pr; dx++) {
        const d2 = dx * dx + dy * dy; if (d2 > pr * pr) continue;
        px(pcx + dx, pcy + dy, d2 > (pr - 2) * (pr - 2) ? "g" : dx + dy < -12 ? "C" : (dy + 40) % 7 < 2 ? "B" : "C");
      }
      for (let dx = -32; dx <= 32; dx++) { const ry = Math.round(dx * 0.18); if (Math.abs(dx) > pr - 2 || ry + pcy > pcy + 2) px(pcx + dx, pcy + ry, "D"); }
      for (let x = x0; x < x1; x++) { px(x, y1 - 30, B.detail); px(x, y1 - 22, B.detail); if (x % 12 < 2 || (x % 12) === ((y1 - 26) % 12)) for (let y = y1 - 30; y <= y1 - 22; y++) px(x, y, B.detail); }
    }
  }

  PB.terrain = { MAT, drawTerrain, drawBackground, crack };
})(typeof window !== "undefined" ? window : globalThis);
