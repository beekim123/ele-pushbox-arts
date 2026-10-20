class_name PortitorArtBackgroundDiyu
extends RefCounted
## Source: game/presentation/render/themes/background_diyu.gd; terrain-diyu.js.
## Exact integer-noise landscape, shared palette codes and embedded pixels are retained.
## Section license inventory follows in T7.
const Raster = preload("../palette_raster.gd")
const BAYER: Array[int] = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5]
const CROW: Array[String] = [".##...", "####..", ".#####", "..#..."]

static func _round(value: float) -> int:
	return floori(value + 0.5) # JavaScript Math.round, including negative halves.

static func vnoise(x: int, y: int, cw: int, ch: int, seed: int) -> int:
	var gx: int = floori(float(x) / cw)
	var gy: int = floori(float(y) / ch)
	var fx: int = x - gx * cw
	var fy: int = y - gy * ch
	var a: int = Raster.h32(gx, gy, seed) & 255
	var b: int = Raster.h32(gx + 1, gy, seed) & 255
	var c: int = Raster.h32(gx, gy + 1, seed) & 255
	var d: int = Raster.h32(gx + 1, gy + 1, seed) & 255
	return floori(float((a * (cw - fx) + b * fx) * (ch - fy) + (c * (cw - fx) + d * fx) * fy) / (cw * ch))

static func tri(tick: int, period: int, amplitude: int) -> int:
	var p: int = posmod(tick, period)
	return _round(float((p if p < period >> 1 else period - p) * 4 * amplitude) / period - amplitude)

static func _limb(px: Callable, fx: float, fy: float, dx: float, dy: float, length: int, thick: int, depth: int, seed: int, color: String) -> void:
	for i: int in length:
		var kink: int = Raster.h32(seed, i, 41) % 5
		fx += dx + (-0.35 if kink == 0 else 0.35 if kink == 1 else 0.0) if dy < -0.5 else dx
		fy += dy
		for k: int in thick: px.call(_round(fx) + k, _round(fy), color)
		if thick > 1 and i > length * 0.6: thick -= 1
	if depth <= 0: return
	for k: int in 2 + Raster.h32(seed, 0, 43) % 2:
		var hs: int = Raster.h32(seed, k, 47)
		var side: int = -1 if k == 0 else 1 if k == 1 or hs & 1 else -1
		var ndx: float = dx + side * (0.35 + float(hs % 40) / 100)
		var ndy: float = dy + 0.15 + float((hs >> 8) % 20) / 100
		var magnitude: float = sqrt(ndx * ndx + ndy * ndy)
		_limb(px, _round(fx), _round(fy), ndx / magnitude, ndy / magnitude, maxi(2, _round(length * (0.55 + float((hs >> 12) % 25) / 100))), maxi(1, thick - 1), depth - 1, hs, color)

static func peaks(x: int, seed: int, span: int, hmin: int, hvar: int) -> int:
	var best: int = 0
	var first: int = floori(float(x) / span) - 2
	for k: int in range(first, first + 5):
		var hs: int = Raster.h32(k, 0, seed)
		var at: int = k * span + hs % span
		var top: int = hmin + (hs >> 8) % hvar
		var distance: int = absi(x - at)
		best = maxi(best, top - floori(float(distance * (2 + (hs >> 16) % 3)) / 3) - (0 if distance < 2 else 1))
	return best + (Raster.h32(x >> 1, 0, seed + 1) & 1)

static func _moon(px: Callable, colors: Dictionary, cx: int, cy: int) -> void:
	for dy: int in range(-6, 7):
		for dx: int in range(-6, 7):
			var d: int = dx * dx + dy * dy
			if d > 38 or (dx - 4) * (dx - 4) + (dy + 2) * (dy + 2) <= 36: continue
			px.call(cx + dx, cy + dy, colors.moon[1] if d > 25 and dx < 0 else colors.moon[0])

static func _mist(px: Callable, colors: Dictionary, area: Rect2i, line: Callable, half: int, shift: int, seed: int) -> void:
	for x: int in range(area.position.x, area.end.x):
		var density: int = vnoise(x - area.position.x - shift, 0, 30, 1, seed) - 60
		var y: int = line.call(x)
		if density <= 0: continue
		for dy: int in range(-half, half + 1):
			if BAYER[((y + dy) & 3) * 4 + (x & 3)] < (density >> 4) + 4 - absi(dy) * 2: px.call(x, y + dy, colors.mist)

static func _grave(px: Callable, colors: Dictionary, cx: int, ground: Callable, hash: int) -> void:
	var rw: int = 4 + hash % 3
	var rh: int = 4 + ((hash >> 3) & 1)
	var y: int = ground.call(cx) + 1
	for dx: int in range(-rw, rw + 1):
		var top: int = _round(rh * sqrt(1 - float(dx * dx) / ((rw + 0.5) * (rw + 0.5))))
		for k: int in top + 1: px.call(cx + dx, y - k, colors.near)
	var mx: int = cx + (rw - 1 if hash & 64 else 1 - rw)
	var lean: int = (hash >> 7) % 3 - 1
	if (hash >> 9) & 1:
		for k: int in 7: px.call(mx + (lean if k > 4 else 0), y - rh - k, colors.near)
	else:
		for k: int in 4:
			for i: int in range(-1, 2):
				if not (k == 3 and i != 0): px.call(mx + i, y - rh - k, colors.near)

static func _banner(px: Callable, colors: Dictionary, x: int, ground: Callable, tick: int, crow: bool) -> void:
	var y: int = ground.call(x) + 1
	var top: int = y - 26
	for k: int in range(top, y + 1): px.call(x, k, colors.near)
	for i: int in range(-1, 5): px.call(x + i, top + 1, colors.near)
	if crow:
		for j: int in 4:
			for i: int in 6:
				if CROW[j][i] == "#": px.call(x - 2 + i, top - 3 + j, colors.near)
	for j: int in 11:
		var sway: int = 0 if j < 2 else tri((tick >> 3) + j * 3, 24, mini(2, j >> 2))
		px.call(x + 3 + sway, top + 2 + j, colors.banner)
		if j < 9: px.call(x + 4 + sway, top + 2 + j, colors.banner)

static func _wisp(px: Callable, colors: Dictionary, x: int, y: int, tick: int) -> void:
	# JavaScript remainder is signed, but this condition only checks zero.
	if (tick >> 3) % 23 == 0: return
	px.call(x, y, colors.wisp[0])
	for offset: Vector2i in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]: px.call(x + offset.x, y + offset.y, colors.wisp[1])
	if (tick >> 4) & 1: px.call(x, y - 2, colors.wisp[1])

static func draw(r: RefCounted, theme: Dictionary, area: Rect2i, tick: int) -> void:
	var b: Dictionary = theme.background
	var colors: Dictionary = {"sky":b.base[0], "sky2":b.base[1], "glow":b.accent, "star":b.speck, "near":b.detail, "far":b.get("far", b.accent), "mid":b.get("mid", b.base[1]), "mist":b.get("mist", b.accent), "moon":b.get("moon", [b.speck,b.speck]), "wisp":b.get("wisp", [b.accent,b.accent]), "banner":b.get("banner", b.speck)}
	var px: Callable = func(x: int, y: int, color: String) -> void:
		if area.has_point(Vector2i(x, y)): r.set_code(x, y, color)
	var horizon: int = area.position.y + _round(area.size.y * 0.58)
	var span: int = maxi(1, horizon - area.position.y)
	for y: int in range(area.position.y, area.end.y):
		var level: int = floori(float((y - area.position.y) * 32) / span)
		for x: int in range(area.position.x, area.end.x):
			var dither: int = BAYER[(y & 3) * 4 + (x & 3)]
			var color: String = colors.sky if level < 6 else (colors.sky2 if dither < level - 6 else colors.sky) if level < 22 else colors.sky2 if level < 25 else (colors.glow if dither < (level - 24) * 2 else colors.sky2) if level < 32 else colors.glow
			if level < 20:
				var hash: int = Raster.h32(x, y, 701)
				if hash % 263 == 0 and not ((hash >> 9) % 4 == 0 and ((tick >> 5) + (hash >> 12)) % 6 == 0): color = colors.star
			r.set_code(x, y, color)
	for mx: int in range(area.position.x + 248, area.end.x + 8, 320): _moon(px, colors, mx, area.position.y + _round(area.size.y * 0.17))
	var near: PackedInt32Array = PackedInt32Array()
	near.resize(area.size.x)
	for x: int in range(area.position.x, area.end.x):
		var xw: int = x - area.position.x
		var far: int = horizon - peaks(xw, 811, 72, 14, 20)
		var mid: int = horizon + 6 - floori(float(vnoise(xw, 0, 44, 1, 815) * 12) / 255) - (Raster.h32(xw >> 1, 0, 816) & 1)
		var nr: int = horizon + 22 - floori(float(vnoise(xw, 0, 70, 1, 817) * 14) / 255) - floori(float(vnoise(xw, 0, 15, 1, 818) * 3) / 255)
		near[xw] = nr
		for y: int in range(far, mid): px.call(x, y, colors.far)
		for y: int in range(mid, nr): px.call(x, y, colors.mid)
		for y: int in range(nr, area.end.y): px.call(x, y, colors.near)
	var ground: Callable = func(x: int) -> int: return near[clampi(x - area.position.x, 0, area.size.x - 1)]
	_mist(px, colors, area, func(_x: int) -> int: return horizon + 3, 4, tick >> 5, 821)
	for k: int in range(-1, ceili(float(area.size.x + 60) / 160)):
		var g: int = Raster.h32(k, 0, 831)
		var base: int = area.position.x + k * 160
		for i: int in (2 if (g >> 28) % 3 == 0 else 1):
			var tx: int = base + 8 + g % 44 + i * 30
			var length: int = 8 + (g >> 26) % 4 if i > 0 else 12 + (g >> 8) % 8
			var seed: int = Raster.h32(k, i, 835)
			_limb(px, tx, ground.call(tx) + 1, ((seed >> 4) % 3 - 1) * 0.12, -1, length, 3, 3, seed, colors.near)
		var gx: int = base + 84 + (g >> 12) % 30
		for i: int in 1 + (g >> 16) % 3: _grave(px, colors, gx + i * 15, ground, Raster.h32(k, i, 833))
		if (g >> 20) % 3 == 0: _banner(px, colors, base + 144 + (g >> 22) % 10, ground, tick, (g >> 24) & 1 != 0)
		for i: int in 2:
			var wx: int = gx + 4 + i * 24
			_wisp(px, colors, wx + tri(tick + i * 211 + k * 97, 620, 4), ground.call(wx) - 9 - (g >> (24 + i * 3)) % 6 + tri(tick + i * 137, 170, 2), tick + i * 53 + k * 31)
	_mist(px, colors, area, func(x: int) -> int: return ground.call(x) + 3, 6, -(tick >> 6), 823)
