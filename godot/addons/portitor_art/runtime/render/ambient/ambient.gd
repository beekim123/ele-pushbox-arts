class_name PortitorArtAmbient
extends RefCounted
## Original decorative selection/motion, consuming only explicit display slots and visibility.
const Raster = preload("../palette_raster.gd")
const MOVERS: Array[String] = ["walker", "percher", "flyer", "hanger"]
var _candidates: Dictionary = {}
func clear_caches() -> void:
	_candidates.clear()
func _opening_candidates(geometry: Dictionary, kind: String, salt: int) -> Array[Dictionary]:
	var key: String = "%s:%d" % [kind,salt]
	if not _candidates.has(key):
		var result: Array[Dictionary] = []
		for point: Vector2i in geometry.floor_slots if kind=="floor" else geometry.ceiling_slots:
			result.append({"tx":point.x,"ty":point.y,"hash":Raster.h32(point.x,point.y,771+salt)})
		result.sort_custom(func(a: Dictionary,b: Dictionary) -> bool: return int(a.hash)<int(b.hash))
		_candidates[key] = result
	return _candidates[key]
func tri(tick: int, period: int, amplitude: int) -> int:
	var p: int = posmod(tick, period)
	return floori(float((p if p < (period >> 1) else period - p) * 4 * amplitude) / period) - amplitude

func seed_of(value: String) -> int:
	var hash: int = 0
	for i: int in range(value.length()):
		hash = Raster.h32(hash, value.unicode_at(i), 907)
	return hash

func longest_run(cands: Array[Dictionary]) -> Dictionary:
	var rows: Dictionary = {}
	for c: Dictionary in cands:
		if not rows.has(c.ty):
			rows[c.ty] = []
		rows[c.ty].append(c.tx)
	var best: Dictionary = {}
	for y: int in rows:
		var xs: Array = rows[y]
		xs.sort()
		var start: int = xs[0]
		var previous: int = xs[0]
		for i: int in range(1, xs.size() + 1):
			if i < xs.size() and int(xs[i]) == previous + 1:
				previous = xs[i]
				continue
			var length: int = previous - start + 1
			if best.is_empty() or length > int(best.len) or (length == int(best.len) and y > int(best.ty)):
				best = {"ty": y, "x0": start, "len": length}
			if i < xs.size():
				start = xs[i]
				previous = xs[i]
	return best

func pick_mover(list: Array, mode: String, seed: int) -> Array[int]:
	var ordered: Array[Dictionary] = []
	var ordinal: int = 0
	var result: Array[int] = []
	for i: int in range(list.size()):
		if MOVERS.has(list[i].type):
			ordered.append({"index": i, "hash": Raster.h32(seed, ordinal, 901)})
			ordinal += 1
	ordered.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return int(a.hash) < int(b.hash))
	if mode == "full":
		for item: Dictionary in ordered:
			result.append(item.index)
	elif not ordered.is_empty():
		if mode == "one":
			result.append(ordered[0].index)
		else:
			for item: Dictionary in ordered:
				if int(item.hash) % 100 < floori(float(list[item.index].get("chance", 0.3)) * 100 + 0.5):
					result.append(item.index)
					break
	return result

func plan(theme: Dictionary, geometry: Dictionary, origin: Vector2i, tick: int, layer: String, sprites: RefCounted, seed: int, lights: Array) -> Array[Dictionary]:
	var opts: Dictionary = {"mode":geometry.ambient_mode,"seed":seed}
	var area: Rect2i = geometry.ambient_area
	var list: Array = theme.get("ambient", [])
	var movers: Array[int] = pick_mover(list, opts.get("mode", "sparse"), int(opts.get("seed", 0)))
	var used: Dictionary = {}
	var commands: Array[Dictionary] = []
	var flyer_index: int = 0
	for index: int in range(list.size()):
		var a: Dictionary = list[index]
		if not sprites.has("art:" + str(a.id)):
			continue
		if MOVERS.has(a.type) and not movers.has(index):
			continue
		var back: bool = ["wall", "hanger", "flyer"].has(a.type)
		if (layer == "back") != back:
			if a.type == "flyer":
				flyer_index += int(a.get("count", 1))
			continue
		match str(a.type):
			"floor", "hang":
				var cands: Array[Dictionary] = _opening_candidates(geometry, "floor" if a.type == "floor" else "ceiling", int(a.get("salt", 0)))
				cands = cands.filter(func(c: Dictionary) -> bool: return not used.has(Vector2i(c.tx, c.ty)))
				var count: int = mini(int(a.get("max", 2)), ceili(float(cands.size()) / int(a.get("every", 4))))
				for c: Dictionary in cands.slice(0, count):
					used[Vector2i(c.tx, c.ty)] = true
					if not bool(geometry.alive_mask[int(c.ty)*geometry.grid_size.x+int(c.tx)]):
						continue
					var x: int = origin.x + int(c.tx) * 16 + 5 + int(c.hash) % 7
					var y: int = origin.y + int(c.ty) * 16 + (16 if a.type == "floor" else 0)
					commands.append(_command(a.id, a.get("anim", "default"), tick + int(c.hash) % 97, x, y, (int(c.hash) >> 3) & 1 != 0))
					_light(lights, a.id, x, y)
			"walker":
				var run: Dictionary = longest_run(_opening_candidates(geometry, "floor", 5))
				if run.is_empty() or int(run.len) < 2:
					continue
				var span: int = int(run.len) * 16 - 12
				var p: int = (tick >> 2) % (2 * (span + 30))
				var x: int = 0
				var facing: int = -1
				var moving: bool = true
				if p < span:
					x = p
					facing = 1
				elif p < span + 30:
					x = span
					facing = 1
					moving = false
				elif p < 2 * span + 30:
					x = 2 * span + 30 - p
				else:
					moving = false
				commands.append(_command(a.id, "walk" if moving else 0, tick if moving else 0, origin.x + int(run.x0) * 16 + 6 + x, origin.y + int(run.ty) * 16 + 16, facing < 0))
			"percher":
				var cands: Array[Dictionary] = _opening_candidates(geometry, "floor", 9)
				cands = cands.filter(func(c: Dictionary) -> bool: return not used.has(Vector2i(c.tx, c.ty)))
				if cands.is_empty():
					continue
				var edge: Dictionary = cands[0]
				for c: Dictionary in cands:
					if Vector2i(c.tx,c.ty) in geometry.perch_edges:
						edge = c
						break
				used[Vector2i(edge.tx, edge.ty)] = true
				if not bool(geometry.alive_mask[int(edge.ty)*geometry.grid_size.x+int(edge.tx)]):
					continue
				var phase: int = floori(float(tick) / 60) % 6
				commands.append(_command(a.id, "peck" if phase == 2 or phase == 3 else "idle", tick, origin.x + int(edge.tx) * 16 + 8, origin.y + int(edge.ty) * 16 + 16, floori(float(tick) / 360) % 2 == 1))
			"wall":
				for x: int in range(area.position.x + (int(a.spacing) >> 1), area.end.x, a.spacing):
					commands.append(_command(a.id, a.get("anim", "default"), tick + x, x, area.position.y + int(a.y), false))
					_light(lights, a.id, x, area.position.y + int(a.y))
			"hanger":
				var cands: Array[Dictionary] = _opening_candidates(geometry, "ceiling", 3)
				if cands.is_empty():
					continue
				var c: Dictionary = cands[0]
				var hx: int = origin.x + int(c.tx) * 16 + 8
				var hy: int = origin.y + int(c.ty) * 16
				var p: int = tick % 720
				commands.append(_command(a.id, "hang" if p < 600 else "fly", tick, hx if p < 600 else hx + tri(p - 600, 120, 20), hy if p < 600 else hy + 10 + tri(p - 570, 60, 6), false))
			"flyer":
				var count: int = a.get("count", 1)
				for _i: int in range(count):
					var k: int = flyer_index
					flyer_index += 1
					var cx: int = area.position.x + int(float(area.size.x * (k + 1)) / (count + 1))
					var cy: int = area.position.y + (area.size.y >> 1)
					var x: int
					var y: int
					match str(a.get("path", "")):
						"cross":
							x = area.position.x + ((tick >> 1) + k * 97) % (area.size.x + 40) - 20
							y = area.position.y + 16 + k * 18 + tri(tick, 80, 3)
						"drift":
							x = area.position.x + ((tick >> 3) + k * 131) % (area.size.x + 40) - 20
							y = area.position.y + 30 + tri(tick, 240, 4)
						"hover":
							x = cx + tri(tick + k * 50, 900, mini(60, area.size.x >> 3))
							y = cy - 20 + tri(tick, 120, 3)
						_:
							x = cx + tri(tick + k * 133, 420, mini(48, area.size.x >> 3))
							y = cy + tri(tick + k * 71, 260, mini(24, area.size.y >> 3))
					commands.append(_command(a.id, a.get("anim", "fly"), tick, x, y, false if a.get("path") == "cross" else tri(tick + k * 133, 420, 1) < 0))
	if geometry.exclude_room:
		var room: Rect2i = geometry.room_bounds
		commands = commands.filter(func(command: Dictionary) -> bool: return not room.has_point(Vector2i(command.x, command.y)))
		for index: int in range(lights.size()-1,-1,-1):
			if room.has_point(Vector2i(lights[index].x,lights[index].y)): lights.remove_at(index)
	return commands

func _command(id: String, animation: Variant, tick: int, x: int, y: int, flip: bool) -> Dictionary:
	return {"uid": "art:" + id, "anim": animation, "tick": tick, "x": x, "y": y, "flip": flip}

func _light(lights: Array, id: String, x: int, y: int) -> void:
	lights.append({"id":id,"x":x,"y":y})
