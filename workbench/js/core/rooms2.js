/* Delivery-mode rooms, format pushbox.room/2 (docs/design/delivery-puzzle-rules.md).
 *
 * A room is 1 x 1 to 2 x 2 screens; a screen is 20 x 10 tiles (one camera
 * view). Exits sit on screen-edge segments at the v1 slots (low / high on the
 * sides, the double-ladder "mid" shaft on top and bottom), so a 1 x 1 room of
 * this format lines up with the v1 rooms.
 *
 * This file is the specification of:
 *  - the room format, mirroring and capping of unused exits;
 *  - float blocks (game layer, no SDK): a hovering run of 2-4 tiles that never
 *    falls; walking into its end pushes the whole block one tile with the
 *    crates and the player standing on it; standing on it, the shovel jabbed at
 *    a wall it cannot dig ("pole") moves the block one tile the other way;
 *  - the puzzle check: the lab tile model (tilemodel.js) plus float blocks,
 *    breadth-first search, author solutions, "this mechanic is required"
 *    checks (search with that mechanic frozen) and hint-step traces;
 *  - ice and vents: the lab plugins (mech/ice_slide.js, freeze.js, melt.js) run
 *    inside the tile model as in level mode; this file only keeps sliding crates
 *    out of exit cells, validates and mirrors the vents and freezes all three;
 *  - hint animals: the next unfinished hint step is the first one whose `done`
 *    predicate is false; the same state always gives the same hint;
 *  - the follow camera (integer pixels).
 * Monsters, timing and damage are not modelled here (delivery-realtime.md);
 * rooms keep monsters out of the puzzle area, which is checked statically.
 * Shared by the workbench (browser, classic script) and the Node tools.
 */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  const TM = () => PB.tilemodel;

  const SW = 20, SH = 10, TILE = 16;            // one screen in tiles; tile in pixels
  const SIZES = ["1x1", "2x1", "1x2", "2x2"];   // cols x rows of screens
  const SIDE = { low: { rows: [6, 7], floor: 8, ceil: 5 }, high: { rows: [2, 3], floor: 4, ceil: 1 } };
  const VERT = { mid: { cols: [9, 10] } };
  const EDGES = ["left", "right", "top", "bottom"];
  const MIRROR_EDGE = { left: "right", right: "left", top: "top", bottom: "bottom" };
  const TYPES = ["gate", "home", "station", "room"];
  const ROLES = ["gate", "teach", "develop", "twist", "breather", "station", "home"];
  const FEATURE_OF = { gate: "gate", home: "recipient", station: "keeper" };
  const TILES = "#%es.HBI_|~=i";                // lab tile characters a v2 room may use (i = ice, mech/ice_slide.js)
  const FLOAT_CHARS = "FG";                      // float blocks (two letters so that two blocks may touch)
  const COIN = "$";
  const ACTIONS = ["L", "R", "U", "D", "DIG_L", "DIG_R", "DIG_D", "POUR_L", "POUR_R"];
  const FREEZABLE = ["float_block", "pole", "push", "dig", "pour", "lever", "seesaw", "gust", "ice_slide", "freeze", "melt"];
  const VENT = { frost_vent: "freeze", heat_vent: "melt" };  // vent device -> the mechanism (plugin) that owns it

  // ---------- exits ----------
  // Exit id: "<edge>.<segment>.<slot>", segment = screen row (left/right) or screen column (top/bottom).
  function parseExit(id) {
    const [edge, seg, slot] = String(id).split(".");
    return { edge, seg: Number(seg), slot };
  }
  function isSide(edge) { return edge === "left" || edge === "right"; }
  function exitCells(W, H, id) {
    const { edge, seg, slot } = parseExit(id);
    if (isSide(edge)) { const x = edge === "left" ? 0 : W - 1; return SIDE[slot].rows.map((r) => [x, seg * SH + r]); }
    const y = edge === "top" ? 0 : H - 1;
    return VERT[slot].cols.map((c) => [seg * SW + c, y]);
  }
  function innerCells(W, H, id) {
    const { edge } = parseExit(id);
    return exitCells(W, H, id).map(([x, y]) => (isSide(edge) ? [edge === "left" ? 1 : W - 2, y] : [x, edge === "top" ? 1 : H - 2]));
  }
  // Where the player stands right after coming in through an exit (feet on the floor, or on the shaft ladder).
  function entryCell(W, H, id) {
    const { edge, seg, slot } = parseExit(id);
    if (isSide(edge)) return [edge === "left" ? 0 : W - 1, seg * SH + SIDE[slot].rows[1]];
    return [seg * SW + VERT[slot].cols[0], edge === "top" ? 0 : H - 1];
  }
  function mirrorExit(id, cols) {
    const { edge, seg, slot } = parseExit(id);
    return [MIRROR_EDGE[edge], isSide(edge) ? seg : cols - 1 - seg, slot].join(".");
  }
  function sizeOf(room) { const [c, r] = room.size || [1, 1]; return { cols: c, rows: r, W: c * SW, H: r * SH }; }

  // ---------- validation ----------
  function validate(room) {
    const out = [], add = (m) => out.push(m);
    if (room.format !== "pushbox.room/2") add("format 应为 pushbox.room/2");
    if (!TYPES.includes(room.type)) add("type 应为 " + TYPES.join(" / "));
    if (room.role && !ROLES.includes(room.role)) add("role 应为 " + ROLES.join(" / "));
    const sz = room.size || [1, 1];
    if (!SIZES.includes(sz.join("x"))) add("size 只能是 1x1、2x1、1x2、2x2 屏");
    const { cols, rows, W, H } = sizeOf(room);
    const map = room.map || [];
    if (map.length !== H) add(`map 应为 ${H} 行（现在 ${map.length}）`);
    map.forEach((r, y) => { if (r.length !== W) add(`第 ${y} 行应为 ${W} 列（现在 ${r.length}）`); });
    if (out.length) return out;
    const legend = room.legend || {};
    const counts = {};
    map.forEach((r, y) => [...r].forEach((ch, x) => {
      if (/\d/.test(ch)) {
        const L = legend[ch];
        if (!L) add(`(${x},${y}) 的 ${ch} 没有写在 legend 里`);
        else { const k = L.monster ? "monster" : L.feature || (L.animal ? "animal" : "?"); counts[k] = (counts[k] || 0) + 1; }
      } else if (!TILES.includes(ch) && !FLOAT_CHARS.includes(ch) && ch !== COIN) add(`(${x},${y}) 不能用字符 '${ch}'`);
    }));
    const want = FEATURE_OF[room.type];
    for (const f of ["gate", "recipient", "keeper"]) {
      const n = counts[f] || 0;
      if (f === want && n !== 1) add(`${room.type} 房间要正好一个 ${f}（现在 ${n}）`);
      if (f !== want && n) add(`${room.type} 房间不能有 ${f}`);
    }
    // Float blocks: horizontal runs of 2-4 tiles.
    for (const f of floatsOf(map)) if (f.w < 2 || f.w > 4) add(`浮空地块 (${f.x},${f.y}) 宽 ${f.w}，应为 2–4 格`);
    // Exits.
    const exits = room.exits || [];
    if (room.type === "room" && exits.length < 2) add("普通房间至少要有两个出入口");
    if (room.type !== "room" && exits.length < 1) add("至少要有一个出入口");
    for (const id of exits) {
      const { edge, seg, slot } = parseExit(id);
      if (!EDGES.includes(edge) || !(isSide(edge) ? SIDE[slot] : VERT[slot])) { add("出入口写法不对：" + id); continue; }
      if (!(seg >= 0 && seg < (isSide(edge) ? rows : cols))) { add("出入口段号超出房间：" + id); continue; }
      const at = (x, y) => (map[y] || "")[x];
      for (const [x, y] of exitCells(W, H, id)) {
        const c = at(x, y);
        if (isSide(edge) ? c !== "." : c !== "H") add(`${id}：开口 (${x},${y}) 应为 ${isSide(edge) ? "空" : "梯子"}，现在是 '${c}'`);
      }
      for (const [x, y] of innerCells(W, H, id)) {
        const c = at(x, y);
        if (isSide(edge) ? !".$".includes(c) : c !== "H") add(`${id}：开口里面一格 (${x},${y}) 应为 ${isSide(edge) ? "空" : "梯子"}`);
      }
      if (isSide(edge)) {
        const x = edge === "left" ? 0 : W - 1, S = SIDE[slot];
        if (at(x, seg * SH + S.floor) !== "#") add(`${id}：开口脚下应为基岩`);
        if (at(x, seg * SH + S.ceil) !== "#") add(`${id}：开口头顶应为基岩`);
      }
    }
    // Border must be bedrock except at exits.
    const open = new Set(); for (const id of exits) for (const [x, y] of exitCells(W, H, id)) open.add(y * W + x);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (x > 0 && y > 0 && x < W - 1 && y < H - 1) continue;
      if (!open.has(y * W + x) && map[y][x] !== "#") add(`边框 (${x},${y}) 应为基岩（不是出入口）`);
    }
    const endOk = (id, special) => exits.includes(id) || id === special;
    for (const r of room.routes || []) {
      const [a, b] = r.split(">");
      if (!endOk(a, room.type === "gate" ? "gate" : null) || !endOk(b, room.type === "home" ? "recipient" : null) || a === b) add("routes 用了不存在的出入口：" + r);
    }
    if (!(room.routes || []).length) add("至少要写一条 routes（检查过的走法）");
    for (const [k, L] of Object.entries(legend)) if (L.monster && L.zone && !(L.zone.length === 2)) add(`legend ${k}：zone 应为 [x0, x1]`);
    const cell = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isInteger) && p[0] >= 0 && p[0] < W && p[1] >= 0 && p[1] < H;
    const devices = room.devices || [];
    for (const [k, d] of devices.entries()) if (VENT[d.type]) {
      // Frost / heat vents as in the lab (F02, F03, F09): a cell, an area inside the room, and a switch.
      const a = d.area;
      if (!cell(d.at)) add(`devices[${k}] ${d.type}：at 必须是房间内的格子`);
      if (!Array.isArray(a) || a.length !== 4 || !a.every(Number.isInteger) || a[2] < 1 || a[3] < 1 || a[0] < 0 || a[1] < 0 || a[0] + a[2] > W || a[1] + a[3] > H) {
        add(`devices[${k}] ${d.type}：area 必须是 [x, y, 宽, 高] 四个整数，宽高至少 1，整块在房间内`);
      }
      const switched = devices.some((e) => (e.type === "lever" && e.action && e.action.device === k) || (e.type === "bin" && e.trigger && e.trigger.device === k));
      if (!switched) add(`devices[${k}] ${d.type}：没有开关（拉杆的 action.device 或沟的 trigger.device 要指向它）`);
    }
    for (const [k, d] of devices.entries()) if (d.type === "seesaw") {
      if (!Array.isArray(d.ends) || d.ends.length !== 2 || !d.ends.every(cell) || !Number.isInteger(d.height) || d.height < 1) {
        add(`devices[${k}] seesaw：ends 必须是两个房间内的格子，height 必须是正整数`);
        continue;
      }
      if (!Array.isArray(d.landings) || d.landings.length !== 2 || d.landings.some((p, side) => !cell(p) || Math.abs(p[0] - d.ends[side][0]) !== 1 || p[1] !== d.ends[side][1] - 1 - d.height)) {
        add(`devices[${k}] seesaw：landings 必须从端点上那格竖升 height 格后横移一格`);
      }
    }
    return out;
  }

  function floatsOf(rows) {
    const out = [];
    rows.forEach((r, y) => {
      let x = 0;
      while (x < r.length) {
        const ch = r[x];
        if (FLOAT_CHARS.includes(ch)) { let w = 1; while (r[x + w] === ch) w++; out.push({ n: out.length, x, y, w, ch }); x += w; } else x++;
      }
    });
    return out;
  }

  // ---------- variants ----------
  const MX = (W, x) => W - 1 - x;
  function mirrorPred(p, W) {
    if (!p || typeof p !== "object") return p;
    const q = {};
    for (const [k, v] of Object.entries(p)) {
      if (k === "all" || k === "any") q[k] = v.map((x) => mirrorPred(x, W));
      else if (k === "not") q[k] = mirrorPred(v, W);
      else if (k === "player" && v.length === 4) q[k] = [MX(W, v[2]), v[1], MX(W, v[0]), v[3]];
      else if (["covers", "crate", "empty", "sand", "at", "target"].includes(k) && Array.isArray(v) && typeof v[0] === "number") q[k] = [MX(W, v[0]), v[1]];
      else q[k] = v;
    }
    return q;
  }
  const MIRROR_ACT = { L: "R", R: "L", DIG_L: "DIG_R", DIG_R: "DIG_L", POUR_L: "POUR_R", POUR_R: "POUR_L" };
  function mirrorActions(list) { return list.map((t) => t.replace(/^(DIG_|POUR_)?([LR])(?=$|\*)/, (m) => MIRROR_ACT[m] || m)); }
  function expand(tokens) {
    const out = [];
    for (const t of tokens || []) {
      const m = /^([A-Z_]+)(?:\*(\d+))?$/.exec(t);
      if (!m) throw new Error("bad action token " + t);
      for (let i = 0; i < Number(m[2] || 1); i++) out.push(m[1]);
    }
    return out;
  }

  // open: list of exit ids (in the variant's own frame, i.e. after mirroring) that stay open; null = all.
  function variant(room, mirror, open) {
    const { cols, rows, W, H } = sizeOf(room);
    const flip = !!mirror && room.mirror !== false;
    const rowsArr = room.map.map((r) => (flip ? [...r].reverse() : [...r]));
    const allExits = (room.exits || []).map((id) => (flip ? mirrorExit(id, cols) : id));
    const openSet = new Set(open == null ? allExits : open.filter((id) => allExits.includes(id)));
    // Cap closed exits: their opening cells become bedrock, then the room's caps patches apply.
    for (const id of allExits) if (!openSet.has(id)) {
      for (const [x, y] of exitCells(W, H, id)) rowsArr[y][x] = "#";
      const base = flip ? mirrorExit(id, cols) : id;
      for (const [x0, y0, w, h, ch] of ((room.caps || {})[base] || [])) for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) rowsArr[y][flip ? MX(W, x) : x] = ch;
    }
    const legend = room.legend || {};
    const spawns = [], coins = [];
    rowsArr.forEach((r, y) => r.forEach((ch, x) => {
      if (/\d/.test(ch)) {
        const L = Object.assign({}, legend[ch]);
        if (L.dir && flip) L.dir = L.dir === "left" ? "right" : "left";
        if (L.zone && flip) L.zone = [MX(W, L.zone[1]), MX(W, L.zone[0])];
        if (L.perch && flip) L.perch = L.perch.map(([px, py]) => [MX(W, px), py]);
        spawns.push(Object.assign({ x, y, key: ch }, L));
      } else if (ch === COIN) coins.push([x, y]);
    }));
    // Float blocks keep the ids of the unmirrored map.
    const floats = floatsOf(room.map).map((f) => (flip ? Object.assign({}, f, { x: W - f.x - f.w }) : Object.assign({}, f)));
    const mp = (xy) => (flip ? [MX(W, xy[0]), xy[1]] : xy.slice());
    const devices = (room.devices || []).map((d) => {
      const o = JSON.parse(JSON.stringify(d));
      if (o.at) o.at = mp(o.at); if (o.button) o.button = mp(o.button); if (o.pads) o.pads = o.pads.map(mp);
      if (o.cells) o.cells = o.cells.map(mp); if (o.stops) o.stops = o.stops.map((s) => (flip ? [W - s[0] - (o.width || 1), s[1]] : s.slice()));
      if (o.ends) o.ends = o.ends.map(mp); if (o.landings) o.landings = o.landings.map(mp);
      if (flip && o.type === "gust") {
        o.area[0] = W - o.area[0] - o.area[2];
        o.direction = MIRROR_ACT[o.direction] || o.direction;
      }
      if (flip && VENT[o.type]) {
        o.area[0] = W - o.area[0] - o.area[2];
        if (o.direction) o.direction = MIRROR_ACT[o.direction] || o.direction;
      }
      if (flip && o.type === "bin" && o.rect) o.rect[0] = W - o.rect[0] - o.rect[2];
      return o;
    });
    const links = room.links ? room.links.map((g) => Object.assign({}, g, { plates: (g.plates || []).map(mp), doors: (g.doors || []).map(mp) })) : undefined;
    const hints = (room.hints || []).map((h) => (flip ? Object.assign({}, h, { target: h.target && mp(h.target), done: mirrorPred(h.done, W), show: h.show && Object.assign({}, h.show, { at: h.show.at && mp(h.show.at), dir: h.show.dir && (MIRROR_ACT[h.show.dir] || h.show.dir) }) }) : JSON.parse(JSON.stringify(h))));
    const areas = (room.puzzle_area || []).map(([x0, y0, x1, y1]) => (flip ? [MX(W, x1), y0, MX(W, x0), y1] : [x0, y0, x1, y1]));
    return { id: room.id, room, mirror: flip, cols, rows, W, H, rows_: rowsArr, map: rowsArr.map((r) => r.join("")), exits: allExits, open: [...openSet], spawns, coins, floats, devices, links, hints, areas };
  }

  // ---------- puzzle model (tile model + float blocks) ----------
  // from: exit id (player enters there) or "gate"; to: exit id, "recipient", or null (free play).
  // A frozen vent still fires (its switch works as before) but its area is empty: nothing freezes or melts.
  const freezesDevices = (frozen) => !!frozen && (frozen.has("seesaw") || frozen.has("gust") || frozen.has("freeze") || frozen.has("melt"));
  function frozenDevices(devices, frozen) {
    if (!freezesDevices(frozen)) return devices;
    return devices.map((d) => d.type === "seesaw" && frozen.has("seesaw") ? Object.assign({}, d, { threshold: Infinity })
      : d.type === "gust" && frozen.has("gust") ? Object.assign({}, d, { light_kinds: [] })
      : VENT[d.type] && frozen.has(VENT[d.type]) ? Object.assign({}, d, { area: [d.area[0], d.area[1], 0, 0] }) : d);
  }
  function start(v, from, to, bag, frozen) {
    const rows = v.map.map((r) => [...r].map((ch) => (/\d/.test(ch) || ch === COIN ? "." : FLOAT_CHARS.includes(ch) ? "#" : ch)));
    let px, py;
    if (from === "gate") { const g = v.spawns.find((s) => s.feature === "gate"); px = g.x; py = g.y; }
    else [px, py] = entryCell(v.W, v.H, from);
    rows[py][px] = rows[py][px] === "H" ? "h" : "P";
    const spec = { id: v.id, map: rows.map((r) => r.join("")), bag: Object.assign({ sand: 0, bomb: 0 }, bag || {}), links: v.links, devices: frozenDevices(v.devices, frozen) };
    // The runtime parser runs device setup before its initial settle. Do not
    // reset that baseline afterwards: a resting load must never launch twice.
    const parsed = TM().parse(spec);
    const L = parsed.level, s = parsed.state;
    s.floats = v.floats.map((f) => ({ n: f.n, x: f.x, y: f.y, w: f.w }));
    const exitSet = new Set();
    for (const id of v.open) for (const [x, y] of exitCells(v.W, v.H, id)) exitSet.add(y * v.W + x);
    let goal = null;
    if (to === "recipient") { const r = v.spawns.find((q) => q.feature === "recipient"); goal = new Set([r.y * v.W + r.x]); }
    else if (to) goal = new Set(exitCells(v.W, v.H, to).map(([x, y]) => y * v.W + x));
    const deviceCells = new Set();
    for (const d of v.devices || []) for (const c of [d.at, d.button, ...(d.pads || []), ...(d.ends || [])].filter(Boolean)) deviceCells.add(c[1] * v.W + c[0]);
    return { v, L, s, spec, t0: s.terrain.slice(), exitSet, goal, deviceCells, from, to };
  }
  function clone(s) { const n = TM().clone(s); n.floats = s.floats.map((f) => ({ n: f.n, x: f.x, y: f.y, w: f.w })); return n; }
  const OPENT = (t) => { const T = TM().T; return t === T.EMPTY || t === T.WATER || t === T.ACID || t === T.SMOKE || t === T.FOG; };
  const isPlayer = (s, x, y) => s.player.x === x && s.player.y === y;
  function platformAt(M, s, x, y) {
    return TM().liftDeck(M.L, s, x, y) >= 0 || TM().bridgeAt(M.L, s, x, y) >= 0
      || (TM().plugins || []).some((p) => typeof p.solid === "function" && p.solid(M.L, s, x, y));
  }
  function free(M, s, x, y) { return OPENT(TM().terrainAt(M.L, s, x, y)) && !TM().crateAt(s, x, y) && !isPlayer(s, x, y) && !platformAt(M, s, x, y); }
  function supports(M, s, x, y) { const t = TM().terrainAt(M.L, s, x, y); return (t !== TM().T.EMPTY && !OPENT(t)) || !!TM().crateAt(s, x, y) || platformAt(M, s, x, y); }
  function floatAt(s, x, y) { for (const f of s.floats) if (y === f.y && x >= f.x && x < f.x + f.w) return f; return null; }
  function inside(M, x, y) { return x >= 0 && y >= 0 && x < M.v.W && y < M.v.H; }
  // A cell a float block may move into: open dry air with nothing in it, no marker, no device, not an exit.
  function floatCellOk(M, s, x, y) {
    if (!inside(M, x, y)) return false;
    const i = y * M.v.W + x;
    return TM().terrainAt(M.L, s, x, y) === TM().T.EMPTY && !TM().crateAt(s, x, y) && !isPlayer(s, x, y) && !platformAt(M, s, x, y)
      && M.L.marker[i] === 0 && !M.deviceCells.has(i) && !M.exitSet.has(i);
  }
  // Crates (stacked) and the player resting on the block move with it; loose sand and water do not.
  function riders(M, s, f) {
    const crates = [], seen = new Set(); let player = false;
    for (let x = f.x; x < f.x + f.w; x++) {
      for (let y = f.y - 1; y >= 0; y--) {
        const c = TM().crateAt(s, x, y);
        if (c) { if (!seen.has(c)) { seen.add(c); crates.push(c); } continue; }
        if (isPlayer(s, x, y) && !TM().ladder(M.L, x, y)) player = true;
        break;
      }
    }
    return { crates, player };
  }
  function moveFloat(M, s, f, dx, pusher) {
    const lead = dx > 0 ? f.x + f.w : f.x - 1;
    if (!floatCellOk(M, s, lead, f.y)) return false;
    const R = riders(M, s, f), W = M.v.W;
    const moving = new Set(R.crates.map((c) => c.y * W + c.x));
    if (R.player) moving.add(s.player.y * W + s.player.x);
    const ok = (x, y, crate) => moving.has(y * W + x) || (free(M, s, x, y) && !(crate && M.exitSet.has(y * W + x)) && !(y === f.y && x === lead));
    for (const c of R.crates) if (!ok(c.x + dx, c.y, true)) return false;
    if (R.player && !ok(s.player.x + dx, s.player.y, false)) return false;
    const T = TM().T;
    for (let x = f.x; x < f.x + f.w; x++) s.terrain[f.y * W + x] = T.EMPTY;
    f.x += dx;
    for (let x = f.x; x < f.x + f.w; x++) s.terrain[f.y * W + x] = T.ROCK;
    for (const c of R.crates) c.x += dx;
    if (R.player || pusher) s.player.x += dx;
    return true;
  }
  // Falls of FALL_HURT rows or more hurt in delivery mode unless they land on sand: routes may not use them.
  const FALL_HURT = 3;
  function finish(M, s, kind, frozen) {
    return withDeviceFeedback(M, s, frozen, () => {
      s.moves += 1; const y0 = s.player.y, events = TM().settle(M.L, s);
      let changed = false;
      for (const p of TM().plugins || []) if (typeof p.afterAction === "function" && p.afterAction(M.L, s, kind, events)) changed = true;
      if (changed) events.push(...TM().settle(M.L, s));
      return { ok: true, kind, events, drop: s.player.y - y0 };
    });
  }
  function hurts(M, s, r) { return r.drop >= FALL_HURT && TM().terrainAt(M.L, s, s.player.x, s.player.y + 1) !== TM().T.SAND; }
  // Observe each plugin's state write, including intermediate settle rounds.
  // A later gust can empty a pad that already fired during this same action.
  // The temporary view is always removed, including when a plugin throws.
  function withDeviceFeedback(M, s, frozen, run) {
    if (!M.L.devices.some((d) => ((d.type === "seesaw" || d.type === "gust") && !frozen.has(d.type)) || (VENT[d.type] && !frozen.has(VENT[d.type])))) return run();
    const dev = s.dev, deviceEvents = [];
    const note = (type, device, side) => {
      if (!deviceEvents.some((e) => e.type === type && e.device === device && e.side === side)) deviceEvents.push(side === undefined ? { type, device } : { type, device, side });
    };
    s.dev = new Proxy(dev, { set(target, prop, value) {
      const k = typeof prop === "string" && /^\d+$/.test(prop) ? Number(prop) : -1, d = M.L.devices[k], old = target[prop] || 0;
      if (d && VENT[d.type] && !frozen.has(VENT[d.type]) && value && !old) note(d.type, k); // the vent fires (its plugin resets it in settle)
      if (d && !frozen.has(d.type)) {
        if (d.type === "gust" && (value + (d.phase | 0)) % Math.max(1, d.period | 0) === 0) note("gust", k);
        if (d.type === "seesaw") d.ends.forEach(([x, y], side) => {
          const load = (value >> (side * 4)) & 15, before = (old >> (side * 4)) & 15;
          if (load <= before || load < (d.threshold || 1)) return;
          const source = isPlayer(s, x, y - 1) ? s.player : TM().crateAt(s, x, y - 1), playerAt = (old / 256 | 0) - 1;
          const t = TM().terrainAt(M.L, s, x, y - 1);
          const fell = source === s.player ? playerAt % M.L.w === x && (playerAt / M.L.w | 0) < source.y
            : source ? source.seesawX === x && source.seesawY < source.y : t === TM().T.SAND || t === TM().T.GRAVEL;
          if (fell) note("seesaw", k, side);
        });
      }
      return Reflect.set(target, prop, value);
    } });
    try {
      const r = run();
      if (r.ok && deviceEvents.length) r.deviceEvents = deviceEvents;
      return r;
    } finally { s.dev = dev; }
  }
  // Ice (mech/ice_slide.js): a crate pushed onto ice slides inside TM.act, the lab's
  // code and order. Two v2 rules the plugin cannot know are applied here with the
  // same steps: a sliding crate never enters an exit cell (it stops in front of
  // it), and with ice_slide frozen a push moves the crate one tile. Returns null
  // when the plugin may run unchanged.
  function icePush(M, s, c, dx, fz) {
    const L = M.L, T = TM().T, frozen = fz.has("ice_slide");
    if (!(TM().plugins || []).some((pl) => pl.id === "ice_slide")) return null;
    if (!TM().free(L, s, c.x + dx, c.y) || TM().terrainAt(L, s, c.x + dx, c.y + 1) !== T.ICE) return null;
    const exit = (x, y) => M.exitSet.has(y * M.v.W + x);
    const slide = (n, crate, keepOut) => {
      let entered = false;
      const enter = () => {
        const into = crate.y * L.w + crate.x + dx;
        if (keepOut && exit(crate.x + dx, crate.y)) return false;
        if (n.terrain[into] === T.WATER && !TM().displace(L, n, into)) return false;
        crate.x += dx; if (exit(crate.x, crate.y)) entered = true;
        return true;
      };
      const oldX = crate.x;
      if (!enter()) return null;
      n.player.x = oldX;
      while (!frozen && TM().terrainAt(L, n, crate.x, crate.y + 1) === T.ICE && TM().free(L, n, crate.x + dx, crate.y)) if (!enter()) break;
      return entered;
    };
    if (!frozen) { const n = clone(s); if (!slide(n, TM().crateAt(n, c.x, c.y), false)) return null; }
    if (slide(s, c, true) === null) return { ok: false, reason: "blocked" };
    return finish(M, s, "push", fz);
  }
  // frozen: Set of mechanics that are switched off (for "required" checks).
  function act(M, s, a, frozen) {
    const fz = frozen || new Set();
    // Keep the same solid endpoints and setup history while disabling their
    // impulse. The per-action level view never mutates the room or plugins.
    if (freezesDevices(fz)) M = Object.assign({}, M, { L: Object.assign({}, M.L, {
      devices: frozenDevices(M.L.devices, fz),
    }) });
    return actStep(M, s, a, fz);
  }
  function actStep(M, s, a, frozen) {
    const T = TM().T, p = s.player, fz = frozen || new Set();
    if (a.startsWith("BOMB")) return { ok: false, reason: "no-bomb" };
    if (a === "L" || a === "R") {
      const dx = a === "L" ? -1 : 1, nx = p.x + dx;
      const f = floatAt(s, nx, p.y);
      if (f && !fz.has("float_block")) {
        const n = clone(s);
        if (moveFloat(M, n, floatAt(n, nx, p.y), dx, true)) { Object.assign(s, n); return finish(M, s, "float-push", fz); }
      }
      const c = TM().crateAt(s, nx, p.y);
      const blockedCrate = c && (fz.has("push") || (free(M, s, nx + dx, p.y) && M.exitSet.has(p.y * M.v.W + nx + dx)));
      if (blockedCrate || f) {
        // Behaves like a wall: only a step up is possible.
        if (supports(M, s, nx, p.y) && free(M, s, p.x, p.y - 1) && free(M, s, nx, p.y - 1)) { p.x = nx; p.y -= 1; return finish(M, s, "step", fz); }
        return { ok: false, reason: "blocked" };
      }
      const r = c && icePush(M, s, c, dx, fz);
      if (r) return r;
    }
    if (a === "U" && fz.has("lever") && M.L.leverAt.has(p.y * M.v.W + p.x) && !TM().ladder(M.L, p.x, p.y)) return { ok: false, reason: "frozen" };
    if (a === "DIG_L" || a === "DIG_R") {
      const dx = a === "DIG_L" ? -1 : 1, tx = p.x + dx, t = TM().terrainAt(M.L, s, tx, p.y);
      const under = floatAt(s, p.x, p.y + 1);
      const anchor = (t === T.ROCK || t === T.CRACKED || t === T.HARD || t === T.DOOR) && !floatAt(s, tx, p.y);
      if (under && anchor && !TM().ladder(M.L, p.x, p.y)) {
        if (fz.has("float_block") || fz.has("pole")) return { ok: false, reason: "frozen" };
        return moveFloat(M, s, under, -dx, false) ? finish(M, s, "pole", fz) : { ok: false, reason: "pole-blocked" };
      }
    }
    if (a.startsWith("DIG") && fz.has("dig")) return { ok: false, reason: "frozen" };
    if (a.startsWith("POUR")) {
      if (fz.has("pour")) return { ok: false, reason: "frozen" };
      const dx = a === "POUR_L" ? -1 : 1;
      if (M.exitSet.has(p.y * M.v.W + p.x + dx)) return { ok: false, reason: "cannot-pour" };
    }
    const y0 = s.player.y, r = withDeviceFeedback(M, s, fz, () => TM().act(M.L, s, a));
    if (r.ok) { const own = r.kind === "climb" ? (a === "D" ? 1 : -1) : r.kind === "step" ? -1 : 0; r.drop = s.player.y - y0 - own; }
    // Riding a lift down is not a fall.
    if (r.ok && (r.events || []).includes("lift") && TM().liftDeck(M.L, s, s.player.x, s.player.y + 1) >= 0) r.drop = 0;
    return r;
  }
  function atGoal(M, s) { return !!M.goal && M.goal.has(s.player.y * M.v.W + s.player.x); }
  function key(M, s) {
    let k = s.player.x + "," + s.player.y + "|" + s.bag.sand + "|";
    k += s.crates.map((c) => c.kind[0] + c.x + "," + c.y).sort().join(";") + "|" + s.open.join("") + "|" + s.dev.join("") + "|" + s.held.join(",") + "|" + s.warped.slice().sort((a, b) => a - b).join(",") + "|";
    const t0 = M.t0; let d = "";
    for (let i = 0; i < t0.length; i++) if (s.terrain[i] !== t0[i]) d += i + ":" + s.terrain[i] + ",";
    return k + d;
  }
  // Breadth-first search for the shortest way from `from` to `to`.
  function solve(v, from, to, opts) {
    const o = opts || {}, frozen = new Set(o.frozen || []), M = start(v, from, to, o.bag, frozen);
    const max = o.limit || 200000, acts = o.actions || ACTIONS;
    const k0 = key(M, M.s), parents = new Map([[k0, null]]);
    let frontier = [M.s];
    while (frontier.length) {
      const next = [];
      for (const s of frontier) {
        if (atGoal(M, s)) return { solved: true, solution: rebuild(parents, key(M, s)), explored: parents.size };
        for (const a of acts) {
          const n = clone(s);
          const r = act(M, n, a, frozen);
          if (!r.ok || hurts(M, n, r)) continue;
          const k = key(M, n);
          if (parents.has(k)) continue;
          parents.set(k, [key(M, s), a]);
          if (parents.size >= max) return { solved: false, explored: parents.size, exhausted: false };
          next.push(n);
        }
      }
      frontier = next;
    }
    return { solved: false, explored: parents.size, exhausted: true };
  }
  function rebuild(parents, k) { const out = []; let e; while ((e = parents.get(k))) { out.push(e[1]); k = e[0]; } return out.reverse(); }
  // Replays actions; returns per-step states (for previews, hint traces and checks).
  function replay(v, from, to, actions, opts) {
    const o = opts || {}, frozen = new Set(o.frozen || []), M = start(v, from, to, o.bag, frozen);
    const steps = [{ action: null, state: clone(M.s), result: null }];
    let s = M.s;
    for (const a of actions) {
      const n = clone(s), r = act(M, n, a, frozen);
      if (!r.ok) return { M, steps, failedAt: steps.length - 1, reason: r.reason, action: a, reached: false };
      if (hurts(M, n, r)) return { M, steps, failedAt: steps.length - 1, reason: "摔伤（落下 " + r.drop + " 格）", action: a, reached: false };
      steps.push({ action: a, state: clone(n), result: r }); s = n;
      if (o.stopAtGoal !== false && atGoal(M, s)) break;
    }
    return { M, steps, reached: atGoal(M, s) };
  }

  // ---------- hints ----------
  function holds(M, s, p) {
    if (!p) return false;
    if (p.all) return p.all.every((q) => holds(M, s, q));
    if (p.any) return p.any.some((q) => holds(M, s, q));
    if (p.not) return !holds(M, s, p.not);
    const W = M.v.W, T = TM().T;
    if (p.covers) { const f = floatAt(s, p.covers[0], p.covers[1]); return !!f && (p.float === undefined || f.n === p.float); }
    if (p.crate) { const c = TM().crateAt(s, p.crate[0], p.crate[1]); return !!c && (!p.kind || c.kind === p.kind); }
    if (p.player) { const [x0, y0, x1, y1] = p.player, q = s.player; return q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1; }
    if (p.empty) return s.terrain[p.empty[1] * W + p.empty[0]] === T.EMPTY;
    if (p.sand) return s.terrain[p.sand[1] * W + p.sand[0]] === T.SAND;
    if (p.door !== undefined) return !!s.open[p.door];
    if (p.lever !== undefined) return !!s.dev[p.lever];
    if (p.device !== undefined) return (s.dev[p.device] || 0) === (p.value === undefined ? 1 : p.value); // bridge broken, lift at stop 1
    if (p.bag_sand !== undefined) return s.bag.sand >= p.bag_sand;
    throw new Error("unknown hint predicate " + JSON.stringify(p));
  }
  // Index of the first unfinished hint step (hints.length when all are done).
  function nextHint(M, s) { const H = M.v.hints; for (let i = 0; i < H.length; i++) if (!holds(M, s, H[i].done)) return i; return H.length; }
  // Along a replay: when each step first becomes done, and whether they finish in order.
  function hintTrace(rep) {
    const M = rep.M, H = M.v.hints, first = H.map(() => -1);
    rep.steps.forEach((st, t) => H.forEach((h, i) => { if (first[i] < 0 && holds(M, st.state, h.done)) first[i] = t; }));
    const problems = [];
    if (H.length && holds(M, rep.steps[0].state, H[0].done)) problems.push("第 1 步一开始就已完成");
    first.forEach((t, i) => { if (t < 0) problems.push(`提示第 ${i + 1} 步在作者解里从没完成`); else if (i && first[i - 1] > t) problems.push(`提示第 ${i + 1} 步比第 ${i} 步先完成`); });
    const seq = rep.steps.map((st) => nextHint(M, st.state));
    return { first, seq, ok: problems.length === 0, problems };
  }

  // ---------- monsters stay out of the puzzle ----------
  function monsterProblems(v) {
    const out = [];
    for (const sp of v.spawns.filter((q) => q.monster)) {
      const [x0, x1] = sp.zone || [sp.x, sp.x];
      for (const [ax0, ay0, ax1, ay1] of v.areas) if (sp.y >= ay0 && sp.y <= ay1 && x1 >= ax0 && x0 <= ax1) out.push(`怪物 ${sp.monster}（${sp.x},${sp.y}）的巡逻范围进入了解谜区`);
    }
    return out;
  }

  // ---------- camera ----------
  // Integer pixel follow camera for rooms larger than one screen. view = 320 x 160 (below the HUD).
  const CAM = { viewW: 320, viewH: 160, deadHalf: 24, look: 32, lookDelay: 12, ease: 3, maxStep: 8, fallMargin: 40 };
  function camTarget(cam, px, py) {
    return [px + TILE / 2 + cam.lookX - (CAM.viewW >> 1), cam.groundY + TILE - (CAM.viewH * 5 >> 3)];
  }
  function clampCam(v, x, y) { return [Math.max(0, Math.min(v.W * TILE - CAM.viewW, x)), Math.max(0, Math.min(v.H * TILE - CAM.viewH, y))]; }
  // State: {x, y, lookX, facing, run, groundY}; player position in pixels (top-left of its tile).
  function cameraStart(v, px, py, facing) {
    const cam = { x: 0, y: 0, lookX: 0, facing: facing || 1, run: 0, groundY: py };
    const [tx, ty] = camTarget(cam, px, py); [cam.x, cam.y] = clampCam(v, tx, ty);
    return cam;
  }
  // Called once per tick. grounded: standing on something or on a ladder.
  function cameraStep(v, cam, px, py, facing, grounded) {
    if (facing !== cam.facing) { cam.facing = facing; cam.run = 0; }
    cam.run = Math.min(CAM.lookDelay, cam.run + 1);
    const wantLook = cam.run >= CAM.lookDelay ? facing * CAM.look : cam.lookX;
    cam.lookX += Math.sign(wantLook - cam.lookX) * Math.min(2, Math.abs(wantLook - cam.lookX));
    // Vertical "platform snapping": follow the ground the player stands on; while falling, only keep him inside the view.
    if (grounded) cam.groundY = py;
    else if (py + TILE > cam.y + CAM.viewH - CAM.fallMargin) cam.groundY = py;
    let [tx, ty] = camTarget(cam, px, py);
    // Horizontal dead zone around the view centre.
    const cx = cam.x + (CAM.viewW >> 1), fx = px + TILE / 2 + cam.lookX;
    if (Math.abs(fx - cx) <= CAM.deadHalf) tx = cam.x; else tx = cam.x + (fx - cx) - Math.sign(fx - cx) * CAM.deadHalf;
    [tx, ty] = clampCam(v, tx, ty);
    const ease = (from, to) => { const d = to - from; if (!d) return from; const st = Math.sign(d) * Math.min(CAM.maxStep, Math.max(1, Math.abs(d) >> CAM.ease)); return from + st; };
    cam.x = ease(cam.x, tx); cam.y = ease(cam.y, ty);
    return cam;
  }

  PB.rooms2 = { SW, SH, TILE, SIZES, SIDE, VERT, EDGES, TYPES, ROLES, ACTIONS, FREEZABLE, FLOAT_CHARS, CAM,
    parseExit, exitCells, innerCells, entryCell, mirrorExit, sizeOf, validate, floatsOf, variant, expand, mirrorActions, mirrorPred,
    start, clone, act, hurts, FALL_HURT, key, solve, replay, atGoal, floatAt, riders, holds, nextHint, hintTrace, monsterProblems,
    cameraStart, cameraStep, clampCam };
})(typeof window !== "undefined" ? window : globalThis);
