class_name PortitorArtFontMask
extends RefCounted
## Extracted from game/presentation/ui/widgets/lobby_skins.gd:104-112,161-189.
## Font atlas sampling, integer zoom/spacing and growth preserve the original
## algorithms. Glyph masks are generated in memory from explicitly supplied
## fonts and retain those fonts' OFL/copyright notices; no glyph art is embedded
## or relicensed here. The widgets reference is weak to avoid an ownership cycle.
const N4: Array[Vector2i] = [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]
const N8: Array[Vector2i] = [Vector2i(-1,-1),Vector2i(0,-1),Vector2i(1,-1),Vector2i(-1,0),Vector2i(1,0),Vector2i(-1,1),Vector2i(0,1),Vector2i(1,1)]
var _widgets_ref: WeakRef
var _glyphs: Dictionary = {}
var _atlases: Dictionary = {}
var _font_sources: Dictionary = {}

func configure(widgets: RefCounted) -> void:
	_widgets_ref = weakref(widgets) if widgets != null else null
	_glyphs.clear()
	_atlases.clear()
	_font_sources.clear()

func textset(value: String, small: bool = false, zoom: int = 1, spacing: int = 0) -> Dictionary:
	var widgets: RefCounted
	if _widgets_ref != null: widgets = _widgets_ref.get_ref() as RefCounted
	if widgets == null or not widgets.has_method("font") or not widgets.has_method("measure"):
		push_error("font mask requires explicitly configured widgets")
		return {"P":{}, "w":0}
	var variation: FontVariation = widgets.font(small) as FontVariation
	if variation == null or not variation.base_font is FontFile:
		push_error("font mask requires the supplied bitmap FontFile")
		return {"P":{}, "w":0}
	var face: FontFile = variation.base_font as FontFile
	# Widgets can be reconfigured in place. Never reuse masks/atlas images from
	# their previous font root, even when this mask component itself is reused.
	if _font_sources.has(small) and _font_sources[small] != variation:
		_glyphs.clear()
		_atlases.clear()
		_font_sources.clear()
	_font_sources[small] = variation
	var result: Dictionary = {}
	var cx: int = 0
	var font_size: int = 10 if small else 12
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
							mask[Vector2i(xx+offset.x,yy+offset.y+roundi(variation.get_ascent(font_size))-(2 if small else 1))] = true
			_glyphs[key] = mask
		for p: Vector2i in _glyphs[key]:
			for yy: int in zoom:
				for xx: int in zoom: result[Vector2i(cx+p.x*zoom+xx,p.y*zoom+yy)] = true
		cx += widgets.measure(ch,small)*zoom+spacing
	return {"P":result,"w":maxi(0,cx-spacing)}

func grow(points: Dictionary, amount: int = 1, diagonal: bool = true) -> Dictionary:
	var result: Dictionary = points.duplicate()
	for step: int in amount:
		var next: Dictionary = result.duplicate()
		for p: Vector2i in result:
			for d: Vector2i in N8 if diagonal else N4: next[p+d] = true
		result = next
	return result
