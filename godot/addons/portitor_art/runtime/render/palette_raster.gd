class_name PortitorArtPaletteRaster
extends RefCounted
## Source: game/presentation/render/palette_raster.gd.
## Integer ENDESGA32 raster. Indices preserve palette remaps without blending.
## Embedded palette/remap values are retained; section license inventory follows in T7.
const CODES: String = ".abcdefghijklmnopqrstuvwxyzABCDEF"
const HEX: Array[String] = ["00000000", "be4a2fff", "d77643ff", "ead4aaff", "e4a672ff", "b86f50ff", "733e39ff", "3e2731ff", "a22633ff", "e43b44ff", "f77622ff", "feae34ff", "fee761ff", "63c74dff", "3e8948ff", "265c42ff", "193c3eff", "124e89ff", "0099dbff", "2ce8f5ff", "ffffffff", "c0cbdcff", "8b9bb4ff", "5a6988ff", "3a4466ff", "262b44ff", "181425ff", "ff0044ff", "68386cff", "b55088ff", "f6757aff", "e8b796ff", "c28569ff"]
const DIM_MAP: Dictionary = {"a":"f","b":"e","c":"v","d":"F","e":"f","f":"g","g":"z","h":"g","i":"h","j":"a","k":"b","l":"k","m":"n","n":"o","o":"p","p":"z","q":"y","r":"q","s":"r","t":"u","u":"v","v":"w","w":"x","x":"y","y":"z","z":"z","A":"h","B":"g","C":"B","D":"C","E":"F","F":"e"}
const LIGHT_MAP: Dictionary = {"z":"y","y":"x","x":"w","w":"v","v":"u","u":"t","t":"t","g":"f","f":"e","e":"F","F":"d","d":"c","c":"t","a":"b","b":"d","h":"i","i":"D","D":"E","E":"c","j":"k","k":"l","l":"t","p":"o","o":"n","n":"m","m":"l","q":"r","r":"s","s":"t","B":"C","C":"D","A":"D"}
var w: int
var h: int
var indices: PackedByteArray
static var _colors: Array[Color] = []
static var _palette_indices: Dictionary = {}
static var _code_indices: Dictionary = {}
static var _dim_indices: Array[int] = []
static var _light_indices: Array[int] = []

func _init(width: int = 320, height: int = 180) -> void:
	w = width
	h = height
	indices.resize(w * h)
	indices.fill(0)
	if _colors.is_empty():
		for i: int in range(HEX.size()):
			var color: Color = Color.html(HEX[i])
			_colors.append(color)
			_palette_indices[color.to_rgba32()] = i
			_code_indices[CODES.substr(i, 1)] = i
		for i: int in range(CODES.length()):
			var code: String = CODES.substr(i, 1)
			_dim_indices.append(CODES.find(DIM_MAP.get(code, code)))
			_light_indices.append(CODES.find(LIGHT_MAP.get(code, code)))

static func h32(x: int, y: int, seed: int) -> int:
	# Mask before the second multiplication: uint32 products need only low bits.
	var n: int = (x * 374761393 + y * 668265263 + (seed & 0xffffffff) * 2147483647) & 0xffffffff
	n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
	return (n ^ (n >> 16)) & 0xffffffff

static func color_of(code: String) -> Color:
	var index: int = CODES.find(code)
	return Color.html(HEX[maxi(0, index)])

func set_code(x: int, y: int, code: String) -> void:
	if x < 0 or y < 0 or x >= w or y >= h or code == "." or code.is_empty():
		return
	var index: int = _code_indices.get(code, -1)
	if index < 0:
		push_error("Unknown palette code " + code)
		return
	_set_index(x, y, index)

func _set_index(x: int, y: int, index: int) -> void:
	indices[y * w + x] = index

func get_code(x: int, y: int) -> String:
	if x < 0 or y < 0 or x >= w or y >= h:
		return "."
	return CODES.substr(indices[y * w + x], 1)

func rect(x: int, y: int, width: int, height: int, code: String) -> void:
	for yy: int in range(maxi(0, y), mini(h, y + height)):
		for xx: int in range(maxi(0, x), mini(w, x + width)):
			set_code(xx, yy, code)

func remap(area: Rect2i, mapping: Dictionary) -> void:
	var table: Array[int] = []
	for i: int in range(CODES.length()):
		var code: String = CODES.substr(i, 1)
		table.append(CODES.find(mapping.get(code, code)))
	for y: int in range(maxi(0, area.position.y), mini(h, area.end.y)):
		for x: int in range(maxi(0, area.position.x), mini(w, area.end.x)):
			var index: int = indices[y * w + x]
			if table[index] != index:
				_set_index(x, y, table[index])

func palette_step(x: int, y: int, brighter: bool) -> void:
	var index: int = indices[y * w + x]
	if index != 0:
		_set_index(x, y, _light_indices[index] if brighter else _dim_indices[index])

func apply_light_offsets(cx: int, cy: int, offsets: Array[Vector2i], minimum_y: int = 20) -> void:
	# Keep the whole selected-point loop inside the concrete raster. A single
	# call replaces per-pixel dynamic RefCounted method/property dispatch.
	for offset: Vector2i in offsets:
		var x: int = cx + offset.x
		var y: int = cy + offset.y
		if x >= 0 and y >= minimum_y and x < w and y < h:
			var i: int = y * w + x
			indices[i] = _light_indices[indices[i]]

func blit_sparse(points: Array[Vector3i], position: Vector2i, frame_width: int, flip: bool = false) -> void:
	# Point.z is the exact palette index decoded from an approved sheet once.
	for point: Vector3i in points:
		var x: int = position.x + (frame_width - 1 - point.x if flip else point.x)
		var y: int = position.y + point.y
		if x >= 0 and y >= 0 and x < w and y < h:
			indices[y * w + x] = point.z

func blit_image(source: Image, region: Rect2i, position: Vector2i, flip: bool = false) -> void:
	for y: int in range(region.size.y):
		for x: int in range(region.size.x):
			var color: Color = source.get_pixel(region.position.x + (region.size.x - 1 - x if flip else x), region.position.y + y)
			if color.a8 == 0:
				continue
			var tx: int = position.x + x
			var ty: int = position.y + y
			if tx >= 0 and ty >= 0 and tx < w and ty < h:
				var index: int = _palette_indices.get(color.to_rgba32(), -1)
				if index >= 0:
					_set_index(tx, ty, index)

func copy() -> RefCounted:
	var raster: RefCounted = get_script().new(w, h)
	raster.indices = indices.duplicate()
	return raster

func image() -> Image:
	# Sprite layers decode these exact indices in palette.gdshader. No CPU RGBA
	# expansion or four-channel writes are needed for lighting/sprite pixels.
	return Image.create_from_data(w, h, false, Image.FORMAT_R8, indices)
