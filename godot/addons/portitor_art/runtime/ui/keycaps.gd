class_name PortitorArtKeycaps
extends RefCounted
## Algorithms are MIT candidates; embedded action/Cmd/separator/keyboard pixels and
## style numbers retain original UI asset provenance. See T5-SOURCES.md.
const KEY: Dictionary = {"r":1,"rings":["z"],"fill":"x","top":["w",1]}
const Contract = preload("../../api/provider_contract.gd")
var _widgets: WeakRef
var _icon_cache: Dictionary = {}
const ICONS: Dictionary = {
	"dig":["..ttt..", ".tuuut.", "u..e..u", "...e...", "...e...", "...e...", "...e..."],
	"pour":["..ded..", "...e...", ".ddddd.", "dcccccd", "dccccdd", "dcccddd", ".ddddd."],
	"bomb":[".....l.", "....ek.", ".wwwe..", "wwwwuw.", "wwwwww.", "wwwwww.", ".wwww.."],
	"mouse_l":["mm.uu", "mm.uu", ".....", "uuuuu", "uuuuu", "uuuuu", ".uuu."],
	"mouse_r":["uu.mm", "uu.mm", ".....", "uuuuu", "uuuuu", "uuuuu", ".uuu."],
	"no":["i...i", ".i.i.", "..i..", ".i.i.", "i...i"]}
func configure(widgets: RefCounted) -> void:
	_widgets = weakref(widgets)
	clear_caches()
func _w() -> RefCounted:
	return _widgets.get_ref() if _widgets != null else null
func clear_caches() -> void:
	_icon_cache.clear()
func validate_items(items: Array[Dictionary]) -> Dictionary:
	if _w() == null or not _w().is_configured(): return Contract.result(["keycaps require configured widgets"])
	for item: Dictionary in items:
		var kinds: Array[String] = []
		for key: String in ["key", "sep", "icon", "hud"]:
			if item.has(key): kinds.append(key)
		if kinds.size() != 1: return Contract.result(["keycap item requires one resolved display kind"])
		var kind: String = kinds[0]
		var checked: Array[String] = Contract.fields(item, {kind:TYPE_STRING}, {"held":TYPE_BOOL} if kind == "key" else {}, "keycap")
		if not checked.is_empty() or str(item[kind]).is_empty(): return Contract.result(["invalid keycap fields"])
		if kind == "sep" and item.sep not in ["plus", "slash", "then"]: return Contract.result(["unknown separator"])
		if kind == "icon" and (not ICONS.has(item.icon) or icon_texture(item.icon) == null): return Contract.result(["missing required icon"])
		if kind == "hud" and _w().atlas("art:ui.icons", item.hud) == null: return Contract.result(["missing required HUD icon"])
		if kind == "key" and item.key == "cmd" and not _w().require_assets(["art:ui.key_cmd"]).ok: return Contract.result(["missing Cmd asset"])
	return Contract.result([])
func draw_items(parent: Node, at: Vector2, items: Array[Dictionary], onboarding: bool = false) -> Dictionary:
	var checked: Dictionary = validate_items(items)
	if not checked.ok: return checked
	var width: int = _paint_onboarding(parent, at, items) if onboarding else _paint_items(parent, at, items)
	return Contract.result([], {"width":width})
func device_items(parent: Node, at: Vector2, items: Array[Dictionary]) -> int:
	var checked: Dictionary = draw_items(parent, at, items)
	return int(checked.value.width) if checked.ok else 0
func validate_segments(segments: Array[Dictionary]) -> Dictionary:
	for part: Dictionary in segments:
		if part.has("items"):
			if part.size() != 1 or not part.items is Array: return Contract.result(["invalid resolved segments"])
			var typed: Array[Dictionary] = []
			for item: Variant in part.items:
				if not item is Dictionary: return Contract.result(["invalid resolved segments"])
				typed.append(item)
			if not validate_items(typed).ok: return Contract.result(["invalid resolved segments"])
		elif part.size() != 1 or not part.get("text") is String: return Contract.result(["invalid resolved segments"])
		elif "⌘" in part.text and not _w().require_assets(["art:ui.key_cmd"]).ok: return Contract.result(["invalid resolved segments"])
	return Contract.result([])
func device_segments(parent: Node, at: Vector2, segments: Array[Dictionary], room: int) -> Control:
	return _paint_segments(parent, at, segments, room)
func onboarding_key_row(parent: Node, at: Vector2, items: Array[Dictionary]) -> int:
	var checked: Dictionary = draw_items(parent, at, items, true)
	return int(checked.value.width) if checked.ok else 0
func icon_texture(kind: String) -> Texture2D:
	if not ICONS.has(kind) or _w() == null or not _w().require_assets(["art:ui.action_icon"]).ok: return null
	if _icon_cache.has(kind): return _icon_cache[kind]
	var rows: Array = ICONS[kind]
	var image: Image = Image.create(str(rows[0]).length() + 2, rows.size() + 2, false, Image.FORMAT_RGBA8)
	const PIXELS = preload("../render/palette_raster.gd")
	for y: int in rows.size():
		for x: int in str(rows[y]).length():
			if str(rows[y])[x] == ".": continue
			for delta: Vector2i in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
				image.set_pixelv(Vector2i(x + 1, y + 1) + delta, PIXELS.color_of("z"))
	for y: int in rows.size():
		for x: int in str(rows[y]).length():
			if str(rows[y])[x] != ".": image.set_pixel(x + 1, y + 1, PIXELS.color_of(str(rows[y])[x]))
	var texture: Texture2D = ImageTexture.create_from_image(image)
	_icon_cache[kind] = texture
	return texture

func device_keyboard(parent: Node, at: Vector2, code: String = "u") -> void:
	for y: int in 5:
		var rows: Array[String] = ["#######", "#.#.#.#", "#######", "##...##", "#######"]
		for x: int in 7:
			if rows[y][x] == "#": _w().rect(parent, Rect2(at + Vector2(x, y), Vector2.ONE), code)

func device_items_width(items: Array[Dictionary]) -> int:
	var width: int = 0
	for item: Dictionary in items:
		if item.has("key"): width += (11 if item.key == "cmd" else _w().key_width(item.key)) + 2
		elif item.has("sep"): width += (5 if item.sep == "plus" else 3) + 2
		elif item.has("hud"): width += 14
		else:
			var texture: Texture2D = icon_texture(item.icon)
			width += (texture.get_width() if texture != null else 9) + 2
	return maxi(0, width - 2)

func _paint_items(parent: Node, at: Vector2, items: Array[Dictionary]) -> int:
	if not validate_items(items).ok: return 0
	var x: int = int(at.x)
	for item: Dictionary in items:
		var width: int = 0
		if item.has("key"):
			var key: String = item.key
			width = 11 if key == "cmd" else _w().key_width(key)
			var key_y: int = int(at.y)
			if item.get("held", false):
				_w().box(parent, Rect2(x - 1, key_y, width + 2, 13), {"r":2, "rings":["m"]})
				key_y += 1
			if key == "cmd":
				_w().box(parent, Rect2(x, key_y, width, 11), KEY)
				var glyph: Array[String] = [".#...#.", "#.#.#.#", ".#####.", "..#.#..", ".#####.", "#.#.#.#", ".#...#."]
				for y: int in glyph.size():
					for column: int in glyph[y].length():
						if glyph[y][column] == "#": _w().rect(parent, Rect2(x + 2 + column, key_y + 2 + y, 1, 1), "t")
			else: _w().keycap(parent, Vector2(x, key_y), key)
		elif item.has("sep"):
			var glyph: Array = ["..#..", "..#..", "#####", "..#..", "..#.."] if item.sep == "plus" else ["..#", "..#", ".#.", ".#.", ".#.", "#..", "#.."] if item.sep == "slash" else ["#..", ".#.", "..#", ".#.", "#.."]
			width = glyph[0].length()
			for y: int in glyph.size():
				for column: int in width:
					if glyph[y][column] == "#": _w().rect(parent, Rect2(x + column, at.y + (2 if item.sep == "slash" else 3) + y, 1, 1), "u")
		elif item.has("hud"):
			_w().icon(parent, "art:ui.icons", item.hud, Vector2(x, at.y))
			width = 12
		else:
			var node := TextureRect.new()
			node.texture = icon_texture(item.icon)
			node.position = Vector2(x, at.y + 1)
			node.mouse_filter = Control.MOUSE_FILTER_IGNORE
			parent.add_child(node)
			width = node.texture.get_width() if node.texture != null else 9
		x += width + 2
	return maxi(0, x - int(at.x) - 2)

func _paint_segments(parent: Node, at: Vector2, segments: Array[Dictionary], room: int) -> Control:
	if not validate_segments(segments).ok: return null
	var node := Control.new()
	node.position = at
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	node.set_meta("device_component", true)
	parent.add_child(node)
	var x: int = 0
	var y: int = 0
	for part: Dictionary in segments:
		if part.has("items"):
			var width: int = device_items_width(part.items)
			if x + width > room and x > 0: x = 0; y += 13
			x += _paint_items(node, Vector2(x, y), part.items) + 1
		else:
			for character: String in str(part.text):
				var width: int = _w().measure(character, true)
				if character == "⌘": width = 11
				if character == "\n" or (x + width > room and x > 0):
					x = 0
					y += 13
					if character == "\n": continue
				if character == "⌘": _paint_items(node, Vector2(x, y), [{"key":"cmd"}])
				else: _w().text(node, Vector2(x, y + 1), character, "t", true)
				x += width
	node.size = Vector2(room, y + 13)
	return node


func _paint_onboarding(parent: Node, at: Vector2, items: Array[Dictionary]) -> int:
	if not validate_items(items).ok: return 0
	var x: int = int(at.x)
	for item: Dictionary in items:
		if not item.has("key"):
			x += _paint_items(parent, Vector2(x, at.y), [item]) + 2
			continue
		var key: String = str(item.key)
		var width: int = 11 if key == "cmd" else _w().key_width(key)
		var y: int = int(at.y)
		if item.get("held", false):
			_w().box(parent, Rect2(x - 1, y, width + 2, 13), {"r":2, "rings":["m"]})
			y += 1
			_w().box(parent, Rect2(x, y, width, 11), {"r":1, "rings":["z"], "fill":"x"})
		elif key == "cmd": _w().box(parent, Rect2(x, y, width, 11), KEY)
		if key == "cmd":
			var glyph: Array[String] = [".#...#.", "#.#.#.#", ".#####.", "..#.#..", ".#####.", "#.#.#.#", ".#...#."]
			for row: int in glyph.size():
				for column: int in glyph[row].length():
					if glyph[row][column] == "#": _w().rect(parent, Rect2(x + 2 + column, y + 2 + row, 1, 1), "t")
		elif item.get("held", false): _w().text(parent, Vector2(x + width / 2, y + 1), key, "t", true, "c")
		else: _w().keycap(parent, Vector2(x, y), key)
		x += width + 2
	return maxi(0, x - int(at.x) - 2)
