class_name PortitorArtBackground
extends RefCounted
## Source: game/presentation/render/themes/background.gd; terrain.js drawBackground.
## Integer cloud/star animation and palette parameters are retained.
## Section license inventory follows in T7.
const Raster = preload("../palette_raster.gd")
const BAYER: Array[int] = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

static func draw(r: RefCounted, theme: Dictionary, area: Rect2i, tick: int, include_animation: bool = true) -> void:
	var b: Dictionary = theme.background
	var style: String = b.style
	if style == "diyu":
		preload("background_diyu.gd").draw(r, theme, area, tick)
		return
	var x0: int = area.position.x
	var y0: int = area.position.y
	var x1: int = area.end.x
	var y1: int = area.end.y
	for y: int in range(y0, y1):
		for x: int in range(x0, x1):
			var hash: int = Raster.h32(x >> 1, y >> 1, 401)
			var c: String = b.base[0]
			if style == "sky":
				var level: int = floori(float((y - y0) * 32) / area.size.y)
				c = b.base[0] if level < 12 else (b.base[1] if BAYER[(y & 3) * 4 + (x & 3)] < level - 12 else b.base[0]) if level < 28 else b.base[1]
			elif style == "dungeon":
				var row: int = floori(float(y) / 12)
				var off: int = (row & 1) * 12
				var mortar: bool = y % 12 == 11 or (x + off) % 24 == 23
				c = b.base[0] if mortar else b.detail if Raster.h32(floori(float(x + off) / 24), row, 41) % 5 == 0 else b.base[1]
				if not mortar and hash % 53 == 0:
					c = b.speck
			elif style == "cosmos":
				var band: int = (x + y * 2) % 140
				if band < 30 and hash % 3 == 0:
					c = b.base[1]
				if band < 12 and hash % 5 == 0:
					c = b.accent
			else:
				var band: int = (y + (Raster.h32(x >> 3, 0, 405) % 5) - 2 + (x >> 4) % 3) % 13
				if band == 0 and hash % 3 != 0:
					c = b.base[1]
				elif Raster.h32(x >> 2, y >> 2, 403) % 11 == 0 and hash % 2 != 0:
					c = b.base[1]
				if hash % 47 == 0:
					c = b.speck
			r.set_code(x, y, c)
	match style:
		"dungeon":
			for cx: int in range(x0 + 40, x1, 112):
				for y: int in range(y0, y0 + 46):
					var link: int = (y >> 2) & 1
					_px(r, area, cx, y, b.detail if link else b.speck)
					if link:
						_px(r, area, cx - 1, y, b.base[0])
						_px(r, area, cx + 1, y, b.base[0])
		"ruins":
			for cx: int in range(x0 + 20, x1 + 20, 64):
				for y: int in range(y0 + 14, y1):
					for k: int in range(14):
						_px(r, area, cx + k, y, b.base[0] if k == 0 or k == 13 else b.detail if k % 4 == 2 else b.accent)
				for k: int in range(-3, 17):
					_px(r, area, cx + k, y0 + 12, b.detail)
					_px(r, area, cx + k, y0 + 13, b.accent)
					_px(r, area, cx + k, y0 + 14, b.detail)
		"cave":
			for sx: int in range(x0 + 6, x1, 23):
				var length: int = 10 + Raster.h32(sx, 0, 51) % 22
				for d: int in range(length):
					var half: int = maxi(0, floori(float((length - d) * 4) / length) - 1)
					for k: int in range(-half, half + 1):
						_px(r, area, sx + k, y0 + d, b.speck if k == -half else b.detail)
			for i: int in range(9):
				var vx: int = x0 + Raster.h32(i, 3, 53) % area.size.x
				var vy: int = y0 + 40 + Raster.h32(i, 4, 53) % (area.size.y - 60)
				for k: int in range(6):
					_px(r, area, vx + k, vy - (k >> 1), b.accent)
		"forest":
			for i: int in range(9):
				var tx: int = x0 + (i * 41 + Raster.h32(i, 0, 61) % 20) % (area.size.x + 20) - 10
				var tw: int = 6 + Raster.h32(i, 1, 61) % 7
				for y: int in range(y0 + 20, y1):
					for k: int in range(tw):
						_px(r, area, tx + k, y, b.base[0] if k == 0 else b.detail if k == 2 and (y >> 3) % 3 != 0 else b.accent)
			for y: int in range(y0, y0 + 34):
				for x: int in range(x0, x1):
					if y < y0 + 18 + Raster.h32(x >> 3, 9, 63) % 12 and Raster.h32(x >> 3, y >> 2, 63) % 4 != 0:
						_px(r, area, x, y, b.detail if (x + y) & 1 else b.base[0])
		"sky":
			for i: int in range(3):
				var ix: int = x0 + 30 + i * 110 + Raster.h32(i, 0, 71) % 30
				var iy: int = y0 + 110 + Raster.h32(i, 1, 71) % 30
				var iw: int = 30 + Raster.h32(i, 2, 71) % 20
				for k: int in range(iw):
					var depth: int = maxi(1, floori(((float(iw) / 2 - absf(k - float(iw) / 2)) * 3) / 4))
					for d: int in range(depth):
						_px(r, area, ix + k, iy + d, "n" if d == 0 else b.detail)
			if include_animation:
				_sky_clouds(r, b, area, tick)
		"cosmos":
			if include_animation:
				_cosmos_stars(r, area, tick, false)
			var pcx: int = x0 + area.size.x - 60
			var pcy: int = y0 + 42
			for dy: int in range(-20, 21):
				for dx: int in range(-20, 21):
					var d2: int = dx * dx + dy * dy
					if d2 <= 400:
						_px(r, area, pcx + dx, pcy + dy, "g" if d2 > 324 else "C" if dx + dy < -12 else "B" if (dy + 40) % 7 < 2 else "C")
			for dx: int in range(-32, 33):
				var ry: int = floori(dx * 0.18 + 0.5)
				if absi(dx) > 18 or ry > 2:
					_px(r, area, pcx + dx, pcy + ry, "D")
			for x: int in range(x0, x1):
				_px(r, area, x, y1 - 30, b.detail)
				_px(r, area, x, y1 - 22, b.detail)
				if x % 12 < 2 or x % 12 == (y1 - 26) % 12:
					for y: int in range(y1 - 30, y1 - 21):
						_px(r, area, x, y, b.detail)

static func draw_static(r: RefCounted, theme: Dictionary, area: Rect2i) -> void:
	# Includes sky islands and cosmos planet/ring/gantry, which never move.
	draw(r, theme, area, 0, false)

static func draw_dynamic(r: RefCounted, theme: Dictionary, area: Rect2i, tick: int) -> void:
	# Called on a copy of draw_static. Only sparse moving pixels are repainted.
	match str(theme.background.style):
		"diyu": preload("background_diyu.gd").draw(r, theme, area, tick)
		"sky": _sky_clouds(r, theme.background, area, tick)
		"cosmos": _cosmos_stars(r, area, tick, true)

static func _sky_clouds(r: RefCounted, b: Dictionary, area: Rect2i, tick: int) -> void:
	for i: int in range(5):
		var cw: int = 26 + Raster.h32(i, 5, 73) % 30
		var cy: int = area.position.y + 14 + i * 22 + Raster.h32(i, 6, 73) % 10
		var cx: int = area.position.x + (Raster.h32(i, 7, 73) % (area.size.x + 60) + (tick >> (4 + (i & 1)))) % (area.size.x + 60) - 40
		for k: int in range(cw):
			var top: int = floori(absf(k - float(cw) / 2) / 3) - Raster.h32(k >> 2, i, 75) % 2
			for d: int in range(maxi(0, top), 6):
				_px(r, area, cx + k, cy + d, b.accent if d >= 4 else b.speck)

static func _cosmos_stars(r: RefCounted, area: Rect2i, tick: int, skip_static_occlusion: bool) -> void:
	for i: int in range(70):
		var sx: int = area.position.x + Raster.h32(i, 0, 81) % area.size.x
		var sy: int = area.position.y + Raster.h32(i, 1, 81) % area.size.y
		# terrain.js paints planet/ring/gantry AFTER the stars. They are already
		# in the cached static raster, so a covered star must not overwrite them.
		if skip_static_occlusion and _cosmos_occludes(area, sx, sy):
			continue
		_px(r, area, sx, sy, "v" if Raster.h32((tick >> 4) + i, i, 83) % 7 == 0 else "t" if Raster.h32(i, 2, 81) % 4 == 0 else "u")

static func _cosmos_occludes(area: Rect2i, x: int, y: int) -> bool:
	var dx: int = x - (area.end.x - 60)
	var dy: int = y - (area.position.y + 42)
	if dx * dx + dy * dy <= 400:
		return true
	if dx >= -32 and dx <= 32:
		var ry: int = floori(dx * 0.18 + 0.5)
		if dy == ry and (absi(dx) > 18 or ry > 2):
			return true
	if y == area.end.y - 30 or y == area.end.y - 22:
		return true
	return y >= area.end.y - 30 and y <= area.end.y - 22 and (x % 12 < 2 or x % 12 == (area.end.y - 26) % 12)

static func _px(r: RefCounted, area: Rect2i, x: int, y: int, code: String) -> void:
	if area.has_point(Vector2i(x, y)):
		r.set_code(x, y, code)
