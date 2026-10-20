/* Delivery-mode room templates (docs/design/delivery-maps.md).
 *
 * A room is one screen: 20 x 10 tiles, the same size as a lab level. Its map
 * uses the lab tile characters (game-design.md 6.5) plus "$" for a coin and
 * digits that the template's legend turns into monsters and features (gate,
 * recipient, station keeper). Exits sit at fixed slots on the edges so that
 * neighbouring rooms line up; unused exits are capped with bedrock.
 *
 * This file is the specification of the room format and of the static
 * traversability check; tools/check-rooms.mjs and the workbench run the same
 * code. The check uses the lab tile model (tilemodel.js) with an empty bag and
 * no monsters, and refuses any fall of 3 rows or more that does not land on
 * sand (delivery mode hurts the player there). Monsters, timing and damage are
 * the real-time model's job (step 3), not this one.
 * Shared by the workbench (browser, classic script) and the Node tools.
 */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const TM = () => PB.tilemodel;

  const W = 20, H = 10;
  // Exit slots. Side exits are 2 tiles tall with bedrock under (floor) and over
  // (ceil) the opening; vertical exits are a 2-wide double ladder shaft whose
  // ladders continue one row into the room.
  const SIDE = { low: { rows: [6, 7], floor: 8, ceil: 5 }, high: { rows: [2, 3], floor: 4, ceil: 1 } };
  const VERT = { mid: { cols: [9, 10] } };
  const EDGES = ["left", "right", "top", "bottom"];
  const OPPOSITE = { left: "right", right: "left", top: "bottom", bottom: "top" };
  const MIRROR_EDGE = { left: "right", right: "left", top: "top", bottom: "bottom" };
  const MIRROR_DIR = { left: "right", right: "left" };
  const TYPES = ["gate", "home", "station", "room"];
  const FEATURE_OF = { gate: "gate", home: "recipient", station: "keeper" };
  // Lab tile characters a delivery room may use (the slice region has no water or devices).
  const TILES = "#es.HBI_|";
  const COIN = "$";
  const FALL_HURT_ROWS = 3;   // falls of this many rows hurt unless they land on sand
  const SPAWN_GAP = 4;         // monsters start at least this many tiles (Chebyshev) from every exit cell

  function isSide(edge) { return edge === "left" || edge === "right"; }
  function slotsOf(edge) { return isSide(edge) ? SIDE : VERT; }
  // Border cells of an exit opening.
  function exitCells(edge, slot) {
    if (isSide(edge)) { const x = edge === "left" ? 0 : W - 1; return SIDE[slot].rows.map((y) => [x, y]); }
    const y = edge === "top" ? 0 : H - 1;
    return VERT[slot].cols.map((x) => [x, y]);
  }
  // Where the player stands right after coming in through an exit.
  function entryCell(edge, slot) {
    if (isSide(edge)) return [edge === "left" ? 0 : W - 1, SIDE[slot].rows[1]];
    return [VERT[slot].cols[0], edge === "top" ? 0 : H - 1];
  }
  // The cells just inside an opening. Exit cells are walls for everything but
  // the player (crates, sand and monsters never block a doorway), so a route
  // that reaches one of these cells can always step out of the room.
  function innerCells(edge, slot) {
    if (isSide(edge)) { const x = edge === "left" ? 1 : W - 2; return SIDE[slot].rows.map((y) => [x, y]); }
    const y = edge === "top" ? 1 : H - 2;
    return VERT[slot].cols.map((x) => [x, y]);
  }
  function innerEntry(edge, slot) { const c = innerCells(edge, slot); return isSide(edge) ? c[c.length - 1] : c[0]; }
  // Direction (dx, dy) from a room to the neighbour behind one of its edges.
  const STEP = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };
  function edgeToward(a, b) { for (const e of EDGES) if (a[0] + STEP[e][0] === b[0] && a[1] + STEP[e][1] === b[1]) return e; return null; }

  // ---------- template parsing ----------
  // Returns {errors, warnings} for the static rules (format, border, exits, legend, spawns).
  function validate(t, ctx) {
    const errors = [], warnings = [], c = ctx || {};
    const err = (m) => errors.push(m), warn = (m) => warnings.push(m);
    if (t.format !== "pushbox.room/1") err("format 应为 pushbox.room/1");
    if (!/^[a-z0-9_-]+$/.test(t.id || "")) err(`编号不合法：${JSON.stringify(t.id)}`);
    if (!TYPES.includes(t.type)) err(`type 只能是 ${TYPES.join(" / ")}`);
    const rows = t.map || [];
    if (rows.length !== H || rows.some((r) => [...r].length !== W)) { err(`地图必须是 ${H} 行 × ${W} 列`); return { errors, warnings }; }
    const legend = t.legend || {};
    const exits = t.exits || {};
    for (const [edge, list] of Object.entries(exits)) {
      if (!EDGES.includes(edge)) { err(`出入口的边不对：${edge}`); continue; }
      for (const s of list) if (!slotsOf(edge)[s]) err(`${edge} 边没有口位 ${s}（左右：${Object.keys(SIDE).join("、")}；上下：${Object.keys(VERT).join("、")}）`);
    }
    const open = new Set();
    for (const [edge, list] of Object.entries(exits)) if (EDGES.includes(edge)) for (const s of list) if (slotsOf(edge)[s]) for (const [x, y] of exitCells(edge, s)) open.add(x + "," + y);
    const at = (x, y) => rows[y][x];
    // Border: bedrock except declared exit openings.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (x > 0 && y > 0 && x < W - 1 && y < H - 1) continue;
      const ch = at(x, y);
      if (open.has(x + "," + y)) continue;
      if (ch !== "#") err(`边框 (${x},${y}) 必须是基岩 #，现在是 ${ch}`);
    }
    for (const [edge, list] of Object.entries(exits)) for (const s of list) {
      if (!slotsOf(edge)[s]) continue;
      if (isSide(edge)) {
        const x = edge === "left" ? 0 : W - 1, S = SIDE[s];
        for (const y of S.rows) if (at(x, y) !== ".") err(`${edge}/${s} 出入口 (${x},${y}) 必须是空格`);
        for (const [ix, iy] of innerCells(edge, s)) if (!".$H".includes(at(ix, iy))) err(`${edge}/${s} 出入口里面一格 (${ix},${iy}) 必须空着`);
        if (at(x, S.floor) !== "#") err(`${edge}/${s} 出入口脚下 (${x},${S.floor}) 必须是基岩`);
        if (at(x, S.ceil) !== "#") err(`${edge}/${s} 出入口上沿 (${x},${S.ceil}) 必须是基岩`);
      } else {
        const y = edge === "top" ? 0 : H - 1, inner = edge === "top" ? 1 : H - 2;
        for (const x of VERT[s].cols) {
          if (at(x, y) !== "H") err(`${edge}/${s} 竖井口 (${x},${y}) 必须是梯子 H`);
          if (at(x, inner) !== "H") err(`${edge}/${s} 竖井口里面一格 (${x},${inner}) 也必须是梯子`);
        }
      }
    }
    // Characters, legend, spawns.
    const spawns = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = at(x, y);
      if (TILES.includes(ch) || ch === COIN) continue;
      if (/[0-9]/.test(ch)) {
        const e = legend[ch];
        if (!e) { err(`(${x},${y}) 的 ${ch} 没有写在 legend 里`); continue; }
        spawns.push(Object.assign({ x, y, ch }, e));
        continue;
      }
      err(`(${x},${y}) 的字符 ${ch} 不能用在配送房间里（只能用 ${TILES}、$ 和 legend 数字）`);
    }
    for (const [ch, e] of Object.entries(legend)) {
      if (!/^[0-9]$/.test(ch)) err(`legend 的键必须是一个数字：${ch}`);
      if (!e.monster && !e.feature) err(`legend ${ch} 必须写 monster 或 feature`);
      if (e.feature && !["gate", "recipient", "keeper"].includes(e.feature)) err(`legend ${ch} 的 feature 只能是 gate / recipient / keeper`);
      if (e.monster && c.monsters && !c.monsters.has(e.monster)) err(`legend ${ch} 的怪物 ${e.monster} 不在 monsters.json 中`);
      if (e.monster && c.world && c.monsters && c.monsters.has(e.monster) && c.monsters.get(e.monster).world !== c.world) err(`怪物 ${e.monster} 不属于 ${c.world}`);
      if (e.dir && !MIRROR_DIR[e.dir]) err(`legend ${ch} 的 dir 只能是 left / right`);
    }
    const solidBelow = (x, y) => y + 1 < H && "#esBI".includes(at(x, y + 1));
    for (const s of spawns) {
      if (!solidBelow(s.x, s.y)) err(`${s.monster || s.feature}（${s.x},${s.y}）脚下要有地面`);
      if (s.monster) {
        let near = Infinity;
        for (const k of open) { const [ex, ey] = k.split(",").map(Number); near = Math.min(near, Math.max(Math.abs(ex - s.x), Math.abs(ey - s.y))); }
        if (near < SPAWN_GAP) err(`怪物 ${s.monster}（${s.x},${s.y}）离出入口只有 ${near} 格，至少要 ${SPAWN_GAP} 格`);
      }
    }
    const feats = spawns.filter((s) => s.feature);
    if (FEATURE_OF[t.type]) {
      const n = feats.filter((s) => s.feature === FEATURE_OF[t.type]).length;
      if (n !== 1) err(`${t.type} 房间必须正好有一个 ${FEATURE_OF[t.type]}（现在 ${n} 个）`);
    }
    for (const s of feats) if (s.feature !== FEATURE_OF[t.type]) err(`${t.type} 房间不能放 ${s.feature}`);
    const edges = EDGES.filter((e) => (exits[e] || []).length);
    if (t.type === "room" && edges.length < 2) err("普通房间至少要有两条边有出入口");
    if (t.type !== "room" && edges.length < 1) err("至少要有一个出入口");
    for (const r of t.routes || []) {
      const m = /^(left|right|top|bottom)>(left|right|top|bottom)$/.exec(r);
      if (!m || m[1] === m[2]) err(`routes 的每一项写成 "左边>右边" 的形式（如 "left>right"）：${r}`);
      else if (!(exits[m[1]] || []).length || !(exits[m[2]] || []).length) err(`routes ${r} 用到了没有出入口的边`);
    }
    if (t.routes && t.type !== "room" && t.type !== "station") err("只有普通房间和驿站可以写 routes（单向房间）");
    for (const [edge, list] of Object.entries(t.caps || {})) {
      if (!(exits[edge] || []).length) err(`caps 写了 ${edge}，但这条边没有出入口`);
      for (const f of list) if (!Array.isArray(f) || f.length !== 5 || typeof f[4] !== "string" || f[4].length !== 1) err(`caps ${edge} 的每一项是 [x, y, w, h, "字符"]`);
    }
    if (!spawns.some((s) => s.monster) && t.type === "room" && !(rows.join("").includes(COIN))) warn("没有怪物也没有金币");
    // Demos: a placement this template can take, a start, a script and what it must achieve.
    const ids = new Set();
    for (const d of t.demos || []) {
      const at = `演示 ${d.id}`;
      if (!d.id || ids.has(d.id)) err(`${at}：编号缺失或重复`); ids.add(d.id);
      for (const [e, sl] of Object.entries(d.open || {})) if (!(exits[e] || []).includes(sl)) err(`${at}：${e}.${sl} 不是这个模板的出入口`);
      const nOpen = Object.keys(d.open || {}).length;
      if ((t.type === "gate" || t.type === "home") ? nOpen !== 1 : nOpen !== 2) err(`${at}：open 打开的出入口数目不对`);
      if (d.from === "gate" ? t.type !== "gate" : !(d.open || {})[String(d.from).split(".")[0]]) err(`${at}：from 必须是 gate 或一个打开的出入口`);
      if (!Array.isArray(d.script) || !d.script.length) err(`${at}：没有 script`);
      else for (const tok of d.script) if (!/^(wait \d+|hold [LRUD] \d+|[A-Z_0-9]+(\*\d+)?)$/.test(tok)) err(`${at}：script 写法不对：${tok}`);
      if (!d.expect || !/^(exit:(left|right|top|bottom)|deliver|fail:(hearts|cargo))$/.test(d.expect.end || "")) err(`${at}：expect.end 写成 exit:<边>、deliver 或 fail:hearts / fail:cargo`);
    }
    if (t.type === "room" && !(t.demos || []).length) warn("还没有演示输入（实时模型回放）");
    return { errors, warnings };
  }

  // One-way rooms list the directions they guarantee ("left>right"); without
  // routes every pair of exits works both ways. Mirroring swaps left and right.
  function allows(t, mirror, from, to) {
    if (!t.routes) return true;
    const src = (e) => (mirror ? MIRROR_EDGE[e] : e);
    return t.routes.includes(src(from) + ">" + src(to));
  }

  // ---------- variants: mirror + open exits ----------
  function mirrorRows(rows) { return rows.map((r) => [...r].reverse().join("")); }
  // Exits of a template as placed (mirroring swaps left and right).
  function exitsOf(t, mirror) {
    const out = {};
    for (const e of EDGES) { const src = mirror ? MIRROR_EDGE[e] : e; if ((t.exits || {})[src] && t.exits[src].length) out[e] = t.exits[src].slice(); }
    return out;
  }
  // open: {edge: slot} — the exits this placement actually uses; every other exit is capped.
  function variant(t, mirror, open) {
    let rows = (mirror ? mirrorRows(t.map) : t.map.slice()).map((r) => [...r]);
    const exits = exitsOf(t, mirror);
    const fill = (x, y, w, h, ch) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (xx >= 0 && yy >= 0 && xx < W && yy < H) rows[yy][xx] = ch; };
    for (const edge of EDGES) for (const slot of exits[edge] || []) {
      if (open && open[edge] === slot) continue;
      const src = mirror ? MIRROR_EDGE[edge] : edge;
      for (const [x, y, w, h, ch] of (t.caps || {})[src] || []) fill(mirror ? W - x - w : x, y, w, h, ch);
      for (const [x, y] of exitCells(edge, slot)) rows[y][x] = "#";
    }
    // Entities come off the map: the tile under every legend digit and coin is empty.
    const spawns = [], coins = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = rows[y][x];
      if (ch === COIN) { coins.push([x, y]); rows[y][x] = "."; }
      else if (/[0-9]/.test(ch)) {
        const e = Object.assign({}, t.legend[ch]);
        if (e.dir && mirror) e.dir = MIRROR_DIR[e.dir];
        spawns.push(Object.assign(e, { x, y }));
        rows[y][x] = ".";
      }
    }
    const links = t.links ? t.links.map((g) => Object.assign({}, g, {
      plates: (g.plates || []).map(([x, y]) => [mirror ? W - 1 - x : x, y]),
      doors: (g.doors || []).map(([x, y]) => [mirror ? W - 1 - x : x, y]),
    })) : undefined;
    const used = {};
    for (const e of EDGES) if (open && open[e] && (exits[e] || []).includes(open[e])) used[e] = open[e];
    return { id: t.id, mirror: !!mirror, rows: rows.map((r) => r.join("")), spawns, coins, links, exits: used, all_exits: exits, type: t.type, world: t.world };
  }

  // Lab level spec for the tile model, with the player put at (px, py). The
  // open exits' own cells become bedrock (see innerCells).
  function specOf(v, px, py, extra) {
    const rows = v.rows.map((r) => [...r]);
    for (const e of EDGES) if (v.exits[e]) for (const [x, y] of exitCells(e, v.exits[e])) rows[y][x] = "#";
    // The recipient is a body in the way (touching him delivers); gate and keeper are background.
    for (const s of v.spawns) if (s.feature === "recipient") rows[s.y][s.x] = "#";
    rows[py][px] = rows[py][px] === "H" ? "h" : "P";
    return Object.assign({ format: "pushbox.levelspec/1", id: v.id + (v.mirror ? "~m" : ""), chapter: v.world || "dungeon", map: rows.map((r) => r.join("")), bag: { sand: 0, bomb: 0 }, links: v.links }, extra || {});
  }

  // ---------- traversability (static, tile model) ----------
  function keyOf(s) {
    let k = s.player.x + "," + s.player.y + "|" + s.bag.sand + "|";
    k += s.crates.map((c) => c.kind[0] + c.x + "," + c.y).sort().join(";") + "|" + s.open.join("") + "|" + s.dev.join("") + "|";
    let t = ""; for (let i = 0; i < s.terrain.length; i++) t += s.terrain[i];
    return k + t;
  }
  // Ticks each action takes in the real-time mode (slice intervals at 60 ticks per second).
  const DEFAULT_TICKS = { walk: 13, step: 13, climb: 13, push: 18, dig: 21, pour: 21, lever: 24, fall: 5 };
  const MOVES = ["L", "R", "U", "D"], ALL = ["L", "R", "U", "D", "DIG_L", "DIG_R", "DIG_D", "POUR_L", "POUR_R"];

  // Breadth-first search from a spec's player to any goal cell. Movement only
  // first; digging and pouring only if walking is not enough.
  // opts: {goal: [[x,y],...], limit, fallHurt, ticks}
  function reach(spec, opts) {
    const o = opts || {};
    const first = search(spec, o, MOVES);
    if (first.ok) return Object.assign(first, { needs_dig: false });
    const full = search(spec, o, ALL);
    return Object.assign(full, { needs_dig: full.ok, explored: first.explored + full.explored });
  }
  function search(spec, o, actions) {
    const T = TM(), parsed = T.parse(spec), L = parsed.level, start = parsed.state;
    const goal = new Set((o.goal || []).map(([x, y]) => x + "," + y));
    const limit = o.limit || 200000, hurt = o.fallHurt || FALL_HURT_ROWS, ticks = Object.assign({}, DEFAULT_TICKS, o.ticks || {});
    const isGoal = (s) => goal.has(s.player.x + "," + s.player.y);
    const k0 = keyOf(start);
    if (isGoal(start)) return { ok: true, actions: [], ticks: 0, explored: 1 };
    const parent = new Map([[k0, null]]), states = [start];
    for (let head = 0; head < states.length && parent.size < limit; head++) {
      const s = states[head], ks = keyOf(s);
      for (const a of actions) {
        const n = T.clone(s), r = T.act(L, n, a);
        if (!r.ok) continue;
        const dy = r.kind === "step" ? -1 : r.kind === "climb" ? (a === "U" ? -1 : 1) : 0;
        const drop = n.player.y - (s.player.y + dy);
        if (drop >= hurt && T.terrainAt(L, n, n.player.x, n.player.y + 1) !== T.T.SAND) continue;
        const kn = keyOf(n);
        if (parent.has(kn)) continue;
        parent.set(kn, { from: ks, a, kind: r.kind, drop: Math.max(0, drop) });
        if (isGoal(n)) {
          const path = [];
          let k = kn, tk = 0;
          while (parent.get(k)) { const p = parent.get(k); path.push(p.a); tk += (ticks[p.kind] || ticks.walk) + p.drop * ticks.fall; k = p.from; }
          return { ok: true, actions: path.reverse(), ticks: tk, explored: parent.size };
        }
        states.push(n);
      }
    }
    return { ok: false, actions: null, ticks: null, explored: parent.size, capped: parent.size >= limit };
  }

  // Goal cells for a feature: next to it in the same row (or on it, for the keeper in the background).
  function besides(x, y) { return [[x, y], [x - 1, y], [x + 1, y]].filter(([a]) => a >= 0 && a < W); }
  // Exits as a list of {edge, slot}.
  function exitList(exits) { const out = []; for (const e of EDGES) for (const s of exits[e] || []) out.push({ edge: e, slot: s }); return out; }

  // The placements a generator can make with this template (open-exit sets per
  // type) and, for each, the routes that must work. Returns
  // [{mirror, open, routes: [{from, to, ok, steps, ticks, ...}]}].
  function placements(t) {
    const out = [];
    for (const mirror of t.mirror ? [false, true] : [false]) {
      const list = exitList(exitsOf(t, mirror));
      const sets = [];
      if (t.type === "gate" || t.type === "home") for (const x of list) sets.push([x]);
      else for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.edge !== b.edge && (allows(t, mirror, a.edge, b.edge) || allows(t, mirror, b.edge, a.edge))) sets.push([a, b]);
      }
      for (const set of sets) {
        const open = {}; for (const x of set) open[x.edge] = x.slot;
        out.push({ mirror, open, key: placementKey(t.id, mirror, open) });
      }
    }
    return out;
  }
  function placementKey(id, mirror, open) { return id + (mirror ? "~m" : "") + ":" + EDGES.filter((e) => open[e]).map((e) => e + "." + open[e]).join("+"); }

  function checkPlacement(t, p, opts) {
    const v = variant(t, p.mirror, p.open), routes = [];
    const feat = v.spawns.find((s) => s.feature === FEATURE_OF[t.type]);
    const used = EDGES.filter((e) => v.exits[e]).map((e) => ({ edge: e, slot: v.exits[e] }));
    const run = (from, to, at, goal) => {
      const res = reach(specOf(v, at[0], at[1]), Object.assign({ goal }, opts || {}));
      routes.push({ from, to, ok: res.ok, steps: res.ok ? res.actions.length : null, ticks: res.ticks, needs_dig: !!res.needs_dig, explored: res.explored, capped: !!res.capped, actions: res.actions });
    };
    const name = (x) => x.edge + "." + x.slot;
    if (t.type === "gate") for (const x of used) run("gate", name(x), [feat.x, feat.y], innerCells(x.edge, x.slot));
    else if (t.type === "home") for (const x of used) run(name(x), "recipient", innerEntry(x.edge, x.slot), besides(feat.x, feat.y));
    else {
      for (const a of used) for (const b of used) if (a !== b && allows(t, p.mirror, a.edge, b.edge)) run(name(a), name(b), innerEntry(a.edge, a.slot), innerCells(b.edge, b.slot));
      if (t.type === "station") for (const a of used) run(name(a), "keeper", innerEntry(a.edge, a.slot), besides(feat.x, feat.y));
    }
    return { key: p.key, mirror: p.mirror, open: p.open, ok: routes.every((r) => r.ok), routes };
  }

  // Seconds a placement's route should take (reference time for the tip): the
  // route's action time plus 25 % and 1.5 s of slack, rounded up to 0.5 s.
  function parSecs(ticks, tickHz) { return Math.ceil(((ticks / (tickHz || 60)) * 1.25 + 1.5) * 2) / 2; }

  PB.rooms = { W, H, SIDE, VERT, EDGES, OPPOSITE, MIRROR_EDGE, STEP, TYPES, FEATURE_OF, TILES, COIN, FALL_HURT_ROWS, SPAWN_GAP,
    exitCells, entryCell, innerCells, innerEntry, edgeToward, validate, allows, exitsOf, variant, specOf, reach, keyOf, placements, placementKey, checkPlacement, exitList, parSecs, mirrorRows, DEFAULT_TICKS };
})(typeof window !== "undefined" ? window : globalThis);
