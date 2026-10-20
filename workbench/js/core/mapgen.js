/* Delivery-mode map generator (docs/design/delivery-maps.md §3).
 *
 * Same seed + same slice + same templates = same map, in the workbench, in the
 * Node tools and in the game. Everything is integer arithmetic on a 32-bit
 * xorshift generator, and the order in which random numbers are drawn is part
 * of the specification: a port must draw them in exactly this order (compare
 * against content/export/delivery-golden.json).
 *
 * Steps: 1) direction (down / up); 2) a snake path through the room grid
 * (Spelunky-style: run sideways along a row, drop to the next row, end on the
 * last row); 3) roles along the path (gate, station, home, rooms); 4) pick a
 * template, a mirror flag and the exit slots for every path room so that
 * neighbouring exits match (depth-first with backtracking). Rooms off the path
 * are sealed. Shared by the workbench (browser, classic script) and Node tools.
 */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const R = () => PB.rooms;

  // ---------- random numbers ----------
  // xorshift32 (Marsaglia). State is an unsigned 32-bit integer, never 0.
  function makeRng(seed) {
    let x = ((seed | 0) ^ 0x9e3779b9) >>> 0;
    if (x === 0) x = 1;
    const next = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x; };
    for (let i = 0; i < 4; i++) next();   // warm up: nearby seeds diverge quickly
    const int = (n) => next() % n;       // 0 .. n-1 (n is small: modulo bias is irrelevant here)
    return { next, int, state: () => x };
  }
  // Weighted order without replacement: repeatedly draw one item by weight.
  function weightedOrder(rng, items, weightOf) {
    const rest = items.slice(), out = [];
    while (rest.length) {
      let total = 0; for (const it of rest) total += Math.max(1, weightOf(it) | 0);
      let r = rng.int(total), i = 0;
      for (; i < rest.length - 1; i++) { r -= Math.max(1, weightOf(rest[i]) | 0); if (r < 0) break; }
      out.push(rest.splice(i, 1)[0]);
    }
    return out;
  }

  // ---------- path ----------
  // A descending snake: start on the top row, run sideways, drop down; the last
  // row ends the path. Returns [[x, y], ...].
  // dropPct: chance (in %) to drop to the next row instead of running on;
  // endPct: chance to end on the last row instead of running on.
  function snake(rng, cols, rows, dropPct, endPct) {
    let x = rng.int(cols), y = 0, dir = rng.int(2) ? 1 : -1;
    const path = [[x, y]], seen = new Set([x + "," + y]);
    const free = (a, b) => a >= 0 && a < cols && !seen.has(a + "," + b);
    for (let guard = 0; guard < cols * rows * 4; guard++) {
      const nx = x + dir;
      if (y === rows - 1) {
        if (!free(nx, y) || rng.int(100) < endPct) break;
        x = nx;
      } else if (!free(nx, y) || rng.int(100) < dropPct) {
        y += 1; dir = rng.int(2) ? 1 : -1;
      } else x = nx;
      path.push([x, y]); seen.add(x + "," + y);
    }
    return path;
  }

  // ---------- generation ----------
  // slice: catalog entry (map: cols, rows, path_min, path_max, directions);
  // templates: room templates of the slice (pushbox.room/1).
  function generate(seed, slice, templates) {
    const rng = makeRng(seed), M = slice.map || {};
    const cols = M.cols || 4, rows = M.rows || 3, min = M.path_min || 5, max = M.path_max || 9;
    const dirs = M.directions && M.directions.length ? M.directions : ["down"];
    const dir = dirs[rng.int(dirs.length)];
    const byType = (ty) => templates.filter((t) => t.type === ty);
    for (let attempt = 0; attempt < 200; attempt++) {
      let path = snake(rng, cols, rows, M.drop_pct == null ? 30 : M.drop_pct, M.end_pct == null ? 20 : M.end_pct);
      if (path.length < min || path.length > max) continue;
      if (dir === "up") path = path.map(([x, y]) => [x, rows - 1 - y]);
      const n = path.length, station = Math.floor((n - 1) / 2);
      const roles = path.map((_, i) => (i === 0 ? "gate" : i === n - 1 ? "home" : i === station ? "station" : "room"));
      const rooms = new Array(n);
      // Edge from room i to room i + 1, and back.
      const out = path.map((p, i) => (i < n - 1 ? R().edgeToward(p, path[i + 1]) : null));
      const place = (i, inSlot) => {
        const need = { in: i > 0 ? R().OPPOSITE[out[i - 1]] : null, out: out[i] };
        const prev = i > 0 ? rooms[i - 1].template : null;
        let cands = weightedOrder(rng, byType(roles[i]), (t) => t.weight || 10);
        // Variety: the same template twice in a row only if nothing else fits.
        cands = cands.filter((t) => t.id !== prev).concat(cands.filter((t) => t.id === prev));
        for (const t of cands) {
          const mirrors = t.mirror ? (rng.int(2) ? [true, false] : [false, true]) : [false];
          for (const mirror of mirrors) {
            const ex = R().exitsOf(t, mirror);
            if (need.in && !(ex[need.in] || []).includes(inSlot)) continue;
            if (need.in && need.out && !R().allows(t, mirror, need.in, need.out)) continue;
            const outs = need.out ? weightedOrder(rng, ex[need.out] || [], () => 1) : [null];
            for (const s of outs) {
              const open = {};
              if (need.in) open[need.in] = inSlot;
              if (need.out) open[need.out] = s;
              rooms[i] = { x: path[i][0], y: path[i][1], index: i, role: roles[i], template: t.id, mirror, open };
              if (i === n - 1 || place(i + 1, s)) return true;
            }
          }
        }
        rooms[i] = undefined;
        return false;
      };
      if (!place(0, null)) continue;
      return { format: "pushbox.map/1", seed, slice: slice.id, cols, rows, dir, attempt, path, rooms };
    }
    throw new Error("no map for seed " + seed + " (templates cannot connect)");
  }

  // Grid lookup: the path room at (x, y), or null for a sealed cell.
  function roomAt(map, x, y) { return map.rooms.find((r) => r.x === x && r.y === y) || null; }

  PB.mapgen = { makeRng, weightedOrder, snake, generate, roomAt };
})(typeof window !== "undefined" ? window : globalThis);
