/* Delivery-mode maps of format pushbox.map/2 (docs/design/delivery-puzzle-rules.md §6).
 *
 * One run = three reels, then a layout:
 *   1) map reel: which map of the run pool (dungeon_2, diyu_1, ...);
 *   2) recipient reel: only recipients of that map;
 *   3) cargo reel: only cargo of that map (and of that recipient, if the map says so);
 *   4) layout: the map's role sequence (gate, teach, develop, station, twist,
 *      home, optional breathers) is placed room by room on a grid of screens.
 *      Rooms are 1x1 to 2x2 screens; room i's exit must meet room i+1's entry on
 *      the shared screen edge, and every room is used only along a route that
 *      tools/check-rooms2.mjs has verified (template `routes`, in that direction).
 * Same seed + same pool + same templates = same run. The order of random draws
 * is part of the specification (reels first, then optional slots, then the
 * depth-first placement), so that the game can reproduce workbench maps.
 * Shared by the workbench (browser, classic script) and the Node tools.
 */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const R2 = () => PB.rooms2, MG = () => PB.mapgen;
  const OPP = { left: "right", right: "left", top: "bottom", bottom: "top" };
  // A map's direction: the gate sits on that side's far edge and no room may exit back toward it.
  const FORBID_OUT = { down: "top", up: "bottom", right: "left", left: "right" };

  // One weighted draw (consumes exactly one random number, even for a single item).
  function pick(rng, items, weightOf) {
    let total = 0; for (const it of items) total += Math.max(1, weightOf(it) | 0);
    let r = rng.int(Math.max(1, total));
    for (const it of items) { r -= Math.max(1, weightOf(it) | 0); if (r < 0) return it; }
    return items[items.length - 1];
  }

  // ---------- reels ----------
  // pool: slices entry with `pool` ({maps: [{slice, weight}], weights: {common, rare, legendary}}).
  // maps: Map slice id -> map slice (format 2); cat: {recipients: Map, cargo: Map}.
  // picks: optional {map, recipient, cargo} chosen by the player after a re-spin; the draws still happen.
  function reels(rng, pool, maps, cat, picks) {
    const P = pool.pool, rw = P.weights || { common: 4, rare: 2, legendary: 1 }, pk = picks || {};
    const mapOpts = P.maps.filter((m) => maps.has(m.slice));
    const drawnMap = pick(rng, mapOpts, (m) => m.weight || 1).slice;
    const map = maps.get(pk.map || drawnMap);
    const rarity = (kind, id) => rw[((cat[kind].get(id) || {}).rarity) || "common"] || 1;
    const recOpts = recipientsOf(map);
    const drawnRec = pick(rng, recOpts, (id) => rarity("recipients", id));
    const recipient = pk.recipient && recOpts.includes(pk.recipient) ? pk.recipient : drawnRec;
    const cargoOpts = cargoOf(map, recipient);
    const drawnCargo = pick(rng, cargoOpts, (id) => rarity("cargo", id));
    const cargo = pk.cargo && cargoOpts.includes(pk.cargo) ? pk.cargo : drawnCargo;
    return { map: map.id, recipient, cargo, drawn: { map: drawnMap, recipient: drawnRec, cargo: drawnCargo } };
  }
  function recipientsOf(map) { return (map.recipients || []).slice(); }
  // cargo_only: {cargo id: [recipient ids]} - that cargo only comes up for those recipients.
  function cargoOf(map, recipient) {
    const only = map.cargo_only || {};
    return (map.cargo || []).filter((c) => !only[c] || only[c].includes(recipient));
  }

  // ---------- layout ----------
  // Allowed routes of a template placement: [{in, out}] in the variant's own frame.
  function routesOf(t, mirror) {
    const W = (t.size || [1, 1])[0];
    return (t.routes || []).map((r) => {
      const [a, b] = r.split(">");
      const f = (id) => (id === "gate" || id === "recipient" || !mirror ? id : R2().mirrorExit(id, W));
      return { in: f(a), out: f(b), key: r };
    });
  }
  // Global screen cell of an exit's segment and where the neighbour must sit.
  function neighbour(gx, gy, size, exitId, nextSize, nextIn) {
    const e = R2().parseExit(exitId), n = R2().parseExit(nextIn);
    if (e.edge === "right") return [gx + size[0], gy + e.seg - n.seg];
    if (e.edge === "left") return [gx - nextSize[0], gy + e.seg - n.seg];
    if (e.edge === "bottom") return [gx + e.seg - n.seg, gy + size[1]];
    return [gx + e.seg - n.seg, gy - nextSize[1]];
  }
  // The entry the next room needs: the opposite edge, the same slot.
  function entryFor(exitId) { const e = R2().parseExit(exitId); return { edge: OPP[e.edge], slot: e.slot }; }

  // slice: a map slice (format 2) with `layout` {cols, rows, direction, sequence: [{role, chance}]}.
  // templates: v2 rooms of that slice. Returns {rooms: [...], attempt} or throws.
  function layout(rng, slice, templates, recipient, cargo) {
    const Lc = slice.layout, cols = Lc.cols, rows = Lc.rows, dir = Lc.direction || "down";
    const roles = [];
    for (const s of Lc.sequence) if (!s.chance || rng.int(100) < s.chance) roles.push(s.role);
    const fits = (t) => (!t.only || ((!t.only.recipients || t.only.recipients.includes(recipient)) && (!t.only.cargo || t.only.cargo.includes(cargo))));
    const byRole = (role) => templates.filter((t) => t.role === role && fits(t));
    const n = roles.length, placed = new Array(n), used = new Set(), taught = [];
    const occupied = (gx, gy, c, r) => placed.some((p) => p && gx < p.gx + p.cols && p.gx < gx + c && gy < p.gy + p.rows && p.gy < gy + r);
    const forbidOut = FORBID_OUT[dir] || null;
    let budget = 20000;
    const place = (i, gx, gy, need) => {
      if (--budget < 0) return false;
      let cands = MG().weightedOrder(rng, byRole(roles[i]), (t) => t.weight || 10);
      cands = cands.filter((t) => !used.has(t.id)).concat(cands.filter((t) => used.has(t.id) && placed[i - 1] && placed[i - 1].template !== t.id && (byRole(roles[i]).length < 2)));
      for (const t of cands) {
        if ((t.needs || []).some((m) => !taught.includes(m))) continue;
        const size = t.size || [1, 1];
        const mirrors = t.mirror === false ? [false] : rng.int(2) ? [true, false] : [false, true];
        for (const mirror of mirrors) {
          let routes = routesOf(t, mirror).filter((r) => (i === 0 ? r.in === "gate" : r.in !== "gate" && R2().parseExit(r.in).edge === need.edge && R2().parseExit(r.in).slot === need.slot));
          routes = routes.filter((r) => (i === n - 1 ? r.out === "recipient" : r.out !== "recipient" && R2().parseExit(r.out).edge !== forbidOut));
          routes = MG().weightedOrder(rng, routes, () => 1);
          for (const r of routes) {
            let x = gx, y = gy;
            if (i > 0) [x, y] = neighbour(need.px, need.py, need.psize, need.pout, size, r.in);
            if (x < 0 || y < 0 || x + size[0] > cols || y + size[1] > rows || occupied(x, y, size[0], size[1])) continue;
            placed[i] = { index: i, role: roles[i], template: t.id, mirror, gx: x, gy: y, cols: size[0], rows: size[1], in: r.in, out: r.out, route: r.key };
            used.add(t.id); const before = taught.length; taught.push(...(t.teaches || []));
            if (i === n - 1) return true;
            const nx = entryFor(r.out);
            if (place(i + 1, 0, 0, { edge: nx.edge, slot: nx.slot, px: x, py: y, psize: size, pout: r.out })) return true;
            taught.length = before; used.delete(t.id); placed[i] = undefined;
          }
        }
      }
      return false;
    };
    for (let attempt = 0; attempt < 24; attempt++) {
      const gate = byRole(roles[0])[0], gs = gate ? gate.size || [1, 1] : [1, 1];
      const gx = dir === "right" ? 0 : dir === "left" ? cols - gs[0] : rng.int(Math.max(1, cols - gs[0] + 1));
      const gy = dir === "up" ? rows - gs[1] : dir === "down" ? 0 : rng.int(Math.max(1, rows - gs[1] + 1));
      budget = 20000;
      if (place(0, gx, gy, null)) return { roles, rooms: placed.slice(), attempt, cols, rows, dir };
    }
    throw new Error("no layout for " + slice.id + " (templates cannot connect)");
  }

  // Whole run. pool: the pool entry; maps: Map id -> map slice; templatesOf(sliceId) -> v2 templates.
  function generate(seed, pool, maps, cat, templatesOf, picks) {
    const rng = MG().makeRng(seed);
    const rl = reels(rng, pool, maps, cat, picks);
    const slice = maps.get(rl.map);
    const lay = layout(rng, slice, templatesOf(slice.id), rl.recipient, rl.cargo);
    return { format: "pushbox.map/2", seed, pool: pool.id, slice: slice.id, world: slice.world, recipient: rl.recipient, cargo: rl.cargo, drawn: rl.drawn,
      cols: lay.cols, rows: lay.rows, dir: lay.dir, attempt: lay.attempt, roles: lay.roles, rooms: lay.rooms };
  }

  // Global tile rectangle of a placed room (for the overview and the minimap).
  function tileRect(p) { return { x: p.gx * R2().SW, y: p.gy * R2().SH, w: p.cols * R2().SW, h: p.rows * R2().SH }; }
  // Checks that consecutive rooms meet on a shared edge segment with matching slots.
  function joints(map, templateById) {
    const out = [];
    for (let i = 0; i + 1 < map.rooms.length; i++) {
      const a = map.rooms[i], b = map.rooms[i + 1];
      const e = R2().parseExit(a.out), f = R2().parseExit(b.in);
      const [x, y] = neighbour(a.gx, a.gy, [a.cols, a.rows], a.out, [b.cols, b.rows], b.in);
      if (OPP[e.edge] !== f.edge || e.slot !== f.slot || x !== b.gx || y !== b.gy) out.push(`房间 ${i} → ${i + 1} 的出入口没有对上`);
    }
    return out;
  }

  PB.mapgen2 = { pick, reels, recipientsOf, cargoOf, routesOf, neighbour, entryFor, layout, generate, tileRect, joints };
})(typeof window !== "undefined" ? window : globalThis);
