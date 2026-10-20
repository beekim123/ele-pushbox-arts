/* Terrain and backdrop for the 极地雪村 region (theme.polar, delivery mode only;
 * docs/design/delivery-polar.md §1). The look is a bright winter day: snow-capped
 * dark blue-grey granite, spruce thickets, frozen rubble, snowy timber decks.
 *
 * Terrain, rock.pattern "polar": rock is drawn by zone, from the material, world
 * pixel hashes h32(x, y, seed), the neighbouring cells and the row's distance
 * from the bottom of the map (bands of 10 rows = one row of screens), never from
 * the room id, so the result can be cached and a shader can reproduce it
 * (art-direction.md §5; delivery-puzzle-rules.md §8.3):
 * - plain rock: dark blue-grey granite (x) with big lit facets (w) and fine
 *   cracks (y); no cyan s and no diagonal glints, both belong to rule ice;
 * - open tops: snow (t) over a u shadow line with a wavy lower edge. In the
 *   upper half of a screen it is 3-4 px deep with a 1 px eave over open sides;
 *   in the lower half it is 2 px of packed snow with a few dark pebbles. Snow is
 *   only how a rock top is drawn: never a cell of its own;
 * - the leftmost and rightmost column: a dense spruce thicket (o / p needles,
 *   t snow clumps, f trunks at its foot), the edge of a forest clearing;
 * - the bottom row: frozen ground and rubble (x stones on y, u frost);
 * - a one-cell-thick strip, open above and below, in the lower half of a screen:
 *   a snowy timber deck (e / f planks under snow, short posts), no frame and no
 *   braces, so it reads as neither a crate nor a bridge.
 * Rule materials (earth, cracked rock, sand, water) come from terrain.js
 * unchanged, block outline included (art-direction.md §8); ice is matter.js.
 *
 * Backdrop, background.style "polar": a clear winter day. Sky dithered from r at
 * the top to pale u at the horizon, a few flat drifting clouds with ragged
 * undersides (never a ledge), a continuous range of snow mountains (t lit, u / v
 * shaded, w foot) with a glacier in a valley, then a dark spruce forest (o far,
 * p near, u snow on the tips) and x / y shade under the trees, darker than the
 * terrain's mid tones. No frozen sea and no water. Any width: positions follow
 * x - x0. Optional background.time "dusk": the sky turns deep blue (y -> x), two
 * or three auroras (m / n, a little C) drift slowly at 4 fps and the mountains
 * take a v tint; terrain is unchanged.
 *
 * Wraps PB.terrain.drawTerrain / drawBackground and only takes over for pattern
 * "polar" / style "polar", so terrain.js, terrain-diyu.js and terrain-jeju.js
 * stay unchanged. Background "time" is in 1/60 s ticks. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const T = PB.terrain;
  if (!T || T.polar) return;   // loaded twice: keep the first wrapper
  const h32 = PB.h32, MAT = T.MAT, baseTerrain = T.drawTerrain, baseBackground = T.drawBackground;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

  // Smooth value noise 0..255 on a cw x ch lattice (integer maths only).
  function vnoise(x, y, cw, ch, seed) {
    const gx = Math.floor(x / cw), gy = Math.floor(y / ch), fx = x - gx * cw, fy = y - gy * ch;
    const a = h32(gx, gy, seed) & 255, b = h32(gx + 1, gy, seed) & 255, c = h32(gx, gy + 1, seed) & 255, d = h32(gx + 1, gy + 1, seed) & 255;
    return Math.floor(((a * (cw - fx) + b * fx) * (ch - fy) + (c * (cw - fx) + d * fx) * fy) / (cw * ch));
  }

  // ---------- terrain: rock.pattern "polar" ----------

  function drawTerrain(r, map, theme, ox, oy, time) {
    const P = theme.rock;
    if (!P || P.pattern !== "polar") return baseTerrain(r, map, theme, ox, oy, time);
    // Rule materials from terrain.js, drawn off-screen first so its stand-in for rock never shows.
    const tmp = new PB.Raster(map.w * 16, map.h * 16);
    baseTerrain(tmp, map, theme, 0, 0, time);
    const at = (x, y) => (x < 0 || y < 0 || x >= map.w || y >= map.h ? MAT.ROCK : map.at(x, y));   // beyond the map: more rock
    for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < map.w; tx++) {
      const m = map.at(tx, ty);
      if (m === MAT.ROCK) polarTile(r, P, map, at, tx, ty, ox, oy);
      else if (m !== MAT.EMPTY) copyTile(r, tmp, tx, ty, ox, oy);
    }
  }
  function copyTile(r, src, tx, ty, ox, oy) {
    for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
      const i = ((ty * 16 + py) * src.w + tx * 16 + px) * 4, d = src.data;
      if (d[i + 3]) r.set(ox + tx * 16 + px, oy + ty * 16 + py, PB.codeOf(d[i], d[i + 1], d[i + 2]));
    }
  }

  // Granite: big angular facets. Voronoi cells around jittered centres on a 14 x 10 lattice;
  // about two cells in five have a lit face (w) cut by a straight line across their upper
  // left part; one border in three is a fine crack (y). A few single-pixel specks.
  const FACE = [[1, 1], [2, 1], [1, 2], [1, 0], [0, 1], [3, 2]];
  function granite(P, wx, wy) {
    const gx = Math.floor(wx / 14), gy = Math.floor(wy / 10);
    let d1 = 1e9, d2 = 1e9, h1 = 0, h2 = 0, cx = 0, cy = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const hx = gx + i, hy = gy + j, hs = h32(hx, hy, 1101);
      const sx = hx * 14 + 2 + (hs % 10), sy = hy * 10 + 2 + ((hs >>> 8) % 6);
      const d = (wx - sx) * (wx - sx) + (wy - sy) * (wy - sy) * 2;
      if (d < d1) { d2 = d1; h2 = h1; d1 = d; h1 = hs; cx = sx; cy = sy; }
      else if (d < d2) { d2 = d; h2 = hs; }
    }
    if (Math.sqrt(d2) - Math.sqrt(d1) < 1.1 && ((h1 ^ h2) >>> 5) % 3 === 0) return P.crack;
    let c = P.base[0];
    if (h1 % 5 < 2) {
      const f = FACE[(h1 >>> 12) % FACE.length], k = ((h1 >>> 16) % 5) - 2;
      if (f[0] * (wx - cx) + f[1] * (wy - cy) < k * (f[0] + f[1])) c = P.base[1];
    }
    if (h32(wx, wy, 1103) % 53 === 0) c = c === P.base[0] ? P.speck : P.base[0];
    return c;
  }

  // Frozen ground: rounded stones (x, lit rim w on their upper left) on dark frozen soil (y),
  // with frost dots (u). Stones sit around jittered centres on a 6 x 5 lattice.
  function rubble(P, wx, wy) {
    const R = P.rubble;   // [soil, stone, lit rim, frost]
    const gx = Math.floor(wx / 6), gy = Math.floor(wy / 5);
    let best = 1e9, bx = 0, by = 0, bh = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const hx = gx + i, hy = gy + j, hs = h32(hx, hy, 1121);
      const sx = hx * 6 + 1 + (hs % 4), sy = hy * 5 + 1 + ((hs >>> 8) % 3), rr = 3 + ((hs >>> 12) % 5);
      const d = (wx - sx) * (wx - sx) + (wy - sy) * (wy - sy) * 2;
      if (d <= rr && d < best) { best = d; bx = sx; by = sy; bh = hs; }
    }
    if (best === 1e9) return h32(wx, wy, 1123) % 23 === 0 ? R[3] : R[0];
    const dx = wx - bx, dy = wy - by;
    if (dy < 0 && (bh >>> 20) % 4 === 0 && h32(wx, wy, 1125) % 3 === 0) return R[3];   // frost on a stone top
    return dx + dy * 2 < -1 ? R[2] : R[1];
  }

  function polarTile(r, P, map, at, tx, ty, ox, oy) {
    const E = MAT.EMPTY, up = at(tx, ty - 1), down = at(tx, ty + 1), left = at(tx - 1, ty), right = at(tx + 1, ty);
    const oU = up === E, oD = down === E, oL = left === E, oR = right === E;
    const lower = (map.h - 1 - ty) % 10 < 5, bottom = ty === map.h - 1, side = tx === 0 || tx === map.w - 1;
    const x0 = tx * 16, y0 = ty * 16, put = (wx, wy, c) => { if (c) r.set(ox + wx, oy + wy, c); };
    if (!bottom && side) {
      // Foot of the thicket: the cell below is the bottom row or a rule material (not open air).
      const foot = !oD && !(down === MAT.ROCK && ty + 1 < map.h - 1);
      return thicketTile(P, put, x0, y0, oU, oD, oL, oR, foot);
    }
    if (!bottom && lower && oU && oD) return deckTile(P, put, x0, y0, oL, oR);
    const covered = up === MAT.WATER || up === MAT.SAND;
    // The ground under the thicket keeps its snow, so the trunks stand in it.
    const snowy = oU || (bottom && side && up === MAT.ROCK);
    const deep = snowy && !lower && !bottom, S = P.snow, K = P.pebble;
    for (let py = 0; py < 16; py++) {
      const wy = y0 + py;
      for (let px = 0; px < 16; px++) {
        // Rounded outer corners (a deep snow cap only loses its very corner pixel).
        if (oL && ((oU && (deep ? px + py < 1 : px + py < 2)) || (oD && px + 15 - py < 2))) continue;
        if (oR && ((oU && (deep ? 15 - px + py < 1 : 15 - px + py < 2)) || (oD && 30 - px - py < 2))) continue;
        const wx = x0 + px, hh = h32(wx, wy, 1111);
        let c = bottom ? rubble(P, wx, wy) : granite(P, wx, wy), snow = false;
        if ((px === 0 && oL) || (px === 15 && oR)) c = px === 0 ? P.rim : P.edge;   // lit left side, shaded right side
        if (snowy && deep) {
          // Deep snow: 3-4 px, a wavy u shadow line at its lower edge, 1 px deeper at open sides.
          const dep = 3 + (vnoise(wx, ty, 7, 1, 1141) > 150 ? 1 : 0) + ((oL && px === 0) || (oR && px === 15) ? 1 : 0);
          if (py < dep) { c = py === dep - 1 ? S[1] : S[0]; snow = true; }
        } else if (snowy) {
          // Packed snow: 2 px, a few dark pebbles showing through, a frosty row under it.
          if (py === 0) { c = hh % 19 === 0 ? K[0] : S[0]; snow = true; }
          else if (py === 1) { c = hh % 13 === 0 ? K[1] : hh % 4 === 0 ? S[0] : S[1]; snow = true; }
          else if (py === 2 && bayer(wx, wy) < 3) c = S[1];
        } else if (covered && py === 0) c = P.light;
        if (!snow && oD && (py === 15 || (py === 14 && hh % 3 === 0))) c = P.dark;
        put(wx, wy, c);
      }
    }
    // Snow eave: the deep cap curls 1 px over an open side.
    if (deep && oL) { put(x0 - 1, y0 + 1, S[0]); put(x0 - 1, y0 + 2, S[1]); }
    if (deep && oR) { put(x0 + 16, y0 + 1, S[0]); put(x0 + 16, y0 + 2, S[1]); }
  }

  // Spruce thicket: trees on a jittered 8 px lattice, each a stack of 7 px tiers widening to
  // 9 px; the frontmost tree wins. Snow lies along the lit left slope of a tier and on its
  // bough tips (u in the shade), bough undersides, the shaded side and the gaps are p. At an
  // open top each tree starts with its first whole tier, so the tips stand against the sky; at
  // open sides and an open bottom only boughs reach the last 2 px; at the foot the trunks show.
  const TIER = 7, HW = [0, 1, 1, 2, 3, 3, 4], LAT = 8;
  function spruceAt(wx, wy) {
    const k0 = Math.floor(wx / LAT);
    let best = null, bz = -1;
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      const hk = h32(k, 0, 1151), cx = k * LAT + (hk % 3), ph = (hk >>> 4) % TIER, z = (hk >>> 8) % 3;
      const dy = (((wy + ph) % TIER) + TIER) % TIER, dx = wx - cx;
      if (Math.abs(dx) > HW[dy] || z <= bz) continue;
      best = { dx, dy, hk, tier: Math.floor((wy + ph) / TIER), top: wy - dy }; bz = z;
    }
    return best;
  }
  function trunkAt(wx) {   // 0 none, 1 trunk, 2 trunk shade
    const k0 = Math.floor(wx / LAT);
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      const cx = k * LAT + (h32(k, 0, 1151) % 3);
      if (wx === cx) return 1;
      if (wx === cx + 1) return 2;
    }
    return 0;
  }
  function thicketTile(P, put, x0, y0, oU, oD, oL, oR, foot) {
    const G = P.spruce;   // [needles, shade, snow, snow in shade, trunk, trunk shade]
    for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
      const wx = x0 + px, wy = y0 + py;
      const edge = (oL && px < 2) || (oR && px > 13) || (oD && py > 13) || (oU && py < 6);
      let c = null;
      if (foot && py >= 12) {
        const k = trunkAt(wx);
        c = k && py > 12 ? G[3 + k] : edge ? null : G[1];
      } else {
        let s = spruceAt(wx, wy);
        if (s && oU && s.top < y0) s = null;
        if (s) {
          const { dx, dy, hk, tier } = s, hw = HW[dy], snowy = h32(hk, tier, 1153) % 5 < 3;
          if (dy === 0) c = snowy ? G[2] : G[0];
          else if (dx === -hw) c = snowy && dy >= TIER - 3 ? G[2] : G[0];      // snow clump on the lit bough tip
          else if (dx === hw && dy >= TIER - 2) c = snowy ? G[3] : G[1];       // bough tip in the shade
          else if (dy === TIER - 1) c = G[1];                                  // underside
          else c = dx * 2 > hw || (dx * 2 === hw && bayer(wx, wy) < 8) ? G[1] : G[0];
        } else c = edge ? null : G[1];
      }
      put(wx, wy, c);
    }
  }

  // Snowy timber deck: a layer of snow on planks (grain, butt joints, nail heads), a shadow
  // line, then short posts. Nothing else, so it reads as neither a crate nor a bridge.
  function deckTile(P, put, x0, y0, oL, oR) {
    const D = P.deck, S = P.snow;   // D: [plank, grain / joint, nail / underside, post, post shade]
    for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
      const wx = x0 + px, wy = y0 + py;
      if ((oL && px === 0 && (py === 0 || py === 8)) || (oR && px === 15 && (py === 0 || py === 8))) continue;
      const off = h32(wx >> 5, 0, 1161) % 9, joint = ((wx + off) % 32) === 0;
      const dep = 2 + (vnoise(wx, y0, 5, 1, 1163) > 170 ? 1 : 0);
      let c = null;
      if (py < dep) c = py === dep - 1 ? S[1] : S[0];
      else if (py <= 7) {
        c = joint || py === 5 || (py === 3 && h32(wx >> 3, wy, 1165) % 4 === 0) ? D[1] : D[0];
        if ((py === 4 || py === 7) && ((wx + off) % 32) === 2) c = D[2];
      } else if (py === 8) c = D[2];
      else {
        const p = (wx + 9) % 32;
        if (p === 0 || p === 1) c = p === 0 ? D[3] : D[4];
      }
      put(wx, wy, c);
    }
  }

  // ---------- backdrop: background.style "polar" ----------

  function drawBackground(r, theme, x0, y0, w, h, time) {
    const B = theme.background;
    if (!B || B.style !== "polar") return baseBackground(r, theme, x0, y0, w, h, time);
    const x1 = x0 + w, y1 = y0 + h, t = time | 0, dusk = B.time === "dusk", D = B.dusk || {};
    const sky = dusk ? D.sky || ["y", "x"] : B.base;
    const C = {
      sky: sky[0], sky2: sky[1], cloud: B.cloud || ["t", "u"], peak: B.peak || ["t", "u", "v", "w"],
      glacier: B.glacier || ["u", "t", "v"], forest: B.forest || ["o", "p", "u"], floor: B.floor || ["y", "x"],
      aurora: D.aurora || ["m", "n", "C"], tint: dusk ? D.tint || "v" : null,
    };
    const px = (x, y, c) => { if (x >= x0 && y >= y0 && x < x1 && y < y1) r.set(x, y, c); };
    const horizon = y0 + Math.round(h * 0.56), span = Math.max(1, horizon - y0);
    // Sky: r at the top, dithered into pale u towards the horizon (dusk: deep y into x).
    for (let y = y0; y < horizon && y < y1; y++) {
      const level = Math.floor(((y - y0) * 32) / span);
      for (let x = x0; x < x1; x++) px(x, y, level < 17 || (level < 28 && bayer(x, y) >= ((level - 17) * 16) / 11) ? C.sky : C.sky2);
    }
    if (dusk) aurora(px, C, x0, y0, x1, horizon, t);
    else {
      // Flat clouds drift left by one pixel every 128 ticks.
      const drift = t >> 7;
      for (let k = Math.floor(drift / 128) - 1; (k - 1) * 128 - drift < w + 60; k++) {
        const hs = h32(k, 0, 1201);
        if (hs % 3 === 0) continue;
        const cx = x0 + k * 128 + ((hs >>> 4) % 90) - drift, cy = y0 + 12 + ((hs >>> 12) % Math.max(1, Math.floor(span * 0.4)));
        flatCloud(px, C, cx, cy, 30 + ((hs >>> 20) % 30), hs);
      }
    }
    // Snow range: snow above a ragged snow line (t on faces lit from the upper left, u / v on
    // shaded faces, rock showing through along diagonal strata), w rock at the foot; one glacier
    // per 230 px flows down a big peak's flank to the horizon.
    const P = C.peak, Gc = C.glacier, tint = C.tint, glaciers = [];
    for (let g = -1; g * 230 < w + 230; g++) glaciers.push(glacierOf(g));
    for (let x = x0; x < x1; x++) {
      const xw = x - x0, rg = range(xw), hm = rg[0], pc = rg[1], top = rg[2];
      const sl = Math.max(3, Math.floor(hm * 0.42)) + ((vnoise(xw, 0, 3, 1, 1219) * 4) >> 8) - 1;
      for (let k = 1; k <= hm; k++) {
        const y = horizon - k, b = bayer(x, y);
        // The ridge line leaves the summit slanting and wobbling, so the faces are not pyramids.
        const ridge = pc + Math.floor(((top - k) * rg[3]) / 8) + ((vnoise(k, pc, 4, 1, 1227) * 3) >> 8) - 1, lit = xw <= ridge;
        let c;
        if (k >= sl) {
          c = lit ? P[0] : P[1];
          if (!lit && k < sl + 4 && b < 6) c = P[2];
          if (lit && k < sl + 2 && b < 4) c = P[1];
          if (vnoise(xw + k, k, 6, 2, 1221) > 205) c = lit ? P[2] : P[3];
          if (tint) c = c === P[0] ? (b < 6 ? tint : P[1]) : c === P[1] ? tint : c;
        } else c = k === sl - 1 && b < 8 ? (lit ? P[1] : P[2]) : P[3];
        px(x, y, c);
      }
      for (const gl of glaciers) {
        for (let k = 1; k <= gl.top && k <= hm; k++) {
          const e = gl.top - k, hw = 1 + (e >> 1), xc = gl.x + Math.floor(e / 3) + ((vnoise(k, gl.g, 4, 1, 1223) * 3) >> 8) - 1, dx = xw - xc;
          if (dx < -hw || dx > hw) continue;
          let c = dx === -hw ? Gc[1] : dx === hw ? Gc[2] : Gc[0];
          if (e % 3 === 1 && dx > -hw && dx < hw && h32(xw, k, 1225) % 3 !== 0) c = Gc[2];   // crevasses
          if (tint) c = c === Gc[0] ? tint : c === Gc[1] ? Gc[0] : c;
          px(x, horizon - k, c);
        }
      }
    }
    // Spruce forest below the horizon: a far row (o) whose tips poke just above the horizon, a
    // near row (p) lower down, a few u snow dots on the tips; then x / y shade to the bottom.
    const F = C.forest, Fl = C.floor;
    for (let x = x0; x < x1; x++) {
      const xw = x - x0;
      for (let y = Math.max(y0, horizon - 4); y < y1; y++) {
        const d = y - horizon;
        let c = null;
        const far = treeAt(xw, d, 5, -4, 4, 4, 1231, false);
        if (far || d >= 0) c = far === 2 ? F[2] : F[0];
        const near = treeAt(xw, d, 7, 5, 6, 3, 1233, true);
        if (near || d >= 15) c = near === 2 ? F[2] : F[1];
        if (d >= 22) {
          c = d < 26 && bayer(x, y) >= (d - 22) * 4 ? F[1] : Fl[0];
          if (c === Fl[0] && vnoise(xw, d, 9, 4, 1235) > 200 && bayer(x, y) < 4) c = Fl[1];
        }
        if (c) px(x, y, c);
      }
    }
  }
  // Ridge at column xw: [height above the horizon, x and height of the peak that wins, slant of
  // its ridge line]. Big peaks on a jittered 58 px lattice, small ones on 26 px, over a low
  // continuous ridge, so the range never breaks.
  const PEAKS = [[58, 16, 22, 1213], [26, 7, 9, 1214]];
  function range(xw) {
    let best = 5 + (vnoise(xw, 0, 40, 1, 1211) >> 6) + (h32(xw >> 1, 0, 1215) & 1), cx = xw, top = best, sk = 0;
    for (const [L, H0, HN, seed] of PEAKS) {
      const k = Math.floor(xw / L);
      for (let i = k - 2; i <= k + 2; i++) {
        const hs = h32(i, 0, seed), pc = i * L + (hs % (L - 10)), H = H0 + ((hs >>> 8) % HN), s = 5 + ((hs >>> 20) & 3);
        const v = H - Math.floor((Math.abs(xw - pc) * s) / 6) + (vnoise(xw, i, 5, 1, 1217) >> 7);
        if (v > best) { best = v; cx = pc; top = H; sk = ((hs >>> 24) % 7) - 3; }
      }
    }
    return [best, cx, top, sk];
  }
  // One glacier per 230 px: it leaves the flank of the big peak nearest the middle of the stretch
  // at two thirds of its height and flows down and away from the summit, widening.
  function glacierOf(g) {
    const [L, H0, HN, seed] = PEAKS[0], i = Math.round((g * 230 + 115 - L / 2) / L);
    const hs = h32(i, 0, seed), pc = i * L + (hs % (L - 10)), H = H0 + ((hs >>> 8) % HN);
    return { g, x: pc + (H >> 2), top: Math.floor((H * 2) / 3) };
  }
  // Silhouette spruces in a row: 0 none, 1 body, 2 snow. Trees every `gap` px, tips `tip0`
  // .. tip0 + tipN - 1 rows below the horizon, widening by 2 px every `den` rows; snow on some
  // tips and, if `boughs`, on a few bough ends.
  function treeAt(xw, d, gap, tip0, tipN, den, seed, boughs) {
    const k0 = Math.floor(xw / gap);
    let out = 0;
    for (let k = k0 - 2; k <= k0 + 2; k++) {
      const hs = h32(k, 0, seed), cx = k * gap + (hs % 3), tip = tip0 + ((hs >>> 4) % tipN), e = d - tip;
      if (e < 0) continue;
      const hw = Math.floor((e * 2) / den) - (e % 3 === 0 && e > 0 ? 1 : 0), dx = Math.abs(xw - cx);
      if (dx > hw) continue;
      if ((e === 0 && (hs >>> 9) % 3 === 0) || (boughs && e % 3 === 2 && dx === hw && h32(xw, d, seed + 1) % 6 === 0)) return 2;
      out = 1;
    }
    return out;
  }
  // A flat bank of 3-5 low puffs; ragged underside with one shade row (never a ledge).
  function flatCloud(px, C, cx, cy, wd, hs) {
    const n = 3 + ((hs >>> 26) % 3), puffs = [];
    for (let i = 0; i < n; i++) {
      const hp = h32(hs, i, 1203), rr = Math.max(3, Math.floor(wd / 5) + (hp % 3) - (i === 0 || i === n - 1 ? 1 : 0));
      puffs.push([cx - (wd >> 1) + Math.floor(((i + 0.5) * wd) / n), cy - (i === 0 || i === n - 1 ? 0 : rr >> 2), rr]);
    }
    const inside = (x, y) => puffs.some(([qx, qy, rr]) => (x - qx) * (x - qx) + (y - qy) * (y - qy) * 5 <= rr * rr) && y <= cy + (h32(x >> 1, cy, 1205) % 3);
    for (let y = cy - wd; y <= cy + 3; y++) for (let x = cx - wd; x <= cx + wd; x++) {
      if (!inside(x, y)) continue;
      px(x, y, !inside(x, y + 1) ? C.cloud[1] : C.cloud[0]);
    }
  }
  // Dusk: two or three aurora curtains drifting slowly (4 fps). Each is a band of soft vertical
  // rays over a wavy lower edge: n dithered thinner towards the top, m at the base of the
  // brightest rays, a few C pixels at the top fringe; gaps between the curtains.
  function aurora(px, C, x0, y0, x1, horizon, t) {
    const f = Math.floor(t / 15), A = C.aurora, span = horizon - y0;
    for (let b = 0; b < 3; b++) {
      const hb = h32(b, 0, 1241);
      if (b === 2 && hb % 2) continue;
      const base = y0 + Math.floor((span * (42 + b * 16)) / 100) + (hb % 6), dir = b & 1 ? -1 : 1, shift = dir * (f >> 1);
      for (let x = x0; x < x1; x++) {
        const xw = x - x0 + shift + b * 97, env = vnoise(xw, b, 70, 1, 1247);
        if (env < 90) continue;
        const ray = vnoise(xw * 3 + dir * f, b, 7, 1, 1245);
        const yc = base + Math.floor((vnoise(xw, b, 50, 1, 1243) - 128) / 9);
        const hgt = 10 + Math.floor(((env - 90) * (12 + (ray >> 4))) / 165), dens0 = 2 + Math.floor((ray * 11) / 255);
        for (let k = 0; k < hgt; k++) {
          const y = yc - k, bb = bayer(x, y), dens = Math.floor((dens0 * (hgt - k)) / hgt);
          let c = null;
          if (k === 0) c = ray > 170 ? A[0] : bb < dens0 ? A[1] : null;
          else if (k >= hgt - 3 && bb < 2) c = A[2];
          else if (bb < dens) c = k < 3 && ray > 200 ? A[0] : A[1];
          if (c) px(x, y, c);
        }
      }
    }
  }

  T.drawTerrain = drawTerrain;
  T.drawBackground = drawBackground;
  T.polar = { vnoise, granite, rubble, spruceAt, polarTile, range, glacierOf };
})(typeof window !== "undefined" ? window : globalThis);
