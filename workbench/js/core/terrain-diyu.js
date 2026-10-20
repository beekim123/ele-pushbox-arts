/* Terrain and backdrop for the 地府 region (theme.diyu, delivery mode only;
 * docs/design/delivery-diyu.md). The look is 荒郊野岭: the barren hills on the
 * road to the underworld at night - no city, no masonry.
 *
 * Terrain, rock.pattern "wild": natural ground. Dark soil with soft strata and
 * field stones of mixed sizes, a crust of withered grass on open tops whose
 * tufts reach up to 3 px into the empty cell above, roots under the grass and
 * hanging from overhangs, rounded outer corners and a ragged edge on open sides.
 * As in terrain.js, colour depends only on the material, world pixel hashes
 * h32(x, y, seed) and the neighbouring cells (art-direction.md §5), so the
 * result can be cached and a shader can reproduce it. Rule materials (earth,
 * cracked rock, sand, water) come from terrain.js unchanged, block outline
 * included (§8).
 *
 * Backdrop, background.style "diyu": night over Mount Mingshan. A dithered sky
 * with sparse stars and a dim waning moon, a sickly teal glow at the horizon,
 * far peaks fading into it, a darker range of round hills, then barren hills in
 * silhouette with dead trees, grave mounds with wooden markers and a
 * soul-calling banner, two slowly drifting bands of mist and a few flickering
 * will-o'-wisps. Darker than the terrain, nothing shaped like an interactive
 * object (§1, §10). Any width: positions follow x - x0, so a wide room simply
 * continues the landscape.
 *
 * Wraps PB.terrain.drawTerrain / drawBackground and only takes over for pattern
 * "wild" / style "diyu", so terrain.js (the approved themes) stays unchanged.
 * Background "time" is in 1/60 s ticks. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const T = PB.terrain;
  if (!T || T.diyu) return;   // loaded twice: keep the first wrapper
  const h32 = PB.h32, MAT = T.MAT, baseTerrain = T.drawTerrain, baseBackground = T.drawBackground;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

  // Smooth value noise 0..255 on a cw x ch lattice (integer maths only).
  function vnoise(x, y, cw, ch, seed) {
    const gx = Math.floor(x / cw), gy = Math.floor(y / ch), fx = x - gx * cw, fy = y - gy * ch;
    const a = h32(gx, gy, seed) & 255, b = h32(gx + 1, gy, seed) & 255, c = h32(gx, gy + 1, seed) & 255, d = h32(gx + 1, gy + 1, seed) & 255;
    return Math.floor(((a * (cw - fx) + b * fx) * (ch - fy) + (c * (cw - fx) + d * fx) * fy) / (cw * ch));
  }
  // Integer triangle wave in [-amp, amp] (as in ambient.js).
  function tri(t, period, amp) {
    const p = ((t % period) + period) % period, half = period >> 1;
    return Math.round(((p < half ? p : period - p) * 4 * amp) / period - amp);
  }

  // ---------- terrain: rock.pattern "wild" ----------

  function drawTerrain(r, map, theme, ox, oy, time) {
    const P = theme.rock;
    if (!P || P.pattern !== "wild") return baseTerrain(r, map, theme, ox, oy, time);
    // Rule materials from terrain.js, drawn off-screen first so its stand-in for rock never shows.
    const tmp = new PB.Raster(map.w * 16, map.h * 16);
    baseTerrain(tmp, map, theme, 0, 0, time);
    const at = (x, y) => (x < 0 || y < 0 || x >= map.w || y >= map.h ? MAT.ROCK : map.at(x, y));   // beyond the map: more ground
    for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < map.w; tx++) {
      const m = map.at(tx, ty);
      if (m === MAT.ROCK) wildTile(r, P, at, tx, ty, ox, oy);
      else if (m !== MAT.EMPTY) copyTile(r, tmp, tx, ty, ox, oy);
    }
  }
  function copyTile(r, src, tx, ty, ox, oy) {
    for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
      const i = ((ty * 16 + py) * src.w + tx * 16 + px) * 4, d = src.data;
      if (d[i + 3]) r.set(ox + tx * 16 + px, oy + ty * 16 + py, PB.codeOf(d[i], d[i + 1], d[i + 2]));
    }
  }

  const inEllipse = (dx, dy, rx, ry) => dx * dx * ry * ry + dy * dy * rx * rx <= rx * rx * ry * ry;
  // Field stones: about one 8 x 8 world cell in four holds one, a flat ellipse 5-9 px wide.
  function stoneAt(wx, wy) {
    const gx = wx >> 3, gy = wy >> 3;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = gx + i, cy = gy + j, hs = h32(cx, cy, 631);
      if (hs % 100 >= 24) continue;
      const rx = 2 + ((hs >>> 16) % 3), ry = rx > 3 ? 2 : 1 + ((hs >>> 19) & 1);
      const sx = cx * 8 + 2 + ((hs >>> 8) % 4), sy = cy * 8 + 2 + ((hs >>> 12) % 4);
      if (inEllipse(wx - sx, wy - sy, rx, ry)) return { sx, sy, rx, ry };
    }
    return null;
  }
  // Soil: soft sideways strata from value noise in two tones (a little dither at the borders),
  // rare warm clay patches and grit.
  function soil(P, wx, wy) {
    const b = bayer(wx, wy) << 1;
    let c = vnoise(wx, wy, 16, 6, 621) + b > 160 ? P.base[1] : P.base[0];
    if (P.soil && vnoise(wx + 5, wy, 20, 7, 622) + b > 236) c = P.soil;
    if (h32(wx, wy, 623) % 53 === 0) c = P.speck;
    return c;
  }
  // Roots under a grassy top: 0-2 thin wiggly lines per tile.
  const WIGGLE = [0, 0, 1, 1, 1, 0, -1, -1, 0, 0, 1, 0];
  function rootAt(tx, ty, px, py) {
    const hr = h32(tx, ty, 641), n = hr % 3;
    for (let i = 0; i < n; i++) {
      const rx = 2 + ((hr >>> (3 + i * 9)) % 12), len = 3 + ((hr >>> (7 + i * 9)) % 7);
      if (py >= 2 && py - 2 < len && px === rx + WIGGLE[(py - 2 + i * 5) % WIGGLE.length]) return true;
    }
    return false;
  }

  function wildTile(r, P, at, tx, ty, ox, oy) {
    const E = MAT.EMPTY, up = at(tx, ty - 1), down = at(tx, ty + 1), left = at(tx - 1, ty), right = at(tx + 1, ty);
    const openUp = up === E || up === MAT.WATER || up === MAT.SAND, grassy = up === E;
    const oL = left === E, oR = right === E, oD = down === E;
    const G = P.grass || [P.top, P.light, P.dark], S = P.stone || [P.light, P.top, P.light2];
    const x0 = tx * 16, y0 = ty * 16, put = (wx, wy, c) => { if (c) r.set(ox + wx, oy + wy, c); };
    const side = (open, wx, wy) => open && h32(wx, wy >> 1, 671) % 5 === 0;   // a 2 px bite out of an open side
    for (let py = 0; py < 16; py++) {
      const wy = y0 + py, sideRow = py >= (grassy ? 2 : 1) && py <= (oD ? 13 : 15);
      const biteL = sideRow && side(oL, x0, wy), biteR = sideRow && side(oR, x0 + 15, wy);
      for (let px = 0; px < 16; px++) {
        // Rounded outer corners.
        if (oL && ((grassy && px + py < 2) || (oD && px + 15 - py < 2))) continue;
        if (oR && ((grassy && 15 - px + py < 2) || (oD && 30 - px - py < 2))) continue;
        const wx = x0 + px;
        let c = soil(P, wx, wy);
        const s = stoneAt(wx, wy);
        if (s) {
          const ins = (x, y) => inEllipse(x - s.sx, y - s.sy, s.rx, s.ry);
          c = !ins(wx, wy + 1) || (!ins(wx + 1, wy) && wy > s.sy) ? S[2]          // shaded underside
            : s.rx > 2 && !ins(wx, wy - 1) && !ins(wx + 1, wy - 1) ? S[1] : S[0];   // lit top on the bigger stones
        }
        if (grassy && rootAt(tx, ty, px, py)) c = P.root;
        // Top: withered grass crust in the open air, a plain lit rim under water or sand.
        if (openUp) {
          if (!grassy) { if (py === 0) c = P.light; }
          else if (py === 0) c = h32(wx, wy, 651) % 4 === 0 ? G[1] : G[0];
          else if (py === 1) c = h32(wx, wy, 652) % 3 === 0 ? G[0] : G[2];
          else if (py === 2 && h32(wx, wy, 653) % 3 === 0) c = G[2];
        }
        if (oD && (py === 15 || (py === 14 && h32(wx, wy, 661) % 3 === 0))) c = P.dark;
        // Open sides: a dark 1 px edge with bites taken out of it.
        if (px === 0 && sideRow && oL) c = biteL ? null : P.edge;
        else if (px === 15 && sideRow && oR) c = biteR ? null : P.edge;
        else if ((px === 1 && sideRow && oL && (biteL || h32(wx, wy >> 1, 672) % 4 === 0)) || (px === 14 && sideRow && oR && (biteR || h32(wx, wy >> 1, 672) % 4 === 0))) c = P.edge;
        put(wx, wy, c);
      }
    }
    // Grass tufts poking up into the empty cell above (patchy, 1-3 px, tall blades bend at the tip).
    if (grassy) for (let px = oL ? 2 : 0; px < (oR ? 14 : 16); px++) {
      const wx = x0 + px, clump = vnoise(wx, ty, 6, 1, 655);
      if (clump < 100) continue;
      const hb = h32(wx, ty, 656);
      let hgt = clump < 150 ? 1 : 1 + (hb % 3);
      if ((hb >>> 4) % 3 === 0) hgt = Math.max(0, hgt - 2);
      for (let k = 1; k <= hgt; k++) {
        const bend = k === 3 && px > 0 && px < 15 ? ((hb >>> 6) & 1 ? 1 : -1) : 0;
        put(wx + bend, y0 - k, k === hgt ? G[1] : G[0]);
      }
    }
    // Roots hanging from an overhang.
    if (oD) for (let px = oL ? 2 : 0; px < (oR ? 14 : 16); px++) {
      const wx = x0 + px, hr = h32(wx, ty, 662);
      if (hr % 13) continue;
      const len = 1 + ((hr >>> 5) % 4);
      for (let k = 0; k < len; k++) put(wx + (k === 3 && px < 15 ? 1 : 0), y0 + 16 + k, P.root);
    }
  }

  // ---------- backdrop: background.style "diyu" ----------

  // Bare dead tree: a jittered trunk that forks two or three times; every limb is a 1-3 px line.
  function deadTree(px, x, y, c, seed, size) {
    function limb(fx, fy, dx, dy, len, thick, depth, s) {
      for (let i = 0; i < len; i++) {
        const j = h32(s, i, 41) % 5;   // an occasional kink sideways
        fx += dx + (dy < -0.5 ? (j === 0 ? -0.35 : j === 1 ? 0.35 : 0) : 0); fy += dy;
        for (let k = 0; k < thick; k++) px(Math.round(fx) + k, Math.round(fy), c);
        if (thick > 1 && i > len * 0.6) thick--;
      }
      if (depth <= 0) return;
      for (let k = 0, n = 2 + (h32(s, 0, 43) % 2); k < n; k++) {
        const hs = h32(s, k, 47), side = k === 0 ? -1 : k === 1 ? 1 : hs & 1 ? 1 : -1;
        let ndx = dx + side * (0.35 + (hs % 40) / 100), ndy = dy + 0.15 + ((hs >>> 8) % 20) / 100;
        const m = Math.hypot(ndx, ndy);
        limb(Math.round(fx), Math.round(fy), ndx / m, ndy / m, Math.max(2, Math.round(len * (0.55 + ((hs >>> 12) % 25) / 100))), Math.max(1, thick - 1), depth - 1, hs);
      }
    }
    limb(x, y, ((seed >>> 4) % 3 - 1) * 0.12, -1, size, 3, 3, seed);
  }
  // A crow in silhouette, facing left, feet on (x, y).
  const CROW = [".##...", "####..", ".#####", "..#..."];

  function drawBackground(r, theme, x0, y0, w, h, time) {
    const B = theme.background;
    if (!B || B.style !== "diyu") return baseBackground(r, theme, x0, y0, w, h, time);
    const x1 = x0 + w, y1 = y0 + h, t = time | 0;
    const C = {
      sky: B.base[0], sky2: B.base[1], glow: B.accent, star: B.speck, near: B.detail,
      far: B.far || B.accent, mid: B.mid || B.base[1], mist: B.mist || B.accent,
      moon: B.moon || [B.speck, B.speck], wisp: B.wisp || [B.accent, B.accent], banner: B.banner || B.speck,
    };
    const px = (x, y, c) => { if (x >= x0 && y >= y0 && x < x1 && y < y1) r.set(x, y, c); };
    const horizon = y0 + Math.round(h * 0.58), span = Math.max(1, horizon - y0);
    // Sky: dark at the top, a little lighter lower down, the teal glow just above the horizon; sparse stars.
    for (let y = y0; y < y1; y++) {
      const level = Math.floor(((y - y0) * 32) / span);
      for (let x = x0; x < x1; x++) {
        const b = bayer(x, y);
        let c = level < 6 ? C.sky : level < 22 ? (b < level - 6 ? C.sky2 : C.sky) : level < 25 ? C.sky2 : level < 32 ? (b < (level - 24) * 2 ? C.glow : C.sky2) : C.glow;
        if (level < 20) {
          const hs = h32(x, y, 701);
          if (hs % 263 === 0 && !((hs >>> 9) % 4 === 0 && ((t >> 5) + (hs >>> 12)) % 6 === 0)) c = C.star;
        }
        px(x, y, c);
      }
    }
    // A dim waning moon, one per 320 px.
    for (let mx = x0 + 248; mx < x1 + 8; mx += 320) moon(px, C, mx, y0 + Math.round(h * 0.17));
    // Ranges: far peaks fading into the glow, round hills in front, then the near barren hills.
    const near = new Array(w);
    for (let x = x0; x < x1; x++) {
      const xw = x - x0;
      const far = horizon - peaks(xw, 811, 72, 14, 20), mid = horizon + 6 - Math.floor((vnoise(xw, 0, 44, 1, 815) * 12) / 255) - (h32(xw >> 1, 0, 816) & 1);
      const nr = horizon + 22 - Math.floor((vnoise(xw, 0, 70, 1, 817) * 14) / 255) - Math.floor((vnoise(xw, 0, 15, 1, 818) * 3) / 255);
      near[xw] = nr;
      for (let y = far; y < mid; y++) px(x, y, C.far);
      for (let y = mid; y < nr; y++) px(x, y, C.mid);
      for (let y = nr; y < y1; y++) px(x, y, C.near);
    }
    const groundAt = (x) => near[Math.max(0, Math.min(w - 1, x - x0))];
    mist(px, C, x0, x1, () => horizon + 3, 4, t >> 5, 821);
    // Silhouettes on the near hills, one group per 160 px: a dead tree (two now and then), a cluster of
    // graves, sometimes a soul-calling banner with a crow on it, and will-o'-wisps over the graves.
    for (let k = Math.floor(-60 / 160); x0 + k * 160 < x1 + 60; k++) {
      const g = h32(k, 0, 831), base = x0 + k * 160;
      for (let i = 0, n = (g >>> 28) % 3 === 0 ? 2 : 1; i < n; i++) {
        const tx = base + 8 + (g % 44) + i * 30, size = i ? 8 + ((g >>> 26) % 4) : 12 + ((g >>> 8) % 8);
        deadTree(px, tx, groundAt(tx) + 1, C.near, h32(k, i, 835), size);
      }
      const gx = base + 84 + ((g >>> 12) % 30);
      for (let i = 0, n = 1 + ((g >>> 16) % 3); i < n; i++) grave(px, C, gx + i * 15, groundAt, h32(k, i, 833));
      if ((g >>> 20) % 3 === 0) banner(px, C, base + 144 + ((g >>> 22) % 10), groundAt, t, (g >>> 24) & 1);
      for (let i = 0; i < 2; i++) {
        const wx = gx + 4 + i * 24;
        wisp(px, C, wx + tri(t + i * 211 + k * 97, 620, 4), groundAt(wx) - 9 - ((g >>> (24 + i * 3)) % 6) + tri(t + i * 137, 170, 2), t + i * 53 + k * 31);
      }
    }
    // Ground fog along the near hill line.
    mist(px, C, x0, x1, (x) => groundAt(x) + 3, 6, -(t >> 6), 823);
  }
  // Height above the base line of a range of peaks (one peak per `span` px, 2-4 px rise per 3 px).
  function peaks(xw, seed, span, hmin, hvar) {
    let best = 0;
    for (let k = Math.floor(xw / span) - 2, k1 = k + 4; k <= k1; k++) {
      const hs = h32(k, 0, seed), at = k * span + (hs % span), top = hmin + ((hs >>> 8) % hvar);
      const d = Math.abs(xw - at), v = top - Math.floor((d * (2 + ((hs >>> 16) % 3))) / 3) - (d < 2 ? 0 : 1);
      if (v > best) best = v;
    }
    return best + (h32(xw >> 1, 0, seed + 1) & 1);
  }
  function moon(px, C, cx, cy) {
    const R = 6;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const d = dx * dx + dy * dy;
      if (d > R * R + 2 || (dx - 4) * (dx - 4) + (dy + 2) * (dy + 2) <= R * R) continue;   // crescent: a disc minus a shifted disc
      px(cx + dx, cy + dy, d > (R - 1) * (R - 1) && dx < 0 ? C.moon[1] : C.moon[0]);
    }
  }
  // A band of mist around the line yc(x): Bayer-dithered, densest in the middle and where the noise is high;
  // drifts sideways with `shift`.
  function mist(px, C, x0, x1, yc, half, shift, seed) {
    for (let x = x0; x < x1; x++) {
      const dens = vnoise(x - x0 - shift, 0, 30, 1, seed) - 60, y = yc(x);
      if (dens <= 0) continue;
      for (let dy = -half; dy <= half; dy++) if (bayer(x, y + dy) < (dens >> 4) + 4 - Math.abs(dy) * 2) px(x, y + dy, C.mist);
    }
  }
  // Grave mound (half ellipse) with a leaning wooden marker or a small round-topped stone.
  function grave(px, C, cx, groundAt, g) {
    const rw = 4 + (g % 3), rh = 4 + ((g >>> 3) & 1), y = groundAt(cx) + 1;
    for (let dx = -rw; dx <= rw; dx++) {
      const top = Math.round(rh * Math.sqrt(1 - (dx * dx) / ((rw + 0.5) * (rw + 0.5))));
      for (let k = 0; k <= top; k++) px(cx + dx, y - k, C.near);
    }
    const mx = cx + (g & 64 ? rw - 1 : 1 - rw), lean = (g >>> 7) % 3 - 1;
    if ((g >>> 9) & 1) for (let k = 0; k < 7; k++) px(mx + (k > 4 ? lean : 0), y - rh - k, C.near);   // wooden marker
    else { for (let k = 0; k < 4; k++) for (let i = -1; i <= 1; i++) if (!(k === 3 && i !== 0)) px(mx + i, y - rh - k, C.near); }
  }
  // Soul-calling banner: a pole with a crossbar and a long strip that flutters slowly; maybe a crow on the bar.
  function banner(px, C, x, groundAt, t, crow) {
    const y = groundAt(x) + 1, top = y - 26;
    for (let k = top; k <= y; k++) px(x, k, C.near);
    for (let i = -1; i <= 4; i++) px(x + i, top + 1, C.near);
    if (crow) for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) if (CROW[j][i] === "#") px(x - 2 + i, top - 3 + j, C.near);
    for (let j = 0; j < 11; j++) {
      const sway = j < 2 ? 0 : tri((t >> 3) + j * 3, 24, Math.min(2, j >> 2));
      px(x + 3 + sway, top + 2 + j, C.banner); if (j < 9) px(x + 4 + sway, top + 2 + j, C.banner);
    }
  }
  // Will-o'-wisp: a small flame of ghost light, flickering out now and then.
  function wisp(px, C, x, y, t) {
    if (((t >> 3) % 23) === 0) return;
    px(x, y, C.wisp[0]); px(x - 1, y, C.wisp[1]); px(x + 1, y, C.wisp[1]); px(x, y - 1, C.wisp[1]);
    px(x, y + 1, C.wisp[1]); if ((t >> 4) & 1) px(x, y - 2, C.wisp[1]);
  }

  T.drawTerrain = drawTerrain;
  T.drawBackground = drawBackground;
  T.diyu = { vnoise, stoneAt, wildTile, peaks, deadTree };
})(typeof window !== "undefined" ? window : globalThis);
