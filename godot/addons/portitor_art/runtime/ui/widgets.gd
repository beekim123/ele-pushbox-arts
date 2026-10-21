class_name PortitorArtWidgets
extends RefCounted
## G2 tokens and pixel geometry mirror workbench/js/core/ui-common.js.
## Text stays live and localized; textures contain only palette shapes.
const RASTER = preload("../render/palette_raster.gd")
const PANEL: Dictionary = {"r": 4, "rings": ["z", "u"], "fill": "y"}
const SMALL: Dictionary = {"r": 3, "rings": ["z", "u"], "fill": "y"}
const BUTTONS: Dictionary = {
	"n": {"r": 3, "rings": ["z"], "fill": "x", "top": ["w", 1]},
	"sel": {"r": 3, "rings": ["z"], "fill": "t", "bottom": ["u", 1]},
	"dis": {"r": 3, "rings": ["z", "x"], "fill": "y"}}
const INK: Dictionary = {"n": "t", "sel": "y", "dis": "w"}
const KEY: Dictionary = {"r": 1, "rings": ["z"], "fill": "x", "top": ["w", 1]}
const NEIGHBORS: Array[Vector2i] = [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]
var _textures: Dictionary = {}
var _fonts: Dictionary = {}

const Contract = preload("../../api/provider_contract.gd")
const FontStyle = preload("font_style.gd")
const Keycaps = preload("keycaps.gd")
const FontMask = preload("font_mask.gd")
var provider: RefCounted
var fonts: RefCounted
var keycaps: RefCounted
var font_mask: RefCounted

func configure(value: RefCounted) -> Dictionary:
	var next_fonts: RefCounted = FontStyle.new()
	var checked: Dictionary = next_fonts.configure(value)
	if not checked.ok: return checked
	provider = value
	fonts = next_fonts
	keycaps = Keycaps.new()
	keycaps.configure(self)
	font_mask = FontMask.new()
	font_mask.configure(self)
	clear_caches()
	return Contract.result([], {"resource_root":fonts.resource_root})

func is_configured() -> bool:
	return provider != null and fonts != null

func clear_caches() -> void:
	_textures.clear()
	_fonts.clear()
	if keycaps != null: keycaps.clear_caches()

func require_assets(uids: Array) -> Dictionary:
	for uid: String in uids:
		var checked: Dictionary = Contract.require_capability(provider, uid)
		if not checked.ok: return checked
	return Contract.result([])

func ui_font(small: bool = false) -> Font:
	return fonts.font(small) if fonts != null else null

func font(small: bool = false) -> Font:
	return fonts.g2_font(small) if fonts != null else null

func measure(value: String, small: bool = false) -> int:
	return roundi(font(small).get_string_size(value, HORIZONTAL_ALIGNMENT_LEFT, -1, 10 if small else 12).x)

func fit(value: String, room: int, small: bool = false) -> String:
	if measure(value, small) <= room:
		return value
	var result: String = value
	while not result.is_empty() and measure(result + "…", small) > room:
		result = result.left(-1)
	return result + "…" if room >= measure("…", small) else ""

func text(parent: Node, at: Vector2, value: String, code: String = "t", small: bool = false, align: String = "l", room: int = -1) -> Label:
	var shown: String = fit(value, room, small) if room >= 0 else value
	var width: int = measure(shown, small)
	var node: Label = label(shown, maxi(1, width), small)
	node.add_theme_font_override("font", font(small))
	node.position = at - Vector2(width / 2 if align == "c" else width if align == "r" else 0, 2 if small else 1)
	node.add_theme_color_override("font_color", RASTER.color_of(code))
	parent.add_child(node)
	return node

func mask(dimensions: Vector2i, radius: int) -> Dictionary:
	var result: Dictionary = {}
	for y: int in dimensions.y:
		for x: int in dimensions.x:
			var dx: float = maxf(0, radius - minf(x + 0.5, dimensions.x - x - 0.5))
			var dy: float = maxf(0, radius - minf(y + 0.5, dimensions.y - y - 0.5))
			if dx * dx + dy * dy <= radius * radius:
				result[Vector2i(x, y)] = true
	return result

func _shrink(points: Dictionary) -> Dictionary:
	var result: Dictionary = {}
	for point: Vector2i in points:
		var inside: bool = true
		for offset: Vector2i in NEIGHBORS + [Vector2i(-1, -1), Vector2i(1, -1), Vector2i(-1, 1), Vector2i(1, 1)]:
			if not points.has(point + offset):
				inside = false
				break
		if inside:
			result[point] = true
	return result

func box_texture(dimensions: Vector2i, style: Dictionary) -> Texture2D:
	var key: String = str(dimensions) + JSON.stringify(style)
	if _textures.has(key):
		return _textures[key]
	var image: Image = Image.create(dimensions.x, dimensions.y, false, Image.FORMAT_RGBA8)
	var points: Dictionary = mask(dimensions, int(style.get("r", 0)))
	for code: String in style.get("rings", []):
		var inside: Dictionary = _shrink(points)
		for point: Vector2i in points:
			if not inside.has(point): image.set_pixelv(point, RASTER.color_of(code))
		points = inside
	for point: Vector2i in points:
		if style.has("fill"): image.set_pixelv(point, RASTER.color_of(style.fill))
	for side: String in ["top", "bottom"]:
		if not style.has(side): continue
		var band: Array = style[side]
		var direction: int = -1 if side == "top" else 1
		for point: Vector2i in points:
			for offset: int in range(1, int(band[1]) + 1):
				if not points.has(point + Vector2i(0, direction * offset)):
					image.set_pixelv(point, RASTER.color_of(band[0]))
					break
	var texture: ImageTexture = ImageTexture.create_from_image(image)
	_textures[key] = texture
	return texture

func box(parent: Node, rect: Rect2, style: Dictionary) -> TextureRect:
	var node := TextureRect.new()
	node.texture = box_texture(Vector2i(rect.size), style)
	node.position = rect.position
	node.size = rect.size
	node.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(node)
	return node

func rect(parent: Node, area: Rect2, code: String) -> ColorRect:
	var node := ColorRect.new()
	node.position = area.position
	node.size = area.size
	node.color = RASTER.color_of(code)
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(node)
	return node

func panel(parent: Node, area: Rect2, small: bool = false) -> TextureRect:
	return box(parent, area, SMALL if small else PANEL)

func plate(parent: Node, area: Rect2) -> TextureRect:
	return box(parent, area, SMALL)

func heading(parent: Node, at: Vector2, value: String, room: int = 304) -> void:
	var shown: String = fit(value, room - 14)
	plate(parent, Rect2(at, Vector2(measure(shown) + 14, 17)))
	text(parent, at + Vector2(7, 3), shown)

func title(parent: Node, area: Rect2, value: String) -> void:
	var shown: String = fit(value, int(area.size.x) - 40)
	var width: int = measure(shown)
	var center: int = int(area.position.x) + int(area.size.x) / 2
	text(parent, Vector2(center, area.position.y + 6), shown, "t", false, "c")
	rect(parent, Rect2(center - width / 2 - 13, area.position.y + 11, 7, 1), "m")
	rect(parent, Rect2(center + width - width / 2 + 6, area.position.y + 11, 7, 1), "m")
	rect(parent, Rect2(area.position.x + 6, area.position.y + 20, area.size.x - 12, 1), "x")

func row(parent: Node, area: Rect2) -> TextureRect:
	return box(parent, area, {"r": 3, "fill": "t"})

func button(parent: Node, area: Rect2, value: String, action: Callable) -> Button:
	var node := Button.new()
	node.position = area.position
	node.size = Vector2(maxf(area.size.x, measure(value) + 12), area.size.y)
	node.text = value
	node.add_theme_font_override("font", font())
	node.add_theme_font_size_override("font_size", 12)
	for state: String in ["normal", "hover", "pressed", "focus", "disabled"]:
		var token: String = "dis" if state == "disabled" else "n" if state == "normal" else "sel"
		var style := StyleBoxTexture.new()
		style.texture = box_texture(Vector2i(node.size), BUTTONS[token])
		node.add_theme_stylebox_override(state, style)
		node.add_theme_color_override("font_" + ("color" if state == "normal" else state + "_color"), RASTER.color_of(INK[token]))
	node.pressed.connect(action)
	parent.add_child(node)
	return node

func arrow(parent: Node, at: Vector2, direction: String, code: String = "m") -> void:
	for i: int in 3:
		for j: int in range(-i, i + 1):
			var offset: Vector2 = Vector2(i, j) if direction == "left" else Vector2(-i, j) if direction == "right" else Vector2(j, i) if direction == "up" else Vector2(j, -i)
			rect(parent, Rect2(at + offset, Vector2.ONE), code)

func cursor(parent: Node, at: Vector2, direction: String = "right") -> Control:
	var node := Control.new()
	node.position = at
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(node)
	var points: Dictionary = {}
	for i: int in 4:
		for j: int in range(-i, i + 1):
			points[Vector2i(i, j) if direction == "left" else Vector2i(-i, j) if direction == "right" else Vector2i(j, i) if direction == "up" else Vector2i(j, -i)] = true
	for point: Vector2i in points:
		for offset: Vector2i in NEIGHBORS:
			if not points.has(point + offset): rect(node, Rect2(Vector2(point + offset), Vector2.ONE), "z")
	for point: Vector2i in points:
		rect(node, Rect2(Vector2(point), Vector2.ONE), "m")
	return node

func key_width(value: String) -> int:
	return 11 if value in ["up", "down", "left", "right"] else measure(value, true) + 7

func keycap(parent: Node, at: Vector2, value: String) -> int:
	var width: int = key_width(value)
	box(parent, Rect2(at, Vector2(width, 11)), KEY)
	if value in ["up", "down", "left", "right"]:
		arrow(parent, at + (Vector2(5, 3) if value == "up" else Vector2(5, 7) if value == "down" else Vector2(4, 5) if value == "left" else Vector2(6, 5)), value, "t")
	else:
		text(parent, at + Vector2(width / 2, 1), value, "t", true, "c")
	return width

func keybar(parent: Node, groups: Array[Dictionary], at: Vector2 = Vector2(160, 164)) -> void:
	var width: int = 0
	for index: int in groups.size():
		var group: Dictionary = groups[index]
		for key: String in group["keys"]:
			width += key_width(key) + 1
		width += 2 + measure(group.label, true) + (9 if index < groups.size() - 1 else 0)
	var x: int = int(at.x) - (width + 12) / 2
	plate(parent, Rect2(x, at.y - 2, width + 12, 15))
	x += 6
	for group: Dictionary in groups:
		for index: int in group["keys"].size():
			x += keycap(parent, Vector2(x, at.y), group["keys"][index]) + (1 if index < group["keys"].size() - 1 else 0)
		x += 3
		text(parent, Vector2(x, at.y + 1), group.label, "t", true)
		x += measure(group.label, true) + 9

func slider(parent: Node, at: Vector2, width: int, value: float) -> Control:
	var node := Control.new()
	node.position = at
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(node)
	var fx: int = 3 + roundi((width - 7) * clampf(value, 0, 1))
	box(node, Rect2(0, 2, width, 5), {"r": 2, "rings": ["z"], "fill": "x"})
	rect(node, Rect2(1, 3, fx - 1, 3), "m")
	box(node, Rect2(fx - 3, 0, 7, 9), {"r": 2, "rings": ["z"], "fill": "t"})
	return node

func toggle(parent: Node, at: Vector2, enabled: bool) -> void:
	box(parent, Rect2(at, Vector2(19, 11)), {"r": 5, "rings": ["z"], "fill": "m" if enabled else "x"})
	box(parent, Rect2(at + Vector2(9 if enabled else 1, 1), Vector2(9, 9)), {"r": 4, "fill": "t"})

func tag(parent: Node, at: Vector2, value: String, quiet: bool = false) -> int:
	var width: int = measure(value, true) + 8
	box(parent, Rect2(at, Vector2(width, 12)), {"r": 2, "rings": ["u"], "fill": "y"} if quiet else {"r": 2, "fill": "m"})
	text(parent, at + Vector2(4, 1), value, "t" if quiet else "y", true)
	return width

func well(parent: Node, area: Rect2, selected: bool = false) -> TextureRect:
	return box(parent, area, {"r": 2, "rings": ["m" if selected else "z"], "fill": "z"})

func dot(parent: Node, center: Vector2, radius: int, code: String) -> void:
	var points: Dictionary = {}
	for y: int in range(-radius, radius + 1):
		for x: int in range(-radius, radius + 1):
			if x * x + y * y <= radius * radius + radius * 0.8: points[Vector2i(x, y)] = true
	for point: Vector2i in points:
		for offset: Vector2i in NEIGHBORS:
			if not points.has(point + offset): rect(parent, Rect2(center + Vector2(point + offset), Vector2.ONE), "z")
	for point: Vector2i in points:
		rect(parent, Rect2(center + Vector2(point), Vector2.ONE), code)

func icon(parent: Node, uid: String, animation: String, at: Vector2, code: String = "") -> TextureRect:
	return _place_icon(parent,atlas(uid,animation),at,code)

func icon_frame(parent: Node, uid: String, frame: int, at: Vector2, code: String = "") -> TextureRect:
	return _place_icon(parent,atlas_frame(uid,frame),at,code)

func _place_icon(parent: Node, atlas: AtlasTexture, at: Vector2, code: String) -> TextureRect:
	if atlas == null: return null
	var texture: Texture2D = atlas
	if not code.is_empty():
		var pixels: Image = atlas.get_image()
		for y: int in pixels.get_height():
			for x: int in pixels.get_width():
				if pixels.get_pixel(x, y).a > 0: pixels.set_pixel(x, y, RASTER.color_of(code))
		texture = ImageTexture.create_from_image(pixels)
	var node := TextureRect.new()
	node.texture = texture
	node.position = at
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(node)
	return node

func overlay_capsule(parent: Node, area: Rect2) -> void:
	box(parent, area, {"r":4, "rings":["r"], "fill":"y"})
	rect(parent, Rect2(area.position + Vector2(2, 0), Vector2(area.size.x - 4, 1)), "s")
	rect(parent, Rect2(area.position + Vector2(2, area.size.y - 1), Vector2(area.size.x - 4, 1)), "q")

func pip(parent: Node, center: Vector2, code: String, radius: int = 2, filled: bool = true) -> void:
	var points: Dictionary = {}
	for y: int in range(-radius, radius + 1):
		for x: int in range(-radius, radius + 1):
			if absi(x) + absi(y) <= radius: points[Vector2i(x, y)] = true
	for point: Vector2i in points:
		for neighbor: Vector2i in NEIGHBORS:
			if not points.has(point + neighbor): rect(parent, Rect2(center + Vector2(point + neighbor), Vector2.ONE), "z")
	for point: Vector2i in points: rect(parent, Rect2(center + Vector2(point), Vector2.ONE), code if filled or absi(point.x) + absi(point.y) == radius else "y")
	if filled: rect(parent, Rect2(center + Vector2(0, -1), Vector2.ONE), "t")

func overlay_icon(parent: Node, uid: String, animation: String, at: Vector2, dim: bool) -> TextureRect:
	var node: TextureRect = icon(parent, uid, animation, at)
	return _shade_overlay_icon(node,dim)

func overlay_icon_frame(parent: Node, uid: String, frame: int, at: Vector2, dim: bool) -> TextureRect:
	return _shade_overlay_icon(icon_frame(parent,uid,frame,at),dim)

func _shade_overlay_icon(node: TextureRect, dim: bool) -> TextureRect:
	if node == null or not dim: return node
	var shades: Dictionary = {"t":"u", "u":"v", "v":"w", "w":"x", "x":"y", "y":"z", "l":"k", "k":"j", "j":"b", "b":"e", "e":"f", "f":"g", "d":"e", "c":"d", "s":"r", "r":"q", "q":"p", "m":"n", "n":"o", "o":"p"}
	var replacements: Dictionary = {}
	for code: String in shades: replacements[RASTER.color_of(code).to_rgba32()] = RASTER.color_of(shades[code])
	var pixels: Image = node.texture.get_image()
	for y: int in pixels.get_height():
		for x: int in pixels.get_width():
			var color: Color = pixels.get_pixel(x, y)
			var opaque: Color = Color(color.r, color.g, color.b, 1)
			if color.a > 0 and replacements.has(opaque.to_rgba32()):
				var shade: Color = replacements[opaque.to_rgba32()]
				shade.a = color.a
				pixels.set_pixel(x, y, shade)
	node.texture = ImageTexture.create_from_image(pixels)
	node.set_meta("g2_overlay_dimmed", true)
	return node


# Device keycaps, including the approved ui.key_cmd bitmap (no font fallback).
func device_keyboard(parent: Node, at: Vector2, code: String = "u") -> void:
	keycaps.device_keyboard(parent, at, code)
func device_items_width(items: Array[Dictionary]) -> int:
	return keycaps.device_items_width(items)
func device_items(parent: Node, at: Vector2, items: Array[Dictionary]) -> int:
	return keycaps.device_items(parent, at, items)
func device_segments(parent: Node, at: Vector2, segments: Array[Dictionary], room: int) -> Control:
	return keycaps.device_segments(parent, at, segments, room)

# The approved onboarding how row uses word/CJK units and a held modifier.
# Keep it separate from the existing live input/key-hint components.
func onboarding_how_layout(units: Array[Dictionary], room: int) -> Dictionary:
	var rows: Array = [[]]
	var width: int = 0
	for unit: Dictionary in units:
		var space: bool = not unit.has("items") and str(unit.s).strip_edges().is_empty()
		var uw: int = _onboarding_how_unit_width(unit)
		var row: Array = rows.back()
		if space and row.is_empty(): continue
		if row.is_empty() or width + uw <= room or space:
			row.append(unit)
			width += uw
			continue
		if not unit.has("items") and "，。：；、！？）」』”…,.:;!?)".contains(str(unit.s).left(1)) and row.size() > 1 and not row.back().has("items"):
			var previous: Dictionary = row.pop_back()
			rows.append([previous, unit])
			width = _onboarding_how_unit_width(previous) + uw
			continue
		while not row.is_empty() and not row.back().has("items") and str(row.back().s).strip_edges().is_empty(): row.pop_back()
		rows.append([unit])
		width = uw
	for row: Array in rows:
		while not row.is_empty() and not row.back().has("items") and str(row.back().s).strip_edges().is_empty(): row.pop_back()
	return {"rows":rows}

func _onboarding_how_unit_width(unit: Dictionary) -> int:
	return device_items_width(unit.items) + 2 if unit.has("items") else measure(str(unit.s), true)

func onboarding_how_row(parent: Node, at: Vector2, layout: Dictionary, room: int) -> Control:
	var node := Control.new()
	node.position = at
	node.size = Vector2(room, layout.rows.size() * 13)
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	node.set_meta("device_component", true)
	parent.add_child(node)
	for index: int in layout.rows.size():
		var x: int = 0
		var run_x: int = 0
		var run: String = ""
		for unit: Dictionary in layout.rows[index]:
			if unit.has("items"):
				if not run.is_empty(): text(node, Vector2(run_x, index * 13 + 1), run, "t", true, "l", room - run_x)
				run = ""
				onboarding_key_row(node, Vector2(x + 1, index * 13), unit.items)
				x += device_items_width(unit.items) + 2
				run_x = x
			else:
				if run.is_empty(): run_x = x
				run += str(unit.s)
				x += measure(str(unit.s), true)
		if not run.is_empty(): text(node, Vector2(run_x, index * 13 + 1), run, "t", true, "l", room - run_x)
	return node

func onboarding_key_row(parent: Node, at: Vector2, items: Array[Dictionary]) -> int:
	return keycaps.onboarding_key_row(parent, at, items)

# ui-common.js logo: scale-two outlined heading, spaced subtitle and tagline.
func logo(parent: Node, at: Vector2, title_value: String, tagline: String) -> Control:
	var stencil: RefCounted = font_mask
	var pixels: Image = Image.create(320, 180, false, Image.FORMAT_RGBA8)
	var paint: Callable = func(points: Dictionary, origin: Vector2i, code: String) -> void:
		for p: Vector2i in points:
			var target: Vector2i = p + origin
			if Rect2i(0, 0, 320, 180).has_point(target): pixels.set_pixelv(target, RASTER.color_of(code))
	var headline: Dictionary = stencil.textset(title_value, false, 2)
	var outline: Dictionary = stencil.grow(headline.P, 1, false)
	paint.call(outline, Vector2i(at) + Vector2i(0, 2), "y")
	paint.call(outline, Vector2i(at), "z")
	paint.call(headline.P, Vector2i(at), "t")
	var subtitle: Dictionary = stencil.textset("PORTITOR", true, 1, 2)
	paint.call(stencil.grow(subtitle.P, 1, false), Vector2i(at) + Vector2i(2, 28), "z")
	paint.call(subtitle.P, Vector2i(at) + Vector2i(2, 28), "m")
	var tag: Dictionary = stencil.textset(tagline, true)
	paint.call(stencil.grow(tag.P, 1, false), Vector2i(at) + Vector2i(0, 43), "z")
	paint.call(tag.P, Vector2i(at) + Vector2i(0, 43), "t")
	var node := TextureRect.new()
	node.texture = ImageTexture.create_from_image(pixels)
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(node)
	return node

# ui-common.js coins: 17px plate; amount uses the normal 12px face.
func coins(parent: Node, at: Vector2, amount: int) -> int:
	var value: String = str(amount)
	var comma: int = value.length() - 3
	while comma > 0:
		value = value.insert(comma, ",")
		comma -= 3
	var width: int = 25 + measure(value)
	var x: int = int(at.x) - width
	plate(parent, Rect2(x, at.y, width, 17))
	var cx: int = x + 10
	var cy: int = int(at.y) + 8
	for dy: int in range(-4, 5):
		for dx: int in range(-4, 5):
			var distance: int = dx * dx + dy * dy
			if distance <= 16: rect(parent, Rect2(cx + dx, cy + dy, 1, 1), "k" if distance <= 9 else "z")
	rect(parent, Rect2(cx - 1, cy - 2, 3, 1), "l")
	rect(parent, Rect2(cx - 2, cy - 1, 1, 3), "l")
	rect(parent, Rect2(cx + 2, cy + 1, 1, 1), "j")
	text(parent, Vector2(x + 19, at.y + 3), value)
	return width

const UI_INK := Color("c0cbdc")
const GOLD := Color("fee761")
func label(text: String, width: float, small: bool = false, wrap: bool = false) -> Label:
	var node := Label.new()
	node.add_theme_font_override("font", ui_font(small))
	node.add_theme_font_size_override("font_size", 10 if small else 12)
	node.add_theme_color_override("font_color", UI_INK)
	node.add_theme_constant_override("line_spacing", 0)
	node.custom_minimum_size.x = width
	node.size.x = width
	if wrap:
		node.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		node.custom_maximum_size.x = width
	else:
		node.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	node.text = text
	node.reset_size()
	node.size.x = width
	# Font overrides invalidate minimum-size caches after entering the tree.
	# Reset again after that notification so the initial default-font height
	# cannot survive on absolutely positioned labels.
	node.call_deferred("reset_size")
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return node

func atlas(uid: String, animation: String = "default", index: int = 0) -> AtlasTexture:
	if not Contract.require_capability(provider, uid).ok: return null
	var art: Dictionary = provider.metadata(uid)
	var texture: Texture2D = provider.texture(uid)
	if texture == null: return null
	var dimensions: Array = art.get("size", [16,16])
	var frames: Array = art.get("animations", {}).get(animation, {}).get("frames", [])
	if frames.is_empty() or dimensions.size() != 2 or int(dimensions[0]) <= 0 or int(dimensions[1]) <= 0: return null
	var frame: int = int(frames[posmod(index, frames.size())])
	if frame < 0 or (frame + 1) * int(dimensions[0]) > texture.get_width() or int(dimensions[1]) > texture.get_height(): return null
	var result := AtlasTexture.new()
	result.atlas = texture
	result.region = Rect2(frame * int(dimensions[0]), 0, int(dimensions[0]), int(dimensions[1]))
	return result

func atlas_frame(uid: String, frame: int) -> AtlasTexture:
	if not Contract.require_capability(provider, uid).ok: return null
	var art: Dictionary = provider.metadata(uid)
	var texture: Texture2D = provider.texture(uid)
	var dimensions: Variant = art.get("size")
	if texture == null or not dimensions is Array or dimensions.size() != 2: return null
	var width: int = int(dimensions[0])
	var height: int = int(dimensions[1])
	if width <= 0 or height <= 0 or frame < 0 or (frame + 1) * width > texture.get_width() or height != texture.get_height(): return null
	var result := AtlasTexture.new()
	result.atlas = texture
	result.region = Rect2(frame * width,0,width,height)
	return result

func panel_style(frame: int = 0) -> StyleBox:
	var texture: AtlasTexture = atlas_frame("art:ui.panel", frame)
	if texture == null:
		return null
	var result := StyleBoxTexture.new()
	result.texture = texture
	for side: int in [SIDE_LEFT, SIDE_TOP, SIDE_RIGHT, SIDE_BOTTOM]:
		result.set_texture_margin(side, 6)
		result.set_content_margin(side, 0)
	return result

func factory_button(text: String, action: Callable, width: float = 100, icon_uid: String = "", icon_animation: String = "default") -> Button:
	if panel_style() == null or panel_style(1) == null: return null
	if not icon_uid.is_empty() and atlas(icon_uid, icon_animation) == null: return null
	var node := Button.new()
	node.text = text
	node.add_theme_font_override("font", ui_font())
	node.add_theme_font_size_override("font_size", 12)
	node.add_theme_color_override("font_color", UI_INK)
	node.add_theme_color_override("font_focus_color", GOLD)
	node.add_theme_color_override("font_hover_color", GOLD)
	node.add_theme_stylebox_override("normal", panel_style())
	node.add_theme_stylebox_override("focus", panel_style(1))
	node.add_theme_stylebox_override("hover", panel_style(1))
	node.add_theme_stylebox_override("pressed", panel_style(1))
	node.custom_minimum_size = Vector2(width, 15)
	node.alignment = HORIZONTAL_ALIGNMENT_LEFT
	if not icon_uid.is_empty():
		node.icon = atlas(icon_uid, icon_animation)
	if action.is_valid(): node.pressed.connect(action)
	return node

func factory_panel(rect: Rect2, frame: int = 0) -> PanelContainer:
	if panel_style(frame) == null: return null
	var node := PanelContainer.new()
	node.position = rect.position
	node.size = rect.size
	node.add_theme_stylebox_override("panel", panel_style(frame))
	return node

func margin(left: int = 6, top: int = 3, right: int = 6, bottom: int = 3) -> MarginContainer:
	var node := MarginContainer.new()
	for pair: Array in [["margin_left", left], ["margin_top", top], ["margin_right", right], ["margin_bottom", bottom]]:
		node.add_theme_constant_override(pair[0], pair[1])
	return node

func column(gap: int = 1) -> VBoxContainer:
	var node := VBoxContainer.new()
	node.add_theme_constant_override("separation", gap)
	return node
