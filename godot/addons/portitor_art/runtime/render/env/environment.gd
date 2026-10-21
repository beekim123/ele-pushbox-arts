class_name PortitorArtEnvironmentEffects
extends RefCounted
## Source: game/presentation/render/env/environment.gd; env.js.
## Exact palette-step lighting/weather; palette parameters are retained.
## Section license inventory follows in T7.
const Raster = preload("../palette_raster.gd")
const BAYER: Array[int] = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const HUD: int = 20
const POOL_CACHE_LIMIT: int = 128
var _pool_geometry: Dictionary = {}

func tri(tick: int, period: int, amplitude: int) -> int:
	var p: int = posmod(tick, period)
	var v: int = p if p < (period >> 1) else period - p
	return floori(float(v * 4 * amplitude) / period) - amplitude

func draw(r: RefCounted, theme: Dictionary, phase: String, ctx: Dictionary) -> void:
	var e: Dictionary = theme.get("env", {})
	var level: String = ctx.get("level", "full")
	if e.is_empty() or level == "off":
		return
	var weather: String = "none"
	if level == "full":
		weather = e.get("weather", "none") if ctx.get("weather") == null else str(ctx.weather)
	match phase:
		"back":
			draw_background_light(r, theme, ctx)
			_back_weather(r, ctx, weather)
		"light":
			vignette(r, int(e.get("vignette", 0)))
		"front":
			_front(r, e, ctx, weather)

func draw_background_light(r: RefCounted, theme: Dictionary, ctx: Dictionary) -> void:
	var e: Dictionary = theme.get("env", {})
	if e.is_empty() or ctx.get("level", "full") == "off":
		return
	_lighting(r, e, ctx)
	_sun(r, e)

func draw_weather_back(r: RefCounted, theme: Dictionary, ctx: Dictionary) -> void:
	var e: Dictionary = theme.get("env", {})
	var level: String = ctx.get("level", "full")
	if e.is_empty() or level == "off":
		return
	var weather: String = "none"
	if level == "full":
		weather = e.get("weather", "none") if ctx.get("weather") == null else str(ctx.weather)
	_back_weather(r, ctx, weather)

func lighting_phase(theme: Dictionary, ctx: Dictionary) -> Array:
	# A lossless key for _lighting + _sun, independent of weather. Positions,
	# radii and masks are their actual integer values, not rounded time buckets.
	var e: Dictionary = theme.get("env", {})
	if e.is_empty() or ctx.get("level", "full") == "off":
		return ["off"]
	var tick: int = ctx.tick
	var area: Rect2i = ctx.area
	var pools: Array[Vector3i] = []
	if e.has("lights"):
		for light: Dictionary in ctx.get("lights", []):
			var source: Dictionary = e.lights.sources.get(light.id, {})
			if source.is_empty():
				continue
			var flicker: int = 0 if source.get("flicker", true) == false else tri(tick + int(light.x) * 7, 18, 1)
			pools.append(Vector3i(int(light.x), int(light.y) + int(source.get("dy", 0)), int(source.radius) + flicker))
	var beams: Array[int] = []
	if e.has("beams"):
		for k: int in range(e.beams.count):
			beams.append(area.position.x + floori(float(area.size.x * (k + 1)) / (int(e.beams.count) + 1)) + tri(tick + k * 300, 1200, 3))
	return [area, pools, beams, ((tick >> 4) & 3) if e.get("mist", false) else 0]

func quiet_weather(theme: Dictionary, ctx: Dictionary) -> bool:
	# Conservative proof of no weather pixels. Other weather, even during an
	# apparently idle part of its cycle, keeps the original per-frame path.
	var e: Dictionary = theme.get("env", {})
	var level: String = ctx.get("level", "full")
	if e.is_empty() or level == "off":
		return true
	if e.get("motes", false) and e.has("beams"):
		return false # Motes still draw in lite mode.
	if level != "full":
		return true
	var weather: String = e.get("weather", "none") if ctx.get("weather") == null else str(ctx.weather)
	return weather == "none"

func _remap(r: RefCounted, x: int, y: int, brighter: bool) -> void:
	if x >= 0 and y >= HUD and x < r.w and y < r.h:
		r.palette_step(x, y, brighter)

func _dot(r: RefCounted, x: int, y: int, c: String) -> void:
	if x >= 0 and y >= HUD and x < r.w and y < r.h:
		r.set_code(x, y, c)

func _pool(r: RefCounted, cx: int, cy: int, radius: int) -> void:
	# Bayer depends on absolute coordinates, so centre phase is part of the
	# geometry key. Store 2D offsets (not a width-dependent linear index).
	var key: Vector3i = Vector3i(radius, cx & 3, cy & 3)
	if not _pool_geometry.has(key):
		var selected: Array[Vector2i] = []
		var inner: int = floori(float(radius * radius * 36) / 100)
		var outer: int = radius * radius
		for dy: int in range(-radius, radius + 1):
			for dx: int in range(-radius, radius + 1):
				var d2: int = dx * dx + dy * dy
				if d2 <= outer and (d2 <= inner or BAYER[((key.z + dy) & 3) * 4 + ((key.y + dx) & 3)] * (outer - inner) >= (d2 - inner) * 16):
					selected.append(Vector2i(dx, dy))
		if _pool_geometry.size() >= POOL_CACHE_LIMIT:
			_pool_geometry.erase(_pool_geometry.keys()[0])
		_pool_geometry[key] = selected
	var offsets: Array[Vector2i] = _pool_geometry[key]
	# Each pool remains a separate batch: overlapping pools still LIGHT twice.
	r.apply_light_offsets(cx, cy, offsets, HUD)

func _lighting(r: RefCounted, e: Dictionary, ctx: Dictionary) -> void:
	var tick: int = ctx.tick
	var area: Rect2i = ctx.area
	if e.has("lights"):
		for light: Dictionary in ctx.get("lights", []):
			var source: Dictionary = e.lights.sources.get(light.id, {})
			if source.is_empty():
				continue
			var flicker: int = 0 if source.get("flicker", true) == false else tri(tick + int(light.x) * 7, 18, 1)
			_pool(r, light.x, int(light.y) + int(source.get("dy", 0)), int(source.radius) + flicker)
	if e.has("beams"):
		var b: Dictionary = e.beams
		var centres: Array[int] = []
		var half_width: int = int(b.width) >> 1
		for k: int in range(b.count):
			centres.append(area.position.x + floori(float(area.size.x * (k + 1)) / (int(b.count) + 1)) + tri(tick + k * 300, 1200, 3))
		var touched: PackedByteArray = PackedByteArray()
		touched.resize(maxi(0, area.size.x))
		var beam_points: Array[Vector2i] = []
		for y: int in range(maxi(HUD, area.position.y), area.end.y):
			touched.fill(0)
			var slope_offset: int = floori(float((y - area.position.y) * int(b.slope[0])) / int(b.slope[1]))
			for centre: int in centres:
				# abs(x - slope_offset - centre) < half_width, with integer x.
				var first: int = maxi(area.position.x, centre + slope_offset - half_width + 1)
				var end: int = mini(area.end.x, centre + slope_offset + half_width)
				if ((first + y) & 1) != 0:
					first += 1
				for x: int in range(first, end, 2):
					var index: int = x - area.position.x
					if touched[index] == 0:
						touched[index] = 1
						# The original per-pixel inner loop breaks at its first hit.
						# Overlapping beam strips must therefore brighten only once.
						beam_points.append(Vector2i(x, y))
		r.apply_light_offsets(0, 0, beam_points, HUD)
	if e.get("mist", false):
		var y0: int = area.end.y - 22
		var mist_points: Array[Vector2i] = []
		for y: int in range(maxi(HUD, y0), area.end.y):
			var density: int = floori(float((y - y0) * 16) / 22)
			# The condition has period four in x. Visit only matching residues;
			# this is the same Bayer mask, including negative screen origins.
			for residue: int in range(4):
				if BAYER[(y & 3) * 4 + ((residue + (tick >> 4)) & 3)] >= (density >> 1):
					continue
				var first: int = area.position.x + ((residue - area.position.x) & 3)
				for x: int in range(first, area.end.x, 4):
					mist_points.append(Vector2i(x, y))
		r.apply_light_offsets(0, 0, mist_points, HUD)

func vignette(r: RefCounted, width: int) -> void:
	if width <= 0:
		return
	for y: int in range(HUD, r.h):
		# Only visit the rim: same pixels as env.js, avoiding a full-frame scan.
		var full_row: bool = y - HUD < width or r.h - 1 - y < width
		for x: int in range(r.w if full_row else width * 2):
			var xx: int = x if full_row or x < width else r.w - width + x - width
			var distance: int = mini(mini(xx, y - HUD), mini(r.w - 1 - xx, r.h - 1 - y))
			if distance < width and BAYER[(y & 3) * 4 + (xx & 3)] * width >= distance * 16:
				_remap(r, xx, y, false)

func _sun(r: RefCounted, e: Dictionary) -> void:
	if e.has("sun"):
		var sun: Dictionary = e.sun
		_pool(r, sun.x, sun.y, sun.radius)
		for y: int in range(-6, 7):
			for x: int in range(-6, 7):
				if x * x + y * y <= 36:
					_dot(r, int(sun.x) + x, int(sun.y) + y, "u" if x * x + y * y > 25 else "t")

func _back_weather(r: RefCounted, ctx: Dictionary, weather: String) -> void:
	var tick: int = ctx.tick
	var area: Rect2i = ctx.area
	if weather == "meteors":
		var p: int = tick % 300
		if p < 24:
			var x0: int = 40 + Raster.h32(floori(float(tick) / 300), 0, 951) % 220
			var y0: int = HUD + 6 + Raster.h32(floori(float(tick) / 300), 1, 951) % 40
			for k: int in range(8):
				_dot(r, x0 + p * 3 - k, y0 + p - (k >> 1), "t" if k < 2 else "u" if k < 5 else "v")
	elif weather == "sandstorm":
		for i: int in range(40):
			var y: int = HUD + Raster.h32(i, 2, 953) % (r.h - HUD)
			var x: int = (Raster.h32(i, 1, 953) % (r.w + 40) + tick * 4) % (r.w + 40) - 20
			for k: int in range(0, 8, 2):
				_dot(r, x + k, y, "F" if i & 1 else "d")
	elif weather == "fireflies":
		for i: int in range(7):
			if ((tick >> 3) + i * 5) % 9 < 3:
				continue
			var x: int = area.position.x + Raster.h32(i, 1, 955) % maxi(1, area.size.x) + tri(tick + i * 61, 400, 12)
			var y: int = area.position.y + Raster.h32(i, 2, 955) % maxi(1, area.size.y) + tri(tick + i * 37, 300, 8)
			_dot(r, x, y, "l")
			_dot(r, x + 1, y, "m")
			_dot(r, x - 1, y, "m")

func _front(r: RefCounted, e: Dictionary, ctx: Dictionary, weather: String) -> void:
	var tick: int = ctx.tick
	var area: Rect2i = ctx.area
	var height: int = r.h - HUD
	match weather:
		"rain":
			for i: int in range(48):
				var y: int = HUD + (Raster.h32(i, 2, 961) % height + tick * 3) % (height + 12) - 12
				var x: int = (Raster.h32(i, 1, 961) % r.w + floori(float(y) / 3)) % r.w
				for k: int in range(3):
					_dot(r, x - k, y - k * 2, "u" if k == 0 else "v")
		"snow":
			for i: int in range(36):
				var y: int = HUD + (Raster.h32(i, 2, 963) % height + (tick >> 1)) % height
				var x: int = Raster.h32(i, 1, 963) % r.w + tri(tick + i * 37, 200, 6)
				_dot(r, x, y, "t")
				if i % 4 == 0:
					_dot(r, x + 1, y, "u")
		"embers":
			for i: int in range(10):
				if ((tick >> 2) + i * 3) % 7 == 0:
					continue
				var y: int = area.end.y - ((tick >> 1) + Raster.h32(i, 2, 965)) % maxi(1, area.size.y)
				var x: int = area.position.x + Raster.h32(i, 1, 965) % maxi(1, area.size.x) + tri(tick + i * 29, 120, 3)
				_dot(r, x, y, "j" if i & 1 else "k")
		"drips":
			for i: int in range(3):
				var p: int = (tick + i * 70) % 210
				var x: int = area.position.x + 8 + Raster.h32(i, 1, 967) % maxi(1, area.size.x - 16)
				if p < 40:
					_dot(r, x, area.position.y + 2 + floori(float(p * p) / 30), "r")
				elif p < 46:
					_dot(r, x - 1, area.position.y + 55, "s")
					_dot(r, x + 1, area.position.y + 55, "s")
		"wind":
			for i: int in range(7):
				var y: int = HUD + 6 + Raster.h32(i, 2, 969) % (height - 12)
				var length: int = 8 + Raster.h32(i, 3, 969) % 8
				var x: int = (Raster.h32(i, 1, 969) % (r.w + 60) + tick * 5) % (r.w + 60) - 30
				for k: int in range(0, length, 2):
					_dot(r, x + k, y + (1 if k > (length >> 1) else 0), "u")
		"sandstorm":
			for i: int in range(30):
				var y: int = HUD + Raster.h32(i, 2, 971) % height
				var x: int = (Raster.h32(i, 1, 971) % (r.w + 20) + tick * 6) % (r.w + 20) - 10
				_dot(r, x, y, "c")
	if e.get("motes", false) and e.has("beams"):
		for i: int in range(14):
			var x: int = area.position.x + Raster.h32(i, 1, 973) % maxi(1, area.size.x) + tri(tick + i * 53, 600, 6)
			var y: int = area.position.y + (Raster.h32(i, 2, 973) % maxi(1, area.size.y) + (tick >> 4)) % maxi(1, area.size.y)
			if ((tick >> 3) + i) % 5 != 0:
				_dot(r, x, y, "c")
