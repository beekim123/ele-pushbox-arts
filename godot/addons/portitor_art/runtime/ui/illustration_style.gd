extends RefCounted
const Contract = preload("../../api/provider_contract.gd")
const BACKGROUND = preload("../render/themes/background.gd")
const TERRAIN = preload("../render/terrain/terrain_material.gd")
const SpriteType = preload("../render/sprites/sprite_assets.gd")
const AmbientType = preload("../render/ambient/ambient.gd")
const PALETTE_SHADER: Shader = preload("../render/sprites/palette.gdshader")
static func bind_visual_tiles(material: ShaderMaterial, dimensions: Vector2i, cells: PackedByteArray) -> Dictionary:
	var bytes := PackedByteArray()
	bytes.resize(cells.size()*4)
	for index: int in cells.size():
		bytes[index*4] = cells[index]
		bytes[index*4+3] = 255
	var image: Image = Image.create_from_data(dimensions.x,dimensions.y,false,Image.FORMAT_RGBA8,bytes)
	image.resize(dimensions.x*16,dimensions.y*16,Image.INTERPOLATE_NEAREST)
	material.set_shader_parameter("grid_size",dimensions)
	return TERRAIN.bind_visual_cells(material,ImageTexture.create_from_image(image),{"format":"visual_cells/1","size":image.get_size(),"origin":Vector2i.ZERO,"visible_rect":Rect2i(Vector2i.ZERO,image.get_size()),"recipe":"tile"})

static func sample_geometry(dimensions: Vector2i, cells: PackedByteArray, origin: Vector2i, occupied: Array[Vector2i], area: Rect2i) -> Dictionary:
	var floor_slots: Array[Vector2i] = []
	var ceiling_slots: Array[Vector2i] = []
	var edges: Array[Vector2i] = []
	var alive := PackedByteArray()
	alive.resize(cells.size()); alive.fill(1)
	for y: int in dimensions.y:
		for x: int in dimensions.x:
			var point := Vector2i(x,y)
			if cells[y*dimensions.x+x] != 0 or point in occupied: continue
			if y+1 < dimensions.y and cells[(y+1)*dimensions.x+x] in [1,2,3]:
				floor_slots.append(point)
				if x+1 >= dimensions.x or (cells[y*dimensions.x+x+1] == 0 and (y+1 >= dimensions.y or cells[(y+1)*dimensions.x+x+1] not in [1,2,3])): edges.append(point)
			if y>0 and cells[(y-1)*dimensions.x+x] in [1,2,3]: ceiling_slots.append(point)
	return {"grid_size":dimensions,"cell_size":16,"room_bounds":Rect2i(origin,dimensions*16),"ambient_area":area,"floor_slots":floor_slots,"ceiling_slots":ceiling_slots,"perch_edges":edges,"alive_mask":alive,"exclude_room":false,"ambient_mode":"one"}


static func theme(provider: RefCounted, uid: String) -> Dictionary:
	var checked: Dictionary = Contract.require_capability(provider,uid,"theme")
	if not checked.ok: return checked
	var value: Dictionary = checked.value.metadata.get("params",{})
	for key: String in ["rock","earth","cracked","sand","water","background"]:
		if not value.get(key) is Dictionary: return Contract.result(["incomplete illustration theme: "+key])
	if not value.rock.get("pattern") is String or not value.background.get("style") is String: return Contract.result(["missing illustration style enums"])
	return Contract.result([],value)

static func require_sprites(provider: RefCounted, requirements: Array[Dictionary]) -> Dictionary:
	for item: Dictionary in requirements:
		var checked: Dictionary = Contract.require_capability(provider,item.asset_uid,"sprite")
		if not checked.ok: return checked
		var metadata: Dictionary = checked.value.metadata
		var dimensions: Variant = metadata.get("size")
		var anchor: Variant = metadata.get("anchor")
		if not dimensions is Array or dimensions.size()!=2 or not anchor is Array or anchor.size()!=2: return Contract.result(["missing illustration sprite size/anchor"])
		for value: Variant in dimensions+anchor:
			if not _pixel_integer(value): return Contract.result(["invalid illustration sprite size/anchor number"])
		var texture: Texture2D = provider.texture(item.asset_uid)
		var frame_count: Variant = metadata.get("frame_count")
		if texture==null or dimensions[0]<=0 or dimensions[1]<=0 or not _pixel_integer(frame_count) or frame_count<1 or dimensions[0]*frame_count!=texture.get_width() or dimensions[1]!=texture.get_height(): return Contract.result(["invalid illustration sprite layout"])
		var animations: Variant = metadata.get("animations")
		if not animations is Dictionary: return Contract.result(["invalid illustration animation table"])
		var animation: Variant = animations.get(item.animation)
		if not animation is Dictionary: return Contract.result(["missing illustration sprite animation"])
		var frames: Variant = animation.get("frames")
		if not frames is Array or frames.is_empty(): return Contract.result(["missing illustration sprite frames"])
		for frame: Variant in frames:
			if not _pixel_integer(frame) or frame<0 or frame>=frame_count: return Contract.result(["invalid illustration sprite frame"])
		var fps: Variant = animation.get("fps",0)
		if not (fps is int or fps is float) or not is_finite(float(fps)) or fps<0 or not animation.get("loop",false) is bool:
			return Contract.result(["invalid illustration animation timing"])
	return Contract.result([])

static func _pixel_integer(value: Variant) -> bool:
	return (value is int or value is float) and is_finite(float(value)) and value==floor(value) and value>=-2147483648 and value<=2147483647
