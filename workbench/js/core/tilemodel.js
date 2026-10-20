/* Design model of the tile-level rules (docs/design/game-design.md §4).
 *
 * This is NOT the SDK. It predicts what each player action should do at the
 * tile level so that level specs can be checked for solvability, step counts
 * and dead ends before anyone builds them in Godot. Loose sand, water, fire
 * and every other SDK material must still be verified in the real SDK.
 *
 * Modelled: chapter 1 rules (push, ladder, dig, pour, plates and doors, falling),
 * tile-level water (§4.9: flows down, spills off edges, levels out between
 * connected basins, is pushed aside by crates and sand, lifts wood crates) and
 * the chapter 2 devices (§6.5: lever, lift with button, collection bin, release,
 * portal pair, load bridge). Explosions only clear tiles; gases, reactions and
 * heat are NOT modelled (their materials are parsed so maps can be drawn).
 *
 * Shared by the workbench (browser, classic script) and the Node tools.
 */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});

  // Terrain codes (static map layer). DOOR is never stored in the terrain: doors
  // are an overlay (L.doorAt) so water can flow through an open gate.
  const T = { EMPTY: 0, ROCK: 1, CRACKED: 2, EARTH: 3, SAND: 4, WATER: 5, DOOR: 6,
    GRAVEL: 7, FUSE: 8, ACID: 9, LIME_A: 10, LIME_B: 11, HARD: 12, SMOKE: 13, FOG: 14, PLUG: 15, WOOD: 16, ICE: 17 };
  // Background markers (do not block).
  const M = { NONE: 0, LADDER: 1, SOCKET: 2, EXIT: 3, PLATE: 4 };

  const CHAR = {
    "#": { t: T.ROCK }, "%": { t: T.CRACKED }, "e": { t: T.EARTH }, "s": { t: T.SAND },
    "~": { t: T.WATER }, "|": { door: true }, ".": {}, "H": { m: M.LADDER }, "o": { m: M.SOCKET },
    "X": { m: M.EXIT }, "_": { m: M.PLATE }, "P": { player: true }, "B": { crate: "wood" },
    "I": { crate: "iron" }, "b": { crate: "wood", m: M.SOCKET }, "h": { player: true, m: M.LADDER },
    "g": { t: T.GRAVEL }, "f": { t: T.FUSE }, "a": { t: T.ACID }, "L": { t: T.LIME_A }, "M": { t: T.LIME_B },
    "R": { t: T.HARD }, "^": { t: T.SMOKE }, "v": { t: T.FOG }, "p": { t: T.PLUG }, "w": { t: T.WOOD }, "i": { t: T.ICE },
    "=": { bridge: true },
  };
  const POWDER = (t) => t === T.SAND || t === T.GRAVEL;
  const LIQUID = (t) => t === T.WATER || t === T.ACID;
  const OPEN = (t) => t === T.EMPTY || t === T.WATER || t === T.ACID || t === T.SMOKE || t === T.FOG;
  const WEIGHT = { player: 1, wood: 1, iron: 2 };
  const RELEASE_TO = { empty: T.EMPTY, plug_decay: T.EMPTY, water: T.WATER, sand: T.SAND };

  const DIRS = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] };

  function parse(spec) {
    const rows = spec.map;
    const h = rows.length, w = rows[0].length;
    const terrain = new Uint8Array(w * h), marker = new Uint8Array(w * h);
    const crates = []; let player = null;
    const doorCells = [], bridgeCells = [];
    for (let y = 0; y < h; y++) {
      if (rows[y].length !== w) throw new Error(spec.id + ": row " + y + " width " + rows[y].length + " != " + w);
      for (let x = 0; x < w; x++) {
        const c = CHAR[rows[y][x]];
        if (!c) throw new Error(spec.id + ": unknown char '" + rows[y][x] + "' at " + x + "," + y);
        const i = y * w + x;
        if (c.t) terrain[i] = c.t;
        if (c.m) marker[i] = c.m;
        if (c.door) doorCells.push(i);
        if (c.bridge) bridgeCells.push(i);
        if (c.crate) crates.push({ x, y, kind: c.crate });
        if (c.player) { if (player) throw new Error(spec.id + ": two players"); player = { x, y }; }
      }
    }
    if (!player) throw new Error(spec.id + ": no player");
    const bag = Object.assign({ sand: 0, bomb: 0 }, spec.bag || {});
    // Showcases are illustrations (a painted waterfall must stay put): no water
    // flow or displacement, bins are not goals.
    const level = { id: spec.id, w, h, marker, plates: [], doors: doorCells, groups: [], doorAt: new Map(), illustration: !!spec.showcase,
      devices: spec.devices || [], leverAt: new Map(), buttonAt: new Map(), padAt: new Map(), bridgeAt: new Map(), lifts: [], bins: [] };
    const at = (x, y) => y * w + x;
    // A cell holds one character: plates under water are listed in links, and
    // `water` lists cells that hold water on top of their marker (ladder, socket, exit).
    for (const g of spec.links || []) for (const [x, y] of g.plates || []) marker[at(x, y)] = M.PLATE;
    for (const [x, y] of spec.water || []) {
      const i = at(x, y);
      if (terrain[i] !== T.EMPTY || crates.some((c) => c.x === x && c.y === y)) throw new Error(spec.id + ": water cell " + x + "," + y + " is not an open cell");
      terrain[i] = T.WATER;
    }
    for (let i = 0; i < w * h; i++) if (marker[i] === M.PLATE) level.plates.push(i);
    // Door groups: without links every plate opens every door (chapter 1).
    if (spec.links) {
      level.symbol = {};
      spec.links.forEach((g, k) => {
        const grp = { plates: (g.plates || []).map(([x, y]) => at(x, y)), doors: (g.doors || []).map(([x, y]) => at(x, y)), latch: !!g.latch };
        for (const i of grp.plates.concat(grp.doors)) level.symbol[i] = g.symbol || ["circle", "triangle", "square"][k % 3];
        level.groups.push(grp);
      });
    } else level.groups.push({ plates: level.plates.slice(), doors: doorCells.slice(), latch: false });
    level.groups.forEach((g, k) => { for (const i of g.doors) level.doorAt.set(i, k); });
    for (const i of doorCells) if (!level.doorAt.has(i)) throw new Error(spec.id + ": door at " + (i % w) + "," + ((i / w) | 0) + " is in no link group");
    // Devices (§6.5). `preview` holds an illustration state for workbench showcases.
    const dev = [];
    level.climb = new Set();
    level.devices.forEach((d, k) => {
      const pv = d.preview || {};
      if (d.type === "lever") { level.leverAt.set(at(d.at[0], d.at[1]), k); dev.push(pv.on ? 1 : 0); }
      else if (d.type === "lift") { level.lifts.push(k); if (d.button) level.buttonAt.set(at(d.button[0], d.button[1]), k); dev.push(pv.stop || 0); }
      else if (d.type === "bin") { level.bins.push(k); dev.push(0); }
      else if (d.type === "portal") {
        const [a, b] = d.pads.map(([x, y]) => at(x, y));
        level.padAt.set(a, { dev: k, to: b }); level.padAt.set(b, { dev: k, to: a }); dev.push(0);
      } else if (d.type === "bridge") {
        for (const [x, y] of d.cells) {
          const i = at(x, y);
          if (!bridgeCells.includes(i)) throw new Error(spec.id + ": bridge cell " + x + "," + y + " is not '=' in the map");
          level.bridgeAt.set(i, k);
        }
        dev.push(0);
      } else {
        if (d.type === "vine" && pv.grown) for (let n = 0; n < d.height; n++) level.climb.add(at(d.root[0], d.root[1] - n));
        dev.push(pv.on ? 1 : 0);
      }
    });
    for (const i of bridgeCells) if (!level.bridgeAt.has(i)) throw new Error(spec.id + ": '=' at " + (i % w) + "," + ((i / w) | 0) + " belongs to no bridge device");
    // held: buttons currently pressed (a button fires when something arrives on it).
    const state = { terrain, crates, player, bag, open: level.groups.map(() => 0), dev, held: [], warped: [], moves: 0 };
    // Whatever starts on a button does not press it; only arrivals do.
    for (const i of level.buttonAt.keys()) if ((player.x === i % w && player.y === ((i / w) | 0)) || crates.some((c) => c.y * w + c.x === i)) state.held.push(i);
    settle(level, state);
    return { level, state };
  }

  function clone(s) {
    return { terrain: s.terrain.slice(), crates: s.crates.map((c) => ({ x: c.x, y: c.y, kind: c.kind })),
      player: { x: s.player.x, y: s.player.y }, bag: { sand: s.bag.sand, bomb: s.bag.bomb },
      open: s.open.slice(), dev: s.dev.slice(), held: s.held.slice(), warped: s.warped.slice(), moves: s.moves };
  }

  function inside(L, x, y) { return x >= 0 && y >= 0 && x < L.w && y < L.h; }
  function doorClosed(L, s, i) { const g = L.doorAt.get(i); return g !== undefined && !s.open[g]; }
  function terrainAt(L, s, x, y) {
    if (!inside(L, x, y)) return T.ROCK;
    const i = y * L.w + x;
    return doorClosed(L, s, i) ? T.DOOR : s.terrain[i];
  }
  function crateAt(s, x, y) { for (const c of s.crates) if (c.x === x && c.y === y) return c; return null; }
  function solidTerrain(t) { return t !== T.EMPTY && !OPEN(t); }
  // Lift decks and unbroken bridge planks are platforms: they hold things up and block.
  function liftDeck(L, s, x, y) {
    for (const k of L.lifts) {
      const d = L.devices[k], [sx, sy] = d.stops[s.dev[k]];
      if (y === sy && x >= sx && x < sx + (d.width || 1)) return k;
    }
    return -1;
  }
  function bridgeAt(L, s, x, y) { if (!inside(L, x, y)) return -1; const k = L.bridgeAt.get(y * L.w + x); return k !== undefined && !s.dev[k] ? k : -1; }
  function platform(L, s, x, y) { return liftDeck(L, s, x, y) >= 0 || bridgeAt(L, s, x, y) >= 0; }
  function isPlayer(s, x, y) { return s.player.x === x && s.player.y === y; }
  // Tile that holds something resting on it.
  function supports(L, s, x, y) { return solidTerrain(terrainAt(L, s, x, y)) || !!crateAt(s, x, y) || platform(L, s, x, y); }
  // Tile a body may move into.
  function free(L, s, x, y) {
    const t = terrainAt(L, s, x, y);
    return OPEN(t) && !crateAt(s, x, y) && !isPlayer(s, x, y) && !platform(L, s, x, y);
  }
  // Tile water may flow into: open air (the player does not block water: it is not in the SDK).
  function dry(L, s, x, y) { return terrainAt(L, s, x, y) === T.EMPTY && !crateAt(s, x, y) && !platform(L, s, x, y); }
  function ladder(L, x, y) { return inside(L, x, y) && (L.marker[y * L.w + x] === M.LADDER || L.climb.has(y * L.w + x)); }

  function pressed(L, s, i) {
    const x = i % L.w, y = (i / L.w) | 0;
    return isPlayer(s, x, y) || !!crateAt(s, x, y) || solidTerrain(s.terrain[i]);
  }
  function blocked(L, s, i) { const x = i % L.w, y = (i / L.w) | 0; return isPlayer(s, x, y) || !!crateAt(s, x, y) || s.terrain[i] !== T.EMPTY; }
  function leverFor(L, s, g) { return L.devices.some((d, k) => d.type === "lever" && d.action && d.action.link === g && s.dev[k]); }

  // ---------- water (§4.9) ----------
  // One connected body of WATER tiles (4-neighbour, through open gates).
  function body(L, s, start, seen) {
    const out = [start], stack = [start]; seen.add(start);
    while (stack.length) {
      const i = stack.pop(), x = i % L.w, y = (i / L.w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (!inside(L, nx, ny)) continue;
        const n = ny * L.w + nx;
        if (!seen.has(n) && s.terrain[n] === T.WATER && !doorClosed(L, s, n)) { seen.add(n); out.push(n); stack.push(n); }
      }
    }
    return out;
  }
  // Where a body can push water: dry neighbours, or a floating wood crate that can rise.
  function waterTargets(L, s, tiles) {
    const set = new Map();
    for (const i of tiles) {
      const x = i % L.w, y = (i / L.w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (!inside(L, nx, ny)) continue;
        const n = ny * L.w + nx;
        if (set.has(n)) continue;
        if (dry(L, s, nx, ny)) set.set(n, null);
        else { const c = crateAt(s, nx, ny); if (c && c.kind === "wood" && terrainAt(L, s, nx, ny) === T.EMPTY && free(L, s, nx, ny - 1) && terrainAt(L, s, nx, ny - 1) === T.EMPTY) set.set(n, c); }
      }
    }
    return set;
  }
  // One water move per call: the highest tile of a body goes to the lowest place
  // it can reach that is strictly lower (levels out connected basins); otherwise
  // a surface tile next to a drop spills sideways. Returns true if anything moved.
  function flowWater(L, s) {
    const seen = new Set();
    for (let i = 0; i < L.w * L.h; i++) {
      if (s.terrain[i] !== T.WATER || seen.has(i) || doorClosed(L, s, i)) continue;
      const tiles = body(L, s, i, seen);
      const top = Math.min(...tiles.map((t) => (t / L.w) | 0));
      const targets = waterTargets(L, s, tiles);
      let best = -1;
      for (const n of targets.keys()) if (best < 0 || ((n / L.w) | 0) > ((best / L.w) | 0) || (((n / L.w) | 0) === ((best / L.w) | 0) && n < best)) best = n;
      if (best >= 0 && ((best / L.w) | 0) > top) {
        // Take the surface tile farthest from the target so the surface lowers evenly.
        const bx = best % L.w;
        let src = -1;
        for (const t of tiles) if (((t / L.w) | 0) === top && (src < 0 || Math.abs((t % L.w) - bx) > Math.abs((src % L.w) - bx))) src = t;
        s.terrain[src] = T.EMPTY;
        const c = targets.get(best);
        if (c) c.y -= 1; // water flowing under a wood crate lifts it
        s.terrain[best] = T.WATER;
        return true;
      }
      // Spill: a supported water tile beside a drop runs off the edge.
      for (const t of tiles.slice().sort((a, b) => a - b)) {
        const x = t % L.w, y = (t / L.w) | 0;
        if (dry(L, s, x, y + 1)) continue;
        for (const dx of [-1, 1]) {
          if (dry(L, s, x + dx, y) && dry(L, s, x + dx, y + 1)) { s.terrain[t] = T.EMPTY; s.terrain[y * L.w + x + dx] = T.WATER; return true; }
        }
      }
    }
    return false;
  }
  // A crate or sand placed into a water tile pushes that water to the lowest
  // place the body can reach (the SDK must not delete it). False if sealed.
  function displace(L, s, i) {
    const tiles = body(L, s, i, new Set());
    s.terrain[i] = T.EMPTY;
    const targets = [...waterTargets(L, s, tiles).entries()].filter(([n, c]) => n !== i && !c).map(([n]) => n);
    if (!targets.length) { s.terrain[i] = T.WATER; return false; }
    // The body is at rest, so its lowest free neighbour is on (or just above) its surface.
    targets.sort((a, b) => ((b / L.w) | 0) - ((a / L.w) | 0) || a - b);
    s.terrain[targets[0]] = T.WATER;
    return true;
  }

  // ---------- devices ----------
  // Weight resting on a bridge: everything stacked on its planks.
  function bridgeLoad(L, s, k) {
    let load = 0;
    for (const [x, y0] of L.devices[k].cells) {
      for (let y = y0 - 1; y >= 0; y--) {
        const c = crateAt(s, x, y);
        if (c) { load += WEIGHT[c.kind]; continue; }
        if (isPlayer(s, x, y)) { load += WEIGHT.player; continue; }
        if (POWDER(s.terrain[y * L.w + x])) { load += 1; continue; }
        break;
      }
    }
    return load;
  }
  // Moves a lift to its other stop with everything standing on the deck.
  function moveLift(L, s, k) {
    const d = L.devices[k], from = d.stops[s.dev[k]], to = d.stops[1 - s.dev[k]], dy = to[1] - from[1], wdt = d.width || 1;
    const riders = [];
    for (let x = from[0]; x < from[0] + wdt; x++) for (let y = from[1] - 1; y >= 0; y--) {
      const c = crateAt(s, x, y);
      if (c) { riders.push(c); continue; }
      if (isPlayer(s, x, y)) { riders.push(s.player); continue; }
      break;
    }
    const moving = new Set(riders);
    const clear = (x, y) => { if (!inside(L, x, y)) return false; const t = terrainAt(L, s, x, y); const c = crateAt(s, x, y);
      return OPEN(t) && t !== T.WATER && (!c || moving.has(c)) && (!isPlayer(s, x, y) || moving.has(s.player)) && bridgeAt(L, s, x, y) < 0; };
    const step = dy > 0 ? 1 : -1;
    for (let x = from[0]; x < from[0] + wdt; x++) for (let y = from[1] + step; y !== to[1] + step; y += step) if (!clear(x, y)) return false;
    for (const r of riders) if (!clear(r.x, r.y + dy)) return false;
    for (const r of riders) r.y += dy;
    s.dev[k] = 1 - s.dev[k];
    return true;
  }
  function trigger(L, s, k, events) {
    const d = L.devices[k];
    if (!d) return false;
    if (d.type === "lift") { if (moveLift(L, s, k)) { events.push("lift"); return true; } events.push("lift-blocked"); return false; }
    if (d.type === "release") {
      if (s.dev[k]) return false;
      s.dev[k] = 1;
      for (const [x, y] of d.cells) s.terrain[y * L.w + x] = RELEASE_TO[d.to] !== undefined ? RELEASE_TO[d.to] : T.EMPTY;
      events.push("release"); return true;
    }
    s.dev[k] = s.dev[k] ? 0 : 1; // torch, vents: illustration state only
    return true;
  }
  function binCount(L, s, d) {
    const want = { water: T.WATER, sand: T.SAND, gravel: T.GRAVEL, acid: T.ACID, smoke: T.SMOKE, fog: T.FOG }[d.material];
    const [x0, y0, bw, bh] = d.rect;
    let tiles = 0;
    for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) if (s.terrain[y * L.w + x] === want) tiles++;
    return tiles * 256;
  }
  function occupant(s, x, y) { return isPlayer(s, x, y) ? s.player : crateAt(s, x, y); }

  // Gravity for crates, loose sand, water and the player, then devices and doors; repeat to fixpoint.
  function settle(L, s) {
    const events = [];
    for (let guard = 0; guard < 4096; guard++) {
      let moved = false;
      for (let y = L.h - 2; y >= 0; y--) {
        for (let x = 0; x < L.w; x++) {
          const i = y * L.w + x;
          const t = s.terrain[i], below = terrainAt(L, s, x, y + 1);
          if (POWDER(t) && free(L, s, x, y + 1) && !LIQUID(below)) {
            s.terrain[i] = below; s.terrain[i + L.w] = t; moved = true;
          } else if (POWDER(t) && LIQUID(below) && !crateAt(s, x, y + 1) && !platform(L, s, x, y + 1)) {
            s.terrain[i] = below; s.terrain[i + L.w] = t; moved = true; // sand sinks, water rises
          }
        }
      }
      for (const c of s.crates.slice().sort((a, b) => b.y - a.y)) {
        const below = terrainAt(L, s, c.x, c.y + 1), above = terrainAt(L, s, c.x, c.y - 1);
        if (c.kind === "wood" && above === T.WATER && !occupant(s, c.x, c.y - 1)) {
          // Wood floats: water on top of it trades places with it.
          s.terrain[(c.y - 1) * L.w + c.x] = T.EMPTY; s.terrain[c.y * L.w + c.x] = T.WATER; c.y -= 1; moved = true; events.push("crate-float");
        } else if (c.kind === "wood" && below === T.WATER) continue;
        else if (c.kind === "iron" && below === T.WATER && !L.illustration && !occupant(s, c.x, c.y + 1) && !platform(L, s, c.x, c.y + 1)) {
          // Iron sinks: it trades places with the water below.
          s.terrain[(c.y + 1) * L.w + c.x] = T.EMPTY; s.terrain[c.y * L.w + c.x] = T.WATER; c.y += 1; moved = true; events.push("crate-sink");
        } else if (free(L, s, c.x, c.y + 1)) { c.y += 1; moved = true; events.push("crate-fall"); }
      }
      const p = s.player;
      if (!ladder(L, p.x, p.y) && !supports(L, s, p.x, p.y + 1) && free(L, s, p.x, p.y + 1)) {
        p.y += 1; moved = true;
      }
      if (!moved && !L.illustration && flowWater(L, s)) moved = true;
      // Bridges give way under too much weight.
      L.devices.forEach((d, k) => {
        if (d.type === "bridge" && !s.dev[k] && bridgeLoad(L, s, k) > (d.capacity || 1)) { s.dev[k] = 1; moved = true; events.push("bridge-break"); }
      });
      // Buttons fire once when something arrives on them.
      const held = [];
      for (const [i, k] of L.buttonAt) if (occupant(s, i % L.w, (i / L.w) | 0)) held.push(i);
      for (const i of held) if (!s.held.includes(i)) { trigger(L, s, L.buttonAt.get(i), events); moved = true; }
      if (held.join() !== s.held.join()) { s.held = held; moved = true; }
      // Collection bins latch when full and may trigger a device.
      for (const k of L.bins) {
        const d = L.devices[k];
        if (!s.dev[k] && binCount(L, s, d) >= Math.max(1, d.need || 256)) {
          s.dev[k] = 1; moved = true; events.push("bin-full");
          if (d.trigger && d.trigger.device !== undefined) trigger(L, s, d.trigger.device, events);
        }
      }
      // Portals: whatever comes to rest on a pad goes to the other pad if it is free.
      s.warped = s.warped.filter((i) => occupant(s, i % L.w, (i / L.w) | 0));
      if (!moved) {
        for (const [i, pad] of L.padAt) {
          const x = i % L.w, y = (i / L.w) | 0, who = occupant(s, x, y);
          if (!who || s.warped.includes(i)) continue;
          const tx = pad.to % L.w, ty = (pad.to / L.w) | 0;
          if (!free(L, s, tx, ty)) continue;
          if (who !== s.player && s.terrain[pad.to] === T.WATER && !displace(L, s, pad.to)) continue;
          who.x = tx; who.y = ty; s.warped.push(pad.to); moved = true; events.push("warp");
          break;
        }
      }
      // Doors: each link group opens while all its plates are pressed (or its lever is on).
      L.groups.forEach((g, k) => {
        const on = g.plates.length > 0 && g.plates.every((i) => pressed(L, s, i));
        if (on && g.latch && s.open[k] !== 2) { s.open[k] = 2; moved = true; events.push("door-latch"); return; }
        const want = s.open[k] === 2 || on || leverFor(L, s, k) ? (s.open[k] === 2 ? 2 : 1) : 0;
        if (want === s.open[k]) return;
        if (want || g.doors.every((i) => !blocked(L, s, i))) { s.open[k] = want; moved = true; events.push(want ? "door-open" : "door-close"); }
      });
      if (!moved) return events;
    }
    throw new Error("settle did not converge");
  }

  // Returns {ok, reason, events}. Mutates state on success.
  function act(L, s, action) {
    const p = s.player;
    if (action === "L" || action === "R") {
      const dx = DIRS[action][0], nx = p.x + dx;
      const c = crateAt(s, nx, p.y);
      if (c && free(L, s, nx + dx, p.y)) {
        const into = (p.y * L.w) + nx + dx;
        if (s.terrain[into] === T.WATER && !displace(L, s, into)) return { ok: false, reason: "blocked" };
        c.x += dx; p.x = nx; return done(L, s, "push");
      }
      if (free(L, s, nx, p.y)) { p.x = nx; return done(L, s, "walk"); }
      // Step up one tile.
      if (supports(L, s, nx, p.y) && free(L, s, p.x, p.y - 1) && free(L, s, nx, p.y - 1)) {
        p.x = nx; p.y -= 1; return done(L, s, "step");
      }
      return { ok: false, reason: "blocked" };
    }
    if (action === "U") {
      const lever = L.leverAt.get(p.y * L.w + p.x);
      if (lever !== undefined && !ladder(L, p.x, p.y)) {
        const d = L.devices[lever];
        s.dev[lever] = s.dev[lever] ? 0 : 1;
        const ev = [];
        if (d.action && d.action.device !== undefined) trigger(L, s, d.action.device, ev);
        if (d.action && d.action.release !== undefined) trigger(L, s, d.action.release, ev);
        return done(L, s, "lever");
      }
      if (ladder(L, p.x, p.y) && ladder(L, p.x, p.y - 1) && free(L, s, p.x, p.y - 1)) { p.y -= 1; return done(L, s, "climb"); }
      return { ok: false, reason: "no-ladder" };
    }
    if (action === "D") {
      if ((ladder(L, p.x, p.y) || ladder(L, p.x, p.y + 1)) && free(L, s, p.x, p.y + 1)) { p.y += 1; return done(L, s, "climb"); }
      return { ok: false, reason: "no-ladder" };
    }
    const m = /^(DIG|POUR|BOMB)_([LRD])$/.exec(action);
    if (!m) return { ok: false, reason: "unknown" };
    const [dx, dy] = DIRS[m[2]];
    const tx = p.x + dx, ty = p.y + dy;
    if (!inside(L, tx, ty)) return { ok: false, reason: "edge" };
    const ti = ty * L.w + tx;
    if (m[1] === "DIG") {
      const t = s.terrain[ti];
      if ((t !== T.SAND && t !== T.EARTH) || s.bag.sand >= 9) return { ok: false, reason: "not-diggable" };
      s.terrain[ti] = T.EMPTY; s.bag.sand += 1; return done(L, s, "dig");
    }
    if (m[1] === "POUR") {
      if (m[2] === "D" || s.bag.sand < 1 || !free(L, s, tx, ty)) return { ok: false, reason: "cannot-pour" };
      if (s.terrain[ti] === T.WATER && !displace(L, s, ti)) return { ok: false, reason: "cannot-pour" };
      s.terrain[ti] = T.SAND; s.bag.sand -= 1; return done(L, s, "pour");
    }
    // BOMB: clears breakable tiles at the target and its four neighbours.
    if (s.bag.bomb < 1) return { ok: false, reason: "no-bomb" };
    let destroyed = 0;
    for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = tx + ox, y = ty + oy;
      if (!inside(L, x, y)) continue;
      const t = s.terrain[y * L.w + x];
      if (t === T.CRACKED || t === T.SAND || t === T.EARTH) { s.terrain[y * L.w + x] = T.EMPTY; destroyed++; }
    }
    s.bag.bomb -= 1;
    const r = done(L, s, "bomb"); r.destroyed = destroyed; return r;
  }

  function done(L, s, kind) { s.moves += 1; const events = settle(L, s); return { ok: true, kind, events }; }

  function goals(L, s) {
    const list = [];
    for (let i = 0; i < L.w * L.h; i++) {
      const x = i % L.w, y = (i / L.w) | 0;
      if (L.marker[i] === M.SOCKET) list.push({ kind: "socket", x, y, lit: !!crateAt(s, x, y) });
      if (L.marker[i] === M.EXIT) list.push({ kind: "exit", x, y, lit: isPlayer(s, x, y) });
    }
    if (!L.illustration) for (const k of L.bins) { const d = L.devices[k]; if (d.latch) list.push({ kind: "bin", x: d.rect[0], y: d.rect[1], lit: !!s.dev[k] }); }
    return list;
  }
  function won(L, s) { const g = goals(L, s); return g.length > 0 && g.every((x) => x.lit); }

  function key(s) {
    let k = s.player.x + "," + s.player.y + "|" + s.bag.sand + "," + s.bag.bomb + "|";
    k += s.crates.map((c) => c.kind[0] + c.x + "," + c.y).sort().join(";") + "|";
    k += s.open.join("") + "|" + s.dev.join("") + "|" + s.held.join(",") + "|" + s.warped.slice().sort((a, b) => a - b).join(",") + "|";
    let t = ""; for (let i = 0; i < s.terrain.length; i++) t += s.terrain[i];
    return k + t;
  }

  const ACTIONS = ["L", "R", "U", "D", "DIG_L", "DIG_R", "DIG_D", "POUR_L", "POUR_R", "BOMB_L", "BOMB_R", "BOMB_D"];

  // Breadth-first search for the shortest solution under the model.
  function solve(spec, limit) {
    const { level: L, state } = parse(spec);
    const max = limit || 300000;
    const seen = new Map([[key(state), null]]);
    let frontier = [state], depth = 0;
    const parents = new Map();
    while (frontier.length && seen.size < max) {
      const next = [];
      for (const s of frontier) {
        if (won(L, s)) return { solved: true, solution: rebuild(parents, key(s)), explored: seen.size };
        for (const a of ACTIONS) {
          const n = clone(s);
          if (!act(L, n, a).ok) continue;
          const k = key(n);
          if (seen.has(k)) continue;
          seen.set(k, true); parents.set(k, [key(s), a]); next.push(n);
        }
      }
      frontier = next; depth++;
    }
    return { solved: false, explored: seen.size, exhausted: frontier.length === 0 };
  }
  function rebuild(parents, k) {
    const out = [];
    while (parents.has(k)) { const [pk, a] = parents.get(k); out.push(a); k = pk; }
    return out.reverse();
  }

  // Replays an action list; returns per-step snapshots for previews and checks.
  function replay(spec, actions) {
    const { level: L, state } = parse(spec);
    const steps = [{ action: null, state: clone(state), result: null }];
    let s = state;
    for (const a of actions) {
      const n = clone(s); const r = act(L, n, a);
      if (!r.ok) return { level: L, steps, failedAt: steps.length - 1, reason: r.reason, action: a };
      steps.push({ action: a, state: clone(n), result: r }); s = n;
    }
    return { level: L, steps, won: won(L, s) };
  }

  // Counts reachable states from which the goal is no longer reachable
  // (only meaningful for small rooms; used to flag trap-heavy layouts).
  function deadEnds(spec, limit) {
    const { level: L, state } = parse(spec);
    const max = limit || 60000;
    const keys = new Map(), edges = new Map(), wins = [];
    const queue = [state]; keys.set(key(state), state);
    while (queue.length && keys.size < max) {
      const s = queue.shift(); const k = key(s); const out = [];
      if (won(L, s)) wins.push(k);
      for (const a of ACTIONS) {
        const n = clone(s); if (!act(L, n, a).ok) continue;
        const nk = key(n); out.push(nk);
        if (!keys.has(nk)) { keys.set(nk, n); queue.push(n); }
      }
      edges.set(k, out);
    }
    if (queue.length) return { complete: false, states: keys.size };
    const reverse = new Map();
    for (const [k, out] of edges) for (const n of out) { if (!reverse.has(n)) reverse.set(n, []); reverse.get(n).push(k); }
    const good = new Set(wins); const stack = wins.slice();
    while (stack.length) { const k = stack.pop(); for (const p of reverse.get(k) || []) if (!good.has(p)) { good.add(p); stack.push(p); } }
    return { complete: true, states: keys.size, dead: keys.size - good.size };
  }

  PB.tilemodel = { T, M, CHAR, ACTIONS, WEIGHT, parse, clone, act, settle, goals, won, solve, replay, deadEnds, crateAt, ladder,
    doorClosed, liftDeck, bridgeAt, bridgeLoad, binCount, terrainAt };
})(typeof window !== "undefined" ? window : globalThis);
