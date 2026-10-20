/* Terrain and backdrop for the 糖果王国 region (theme.candy, delivery mode only;
 * docs/design/delivery-candy.md §1). The look is a sunny, warm afternoon in a
 * fairy-tale candy land: cracker ground, sandwich-cookie walls, chocolate slabs,
 * wafer strips and frosted tops under a blue sky with cream clouds.
 *
 * Terrain, rock.pattern "candy": rock is drawn by zone, from the material, world
 * pixel hashes h32(x, y, seed), the neighbouring cells and the row's distance
 * from the bottom of the map (bands of 10 rows = one row of screens), never from
 * the room id, so the result can be cached and a shader can reproduce it
 * (art-direction.md §5; delivery-puzzle-rules.md §8.3):
 * - plain rock: one square soda cracker per cell (pale E, a baked 1 px rim, F
 *   shading, rows of 1 px docking holes with a lit lower lip, a lit open top).
 *   No cracks: cracks mark rule cracked rock (delivery-candy.md §7.2);
 * - the leftmost and rightmost column: stacked sandwich cookies (biscuit E with
 *   pink D and cream t filling in turn, dark seams between the cookies);
 * - the bottom row: hard chocolate slabs, one per cell (f, lit e bevel, g groove);
 * - a one-cell-thick strip, open above and below, in the lower half of a screen:
 *   a wafer bar (E with an F diagonal lattice; no frame, no braces: not a crate,
 *   not a bridge);
 * - open tops: pink strawberry frosting (D, lit edge t, 1-3 px drips, a few
 *   single-pixel sprinkles m / r / t, rising up to 2 px into the cell above) in
 *   the upper half of a screen, a 2 px mint glaze (m, dark edge n) in the lower
 *   half (never a whole cell, so it reads as neither rule acid nor ice).
 * Rule materials (earth, cracked rock, sand, water) come from terrain.js
 * unchanged, block outline included (art-direction.md §8): the water stays blue
 * ("糖水"), the chocolate river is backdrop only (§7.1 A). Ice keeps its own
 * drawing (matter.js), as everywhere else.
 *
 * Backdrop, background.style "candy": a clear, warm afternoon. Dithered blue sky
 * (r into pale u), slowly drifting cream clouds with ragged undersides (never a
 * ledge), on the horizon a three-tier pink cake castle (cream lace, mint spires,
 * a cherry on the top spire) between round cream hills and a row of lollipop
 * grove silhouettes; then a chocolate river (e at the horizon, dithered into the
 * darker f and g within 16 px, moving e ripples and d glints, no blue and no
 * bright surface line: that is rule water) and a dark near bank g at the bottom.
 * Any width: positions follow x - x0. No outlines anywhere in the backdrop.
 *
 * Wraps PB.terrain.drawTerrain / drawBackground and only takes over for pattern
 * "candy" / style "candy", so terrain.js, terrain-diyu.js and terrain-jeju.js
 * stay unchanged. Background "time" is in 1/60 s ticks. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const T = PB.terrain;
  if (!T || T.candy) return;   // loaded twice: keep the first wrapper
  const h32 = PB.h32, MAT = T.MAT, baseTerrain = T.drawTerrain, baseBackground = T.drawBackground;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

  // Smooth value noise 0..255 on a cw x ch lattice (integer maths only).
  function vnoise(x, y, cw, ch, seed) {
    const gx = Math.floor(x / cw), gy = Math.floor(y / ch), fx = x - gx * cw, fy = y - gy * ch;
    const a = h32(gx, gy, seed) & 255, b = h32(gx + 1, gy, seed) & 255, c = h32(gx, gy + 1, seed) & 255, d = h32(gx + 1, gy + 1, seed) & 255;
    return Math.floor(((a * (cw - fx) + b * fx) * (ch - fy) + (c * (cw - fx) + d * fx) * fy) / (cw * ch));
  }

  // ---------- terrain: rock.pattern "candy" ----------

  function drawTerrain(r, map, theme, ox, oy, time) {
    const P = theme.rock;
    if (!P || P.pattern !== "candy") return baseTerrain(r, map, theme, ox, oy, time);
    // Rule materials from terrain.js, drawn off-screen first so its stand-in for rock never shows.
    const tmp = new PB.Raster(map.w * 16, map.h * 16);
    baseTerrain(tmp, map, theme, 0, 0, time);
    const at = (x, y) => (x < 0 || y < 0 || x >= map.w || y >= map.h ? MAT.ROCK : map.at(x, y));   // beyond the map: more rock
    for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < map.w; tx++) {
      const m = map.at(tx, ty);
      if (m === MAT.ROCK) candyTile(r, P, map, at, tx, ty, ox, oy);
      else if (m !== MAT.EMPTY) copyTile(r, tmp, tx, ty, ox, oy);
    }
  }
  function copyTile(r, src, tx, ty, ox, oy) {
    for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
      const i = ((ty * 16 + py) * src.w + tx * 16 + px) * 4, d = src.data;
      if (d[i + 3]) r.set(ox + tx * 16 + px, oy + ty * 16 + py, PB.codeOf(d[i], d[i + 1], d[i + 2]));
    }
  }

  function candyTile(r, P, map, at, tx, ty, ox, oy) {
    const E = MAT.EMPTY, up = at(tx, ty - 1), down = at(tx, ty + 1), left = at(tx - 1, ty), right = at(tx + 1, ty);
    const oU = up === E, oD = down === E, oL = left === E, oR = right === E;
    const lower = (map.h - 1 - ty) % 10 < 5, bottom = ty === map.h - 1, side = tx === 0 || tx === map.w - 1;
    const x0 = tx * 16, y0 = ty * 16, put = (wx, wy, c) => { if (c) r.set(ox + wx, oy + wy, c); };
    if (bottom) return chocoTile(P, put, x0, y0, oU, oL, oR);
    if (side) return wallTile(P, put, x0, y0, oU, oD, oL, oR);
    if (lower && oU && oD) return waferTile(P, put, x0, y0, oL, oR);
    const covered = up === MAT.WATER || up === MAT.SAND;
    for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
      if (cut(px, py, oU, oD, oL, oR)) continue;
      const wx = x0 + px, wy = y0 + py;
      let c = cracker(P, wx, wy, px, py);
      if ((oU || covered) && py === 0) c = P.light;
      if (oD && py === 15) c = P.dark;
      if ((oL && px === 0) || (oR && px === 15)) c = py === 0 && (oU || covered) ? P.light : P.edge;
      put(wx, wy, c);
    }
    if (oU) (lower ? mintTop : frostTop)(P, put, x0, y0, ty, oL, oR);
  }
  // Rounded outer corners (one pixel) where two neighbouring sides are open.
  function cut(px, py, oU, oD, oL, oR) {
    return (oL && ((oU && px + py < 1) || (oD && px + 15 - py < 1))) || (oR && ((oU && 15 - px + py < 1) || (oD && 30 - px - py < 1)));
  }

  // Soda cracker: one per cell. A baked rim all round, F shading inside the lower and right
  // rim, three rows of four docking holes, each with a lit pixel under it, a few baked specks.
  function cracker(P, wx, wy, px, py) {
    const K = P.cracker;   // [body, shade, rim, hole, lip, speck]
    if (px === 0 || py === 0 || px === 15 || py === 15) return K[2];
    if (px === 14 || py === 14) return K[1];
    const hole = px >= 3 && px <= 12 && (px - 3) % 3 === 0;
    if (hole && (py === 3 || py === 7 || py === 11)) return K[3];
    if (hole && (py === 4 || py === 8 || py === 12)) return K[4];
    return h32(wx, wy, 1201) % 43 === 0 ? K[5] : K[0];
  }

  // Strawberry frosting over an open top (upper half of a screen): 3 px of D with a lit t edge,
  // drips of 1-3 px, sparse sprinkles, and a soft top that rises up to 2 px into the cell above.
  function frostTop(P, put, x0, y0, ty, oL, oR) {
    const F = P.frost, S = P.sprinkle;   // F: [lit edge, body, drip tip]
    for (let px = 0; px < 16; px++) {
      const wx = x0 + px, rim = (oL && px === 0) || (oR && px === 15);
      const v = vnoise(wx, ty, 7, 1, 1211), rise = rim ? 0 : v > 170 ? 2 : v > 90 ? 1 : 0;
      const g = Math.floor(wx / 5), hd = h32(g, ty, 1213), d0 = g * 5 + 1 + ((hd >>> 4) % 2), dw = 1 + ((hd >>> 7) & 1);
      let depth = rim ? 2 : 3;
      if (!rim && hd % 3 === 0 && wx >= d0 && wx < d0 + dw) depth += 1 + ((hd >>> 9) % 3) - (dw === 2 && wx === d0 + 1 ? 1 : 0);
      for (let k = -rise; k < depth; k++) {
        const wy = y0 + k, hs = h32(wx, wy, 1215);
        let c = k === -rise ? (hs % 5 === 0 ? F[1] : F[0]) : F[1];
        if (k === depth - 1 && depth > 3) c = F[2];
        else if (k > -rise && k < depth - 1 && hs % 19 === 0) c = S[(hs >>> 8) % S.length];
        put(wx, wy, c);
      }
    }
  }
  // Mint glaze over an open top (lower half): two rows of m with a broken dark n lower edge.
  function mintTop(P, put, x0, y0, ty, oL, oR) {
    const M = P.mint;   // [glaze, dark edge]
    for (let px = 0; px < 16; px++) {
      const wx = x0 + px, rim = (oL && px === 0) || (oR && px === 15);
      put(wx, y0, rim ? M[1] : M[0]);
      put(wx, y0 + 1, rim || vnoise(wx, ty, 4, 1, 1221) > 150 ? M[1] : M[0]);
    }
  }

  // Sandwich cookies stacked in 8 px layers (world-aligned): biscuit, filling (pink or
  // cream in turn), biscuit, dark seam. On an open side the cookie ends are rounded and
  // the seam shows the backdrop through.
  function wallTile(P, put, x0, y0, oU, oD, oL, oR) {
    const W = P.wall;   // [biscuit, lit, shade, seam, filling A, filling B, hole]
    for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
      const wx = x0 + px, wy = y0 + py, k = wy >> 3, ly = wy & 7, inset = h32(k, x0, 1231) % 2;
      const endL = oL && px <= inset, endR = oR && px >= 15 - inset;
      if ((endL || endR) && (ly === 7 || ly === 0 || ly === 6)) continue;
      if (oU && py === 0 && ly === 7) continue;
      let c;
      if (ly === 7) c = W[3];
      else if (ly === 3 || ly === 4) c = k & 1 ? W[5] : W[4];
      else if (ly === 0) c = W[1];
      else if (ly === 6) c = W[2];
      else c = ly === 1 && (wx + k * 2) % 4 === 0 ? W[6] : W[0];
      if ((endR || (oR && px === 15)) && ly !== 3 && ly !== 4) c = W[2];
      if (oD && py === 15) c = W[2];
      put(wx, wy, c);
    }
  }

  // Chocolate slab, one per cell: g groove on the lower and right side, a lit e bevel on the
  // upper and left side, a raised inner panel with its own bevel and one glint.
  function chocoTile(P, put, x0, y0, oU, oL, oR) {
    const C = P.choco;   // [body, lit, groove, glint]
    for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
      if ((oL && oU && px + py < 1) || (oR && oU && 15 - px + py < 1)) continue;
      let c = C[0];
      if (px === 15 || py === 15) c = C[2];
      else if (px === 0 || py === 0) c = C[1];
      else if (px >= 3 && px <= 12 && py >= 3 && py <= 12) {
        if (px === 3 || py === 3) c = C[1];
        else if (px === 12 || py === 12) c = C[2];
        if (py === 4 && px >= 4 && px <= 6) c = C[3];
      }
      put(x0 + px, y0 + py, c);
    }
  }

  // Wafer bar: E with an F diagonal lattice every 6 px, a lit top row and a shaded bottom
  // row; nothing else (no frame, no braces).
  function waferTile(P, put, x0, y0, oL, oR) {
    const A = P.wafer;   // [body, lattice, lit, shade]
    for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
      if (cut(px, py, true, true, oL, oR)) continue;
      const wx = x0 + px, wy = y0 + py;
      let c = (wx + wy) % 6 === 0 || (((wx - wy) % 6) + 6) % 6 === 0 ? A[1] : A[0];
      if (py === 0) c = A[2];
      else if (py === 15) c = A[3];
      put(wx, wy, c);
    }
  }
  // ---------- backdrop: background.style "candy" ----------

  function drawBackground(r, theme, x0, y0, w, h, time) {
    const B = theme.background;
    if (!B || B.style !== "candy") return baseBackground(r, theme, x0, y0, w, h, time);
    const x1 = x0 + w, y1 = y0 + h, t = time | 0;
    const px = (x, y, c) => { if (x >= x0 && y >= y0 && x < x1 && y < y1) r.set(x, y, c); };
    const horizon = y0 + Math.round(h * 0.58), span = Math.max(1, horizon - y0);
    // Sky: r blue at the top, dithered into the pale u that reaches the horizon.
    for (let y = y0; y < horizon && y < y1; y++) {
      const level = Math.floor(((y - y0) * 32) / span);
      for (let x = x0; x < x1; x++) px(x, y, level < 12 ? B.base[0] : level < 28 ? (bayer(x, y) < level - 12 ? B.base[1] : B.base[0]) : B.base[1]);
    }
    // Cream clouds drift left by one pixel every 128 ticks.
    const drift = t >> 7;
    for (let k = Math.floor(drift / 120) - 1; (k - 1) * 120 - drift < w + 60; k++) {
      const hs = h32(k, 0, 1301);
      if (hs % 5 === 0) continue;
      const cx = x0 + k * 120 + (hs >>> 4) % 84 - drift, cy = y0 + 12 + ((hs >>> 12) % Math.max(1, Math.floor(span * 0.4)));
      cloud(px, B.cloud, cx, cy, 16 + ((hs >>> 20) % 20), hs);
    }
    // Horizon: round cream hills, a row of lollipop silhouettes, the cake castle in front.
    for (let x = x0; x < x1; x++) {
      const xw = x - x0, hh = hill(xw);
      for (let k = 1; k <= hh; k++) px(x, horizon - k, k >= hh - 1 && bayer(x, horizon - k) < 12 ? B.hills[0] : B.hills[1]);
    }
    grove(px, B, x0, x1, horizon);
    const kc = Math.floor(-200 / 480);
    for (let k = kc; k * 480 - 200 < w; k++) castle(px, B, x0 + castleX(k), horizon);
    // Chocolate river: e at the horizon, dithered into f within 16 rows, then f into g towards
    // the near bank; e ripple rows slide with time, sparse d glints. Never blue, no bright line.
    const R = B.river, fade = 16;
    for (let y = horizon; y < y1; y++) {
      const d = y - horizon, wave = waveRow(d), deep = Math.max(1, y1 - horizon - fade);
      for (let x = x0; x < x1; x++) {
        const xw = x - x0, bb = bayer(x, y);
        let c = d < fade ? (bb >= Math.floor((d * 16) / fade) ? R[0] : R[1]) : (bb < Math.floor(((d - fade) * 10) / deep) ? R[2] : R[1]);
        if (wave && d >= 2 && vnoise(xw + (wave & 1 ? 1 : -1) * (t >> 5) + d * 13, d, 9 + d, 1, 1311) > 150) c = R[0];
        const hg = h32(xw, y, 1313);
        if (d >= 3 && hg % 157 === 0 && ((t >> 4) + (hg >>> 9)) % 5 < 2) c = B.glint;
        px(x, y, c);
      }
    }
    // Near bank: a dark silhouette along the bottom.
    for (let x = x0; x < x1; x++) {
      const xw = x - x0, top = y1 - 4 - Math.floor((vnoise(xw, 0, 18, 1, 1321) * 8) / 255) - (h32(xw >> 2, 0, 1322) % 3 === 0 ? 1 : 0);
      for (let y = top; y < y1; y++) px(x, y, B.shore);
    }
  }
  // Rows of the river that carry ripples: d = 1, 3, 6, 10, 15, 21, ... (wider apart nearer the bank).
  function waveRow(d) {
    for (let k = 1, at = 1; at <= d; k++, at += k) if (at === d) return k;
    return 0;
  }
  // Round cream hills: domes on a 110 px lattice, 5-13 px high.
  function hill(xw) {
    const k = Math.floor(xw / 110);
    let best = 0;
    for (let i = k - 1; i <= k + 1; i++) {
      const hs = h32(i, 0, 1331), cx = i * 110 + 20 + (hs % 70), hw = 34 + ((hs >>> 8) % 26), H = 5 + ((hs >>> 16) % 9);
      const dx = Math.abs(xw - cx);
      if (dx >= hw) continue;
      const v = Math.round(H * Math.sqrt(1 - (dx * dx) / (hw * hw)));
      if (v > best) best = v;
    }
    return best;
  }
  // Lollipop grove: small silhouettes (a round head on a thin stick) every 9-15 px.
  function grove(px, B, x0, x1, horizon) {
    for (let k = -2, x = x0 - 20; x < x1 + 20; k++) {
      const hs = h32(k, 0, 1341);
      x = x0 + k * 12 + (hs % 5);
      if (hs % 7 === 0) continue;
      const stick = 3 + ((hs >>> 4) % 4), rad = 2 + ((hs >>> 8) % 2), top = horizon - stick - rad * 2;
      for (let y = horizon - stick; y < horizon; y++) px(x, y, B.grove);
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) if (dx * dx + dy * dy <= rad * rad + 1) px(x + dx, top + rad + dy, B.grove);
    }
  }
  function castleX(k) { return k * 480 + 110 + (h32(k, 0, 1351) % 120); }
  // The cake castle: three pink tiers (D, shaded C on the right) with scalloped cream lace,
  // two side towers and a top spire in mint n, a cherry i on the top spire. No outline.
  function castle(px, B, cx, horizon) {
    const [body, shade] = B.castle;
    const tier = (w, top, hgt) => {
      const l = cx - (w >> 1), rr = l + w - 1;
      for (let y = top; y < top + hgt; y++) for (let x = l; x <= rr; x++) {
        let c = x > rr - Math.max(2, w >> 3) ? shade : body;
        const sx = (x - l) % 4;
        if (y === top || (y === top + 1 && sx !== 3) || (y === top + 2 && sx === 1)) c = B.lace;
        if (y >= top + 4 && y < top + hgt - 1 && (x - l) % 8 === 4 && x < rr - 3) c = y === top + 4 ? body : shade;
        px(x, y, c);
      }
    };
    const spire = (x, base, hgt, cap) => {
      for (let k = 0; k < hgt; k++) {
        const half = Math.floor((k * 3) / hgt);
        for (let dx = -half; dx <= half; dx++) px(x + dx, base - hgt + k, B.spire);
      }
      if (cap) for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) px(x + dx, base - hgt - 2 + dy, B.cherry);
    };
    const t1 = horizon - 13, t2 = t1 - 10, t3 = t2 - 8;
    // Side towers stand behind the lowest tier.
    for (const sx of [cx - 30, cx + 29]) {
      for (let y = t1 - 9; y < t1; y++) for (let x = sx - 2; x <= sx + 2; x++) px(x, y, x === sx + 2 ? shade : y === t1 - 9 ? B.lace : body);
      spire(sx, t1 - 9, 6, false);
    }
    tier(62, t1, 13);
    tier(42, t2, 10);
    tier(24, t3, 8);
    spire(cx, t3, 9, true);
  }
  // A heap of 3-4 cream puffs; the underside is ragged, with one shade row.
  function cloud(px, C, cx, cy, wd, hs) {
    const n = 3 + ((hs >>> 26) & 1), puffs = [];
    for (let i = 0; i < n; i++) {
      const hp = h32(hs, i, 1361), rr = Math.max(3, Math.floor(wd / 4) + (hp % 4) - (i === 0 || i === n - 1 ? 2 : 0));
      puffs.push([cx - (wd >> 1) + Math.floor(((i + 0.5) * wd) / n), cy - (i === 0 || i === n - 1 ? 0 : rr >> 1), rr]);
    }
    const inside = (x, y) => puffs.some(([px0, py0, rr]) => (x - px0) * (x - px0) + (y - py0) * (y - py0) * 2 <= rr * rr) && y <= cy + 2 + (h32(x >> 1, cy, 1363) % 3) - 1;
    for (let y = cy - wd; y <= cy + 4; y++) for (let x = cx - wd; x <= cx + wd; x++) {
      if (!inside(x, y)) continue;
      px(x, y, !inside(x, y + 1) || !inside(x, y + 2) ? C[1] : C[0]);
    }
  }

  T.drawTerrain = drawTerrain;
  T.drawBackground = drawBackground;
  T.candy = { vnoise, cracker, hill, castleX };
})(typeof window !== "undefined" ? window : globalThis);
