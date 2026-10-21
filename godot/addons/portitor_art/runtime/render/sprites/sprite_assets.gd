class_name PortitorArtSpriteAssets
extends RefCounted
## Provider-owned sprite drawing and caches.
const Palette = preload("../palette_raster.gd")
var _images: Dictionary = {}
var _textures: Dictionary = {}
var _metadata_cache: Dictionary = {}
var _sparse_sheets: Dictionary = {}
var _rgba_indices: Dictionary = {}

var provider: RefCounted
func _init(value: RefCounted = null) -> void:
	provider = value

func metadata(uid: String) -> Dictionary:
	if _metadata_cache.has(uid): return _metadata_cache[uid]
	if provider == null: return {}
	var entry: Dictionary = provider.metadata(uid)
	if entry.get("approved") != true or entry.get("placeholder") != false: return {}
	_metadata_cache[uid] = entry
	return entry

func clear_caches() -> void:
	_images.clear(); _textures.clear(); _metadata_cache.clear(); _sparse_sheets.clear(); _rgba_indices.clear()

func has(uid: String) -> bool:
	return not metadata(uid).is_empty()

func frame_at(asset: Dictionary, animation: Variant, tick: int) -> int:
	if animation is int or animation is float:
		return int(animation)
	var a: Dictionary = asset.get("animations", {}).get(str(animation), {})
	if a.is_empty() or a.get("frames", []).is_empty():
		return 0
	var frames: Array = a.frames
	if float(a.get("fps", 0)) == 0 or frames.size() == 1:
		return int(frames[0])
	var step: int = floori(float(tick) * float(a.fps) / 60)
	return int(frames[posmod(step, frames.size()) if bool(a.get("loop", false)) else mini(maxi(0, step), frames.size() - 1)])

func texture(uid: String) -> Texture2D:
	if _textures.has(uid):
		return _textures[uid]
	var asset: Dictionary = metadata(uid)
	var result: Texture2D = provider.texture(uid) if provider != null else null
	if result != null: _textures[uid] = result
	return result

func _image(uid: String) -> Image:
	if not _images.has(uid):
		var sheet: Texture2D = texture(uid)
		if sheet == null:
			return null
		var image: Image = sheet.get_image()
		if image.is_compressed():
			image.decompress()
		image.convert(Image.FORMAT_RGBA8)
		_images[uid] = image
	return _images[uid]

func _sparse_frame(uid: String, size: Vector2i, frame: int) -> Array[Vector3i]:
	if not _sparse_sheets.has(uid):
		if _rgba_indices.is_empty():
			for i: int in range(Palette.HEX.size()):
				_rgba_indices[Color.html(Palette.HEX[i]).to_rgba32()] = i
		var source: Image = _image(uid)
		var frames: Dictionary = {}
		# Decode the whole approved strip at first use, outside later pose/frame
		# changes. All animation frames then share the same sparse integer path.
		for index: int in range(source.get_width() / size.x):
			var points: Array[Vector3i] = []
			for y: int in range(size.y):
				for x: int in range(size.x):
					var color: Color = source.get_pixel(index * size.x + x, y)
					if color.a8 == 0:
						continue
					var code: int = _rgba_indices.get(color.to_rgba32(), -1)
					if code >= 0:
						points.append(Vector3i(x, y, code))
			frames[index] = points
		_sparse_sheets[uid] = frames
	return _sparse_sheets[uid][frame]

func blit(raster: RefCounted, uid: String, animation: Variant, tick: int, anchor: Vector2i, flip: bool = false, visible_rows: int = -1) -> void:
	var asset: Dictionary = metadata(uid)
	if asset.is_empty():
		return
	var source: Image = _image(uid)
	if source == null:
		return
	var size: Vector2i = Vector2i(int(asset.size[0]), int(asset.size[1]))
	var pivot: Vector2i = Vector2i(size.x - int(asset.anchor[0]) if flip else int(asset.anchor[0]), int(asset.anchor[1]))
	var frame: int = frame_at(asset, animation, tick)
	if frame < 0 or (frame + 1) * size.x > source.get_width():
		push_error("Invalid animation frame for " + uid)
		return
	var points: Array[Vector3i] = _sparse_frame(uid, size, frame)
	if visible_rows >= 0 and visible_rows < size.y:
		var clipped: Array[Vector3i] = []
		for point: Vector3i in points:
			if point.y >= size.y - visible_rows: clipped.append(point)
		points = clipped
	raster.blit_sparse(points, anchor - pivot, size.x, flip)

func command_phase(commands: Array[Dictionary]) -> Array:
	var phase: Array = []
	for command: Dictionary in commands:
		var asset: Dictionary = metadata(command.uid)
		if not asset.is_empty():
			phase.append([command.uid, frame_at(asset, command.anim, command.tick), command.x, command.y, command.flip])
	return phase

func draw_asset(canvas: CanvasItem, uid: String, animation: Variant, tick: int, anchor: Vector2, flip: bool = false) -> void:
	# Invoke from the receiving CanvasItem's _draw(). No dimensions/anchors guessed.
	var asset: Dictionary = metadata(uid)
	var sheet: Texture2D = texture(uid)
	if asset.is_empty() or sheet == null:
		return
	var size: Vector2 = Vector2(float(asset.size[0]), float(asset.size[1]))
	var pivot: Vector2 = Vector2(size.x - float(asset.anchor[0]) if flip else float(asset.anchor[0]), float(asset.anchor[1]))
	var destination: Rect2 = Rect2(anchor.floor() - pivot, size)
	if flip:
		destination.position.x += size.x
		destination.size.x = -size.x
	canvas.draw_texture_rect_region(sheet, destination, Rect2(Vector2(frame_at(asset, animation, tick) * size.x, 0), size))
