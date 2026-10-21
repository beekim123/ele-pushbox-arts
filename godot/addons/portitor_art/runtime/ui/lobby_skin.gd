class_name PortitorArtLobbySkin
extends Control
## Source: game/presentation/ui/widgets/lobby_skins.gd (825-line pre-T5 source),
## itself a port of workbench/js/core/ui-skins.js. Only explicit display data is read.
## Sampling/geometry algorithms and embedded art have separate provenance: the
## six skin recipes, palette/style values, RUNES and decorative pixel strings
## retain the original UI asset terms; generated glyph masks retain the source
## fonts' OFL/copyright notices. Brand/character rights remain reserved. This
## mixed-content file is not covered by a blanket MIT asset grant; see T5 inventory.
const RASTER = preload("../render/palette_raster.gd")
const BY_THEME: Dictionary = {"dungeon":"S2", "ruins":"S3", "cave":"S1", "forest":"S5", "sky":"S4", "cosmos":"S6"}
const N4: Array[Vector2i] = [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]
const N8: Array[Vector2i] = [Vector2i(-1,-1),Vector2i(0,-1),Vector2i(1,-1),Vector2i(-1,0),Vector2i(1,0),Vector2i(-1,1),Vector2i(0,1),Vector2i(1,1)]
const BAYER: Array = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]]
# Original UI rune pixel data (pre-T5 source line 11), not algorithm licensing.
const RUNES: Array[String] = ["..#..\n.#.#.\n#.#.#\n..#..\n..#..", "#...#\n.#.#.\n..#..\n.#.#.\n#...#", "##...\n#.#..\n##...\n#.#..\n#..#.", "#.#..\n##...\n#.#..\n#..#.\n#...#", ".###.\n#...#\n..#..\n#...#\n.###.", "#####\n..#..\n.#.#.\n#...#\n#...#"]
const DISPLAY_TEXT: Array[String] = ["title", "titleEn", "tag", "curTag", "cur", "coins", "keySelect", "keyConfirm"]
var G2: RefCounted
var _pixels: Image
var _dirty: bool = false
var _data: Dictionary
var _theme: String
var _selection: int = 0
var _layers: Control
var _rows: Array[Rect2] = []
var _glyphs: Dictionary = {}
var _atlases: Dictionary = {}
var _font_sources: Dictionary = {}

func configure_display(widgets: RefCounted, theme: String, data: Dictionary) -> Dictionary:
	var errors: Array[String] = _display_errors(widgets, theme, data)
	if not errors.is_empty(): return _result(errors)
	var required: Array[String] = ["art:ui.menu_icons", "art:ui.theme_emblem"]
	var available: Dictionary = widgets.require_assets(required)
	if not available.ok: return available
	var provider: RefCounted = widgets.provider
	var icon_metadata: Dictionary = provider.metadata("art:ui.menu_icons")
	var emblem_metadata: Dictionary = provider.metadata("art:ui.theme_emblem")
	var icon_texture: Texture2D = provider.texture("art:ui.menu_icons")
	var emblem_texture: Texture2D = provider.texture("art:ui.theme_emblem")
	errors.append_array(_animation_errors(emblem_metadata, theme, emblem_texture))
	for item: Dictionary in data.items:
		errors.append_array(_animation_errors(icon_metadata, item.icon, icon_texture))
	if not errors.is_empty(): return _result(errors)
	# Commit after all model, font and resource checks. Failed attempts preserve
	# the previous widgets, model, rendered layers, menu bounds and glyph caches.
	G2 = widgets
	_theme = theme
	_data = data.duplicate(true)
	_glyphs.clear()
	_atlases.clear()
	_font_sources.clear()
	size = Vector2(320,180)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	redraw(0)
	return _result([], true)

func _display_errors(widgets: RefCounted, theme: String, data: Dictionary) -> Array[String]:
	var errors: Array[String] = []
	if widgets == null:
		errors.append("lobby display: explicit configured widgets are required")
	else:
		for method: String in ["is_configured", "require_assets", "font", "measure", "text", "mask", "_shrink", "icon"]:
			if not widgets.has_method(method): errors.append("lobby display: widgets missing " + method)
		if errors.is_empty():
			if not widgets.is_configured():
				errors.append("lobby display: widgets are not configured")
			else:
				for small: bool in [false, true]:
					var face: FontVariation = widgets.font(small) as FontVariation
					if face == null or not face.base_font is FontFile:
						errors.append("lobby display: explicit bitmap font is required")
	if not BY_THEME.has(theme): errors.append("lobby display: unsupported theme " + theme)
	for key: Variant in data:
		if not (key is String or key is StringName) or (key not in DISPLAY_TEXT and key != "items"):
			errors.append("lobby display: undeclared field " + str(key))
	for key: String in DISPLAY_TEXT:
		if not data.has(key) or not data[key] is String: errors.append("lobby display." + key + ": expected String")
	if data.get("title") is String and data.title.is_empty(): errors.append("lobby display.title: expected nonempty text")
	if not data.get("items") is Array:
		errors.append("lobby display.items: expected Array")
	else:
		if data.items.is_empty() or data.items.size() > 4:
			errors.append("lobby display.items: expected one to four menu items")
			return errors
		for index: int in data.items.size():
			var item: Variant = data.items[index]
			if not item is Dictionary:
				errors.append("lobby display.items." + str(index) + ": expected display Dictionary")
				continue
			for key: Variant in item:
				if not (key is String or key is StringName) or key not in ["label", "icon", "detail"]:
					errors.append("lobby display.items." + str(index) + ": undeclared field " + str(key))
			for key: String in ["label", "icon"]:
				if not item.get(key) is String: errors.append("lobby display.items." + str(index) + "." + key + ": expected String")
			if item.has("detail") and not item.detail is String: errors.append("lobby display.items." + str(index) + ".detail: expected String")
	return errors

func _animation_errors(metadata: Dictionary, animation: String, texture: Texture2D) -> Array[String]:
	var errors: Array[String] = []
	var dimensions: Variant = metadata.get("size")
	var frame_count: Variant = metadata.get("frame_count")
	if not dimensions is Array or dimensions.size() != 2:
		return ["lobby display: missing sprite dimensions"]
	if not _pixel_integer(dimensions[0]) or not _pixel_integer(dimensions[1]) or dimensions[0] <= 0 or dimensions[1] <= 0:
		return ["lobby display: invalid sprite dimensions"]
	if not _pixel_integer(frame_count) or frame_count < 1:
		return ["lobby display: invalid sprite frame count"]
	if texture == null or int(dimensions[0]) * int(frame_count) != texture.get_width() or int(dimensions[1]) != texture.get_height():
		return ["lobby display: sprite dimensions/frame count do not match texture"]
	var animations: Variant = metadata.get("animations")
	if not animations is Dictionary or not animations.get(animation) is Dictionary:
		errors.append("lobby display: missing animation " + animation + " for " + str(metadata.get("uid", "")))
		return errors
	var frames: Variant = animations[animation].get("frames")
	if not frames is Array or frames.is_empty():
		errors.append("lobby display: animation requires explicit nonempty frames " + animation)
		return errors
	for frame: Variant in frames:
		if not _pixel_integer(frame) or frame < 0 or frame >= frame_count: errors.append("lobby display: animation frame outside sheet " + animation)
	return errors

static func _pixel_integer(value: Variant) -> bool:
	if not (value is int or value is float): return false
	return is_finite(float(value)) and float(value) == floor(float(value))

func _result(errors: Array[String], value: Variant = null) -> Dictionary:
	return {"ok":errors.is_empty(), "errors":errors, "value":value if errors.is_empty() else null}

func menu_rows() -> Array[Rect2]:
	return _rows.duplicate()

func get_semantic_anchor(id: String) -> Rect2:
	var index: int = _menu_index(id)
	return _rows[index] if index >= 0 else Rect2()

func query_element(id: String) -> Dictionary:
	var index: int = _menu_index(id)
	if index < 0: return {}
	return {"id":id, "bounds":_rows[index], "label":_data.items[index].label, "selected":index == _selection}

func _menu_index(id: String) -> int:
	if not id.begins_with("lobby.menu."): return -1
	var suffix: String = id.trim_prefix("lobby.menu.")
	if not suffix.is_valid_int(): return -1
	var index: int = suffix.to_int()
	return index if suffix == str(index) and index >= 0 and index < _rows.size() else -1

func redraw(selection: int) -> void:
	if G2 == null or _data.is_empty(): return
	_selection = selection
	if _layers != null:
		remove_child(_layers)
		_layers.queue_free()
	_layers = Control.new()
	_layers.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_layers)
	_pixels = Image.create(320,180,false,Image.FORMAT_RGBA8)
	_dirty = false
	_rows.clear()
	match BY_THEME[_theme]:
		"S1": _crystal()
		"S2": _runes()
		"S3": _jade()
		"S4": _candy()
		"S5": _wood()
		"S6": _space()
	_flush()

func _flush() -> void:
	if not _dirty: return
	var layer := TextureRect.new()
	layer.texture = ImageTexture.create_from_image(_pixels)
	layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	_layers.add_child(layer)
	_pixels = Image.create(320,180,false,Image.FORMAT_RGBA8)
	_dirty = false

func _px(x: int, y: int, code: String) -> void:
	if x >= 0 and x < 320 and y >= 0 and y < 180:
		_pixels.set_pixel(x,y,RASTER.color_of(code))
		_dirty = true

func _rect(x: int, y: int, w: int, h: int, code: String) -> void:
	for yy: int in range(y,y+h):
		for xx: int in range(x,x+w): _px(xx,yy,code)

func _h(x: int, y: int, w: int, code: String) -> void: _rect(x,y,w,1,code)
func _v(x: int, y: int, h: int, code: String) -> void: _rect(x,y,1,h,code)
func _frame(x: int, y: int, w: int, h: int, code: String) -> void:
	_h(x,y,w,code); _h(x,y+h-1,w,code); _v(x,y,h,code); _v(x+w-1,y,h,code)

func _rect_mask(x: int, y: int, w: int, h: int) -> Dictionary:
	var result: Dictionary = {}
	for yy: int in range(y,y+h):
		for xx: int in range(x,x+w): result[Vector2i(xx,yy)] = true
	return result

func _round(x: int, y: int, w: int, h: int, radius: int) -> Dictionary:
	return _shift(G2.mask(Vector2i(w,h),radius),x,y)

func _cham(x: int, y: int, w: int, h: int, cut: int) -> Dictionary:
	var result: Dictionary = {}
	for yy: int in h:
		for xx: int in w:
			if mini(xx,w-1-xx) + mini(yy,h-1-yy) >= cut: result[Vector2i(x+xx,y+yy)] = true
	return result

func _shift(points: Dictionary, x: int, y: int) -> Dictionary:
	var result: Dictionary = {}
	for p: Vector2i in points: result[p+Vector2i(x,y)] = true
	return result

func _grow(points: Dictionary, amount: int = 1, diagonal: bool = true) -> Dictionary:
	var result: Dictionary = points.duplicate()
	for step: int in amount:
		var next: Dictionary = result.duplicate()
		for p: Vector2i in result:
			for d: Vector2i in N8 if diagonal else N4: next[p+d] = true
		result = next
	return result

func _minus(a: Dictionary, b: Dictionary) -> Dictionary:
	var result: Dictionary = {}
	for p: Vector2i in a:
		if not b.has(p): result[p] = true
	return result

func _paint(points: Dictionary, code: String) -> void:
	for p: Vector2i in points: _px(p.x,p.y,code)

func _bevel(points: Dictionary, hi: String, lo: String, side: String) -> Dictionary:
	var inner: Dictionary = G2._shrink(points)
	for p: Vector2i in points:
		if inner.has(p): continue
		_px(p.x,p.y,hi if not points.has(p+Vector2i.UP) or not points.has(p+Vector2i.LEFT) else lo if not points.has(p+Vector2i.DOWN) else side)
	return inner

func _shadow(points: Dictionary, dx: int = 2, dy: int = 3, threshold: int = 9) -> void:
	for p: Vector2i in points:
		var q := p+Vector2i(dx,dy)
		if not points.has(q) and int(BAYER[posmod(q.y,4)][posmod(q.x,4)]) < threshold: _px(q.x,q.y,"z")

func _diamond(x: int, y: int, r: int, code: String) -> void:
	for yy: int in range(-r,r+1): _h(x-r+absi(yy),y+yy,2*(r-absi(yy))+1,code)

func _disc(x: int, y: int, r: int, code: String, outline: bool = false) -> void:
	var points: Dictionary = {}
	for yy: int in range(-r,r+1):
		for xx: int in range(-r,r+1):
			if xx*xx+yy*yy <= r*r: points[Vector2i(x+xx,y+yy)] = true
	_paint(_minus(points,G2._shrink(points)) if outline else points,code)

func _sparkle(x: int, y: int, code: String = "t", r: int = 1, center: String = "") -> void:
	_h(x-r,y,r*2+1,code); _v(x,y-r,r*2+1,code)
	if not center.is_empty(): _px(x,y,center)

func _glyph(rows: String, x: int, y: int, code: String = "", flip: bool = false, recolor: Dictionary = {}) -> void:
	var lines: PackedStringArray = rows.split("\n")
	for yy: int in lines.size():
		for xx: int in lines[yy].length():
			var ch: String = lines[yy][xx]
			if ch != "." and ch != " ": _px(x+(lines[yy].length()-xx-1 if flip else xx),y+yy,str(recolor.get(ch,code if not code.is_empty() else ch)))

func _tw(value: String, small: bool = false) -> int: return G2.measure(value,small)
func _text(x: int, y: int, value: String, code: String = "t", small: bool = false, align: String = "l") -> void:
	_flush()
	G2.text(_layers,Vector2(x,y),value,code,small,align)

func _textset(value: String, small: bool = false, zoom: int = 1, spacing: int = 0) -> Dictionary:
	var result: Dictionary = {}
	var cx: int = 0
	var font_size: int = 10 if small else 12
	var variation: FontVariation = G2.font(small) as FontVariation
	if _font_sources.has(small) and _font_sources[small] != variation:
		_glyphs.clear()
		_atlases.clear()
		_font_sources.clear()
	_font_sources[small] = variation
	var face: FontFile = variation.base_font as FontFile
	for ch: String in value:
		var key: String = str(font_size)+ch
		if not _glyphs.has(key):
			var glyph: int = face.get_glyph_index(font_size,ch.unicode_at(0),0)
			var dimensions := Vector2i(font_size,0)
			var uv := Rect2i(face.get_glyph_uv_rect(0,dimensions,glyph))
			var offset := Vector2i(face.get_glyph_offset(0,dimensions,glyph))
			var texture_index: int = face.get_glyph_texture_idx(0,dimensions,glyph)
			var atlas_key: String = str(font_size)+":"+str(texture_index)
			if texture_index >= 0 and not _atlases.has(atlas_key): _atlases[atlas_key] = face.get_texture_image(0,dimensions,texture_index)
			var mask: Dictionary = {}
			if texture_index >= 0:
				var atlas: Image = _atlases[atlas_key]
				for yy: int in uv.size.y:
					for xx: int in uv.size.x:
						if atlas.get_pixel(uv.position.x+xx,uv.position.y+yy).a > 0.5:
							mask[Vector2i(xx+offset.x,yy+offset.y+roundi(G2.font(small).get_ascent(font_size))-(2 if small else 1))] = true
			_glyphs[key] = mask
		for p: Vector2i in _glyphs[key]:
			for yy: int in zoom:
				for xx: int in zoom: result[Vector2i(cx+p.x*zoom+xx,p.y*zoom+yy)] = true
		cx += _tw(ch,small)*zoom+spacing
	return {"P":result,"w":maxi(0,cx-spacing)}

func _fancy(x: int, y: int, value: String, code: String, o: Dictionary = {}) -> void:
	var field: Dictionary = _textset(value,o.get("small",false),o.get("scale",1),o.get("spacing",0))
	var align: String = o.get("align","l")
	x -= int(field.w)/2 if align == "c" else int(field.w) if align == "r" else 0
	var points: Dictionary = _shift(field.P,x,y)
	var outline: Dictionary = _minus(_grow(points,1,o.get("diag",true)),points) if o.get("outline","") != "" else {}
	var union: Dictionary = points.merged(outline)
	var outer: Dictionary = _minus(_grow(union,1,false),union) if o.get("outline2","") != "" else {}
	union.merge(outer)
	if o.get("shadow","") != "":
		_paint(_minus(_shift(union,o.get("sx",1),o.get("sy",2)),union),o.shadow)
	if not outer.is_empty(): _paint(outer,o.outline2)
	if not outline.is_empty(): _paint(outline,o.outline)
	for p: Vector2i in points:
		var col: String = code
		if o.has("top") and not points.has(p+Vector2i.UP): col = o.top
		elif o.has("bottom") and not points.has(p+Vector2i.DOWN): col = o.bottom
		_px(p.x,p.y,col)

func _icon(name: String, x: int, y: int) -> void:
	_flush()
	G2.icon(_layers,"art:ui.menu_icons",name,Vector2(x,y))

func _emblem(x: int, y: int) -> void:
	_flush()
	G2.icon(_layers,"art:ui.theme_emblem",_theme,Vector2(x,y))

func _coin(x: int, y: int) -> void:
	_disc(x+3,y+4,4,"z"); _disc(x+3,y+4,3,"k"); _h(x+2,y+2,3,"l"); _v(x+1,y+3,3,"l"); _px(x+5,y+5,"j")

func _menu_width(base: int, pad: int) -> int:
	var width: int = base
	for it: Dictionary in _data.items: width = maxi(width,_tw(it.label)+(_tw(it.get("detail",""),true)+8 if not str(it.get("detail","")).is_empty() else 0)+pad)
	return width

func _keys_width(extra: int = 7) -> int:
	return 11+1+11+3+_tw(_data.keySelect,true)+8+_tw("Enter",true)+extra+3+_tw(_data.keyConfirm,true)

func _keycap(x: int, y: int, value: String, skin: String) -> int:
	var arrow: bool = value in ["up","down"]
	var w: int = 11 if arrow else _tw(value,true)+(8 if skin == "S4" else 7)
	var ink: String = "u"
	match skin:
		"S1":
			_plate(x,y,w,11,2)
		"S2":
			_slab(x,y,w,8,{"top":2,"jag":0,"seed":x,"shadow":false,"tails":[]})
		"S3", "S5":
			_paint(_round(x,y,w,11,2),"z"); _paint(_round(x+1,y+1,w-2,9,1),"n" if skin == "S3" else "F")
			_h(x+2,y+1,w-4,"m" if skin == "S3" else "d"); _h(x+2,y+9,w-4,"o" if skin == "S3" else "e")
			ink = "l" if skin == "S3" else "g"
		"S4":
			_pill(x,y,w,11,"D","E","C","B",false); ink = "t"
		"S6":
			_paint(_cham(x,y,w,11,2),"z"); _paint(_cham(x+1,y+1,w-2,9,1),"x")
			_h(x+2,y+1,w-4,"w"); _h(x+2,y+9,w-4,"y"); ink = "s"
	if arrow:
		_glyph("..#..\n.###.\n#####" if value == "up" else "#####\n.###.\n..#..",x+3,y+(5 if skin == "S2" else 4),ink)
	else: _text(x+w/2-(1 if skin == "S2" else 0),y+(2 if skin == "S2" else 1),value,ink,true,"c")
	return w

func _footer(skin: String) -> void:
	var y: int = 163 if skin == "S1" else 165
	var hw: int = _keys_width(8 if skin == "S4" else 7)+(12 if skin == "S4" else 10)
	var x: int = 13
	var ink: String = "u"
	match skin:
		"S1": _plate(10,y-2,hw,15,3); x = 15
		"S2": x = 12; ink = "t"
		"S3": _jade_chip(9,y-2,hw,15); ink = "c"
		"S4": _pill(9,y-2,hw,15,"t","t","u"); x = 14; ink = "B"
		"S5": _board(9,y-2,hw,15,{"seed":50,"nails":false}); ink = "c"
		"S6":
			_hull(9,y-2,hw+8,15,{"k":3,"rivets":false})
			for yy: int in range(y,y+11):
				for xx: int in range(9+hw-2,9+hw+5): _px(xx,yy,_hazard(xx,yy))
	x += _keycap(x,y,"up",skin)+(2 if skin == "S2" else 1)
	x += _keycap(x,y,"down",skin)+3
	if skin == "S2": _fancy(x,y+2,_data.keySelect,ink,{"outline":"z","small":true})
	else: _text(x,y+1,_data.keySelect,ink,true)
	x += _tw(_data.keySelect,true)+(9 if skin == "S2" else 8)
	x += _keycap(x,y,"Enter",skin)+3
	if skin == "S2": _fancy(x,y+2,_data.keyConfirm,ink,{"outline":"z","small":true})
	else: _text(x,y+1,_data.keyConfirm,ink,true)

func _plate(x: int, y: int, w: int, h: int, cut: int = 3) -> void:
	var mask: Dictionary = _cham(x,y,w,h,cut)
	_shadow(mask)
	_paint(mask,"z")
	var inner: Dictionary = _bevel(_cham(x+1,y+1,w-2,h-2,maxi(0,cut-1)),"s","q","r")
	_paint(inner,"y")
	_h(x+cut+1,y+2,w-2*cut-2,"r")

func _shard(x: int, y: int, length: int, width: int, hi: String = "t", lit: String = "s", body: String = "r", dark: String = "q", horizontal: bool = false) -> void:
	for j: int in range(length):
		var hw: int = mini(width/2,mini(j,(length-j+1)/2))
		for i: int in range(-hw,hw+1):
			var col: String = hi if i == -hw else lit if i < 0 else body if i < hw else dark
			_px(x+j if horizontal else x+i,y+i if horizontal else y+j,col)

# S1 crystal recipe: original UI layout, colors and pixel decoration (lines 275-329).
func _crystal() -> void:
	_shard(96,6,15,7); _shard(106,15,9,5,"t","D","C","B"); _shard(6,40,7,3); _sparkle(112,9)
	_fancy(13,9,_data.title,"t",{"outline":"s","outline2":"z","shadow":"q","scale":2,"sx":1,"sy":2,"diag":false,"spacing":2})
	_h(13,37,6,"r"); _diamond(21,37,1,"s")
	_fancy(26,34,_data.titleEn,"s",{"outline":"z","small":true,"spacing":1})
	var tw: int = 26
	for ch: String in _data.titleEn: tw += _tw(ch,true)+1
	_diamond(tw+2,37,1,"s"); _h(tw+5,37,6,"r")
	_fancy(13,44,_data.tag,"u",{"outline":"z","small":true})
	var cw: int = 30+_tw(_data.curTag,true)+_tw(_data.cur)
	_plate(20,60,cw,16)
	_diamond(22,68,12,"z"); _diamond(22,68,11,"q")
	for j: int in range(-11,12):
		var k: int = 11-absi(j)
		_px(22-k,68+j,"s" if j <= 0 else "r"); _px(22+k,68+j,"r" if j <= 0 else "q")
	_diamond(22,68,9,"y"); _emblem(14,60); _px(22,57,"t")
	_text(40,64,_data.curTag,"v",true); _text(44+_tw(_data.curTag,true),63,_data.cur)
	var pw: int = _menu_width(136,44)
	var ph: int = 12+_data.items.size()*15
	_plate(12,82,pw,ph,6)
	for i: int in _data.items.size():
		var it: Dictionary = _data.items[i]
		var ry: int = 88+i*15
		_rows.append(Rect2(18,ry,pw-12,14))
		if i == _selection:
			_paint(_cham(18,ry,pw-12,14,3),"r"); _paint(_cham(19,ry+1,pw-14,12,2),"q")
			_h(21,ry+1,pw-18,"s"); _h(21,ry+12,pw-18,"y")
			for k: int in 6: _px(12+pw-26+k,ry+11-k*2 if k<5 else ry+2,"r")
		_icon(it.icon,26,ry+1); _text(42,ry+1,it.label,"t" if i == _selection else "u")
		if i == _selection:
			if it.has("detail"): _text(pw,ry+2,it.detail,"l",true,"r")
			_shard(6,ry+1,12,11,"t","s","r","q",true); _sparkle(5,ry-1)
		if i>0 and i<_data.items.size()-1:
			for xx: int in range(26,12+pw-14,3): _px(xx,ry+14,"x")
	var cx: int = 12+pw-7
	var cy: int = 82+ph-23
	_shard(cx,cy,16,7); _shard(cx+8,cy+8,11,5,"t","D","C","B"); _shard(cx-7,cy+12,9,5)
	var cw2: int = 24+_tw(_data.coins,true)
	_plate(314-cw2,6,cw2,14); _coin(318-cw2,8); _text(309,8,_data.coins,"t",true,"r")
	_footer("S1")

func _hash_input(value: int, factor: int) -> Array[int]:
	# Signed int64 times a positive 27-bit factor, as three little-endian
	# uint32 words (96-bit two's complement). Each partial product fits int64.
	var low: int = (value & 0xffffffff) * factor
	var high: int = ((value >> 32) & 0xffffffff) * factor + (low >> 32)
	return [low & 0xffffffff, high & 0xffffffff, ((high >> 32) - (factor if value < 0 else 0)) & 0xffffffff]

func _hash(x: int, y: int, seed: int) -> int:
	# Exact ui-kit.js Hh/BigInt, including signed inputs. Do not truncate the
	# high product bits: they feed back into the low bits through v >> 16.
	var xs: Array[int] = _hash_input(x, 73856093)
	var ys: Array[int] = _hash_input(y, 19349663)
	var seeds: Array[int] = _hash_input(seed, 83492791)
	var words: Array[int] = []
	for i: int in 3: words.append(xs[i] ^ ys[i] ^ seeds[i])
	# v ^ (v >> 13) is nonnegative even if the initial v is negative.
	# Iterate low to high so the next word still contains the original bits.
	for i: int in 3:
		var upper: int = words[i + 1] if i < 2 else (0xffffffff if (words[2] & 0x80000000) != 0 else 0)
		words[i] ^= (words[i] >> 13) | ((upper & 0x1fff) << 19)
	var carry: int = 0
	for i: int in 3:
		var product: int = words[i] * 1274126177 + carry
		words[i] = product & 0xffffffff
		carry = product >> 32
	words.append(carry)
	var remainder: int = 0
	var upper: int = 0
	for i: int in range(words.size() - 1, -1, -1):
		var word: int = words[i]
		var mixed: int = word ^ ((word >> 16) | ((upper & 0xffff) << 16))
		remainder = (remainder * 0x100000000 + mixed) % 1000
		upper = word
	return remainder

func _slab(x: int, y: int, w: int, face: int, o: Dictionary = {}) -> int:
	var top: int = o.get("top",2)
	var jag: int = o.get("jag",4)
	var seed: int = o.get("seed",0)
	var colors: Dictionary = {}
	var height: int = top+face
	for j: int in height:
		var lo: int = 1 if _hash(x,y+j,seed)%3 == 0 else 0
		var ro: int = 1 if _hash(x+w,y+j,seed)%3 == 0 else 0
		if j == 0: lo = 1; ro = 1
		var tap: int = maxi(0,j-(height-3))
		for i: int in range(lo+tap,w-ro-tap):
			var col: String = "w"
			if j<top: col = "v" if j == 0 and i%11 in [2,3,4,5,6] else "w"
			elif j == top: col = "y"
			else: col = "w" if i == lo+tap else "y" if i>=w-ro-tap-2 else "x"
			colors[Vector2i(x+i,y+j)] = col
	var tails: Array = o.get("tails",[[0.3,jag],[0.7,maxi(1,jag-1)]])
	for tail: Array in tails:
		var d: int = tail[1]
		var cx: int = x+int(float(tail[0])*w)+_hash(x,y,seed+int(float(tail[0])*10))%5-2
		for j: int in d:
			var hw: int = (d-j)*3/d
			for i: int in range(cx-hw-1,cx+hw+2): colors[Vector2i(i,y+height+j)] = "y" if j<d-1 else "z"
	if o.get("shadow",true): _shadow(_grow(colors),3,6,8)
	var outline: Dictionary = _minus(_grow(colors,1,false),colors)
	if o.has("glow"): _paint(_minus(_grow(colors.merged(outline),1,false),colors.merged(outline)),o.glow)
	_paint(outline,"z")
	for p: Vector2i in colors: _px(p.x,p.y,colors[p])
	if o.get("moss",false):
		var mx: int = x+4+_hash(y,x,seed)%maxi(1,w/3)
		for k: int in range(6+seed%4):
			_px(mx+k,y,"n" if k%2 else "m")
			if k%3 == 1: _px(mx+k,y-1,"m")
	return y+top+1

# S2 rune/stone recipe: original UI layout, colors and RUNES (lines 330-448).
func _rune(index: int, x: int, y: int, code: String, glow: String = "") -> void:
	var mask: Dictionary = {}
	var lines: PackedStringArray = RUNES[index%RUNES.size()].split("\n")
	for yy: int in lines.size():
		for xx: int in lines[yy].length():
			if lines[yy][xx] == "#": mask[Vector2i(x+xx,y+yy)] = true
	if not glow.is_empty(): _paint(_minus(_grow(mask,1,false),mask),glow)
	_paint(mask,code)

func _runes() -> void:
	var tw: int = maxi(114,_tw(_data.title)*2+2*(_data.title.length()-1)+30)
	var fy: int = _slab(10,4,tw,34,{"top":3,"jag":6,"seed":3,"moss":true,"tails":[[0.22,5],[0.5,7],[0.8,4]]})
	for i: int in 2:
		var rx: int = 15 if i == 0 else 10+tw-11
		_rune(i+2,rx,fy+3,"k","f"); _rune(i+4,rx,fy+25,"w")
	_fancy(10+tw/2-1,fy+3,_data.title,"k",{"top":"l","outline":"f","scale":2,"align":"c","diag":false,"spacing":2})
	_fancy(10+tw/2-1,fy+26,_data.titleEn,"v",{"small":true,"align":"c","spacing":1})
	_slab(130,12,8,3,{"top":1,"jag":2,"seed":5,"shadow":false,"tails":[[0.5,2]]})
	_slab(136,31,5,2,{"top":1,"jag":1,"seed":6,"shadow":false,"tails":[[0.5,1]]})
	for p: Vector2i in [Vector2i(128,6),Vector2i(142,24),Vector2i(6,44),Vector2i(122,44)]: _px(p.x,p.y,"l")
	_fancy(13,53,_data.tag,"u",{"outline":"z","small":true})
	var cw: int = 34+_tw(_data.curTag,true)+_tw(_data.cur)
	fy = _slab(10,67,cw,11,{"top":2,"jag":3,"seed":8})
	_emblem(13,fy-3); _text(32,fy+2,_data.curTag,"v",true); _text(36+_tw(_data.curTag,true),fy+1,_data.cur)
	var wide: int = _menu_width(110,36)
	for i: int in _data.items.size():
		var it: Dictionary = _data.items[i]
		var selected: bool = i == _selection
		var y: int = 88+i*19-(2 if selected else 0)
		var x: int = 20 if selected else 12
		var w: int = wide+10 if selected else wide
		var options: Dictionary = {"top":2,"jag":4 if selected else 3,"seed":20+i,"moss":i==2}
		if selected: options["glow"] = "j"
		var fy2: int = _slab(x,y,w,11,options)
		_rows.append(Rect2(12,88+i*19,wide+18,16))
		_icon(it.icon,x+4,fy2)
		_text(x+19,fy2,it.label,"l" if selected else "u")
		_rune(0 if selected else i+1,x+w-10,fy2+3,"k" if selected else "w","f" if selected else "")
		if selected:
			if it.has("detail"): _text(x+w-14,fy2+1,it.detail,"k",true,"r")
			_disc(x-9,fy2+5,7,"j",true); _diamond(x-9,fy2+5,4,"z"); _diamond(x-9,fy2+5,3,"j"); _diamond(x-9,fy2+5,2,"k"); _px(x-10,fy2+4,"l")
			for p: Vector2i in [Vector2i(x+26,y-5),Vector2i(x+52,y-7),Vector2i(x+84,y-4),Vector2i(x+104,y-8),Vector2i(x+10,y-9)]: _px(p.x,p.y,"l")
			_px(x+53,y-8,"t")
	var cw2: int = 24+_tw(_data.coins,true)
	fy = _slab(312-cw2,5,cw2,10,{"top":2,"jag":3,"seed":40})
	_coin(316-cw2,fy); _text(306,fy,_data.coins,"t",true,"r")
	_footer("S2")

# S3 jade recipe: original cloud strings, ornaments, colors and layout (lines 450-526).
func _cloud(x: int, y: int, flip: bool = false) -> void:
	_glyph(".....oooo.........\n...oollllo..oooo..\n..olkkkkkloollllo.\n.olkjjjjkkllkkkklo\n.okjkkkkjkkkjjjjko\n.okjkjjkjkkjkkkjko\n.okjkkjjkkkjkjjjko\n..okjkkkkjkkkkkoo.\n...oooooooooooo...",x,y,"",flip,{"o":"z"})

func _jade_chip(x: int, y: int, w: int, h: int = 14) -> void:
	var mask: Dictionary = _round(x,y,w,h,3)
	_shadow(mask,1,2,8); _paint(mask,"z")
	_bevel(_round(x+1,y+1,w-2,h-2,2),"l","j","k")
	_paint(_round(x+2,y+2,w-4,h-4,1),"o"); _h(x+3,y+2,w-6,"n")

func _jade_panel(x: int, y: int, w: int, h: int) -> void:
	var mask: Dictionary = _round(x,y,w,h,3)
	_shadow(mask); _paint(mask,"z")
	_bevel(_round(x+1,y+1,w-2,h-2,2),"l","j","k")
	_paint(_round(x+2,y+2,w-4,h-4,1),"f"); _rect(x+3,y+3,w-6,h-6,"o")
	_h(x+3,y+3,w-6,"n"); _h(x+3,y+h-4,w-6,"p")
	for k: int in 5: _px(x+8+k,y+8-k,"n")
	for k: int in 3: _px(x+12+k,y+8-k,"n")
	var ix: int = x+5
	var iy: int = y+5
	var iw: int = w-10
	var ih: int = h-10
	for xx: int in range(ix+6,ix+iw-6):
		if xx%2 == 0: _px(xx,iy,"k"); _px(xx,iy+ih-1,"j")
	for yy: int in range(iy+6,iy+ih-6):
		if yy%2 == 0: _px(ix,yy,"k"); _px(ix+iw-1,yy,"j")
	for p: Vector2i in [Vector2i(ix,iy),Vector2i(ix+iw-5,iy),Vector2i(ix,iy+ih-5),Vector2i(ix+iw-5,iy+ih-5)]:
		_glyph("#####\n#...#\n#.#.#\n#...#\n#####",p.x,p.y,"k")

func _tassel(x: int, y: int, length: int = 9) -> void:
	_v(x,y,4,"h"); _v(x+1,y,4,"g")
	_diamond(x,y+7,4,"z"); _diamond(x,y+7,3,"h"); _diamond(x,y+7,2,"i")
	_px(x-1,y+6,"D"); _px(x,y+7,"h"); _px(x,y+5,"D")
	_rect(x-2,y+12,5,2,"k"); _h(x-2,y+12,5,"l"); _frame(x-3,y+11,7,4,"z")
	for i: int in range(-2,3):
		var ln: int = length-absi(i)*2+posmod(i,2)
		_v(x+i,y+15,ln,"i" if posmod(i,2)==0 else "h"); _px(x+i,y+15+ln,"z")
	_v(x-3,y+15,length-4,"z"); _v(x+3,y+15,length-4,"z")

func _plaque(x: int, y: int, w: int, h: int) -> void:
	var mask: Dictionary = _rect_mask(x,y,w,h)
	for p: Vector2i in [Vector2i(x,y),Vector2i(x+w-1,y),Vector2i(x,y+h-1),Vector2i(x+w-1,y+h-1)]: mask.erase(p)
	_shadow(mask); _paint(mask,"z"); _rect(x+1,y+1,w-2,h-2,"h")
	_h(x+1,y+1,w-2,"i"); _v(x+1,y+1,h-2,"i"); _h(x+2,y+h-2,w-3,"g")
	_rect(x+3,y+3,w-6,h-6,"z"); _rect(x+4,y+4,w-8,h-8,"g"); _h(x+4,y+4,w-8,"B")
	for p: Vector2i in [Vector2i(x+2,y+2),Vector2i(x+w-3,y+2),Vector2i(x+2,y+h-3),Vector2i(x+w-3,y+h-3)]: _px(p.x,p.y,"l")

func _jade() -> void:
	var pw: int = maxi(104,_tw(_data.title)*2+3*(_data.title.length()-1)+24)
	_plaque(12,6,pw,34)
	_fancy(12+pw/2,13,_data.title,"k",{"top":"l","bottom":"j","outline":"z","scale":2,"align":"c","diag":false,"spacing":3})
	_cloud(pw,1); _cloud(5,34,true)
	_fancy(12+pw/2,42,"· "+_data.titleEn+" ·","l",{"outline":"z","small":true,"align":"c","spacing":1})
	_fancy(13,51,_data.tag,"c",{"outline":"z","small":true})
	var cw: int = 36+_tw(_data.curTag,true)+_tw(_data.cur)
	_jade_chip(12,65,cw,15); _disc(19,72,9,"z"); _disc(19,72,8,"k"); _disc(19,72,7,"f"); _emblem(11,64)
	_text(32,68,_data.curTag,"m",true); _text(36+_tw(_data.curTag,true),67,_data.cur)
	var mw: int = _menu_width(132,46)
	var mh: int = 14+_data.items.size()*14
	_jade_panel(12,86,mw,mh)
	for i: int in _data.items.size():
		var it: Dictionary = _data.items[i]
		var ry: int = 93+i*14
		_rows.append(Rect2(20,ry,mw-16,13))
		if i == _selection:
			_rect(20,ry,mw-16,13,"z"); _rect(21,ry+1,mw-18,11,"n"); _h(21,ry+1,mw-18,"m"); _h(21,ry+11,mw-18,"o")
			for ex: int in [21,mw]:
				_rect(ex,ry+1,3,11,"k"); _v(ex,ry+1,11,"l"); _v(ex+2,ry+1,11,"j")
		_icon(it.icon,27,ry+1); _text(42,ry+1,it.label,"t" if i == _selection else "c")
		if i == _selection:
			if it.has("detail"): _text(mw-3,ry+2,it.detail,"l",true,"r")
			for k: int in 5: _v(13+k,ry+2+k,9-2*k,"k" if k else "l")
			for k: int in 5: _px(12+k,ry+1+k,"z"); _px(12+k,ry+11-k,"z")
			_v(12,ry+1,11,"z"); _px(18,ry+6,"z"); _px(17,ry+6,"j")
	_tassel(mw+5,86+mh-1)
	var cw2: int = 24+_tw(_data.coins,true)
	_jade_chip(314-cw2,6,cw2,14); _coin(318-cw2,8); _text(308,8,_data.coins,"t",true,"r"); _cloud(301-cw2,13,true)
	_footer("S3")

# S4 candy UI recipe: original pill/bubble/star/heart pixels and style (lines 528-591).
func _pill(x: int, y: int, w: int, h: int, body: String, hi: String, lo: String, edge: String = "B", outer: bool = true) -> void:
	var mask: Dictionary = _round(x,y,w,h,h/2)
	if outer: _paint(_grow(mask),"z")
	_paint(mask,edge)
	var inner: Dictionary = _round(x+1,y+1,w-2,h-2,(h-2)/2)
	_paint(inner,body)
	for p: Vector2i in inner:
		if not inner.has(p+Vector2i.UP): _px(p.x,p.y,hi)
		elif not inner.has(p+Vector2i.DOWN): _px(p.x,p.y,lo)

func _bubble_panel(x: int, y: int, w: int, h: int, radius: int = 7) -> void:
	var mask: Dictionary = _round(x,y,w,h,radius)
	var grown: Dictionary = _grow(mask)
	_shadow(grown); _paint(grown,"z"); _paint(mask,"B")
	var inner: Dictionary = _round(x+1,y+1,w-2,h-2,radius-1)
	_paint(inner,"t")
	for p: Vector2i in inner:
		if (not inner.has(p+Vector2i(0,3)) and int(BAYER[posmod(p.y,4)][posmod(p.x,4)])<10) or not inner.has(p+Vector2i(0,2)): _px(p.x,p.y,"u")
	for k: int in mini(w/3,26): _px(x+radius+2+k,y+2,"s" if k<12 else "D")
	for k: int in mini(h/3,10): _px(x+2,y+radius+2+k,"s")
	_px(x+3,y+3,"t"); _rect(x+radius-1,y+3,2,1,"t")

func _bubble(x: int, y: int, radius: int) -> void:
	_disc(x,y,radius,"u",true)
	if radius>=4:
		for p: Vector2i in [Vector2i(x-radius+1,y-1),Vector2i(x-radius+1,y),Vector2i(x-1,y-radius+1),Vector2i(x,y-radius+1)]: _px(p.x,p.y,"s")
	var half: int = radius/2
	_px(x-half,y-half,"t")
	if radius>=5: _px(x-half+1,y-half,"t")
	_px(x+half,y+half+(1 if radius>4 else 0),"D")

func _star(x: int, y: int) -> void:
	var points: Dictionary = {}
	for p: Vector2i in [Vector2i(2,0),Vector2i(2,1),Vector2i(0,2),Vector2i(1,2),Vector2i(2,2),Vector2i(3,2),Vector2i(4,2),Vector2i(1,3),Vector2i(2,3),Vector2i(3,3),Vector2i(1,4),Vector2i(3,4)]: points[p+Vector2i(x,y)] = true
	_paint(_minus(_grow(points),points),"z"); _paint(points,"l")

func _candy() -> void:
	_bubble(128,16,9); _rect(124,13,8,7,"e"); _frame(124,13,8,7,"f"); _h(125,14,6,"d")
	for k: int in 6: _px(125+k,18-int(k*4.0/5),"d")
	_bubble(128,16,9); _bubble(140,36,5)
	_glyph(".##.##.\n#######\n#######\n.#####.\n..###..\n...#...",137,33,"i")
	_bubble(140,36,5); _bubble(6,46,3); _star(116,34)
	_fancy(12,8,_data.title,"t",{"outline":"B","outline2":"z","shadow":"C","scale":2,"sx":0,"sy":2,"diag":true,"spacing":2})
	_pill(14,36,_tw(_data.titleEn,true)+21,11,"C","D","B")
	_fancy(21,36,_data.titleEn,"t",{"small":true,"spacing":1})
	_fancy(13,51,_data.tag,"t",{"outline":"B","outline2":"z","small":true})
	var cw: int = 40+_tw(_data.curTag,true)+_tw(_data.cur)
	_pill(12,66,cw,15,"t","t","u"); _disc(21,73,9,"z"); _disc(21,73,8,"B"); _disc(21,73,7,"E"); _emblem(13,65)
	_text(34,69,_data.curTag,"C",true); _text(38+_tw(_data.curTag,true),68,_data.cur,"B")
	var mw: int = _menu_width(132,46)
	_bubble_panel(12,88,mw,8+_data.items.size()*15)
	for i: int in _data.items.size():
		var it: Dictionary = _data.items[i]
		var ry: int = 94+i*15
		_rows.append(Rect2(18,ry-1,mw-12,15))
		if i == _selection:
			_pill(18,ry-1,mw-12,15,"C","D","B","B",false); _px(24,ry+1,"t"); _px(25,ry+1,"t")
		_icon(it.icon,26,ry+1); _text(42,ry+1,it.label,"t" if i==_selection else "B")
		if i == _selection:
			if it.has("detail"): _text(mw-2,ry+2,it.detail,"l",true,"r")
			_star(8,ry+3)
	var cw2: int = 26+_tw(_data.coins,true)
	_pill(314-cw2,6,cw2,13,"t","t","u"); _coin(318-cw2,8); _text(307,7,_data.coins,"B",true,"r")
	_footer("S4")

# S5 wood/plant recipe: original plant/mushroom pixels, colors and layout (lines 593-710).
func _moss(x: int, y: int, w: int, seed: int) -> void:
	for xx: int in range(x,x+w):
		_px(xx,y,"m" if _hash(xx,y,seed)<620 else "n"); _px(xx,y+1,"n")
		if _hash(xx,y,seed+1)<480: _px(xx,y+2,"o" if _hash(xx,y,seed+5)<550 else "n")
		if _hash(xx,y,seed+2)<110 and xx!=x and xx!=x+w-1: _px(xx,y+3,"o")
		if _hash(xx,y,seed+3)<300: _px(xx,y-1,"m")
		elif _hash(xx,y,seed+4)<110: _px(xx,y-1,"n")
		if _hash(xx,y,seed+6)<60: _px(xx,y-2,"m"); _px(xx,y-1,"m")

func _board(x: int, y: int, w: int, h: int, o: Dictionary = {}) -> void:
	var seed: int = o.get("seed",0)
	var mask: Dictionary = _round(x,y,w,h,2)
	if o.get("shadow",true): _shadow(mask)
	_paint(mask,"z")
	var inner: Dictionary = _bevel(_round(x+1,y+1,w-2,h-2,1),"e","g","f")
	_paint(inner,o.get("body","f"))
	if o.get("grain",true):
		for p: Vector2i in inner:
			if _hash(p.x/5+p.y*7,p.y,seed)<60 and inner.has(p+Vector2i.UP) and inner.has(p+Vector2i.DOWN): _px(p.x,p.y,"g")
	if o.get("nails",true):
		for nx: int in [x+3,x+w-4]: _px(nx,y+h/2,"v"); _px(nx,y+h/2+1,"g")
	if o.get("mossy",true): _moss(x+2,y,w-4,seed)

func _py_round(value: float) -> int:
	# Match Python's ties-to-even rounding used by the reference silhouettes.
	var low: int = floori(value)
	return low if value-low<0.5 or (value-low==0.5 and low%2==0) else low+1

func _leaf_hw(height: int, t: float) -> int:
	return _py_round(height*(sin(PI/2*t/0.35) if t<0.35 else 1-(t-0.35)/0.65))

func _leaf(x: int, y: int, length: int = 8, height: int = 2, flip: bool = false, cursor: bool = false) -> void:
	var colors: Dictionary = {}
	for i: int in length:
		var t: float = float(i)/maxi(1,length-1)
		var hw: int = _leaf_hw(height,t)
		var yy: int = y-(_py_round(2*t*t) if cursor else 0)
		for j: int in range(-hw,hw+1): colors[Vector2i(x-i if flip else x+i,yy+j)] = "o" if j==0 and i>=1 and i<=length-3 else "m" if j<0 else "n"
	if cursor:
		for p: Vector2i in [Vector2i(x-1,y+1),Vector2i(x-2,y+2),Vector2i(x-3,y+2)]: colors[p] = "n"
	_paint(_minus(_grow(colors),colors),"z")
	for p: Vector2i in colors: _px(p.x,p.y,colors[p])

func _vine(x: int, y1: int, amp: float, phase: float, leaves: Array) -> void:
	var points: Array[Vector2i] = []
	var mask: Dictionary = {}
	for y: int in y1:
		var p := Vector2i(x+_py_round(amp*sin(y*0.33+phase)),y)
		points.append(p); mask[p] = true; mask[p+Vector2i.RIGHT] = true
	_paint(_minus(_grow(mask,1,false),mask),"z")
	for p: Vector2i in points: _px(p.x,p.y,"n"); _px(p.x+1,p.y,"o")
	for i: int in range(0,points.size(),5): _px(points[i].x,points[i].y,"m")
	for item: Array in leaves:
		var p: Vector2i = points[item[0]]
		_leaf(p.x+(2 if item[1]>0 else -1),p.y+1,6,2,item[1]<0)
	_px(points[-1].x,points[-1].y+1,"m")

func _firefly(x: int, y: int, big: bool = false) -> void:
	_px(x,y,"l")
	for d: Vector2i in N4:
		_px(x+d.x,y+d.y,"k" if big else "m")
		if big: _px(x+2*d.x,y+2*d.y,"m")

func _grass_title(x: int, y: int, value: String) -> void:
	var field: Dictionary = _textset(value,false,2,2)
	var points: Dictionary = _shift(field.P,x,y)
	var outline: Dictionary = _minus(_grow(points),points)
	var combined: Dictionary = points.merged(outline)
	var outer: Dictionary = _minus(_grow(combined,1,false),combined)
	combined.merge(outer)
	_paint(_minus(_shift(combined,1,2),combined),"p"); _paint(outer,"z"); _paint(outline,"g")
	var tops: Dictionary = {}
	for p: Vector2i in points: tops[p.x] = mini(tops.get(p.x,999),p.y)
	for p: Vector2i in points: _px(p.x,p.y,"m" if tops[p.x]==p.y else "d" if not points.has(p+Vector2i.DOWN) else "c")
	for a: int in tops:
		if _hash(a,tops[a],4)<300 and outline.has(Vector2i(a,tops[a]-1)): _px(a,tops[a]-1,"m")

func _wood() -> void:
	_vine(104,40,1.6,0.0,[[9,1],[19,-1],[30,1]]); _vine(118,22,1.2,1.7,[[8,-1],[16,1]])
	_grass_title(13,9,_data.title)
	var wen: int = -1
	for ch: String in _data.titleEn: wen += _tw(ch,true)+1
	_leaf(29,38,6,2,true); _fancy(32,34,_data.titleEn,"m",{"outline":"z","small":true,"spacing":1}); _leaf(35+wen,38,6)
	_fancy(13,46,_data.tag,"c",{"outline":"z","small":true})
	var cw: int = 36+_tw(_data.curTag,true)+_tw(_data.cur)
	_board(14,64,cw,15,{"seed":8,"nails":false})
	_disc(20,71,10,"z"); _disc(20,71,9,"f"); _disc(20,71,8,"F"); _disc(20,71,6,"d",true); _disc(20,71,4,"e",true); _emblem(12,63)
	_text(34,68,_data.curTag,"m",true); _text(38+_tw(_data.curTag,true),67,_data.cur)
	var mw: int = _menu_width(134,46)
	var mh: int = 10+_data.items.size()*15
	_board(12,86,mw,mh,{"seed":12,"grain":false,"nails":false})
	for i: int in _data.items.size():
		var py: int = 90+i*15
		if i>0: _h(14,py-1,mw-4,"g")
		for yy: int in [py+1,py+12]:
			for xx: int in range(15,12+mw-3):
				if _hash(xx/6,yy,30+i)<160: _px(xx,yy,"g")
		for nx: int in [16,12+mw-5]: _px(nx,py+6,"v"); _px(nx,py+7,"g")
	for i: int in _data.items.size():
		var it: Dictionary = _data.items[i]
		var ry: int = 91+i*15
		_rows.append(Rect2(20,ry-1,mw-16,14))
		if i == _selection:
			var mask: Dictionary = _round(20,ry-1,mw-16,14,3)
			_paint(_grow(mask),"z"); _paint(mask,"n")
			for p: Vector2i in mask:
				if not mask.has(p+Vector2i.UP): _px(p.x,p.y,"m")
				elif not mask.has(p+Vector2i.DOWN): _px(p.x,p.y,"o")
		_icon(it.icon,25,ry); _text(40,ry,it.label,"t" if i == _selection else "c")
		if i == _selection:
			if it.has("detail"): _text(mw,ry+1,it.detail,"l",true,"r")
			_leaf(5,ry+6,11,3,false,true); _firefly(9,ry-4,true)
	_glyph("...zzzz...\n.zzitiizz.\nzitiiiitiz\nziiiitiiiz\nzhhhhhhhhz\n.zzzcczzz.\n...zcdz...\n...zcdz...",mw-2,86+mh-6)
	_glyph("..zzz..\n.zitiz.\nziiiiiz\nzhhhhhz\n.zzczz.\n..zcz..",mw+7,86+mh-3); _px(mw-1,86+mh-7,"l")
	var cw2: int = 24+_tw(_data.coins,true)
	_board(314-cw2,6,cw2,14,{"seed":40,"grain":false,"nails":false}); _coin(318-cw2,9); _text(308,9,_data.coins,"t",true,"r"); _leaf(313-cw2,12,6,2,true)
	_footer("S5")
	for p: Vector2i in [Vector2i(128,52),Vector2i(96,64),Vector2i(150,112),Vector2i(6,116),Vector2i(140,30)]: _firefly(p.x,p.y,p.x==128)

# S6 spacecraft recipe: original hull/planet/ship pixels, colors and layout (lines 712-825).
func _hazard(x: int, y: int) -> String:
	return "k" if posmod(floori(float(x+y)/3),2)==0 else "z"

func _hull(x: int, y: int, w: int, h: int, o: Dictionary = {}) -> void:
	var cut: int = o.get("k",3)
	var mask: Dictionary = _cham(x,y,w,h,cut)
	if o.get("shadow",true): _shadow(mask)
	_paint(mask,"z")
	var inner: Dictionary = _bevel(_cham(x+1,y+1,w-2,h-2,cut-1),"v","x","w")
	if o.get("thick",false):
		inner = _bevel(inner,"w","x","w")
		var inset: Dictionary = G2._shrink(inner)
		_paint(_minus(inner,inset),"z"); inner = inset
	_paint(inner,o.get("body","y"))
	var stripe: int = o.get("stripe",0)
	if stripe>0:
		for p: Vector2i in mask:
			if p.y>=y+1 and p.y<y+1+stripe and not inner.has(p) and mask.has(p+Vector2i.LEFT) and mask.has(p+Vector2i.RIGHT): _px(p.x,p.y,_hazard(p.x,p.y))
		if o.get("thick",false): _h(x+cut,y+1+stripe,w-2*cut,"z")
	if o.get("rivets",true):
		var off: int = 3 if o.get("thick",false) else 2
		for rx: int in [x+off+cut-1,x+w-off-cut]: _px(rx,y+h-off-1,"u"); _px(rx+1,y+h-off,"x")

func _led_title(x: int, y: int, value: String) -> Vector2i:
	var field: Dictionary = _textset(value,false,1,2)
	var points: Dictionary = field.P
	var top: int = 999
	var bottom: int = -999
	for p: Vector2i in points: top = mini(top,p.y); bottom = maxi(bottom,p.y)
	var cols: int = field.w+4
	var rows: int = bottom-top+3
	for i: int in cols:
		for j: int in rows:
			var xx: int = x+2*i
			var yy: int = y+2*j
			if points.has(Vector2i(i-2,j-1+top)):
				_px(xx,yy,"l"); _px(xx+1,yy,"k"); _px(xx,yy+1,"k"); _px(xx+1,yy+1,"j")
			else: _px(xx,yy,"y")
	return Vector2i(2*cols,2*rows)

func _planet(cx: int, cy: int) -> void:
	var ca: float = cos(deg_to_rad(-18))
	var sa: float = sin(deg_to_rad(-18))
	for front: bool in [false,true]:
		if front:
			_disc(cx,cy,6,"z"); _disc(cx,cy,5,"C")
			for yy: int in range(cy-5,cy+6):
				for xx: int in range(cx-5,cx+6):
					if (xx-cx)*(xx-cx)+(yy-cy)*(yy-cy)>25: continue
					var q: int = xx-cx+yy-cy
					if q>3: _px(xx,yy,"B")
					elif q< -5: _px(xx,yy,"D")
					elif posmod(yy-cy+1,4)==0: _px(xx,yy,"B")
			_px(cx-2,cy-3,"t")
		for yy: int in range(cy-6,cy+7):
			for xx: int in range(cx-12,cx+13):
				var u: float = (xx-cx)*ca+(yy-cy)*sa
				var v: float = -(xx-cx)*sa+(yy-cy)*ca
				var e: float = pow(u/10.5,2)+pow(v/3.0,2)
				if e>0.55 and e<=1.0 and (v>0)==front: _px(xx,yy,"k" if e>0.78 else "j")

func _space() -> void:
	var field: Dictionary = _textset(_data.title,false,1,2)
	var top: int = 999
	var bottom: int = -999
	for p: Vector2i in field.P: top = mini(top,p.y); bottom = maxi(bottom,p.y)
	var fw: int = 2*(int(field.w)+4)
	var fh: int = 2*(bottom-top+3)
	_hull(10,5,fw+6,fh+6,{"body":"z","rivets":false}); _led_title(13,8,_data.title)
	_planet(10+fw+22,19)
	for p: Vector2i in [Vector2i(10+fw+10,7),Vector2i(10+fw+34,31),Vector2i(136,44)]: _sparkle(p.x,p.y,"u",1,"t")
	_fancy(14,39,_data.titleEn,"s",{"outline":"z","small":true,"spacing":1})
	var wen: int = -1
	for ch: String in _data.titleEn: wen += _tw(ch,true)+1
	for k: int in 3: _rect(18+wen+k*4,43,2,2,"r" if k<2 else "x")
	_fancy(13,50,_data.tag,"u",{"outline":"z","small":true})
	var cw: int = 36+_tw(_data.curTag,true)+_tw(_data.cur)
	_hull(14,64,cw,15,{"rivets":false})
	_disc(20,71,11,"z"); _disc(20,71,10,"w")
	for yy: int in range(61,82):
		for xx: int in range(10,31):
			if (xx-20)*(xx-20)+(yy-71)*(yy-71)<=100 and xx-20+yy-71 < -7: _px(xx,yy,"v")
	_disc(20,71,7,"z"); _disc(20,71,6,"y")
	for k: int in 8:
		var a: float = PI/4*k+PI/8
		_px(20+_py_round(8.5*cos(a)),71+_py_round(8.5*sin(a)),"u")
	_emblem(12,63); _text(34,68,_data.curTag,"s",true); _text(38+_tw(_data.curTag,true),67,_data.cur)
	var mw: int = _menu_width(134,46)
	_hull(12,87,mw,12+_data.items.size()*14,{"k":5,"stripe":3,"thick":true})
	var bx: int = mw-8
	_rect(bx-1,85,8,3,"z"); _h(bx,86,6,"w"); _px(bx,86,"v")
	_rect(bx+1,82,4,4,"z"); _rect(bx+2,83,2,2,"A"); _px(bx+2,83,"D")
	for p: Vector2i in [Vector2i(bx-1,83),Vector2i(bx+6,83),Vector2i(bx+2,80),Vector2i(bx+3,80)]: _px(p.x,p.y,"h")
	for i: int in _data.items.size():
		var it: Dictionary = _data.items[i]
		var ry: int = 96+i*14
		_rows.append(Rect2(18,ry-1,mw-12,14))
		if i==_selection:
			var mask: Dictionary = _cham(18,ry-1,mw-12,14,3)
			_paint(_grow(mask),"z"); _paint(mask,"B")
			for p: Vector2i in mask:
				if not mask.has(p+Vector2i.UP): _px(p.x,p.y,"C")
				elif not mask.has(p+Vector2i.DOWN): _px(p.x,p.y,"g")
			for p: Vector2i in mask:
				if p.x<22 or p.x>=12+mw-10: _px(p.x,p.y,_hazard(p.x,p.y))
		_icon(it.icon,24,ry); _text(39,ry,it.label,"t" if i==_selection else "u")
		if i==_selection:
			if it.has("detail"): _text(mw,ry+1,it.detail,"l",true,"r")
			_glyph("...zzz.......\n..zhiizzzzz..\nzzzuuuuuuttz.\njkzuuqsquutiz\nzzzvvvvvvuuz.\n..zhiizzzzz..\n...zzz.......",3,ry)
		if i>0 and i<_data.items.size()-1:
			for xx: int in range(24,mw,4): _px(xx,ry+13,"x")
	var cw2: int = 24+_tw(_data.coins,true)
	_hull(314-cw2,6,cw2,14,{"rivets":false}); _coin(318-cw2,8); _text(308,8,_data.coins,"t",true,"r")
	_footer("S6")
