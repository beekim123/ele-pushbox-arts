class_name PortitorArtMatter
extends RefCounted
## Pixel paint for finite resolved visual effects. Colors and silhouettes retain source attribution.
const REGION_COLORS: Dictionary = {"cyan":"s","heat":"k","gust":"D","release":"C","load":"l","blast":"j","cracked":"F"}
static func draw(raster: RefCounted, effect: Dictionary) -> void:
	match effect.kind:
		"bridge_load":
			for index: int in effect.bars.size():
				raster.rect(effect.position.x+index*3,effect.position.y,1,3,["F","l","i"][effect.bars[index]])
		"placeholder": placeholder(raster,effect.position,effect.solid,effect.size)
		"observe_region":
			if effect.shape=="rect": dashed_rect(raster,effect.bounds,REGION_COLORS[effect.style])
			else: dashed_circle(raster,effect.center,effect.radius,REGION_COLORS[effect.style])
		"observe_path":
			var points: Array = effect.points
			var code: String = "D" if effect.style=="actual" else "s"
			for index: int in range(1,points.size()): dotted(raster,points[index-1],points[index],code)
			if not points.is_empty(): dashed_rect(raster,Rect2i(points.back()-Vector2i(7,7),Vector2i(14,14)),code)
		"observe_link":
			if effect.rounding=="round": dotted(raster,effect.from,effect.to,"D" if effect.style=="actual" else "s")
			else:
				var a: Vector2i = effect.from
				var b: Vector2i = effect.to
				var count: int = maxi(absi(a.x-b.x),absi(a.y-b.y))
				for k: int in range(0,count+1,2):
					var p: Vector2 = Vector2(a).lerp(Vector2(b),float(k)/maxi(1,count))
					raster.set_code(floori(p.x+0.5),floori(p.y+0.5),"s")
		"target_blast":
			var radius: int = effect.radius
			for y: int in range(-radius,radius+1):
				for x: int in range(-radius,radius+1):
					var d: int = x*x+y*y
					if d<=radius*radius and d>=(radius-1)*(radius-1): raster.set_code(effect.center.x+x,effect.center.y+y,"j")
static func placeholder(raster: RefCounted, point: Vector2i, solid: bool = true, size: int = 14) -> void:
	var start: Vector2i = point - Vector2i(size >> 1, size)
	if solid:
		raster.rect(start.x, start.y, size, size, "B")
	else:
		dashed_rect(raster, Rect2i(start, Vector2i(size, size)), "B")
	# A magenta question mark labels every placeholder independently of colour.
	var glyph: Array[String] = ["111", "001", "010", "000", "010"]
	for y: int in range(glyph.size()):
		for x: int in range(3):
			if glyph[y].substr(x, 1) == "1":
				raster.set_code(point.x - 1 + x, start.y + 2 + y, "D")

static func dashed_rect(raster: RefCounted, rect: Rect2i, code: String) -> void:
	for x: int in range(rect.size.x):
		if ((x >> 1) & 1) == 0:
			raster.set_code(rect.position.x + x, rect.position.y, code)
			raster.set_code(rect.position.x + x, rect.end.y - 1, code)
	for y: int in range(rect.size.y):
		if ((y >> 1) & 1) == 0:
			raster.set_code(rect.position.x, rect.position.y + y, code)
			raster.set_code(rect.end.x - 1, rect.position.y + y, code)

static func dotted(raster: RefCounted, a: Vector2i, b: Vector2i, code: String) -> void:
	var count: int = maxi(1, maxi(absi(a.x - b.x), absi(a.y - b.y)))
	for index: int in range(0, count + 1, 2):
		var point: Vector2 = Vector2(a).lerp(Vector2(b), float(index) / count)
		raster.set_code(roundi(point.x), roundi(point.y), code)

static func dashed_circle(raster: RefCounted, center: Vector2i, radius: int, code: String) -> void:
	for y: int in range(-radius, radius + 1):
		for x: int in range(-radius, radius + 1):
			var distance: int = x * x + y * y
			if distance <= radius * radius and distance >= (radius - 1) * (radius - 1) and posmod(x + y, 3) != 0:
				raster.set_code(center.x + x, center.y + y, code)
