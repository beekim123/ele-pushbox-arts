/* Ambient life (plants and small animals) for each theme. Purely decorative:
 * never blocks, never interacts, and follows the readability rules in
 * docs/design/art-direction.md §7. Placement is deterministic (hash of tile
 * position); motion uses integer triangle waves so every renderer agrees. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const h32 = PB.h32;
  const S = () => PB.sprites;

  function tri(t, period, amp) {
    const p = ((t % period) + period) % period, half = period >> 1;
    const v = p < half ? p : period - p;
    return Math.floor((v * 4 * amp) / period) - amp;
  }
  function solid(m) { const M = PB.terrain.MAT; return m === M.ROCK || m === M.EARTH || m === M.CRACKED; }

  // Floor / ceiling candidate tiles, ordered by a stable hash.
  function candidates(map, occupied, kind, salt) {
    const out = [];
    for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < map.w; tx++) {
      if (map.at(tx, ty) !== PB.terrain.MAT.EMPTY || (occupied && occupied(tx, ty))) continue;
      const ok = kind === "floor" ? solid(map.at(tx, ty + 1)) : solid(map.at(tx, ty - 1));
      if (ok) out.push({ tx, ty, h: h32(tx, ty, 771 + (salt | 0)) });
    }
    return out.sort((a, b) => a.h - b.h);
  }

  // Longest run of adjacent floor tiles in one row (for walkers).
  function longestRun(cands) {
    const byRow = new Map();
    for (const c of cands) { if (!byRow.has(c.ty)) byRow.set(c.ty, []); byRow.get(c.ty).push(c.tx); }
    let best = null;
    for (const [ty, xs] of byRow) {
      xs.sort((a, b) => a - b);
      let start = xs[0], prev = xs[0];
      for (let i = 1; i <= xs.length; i++) {
        if (i < xs.length && xs[i] === prev + 1) { prev = xs[i]; continue; }
        const len = prev - start + 1;
        if (!best || len > best.len || (len === best.len && ty > best.ty)) best = { ty, x0: start, len };
        if (i < xs.length) { start = xs[i]; prev = xs[i]; }
      }
    }
    return best;
  }

  // alive(tx, ty): whether a decoration placed from the opening layout still fits now.
  // layer: "back" (behind terrain) or "front" (after terrain, behind entities).
  // area: {x, y, w, h} screen rectangle used by flyers.
  const MOVERS = new Set(["walker", "percher", "flyer", "hanger"]);
  // Which moving critter (if any) appears in this room. Rules (art direction §6):
  // "full" = every critter (review scenes only); "one" = exactly one, chosen by seed
  // (menus); "sparse" = at most one, and only if its own chance passes for this seed.
  function pickMover(list, opts) {
    const mode = (opts && opts.mode) || "sparse", seed = (opts && opts.seed) | 0;
    const movers = list.filter((a) => MOVERS.has(a.type));
    if (mode === "full" || !movers.length) return mode === "full" ? new Set(movers) : new Set();
    const order = movers.map((a, i) => ({ a, h: h32(seed, i, 901) })).sort((x, y) => x.h - y.h);
    if (mode === "one") return new Set([order[0].a]);
    const hit = order.find((o) => (o.h % 100) < Math.round((o.a.chance == null ? 0.3 : o.a.chance) * 100));
    return new Set(hit ? [hit.a] : []);
  }
  function seedOf(str) { let h = 0; for (const ch of String(str)) h = h32(h, ch.charCodeAt(0), 907); return h; }

  // opts: { mode, seed, out } - out collects decoration positions (light sources).
  function draw(r, theme, map, ox, oy, tick, layer, occupied, area, alive, opts) {
    const list = (theme.ambient || []);
    const used = new Set(), movers = pickMover(list, opts), out = opts && opts.out;
    const S = opts && opts.dry ? () => ({ draw() {}, has: (id) => PB.sprites.has(id) }) : () => PB.sprites;
    let flyerIndex = 0;
    for (const a of list) {
      if (!S().has(a.id)) continue;
      if (MOVERS.has(a.type) && !movers.has(a)) continue;
      const back = a.type === "wall" || a.type === "hanger" || a.type === "flyer";
      if ((layer === "back") !== back) { if (a.type === "flyer") flyerIndex += a.count || 1; continue; }
      if (a.type === "floor" || a.type === "hang") {
        const cands = candidates(map, occupied, a.type === "floor" ? "floor" : "ceiling", a.salt).filter((c) => !used.has(c.tx + "," + c.ty));
        const n = Math.min(a.max || 2, Math.ceil(cands.length / (a.every || 4)));
        for (const c of cands.slice(0, n)) {
          used.add(c.tx + "," + c.ty);
          if (alive && !alive(c.tx, c.ty)) continue;
          const x = ox + c.tx * 16 + 5 + (c.h % 7), y = oy + c.ty * 16 + (a.type === "floor" ? 16 : 0);
          S().draw(r, a.id, a.anim || "default", tick + (c.h % 97), x, y, (c.h >> 3) & 1);
          if (out) out.push({ id: a.id, x, y });
        }
      } else if (a.type === "walker") {
        const run = longestRun(candidates(map, occupied, "floor", 5));
        if (!run || run.len < 2) continue;
        const span = run.len * 16 - 12, t = tick >> 2, pause = 30, cycle = 2 * (span + pause);
        const p = t % cycle;
        let x, facing, moving = true;
        if (p < span) { x = p; facing = 1; } else if (p < span + pause) { x = span; facing = 1; moving = false; }
        else if (p < 2 * span + pause) { x = 2 * span + pause - p; facing = -1; } else { x = 0; facing = -1; moving = false; }
        const px = ox + run.x0 * 16 + 6 + x, py = oy + run.ty * 16 + 16;
        S().draw(r, a.id, moving ? "walk" : 0, moving ? tick : 0, px, py, facing < 0);
      } else if (a.type === "percher") {
        const cands = candidates(map, occupied, "floor", 9).filter((c) => !used.has(c.tx + "," + c.ty));
        const edge = cands.find((c) => map.at(c.tx + 1, c.ty) === PB.terrain.MAT.EMPTY && !solid(map.at(c.tx + 1, c.ty + 1))) || cands[0];
        if (!edge) continue;
        used.add(edge.tx + "," + edge.ty);
        if (alive && !alive(edge.tx, edge.ty)) continue;
        const phase = Math.floor(tick / 60) % 6, flip = Math.floor(tick / 360) % 2 === 1;
        const anim = phase === 2 || phase === 3 ? "peck" : "idle";
        S().draw(r, a.id, anim, tick, ox + edge.tx * 16 + 8, oy + edge.ty * 16 + 16, flip);
      } else if (a.type === "wall") {
        for (let x = area.x + (a.spacing >> 1); x < area.x + area.w; x += a.spacing) {
          S().draw(r, a.id, a.anim, tick + x, x, area.y + a.y);
          if (out) out.push({ id: a.id, x, y: area.y + a.y });
        }
      } else if (a.type === "hanger") {
        const c = candidates(map, occupied, "ceiling", 3)[0];
        if (!c) continue;
        const hx = ox + c.tx * 16 + 8, hy = oy + c.ty * 16;
        const p = tick % 720;
        if (p < 600) S().draw(r, a.id, "hang", tick, hx, hy);
        else S().draw(r, a.id, "fly", tick, hx + tri(p - 600, 120, 20) + 0, hy + 10 + tri(p - 570, 60, 6));
      } else if (a.type === "flyer") {
        const n = a.count || 1;
        for (let i = 0; i < n; i++, flyerIndex++) {
          const k = flyerIndex, cx = area.x + ((area.w * (k + 1)) / (n + 1) | 0), cy = area.y + (area.h >> 1);
          let x, y;
          if (a.path === "cross") { x = area.x + (((tick >> 1) + k * 97) % (area.w + 40)) - 20; y = area.y + 16 + k * 18 + tri(tick, 80, 3); }
          else if (a.path === "drift") { x = area.x + (((tick >> 3) + k * 131) % (area.w + 40)) - 20; y = area.y + 30 + tri(tick, 240, 4); }
          else if (a.path === "hover") { x = cx + tri(tick + k * 50, 900, Math.min(60, area.w >> 3)); y = cy - 20 + tri(tick, 120, 3); }
          else { x = cx + tri(tick + k * 133, 420, Math.min(48, area.w >> 3)); y = cy + tri(tick + k * 71, 260, Math.min(24, area.h >> 3)); }
          S().draw(r, a.id, a.anim || "fly", tick, x, y, a.path === "cross" ? false : tri(tick + k * 133, 420, 1) < 0);
        }
      }
    }
  }

  PB.ambient = { draw, tri, pickMover, seedOf };
})(typeof window !== "undefined" ? window : globalThis);
