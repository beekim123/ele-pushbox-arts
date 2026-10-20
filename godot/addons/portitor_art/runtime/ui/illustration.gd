class_name PortitorArtIllustration
extends TextureRect
## ui.js mapThumb/rulecard illustrations from approved rules and assets.
## Decorative drawings only: this widget creates no SDK world.

const RASTER = preload("../render/palette_raster.gd")
const BACKGROUND = preload("../render/themes/background.gd")
const AmbientType = preload("../render/ambient/ambient.gd")
const SpriteType = preload("../render/sprites/sprite_assets.gd")
const TERRAIN = preload("../render/terrain/terrain_material.gd")
const PALETTE_SHADER: Shader = preload("../render/sprites/palette.gdshader")

const Contract = preload("../../api/provider_contract.gd")
const Style = preload("illustration_style.gd")
var provider: RefCounted
var SPRITES: RefCounted
var AMBIENT: RefCounted
var dug: bool = false
var _theme_uid: String
var _theme: Dictionary = {}
var _kind: String = "chapter"
var _with_hero: bool = true
var _dimensions: Vector2i
var _map: Dictionary = {}
var _origin: Vector2i
var _floor_row: int = 0
var _viewport: SubViewport
var _background: Sprite2D
var _back: Sprite2D
var _front: Sprite2D
var _terrain: ColorRect
var _material: ShaderMaterial
var _tick: int = -1
var _background_key: int = -1
var _hero_key: int = -1

func bind_provider(value: RefCounted) -> Dictionary:
	var checked: Dictionary = Contract.validate_provider(value)
	if not checked.ok: return checked
	provider = value
	SPRITES = SpriteType.new(value)
	AMBIENT = AmbientType.new()
	return Contract.result([])

func configure_display(model: Dictionary) -> Dictionary:
	var errors: Array[String] = Contract.fields(model,{"kind":TYPE_STRING,"theme_uid":TYPE_STRING,"dimensions":TYPE_VECTOR2I,"tick":TYPE_INT,"with_hero":TYPE_BOOL},{},"illustration")
	if not errors.is_empty(): return Contract.result(errors)
	if model.kind not in ["chapter","rulecard"] or model.dimensions.x<=0 or model.dimensions.y<=12 or model.dimensions.x>512 or model.dimensions.y>512 or model.tick<0: return Contract.result(["invalid illustration display geometry/kind/tick"])
	if model.kind=="rulecard" and (model.dimensions!=Vector2i(56,32) or not model.with_hero): return Contract.result(["rulecard display uses its fixed neutral sample"])
	var checked: Dictionary = Style.theme(provider,model.theme_uid)
	if not checked.ok: return checked
	var required: Array[Dictionary] = []
	if model.with_hero:
		required.append({"asset_uid":"art:char.portitor","animation":"idle"})
		if model.kind=="rulecard": required.append({"asset_uid":"art:char.portitor","animation":"dig"})
		else: required.append({"asset_uid":"art:obj.crate_wood","animation":"default"})
	checked = Style.require_sprites(provider,required)
	if not checked.ok: return checked
	if _viewport!=null:
		remove_child(_viewport); _viewport.queue_free()
		_viewport=null
	_kind=model.kind; _with_hero=model.with_hero
	_tick=-1; _background_key=-1; _hero_key=-1; _material=null
	AMBIENT.clear_caches()
	_configure(model.theme_uid,model.dimensions,model.tick)
	return Contract.result([])

func _configure(theme_uid: String, dimensions: Vector2i, tick: int) -> void:
	_theme_uid = theme_uid
	_dimensions = dimensions
	size = Vector2(dimensions)
	expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	stretch_mode = TextureRect.STRETCH_SCALE
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_theme = provider.metadata(theme_uid).get("params",{})
	_rebuild_map(false)
	if DisplayServer.get_name() == "headless":
		dug = _kind == "rulecard" and (tick / 60) % 2 == 1
		return
	_viewport = SubViewport.new()
	_viewport.size = dimensions
	_viewport.transparent_bg = true
	_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	_viewport.canvas_item_default_texture_filter = Viewport.DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_NEAREST
	add_child(_viewport)
	_background = _sprite_layer()
	_back = _sprite_layer()
	_terrain = ColorRect.new()
	_terrain.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_terrain.position = Vector2(_origin)
	_terrain.size = Vector2(int(_map.w) * 16, int(_map.h) * 16)
	_material = TERRAIN.create(_theme)
	_material.set_shader_parameter("grid_size", Vector2i(_map.w, _map.h))
	_terrain.material = _material
	_viewport.add_child(_terrain)
	_front = _sprite_layer()
	texture = _viewport.get_texture()
	set_tick(tick)

func _sprite_layer() -> Sprite2D:
	var layer := Sprite2D.new()
	layer.centered = false
	var material := ShaderMaterial.new()
	material.shader = PALETTE_SHADER
	layer.material = material
	_viewport.add_child(layer)
	return layer

func _rebuild_map(is_dug: bool) -> void:
	var width: int = 4 if _kind == "rulecard" else ceili(float(_dimensions.x) / 16) + 1
	_floor_row = 1 if _kind == "rulecard" else floori(float(_dimensions.y - 12) / 16)
	var height: int = 2 if _kind == "rulecard" else _floor_row + 2
	_origin = Vector2i(-4, 0) if _kind == "rulecard" else Vector2i(0, _dimensions.y - 12 - _floor_row * 16)
	var cells: Array[int] = []
	for y: int in height:
		for x: int in width:
			cells.append(1 if y >= _floor_row else 3 if _kind == "rulecard" and y == 0 and x == 2 and not is_dug else 0)
	_map = {"w": width, "h": height, "terrain": cells}
	if _material != null:
		_upload_map()

func _upload_map() -> void:
	bind_visual_tiles(_material, Vector2i(_map.w,_map.h), PackedByteArray(_map.terrain))

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

func set_tick(tick: int) -> void:
	if _viewport == null or _theme.is_empty() or tick == _tick:
		return
	var next_dug: bool = _kind == "rulecard" and (tick / 60) % 2 == 1
	if _tick < 0 or next_dug != dug:
		dug = next_dug
		_rebuild_map(dug)
	_tick = tick
	_material.set_shader_parameter("visual_tick", tick >> 3)
	var background_key: int = tick >> 4 if _theme.background.style in ["sky", "cosmos"] else 0
	if background_key != _background_key:
		_background_key = background_key
		var raster = RASTER.new(_dimensions.x, _dimensions.y)
		BACKGROUND.draw(raster, _theme, Rect2i(Vector2i.ZERO, _dimensions), tick)
		_update_texture(_background, raster.image())
	if _kind == "rulecard":
		var animation: String = "idle" if dug else "dig"
		var frame: int = SPRITES.frame_at(provider.metadata("art:char.portitor"), animation, tick)
		var key: int = frame + (100 if dug else 0)
		if key == _hero_key:
			return
		_hero_key = key
		var actor = RASTER.new(56, 32)
		SPRITES.blit(actor, "art:char.portitor", animation, tick, Vector2i(20, 16))
		_update_texture(_front, actor.image())
		return
	var occupied: Array[Vector2i] = [Vector2i(1,_floor_row-1),Vector2i(2,_floor_row-1)] if _with_hero else []
	var seed: int = AMBIENT.seed_of(_theme_uid.trim_prefix("art:"))
	var area := Rect2i(0, 0, _dimensions.x, _dimensions.y - 14)
	var back = RASTER.new(_dimensions.x, _dimensions.y)
	var front = RASTER.new(_dimensions.x, _dimensions.y)
	for command: Dictionary in AMBIENT.plan(_theme, sample_geometry(Vector2i(_map.w,_map.h),PackedByteArray(_map.terrain),_origin,occupied,area), _origin, tick, "back", SPRITES, seed, []):
		SPRITES.blit(back, command.uid, command.anim, command.tick, Vector2i(command.x, command.y), command.flip)
	for command: Dictionary in AMBIENT.plan(_theme, sample_geometry(Vector2i(_map.w,_map.h),PackedByteArray(_map.terrain),_origin,occupied,area), _origin, tick, "front", SPRITES, seed, []):
		SPRITES.blit(front, command.uid, command.anim, command.tick, Vector2i(command.x, command.y), command.flip)
	if _with_hero:
		SPRITES.blit(front, "art:char.portitor", "idle", tick, Vector2i(24, _origin.y + _floor_row * 16))
		SPRITES.blit(front, "art:obj.crate_wood", "default", 0, Vector2i(40, _origin.y + _floor_row * 16))
	_update_texture(_back, back.image())
	_update_texture(_front, front.image())

func _update_texture(layer: Sprite2D, image: Image) -> void:
	if layer.texture == null:
		layer.texture = ImageTexture.create_from_image(image)
	else:
		(layer.texture as ImageTexture).update(image)

func prepare_reference() -> void:
	if _viewport == null or not is_inside_tree() or DisplayServer.get_name() == "headless":
		return
	await get_tree().process_frame
	await RenderingServer.frame_post_draw

class Picture extends TextureRect:
	## Presentation-only initial map, using the same approved palette shaders.
	## No SDK world, input, save, or simulation is created by a thumbnail.
	const Style = preload("illustration_style.gd")
	const PIXELS = preload("../render/palette_raster.gd")
	var viewport: SubViewport
	var provider: RefCounted
	var SPRITES: RefCounted
	var AMBIENT: RefCounted
	func bind_provider(value: RefCounted) -> Dictionary:
		var checked: Dictionary = Style.Contract.validate_provider(value)
		if not checked.ok: return checked
		provider = value
		SPRITES = Style.SpriteType.new(value)
		AMBIENT = Style.AmbientType.new()
		return Style.Contract.result([])

	func configure_visual(theme_uid: String, dimensions: Vector2i, visual_tiles: PackedByteArray, entities: Array[Dictionary], tick: int, origin: Vector2i) -> Dictionary:
		var checked: Dictionary = Style.theme(provider,theme_uid)
		if not checked.ok: return checked
		if dimensions.x<=0 or dimensions.y<=0 or dimensions.x>512 or dimensions.y>512 or visual_tiles.size()!=dimensions.x*dimensions.y or tick<0: return Style.Contract.result(["invalid illustration visual grid"])
		for cell: int in visual_tiles:
			if cell>18: return Style.Contract.result(["unknown visual tile class"])
		for entity: Dictionary in entities:
			var errors: Array[String] = Style.Contract.fields(entity,{"asset_uid":TYPE_STRING,"animation":TYPE_STRING,"position":TYPE_VECTOR2I},{},"illustration entity")
			if not errors.is_empty(): return Style.Contract.result(errors)
			var required: Array[Dictionary] = [entity]
			var available: Dictionary = Style.require_sprites(provider,required)
			if not available.ok: return available
		var theme: Dictionary = checked.value
		if viewport!=null:
			remove_child(viewport); viewport.queue_free(); viewport=null
		size = Vector2(126,44)
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		if DisplayServer.get_name()=="headless": return Style.Contract.result([])
		viewport = SubViewport.new()
		viewport.size = Vector2i(320,180)
		viewport.transparent_bg = false
		viewport.render_target_update_mode = SubViewport.UPDATE_ONCE
		viewport.canvas_item_default_texture_filter = Viewport.DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_NEAREST
		add_child(viewport)
		var backdrop = PIXELS.new(320,180)
		Style.BACKGROUND.draw(backdrop,theme,Rect2i(0,0,320,180),tick)
		_layer(backdrop.image())
		var actors = PIXELS.new(320,180)
		for entity: Dictionary in entities: SPRITES.blit(actors,entity.asset_uid,entity.animation,tick,entity.position)
		var terrain := ColorRect.new()
		terrain.position = Vector2(origin)
		terrain.size = Vector2(dimensions*16)
		var material: ShaderMaterial = Style.TERRAIN.create(theme)
		Style.bind_visual_tiles(material,dimensions,visual_tiles)
		material.set_shader_parameter("visual_tick",tick>>3)
		terrain.material = material
		viewport.add_child(terrain)
		_layer(actors.image())
		var crop := AtlasTexture.new()
		crop.atlas = viewport.get_texture()
		crop.region = Rect2(91,85,126,44)
		texture = crop
		return Style.Contract.result([])

	func _layer(pixels: Image) -> void:
		var node := Sprite2D.new()
		node.centered = false
		node.texture = ImageTexture.create_from_image(pixels)
		var material := ShaderMaterial.new()
		material.shader = Style.PALETTE_SHADER
		node.material = material
		viewport.add_child(node)

class ChapterPicture extends Picture:
	## The reference crops the same decorative stage around x=232, floor y=156.
	## These samples are illustrations, independent of chapter progress or SDKs.
	func configure_chapter_display(theme_uid: String, dimensions: Vector2i, tick: int, big: bool) -> Dictionary:
		if dimensions.x<=0 or dimensions.y<=0 or dimensions.x>320 or dimensions.y>180 or tick<0: return Style.Contract.result(["invalid chapter sample geometry/tick"])
		var checked: Dictionary = Style.theme(provider,theme_uid)
		if not checked.ok: return checked
		var required: Array[Dictionary] = [{"asset_uid":"art:char.portitor","animation":"idle"},{"asset_uid":"art:obj.crate_wood","animation":"default"}]
		checked = Style.require_sprites(provider,required)
		if not checked.ok: return checked
		if viewport!=null:
			remove_child(viewport);viewport.queue_free();viewport=null
		_build_chapter(theme_uid,dimensions,tick,big)
		return Style.Contract.result([])

	func _build_chapter(theme_uid: String, dimensions: Vector2i, _tick: int, big: bool) -> void:
		size = Vector2(dimensions)
		expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		if DisplayServer.get_name() == "headless": return
		var checked: Dictionary = Style.Contract.require_capability(provider,theme_uid,"theme")
		if not checked.ok: return
		var art: Dictionary = checked.value.metadata
		if not art.get("approved", false): return
		var theme: Dictionary = art.get("params", {})
		viewport = SubViewport.new()
		viewport.size = Vector2i(320, 180)
		viewport.render_target_update_mode = SubViewport.UPDATE_ONCE
		viewport.canvas_item_default_texture_filter = Viewport.DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_NEAREST
		add_child(viewport)
		var backdrop = PIXELS.new(320, 180)
		Style.BACKGROUND.draw(backdrop, theme, Rect2i(0, 0, 320, 180), 0)
		_layer(backdrop.image())
		var cells: Array[int] = []
		for y: int in 11:
			for x: int in 20:
				cells.append(1 if y >= 9 else 3 if y >= 6 and x in [11, 12] else 0)
		var map: Dictionary = {"w":20,"h":11,"terrain":cells}
		var occupied: Array[Vector2i] = [Vector2i(13,8),Vector2i(14,8),Vector2i(15,8),Vector2i(15,7)]
		var seed: int = AMBIENT.seed_of(theme_uid.trim_prefix("art:"))
		var origin := Vector2i(0, 12)
		var back = PIXELS.new(320, 180)
		var front = PIXELS.new(320, 180)
		for command: Dictionary in AMBIENT.plan(theme,Style.sample_geometry(Vector2i(20,11),PackedByteArray(cells),origin,occupied,Rect2i(0,0,320,154)),origin,0,"back",SPRITES,seed,[]):
			SPRITES.blit(back, command.uid, command.anim, command.tick, Vector2i(command.x, command.y), command.flip)
		_layer(back.image())
		var terrain := ColorRect.new()
		terrain.position = Vector2(origin)
		terrain.size = Vector2(320, 176)
		var material: ShaderMaterial = Style.TERRAIN.create(theme)
		material.set_shader_parameter("grid_size", Vector2i(20, 11))
		Style.bind_visual_tiles(material, Vector2i(20,11),PackedByteArray(cells))
		material.set_shader_parameter("visual_tick", 0)
		terrain.material = material
		# Backdrop masonry is one palette step behind the foreground props.
		var masonry := SubViewport.new()
		masonry.size = Vector2i(320, 180)
		masonry.transparent_bg = true
		masonry.render_target_update_mode = SubViewport.UPDATE_ONCE
		masonry.canvas_item_default_texture_filter = Viewport.DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_NEAREST
		viewport.add_child(masonry)
		masonry.add_child(terrain)
		var stone := Sprite2D.new()
		stone.centered = false
		stone.texture = masonry.get_texture()
		var dim := ShaderMaterial.new()
		dim.shader = preload("palette_dim.gdshader")
		dim.set_shader_parameter("dim_steps", 1)
		stone.material = dim
		viewport.add_child(stone)
		for command: Dictionary in AMBIENT.plan(theme,Style.sample_geometry(Vector2i(20,11),PackedByteArray(cells),origin,occupied,Rect2i(0,0,320,154)),origin,0,"front",SPRITES,seed,[]):
			SPRITES.blit(front, command.uid, command.anim, command.tick, Vector2i(command.x, command.y), command.flip)
		SPRITES.blit(front, "art:char.portitor", "idle", 0, Vector2i(216, 156))
		for at: Vector2i in [Vector2i(232, 156), Vector2i(248, 156), Vector2i(248, 140)]:
			SPRITES.blit(front, "art:obj.crate_wood", "default", 0, at)
		_layer(front.image())
		var crop := AtlasTexture.new()
		crop.atlas = viewport.get_texture()
		crop.region = Rect2(232 - dimensions.x / 2, (157 if big else 156) - dimensions.y, dimensions.x, dimensions.y)
		texture = crop

	func resize_chapter(dimensions: Vector2i, big: bool) -> void:
		size = Vector2(dimensions)
		if texture is AtlasTexture:
			texture.region = Rect2(232 - dimensions.x / 2, (157 if big else 156) - dimensions.y, dimensions.x, dimensions.y)

	func set_tick(_tick: int) -> void:
		pass # chapterImage in the reference always renders tick 0.

	func preparation_state() -> Dictionary:
		return {"prepared":viewport==null,"texture_instance":texture.get_instance_id() if texture!=null else 0}

	func begin_prepare() -> void:
		if viewport != null: viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS

	func finish_prepare() -> void:
		if viewport == null: return
		# Chapter artwork is fixed at tick 0. Keep its RGBA result rather than
		# letting an offscreen SubViewport initialize when a card first enters.
		(texture as AtlasTexture).atlas = ImageTexture.create_from_image(viewport.get_texture().get_image())
		remove_child(viewport)
		viewport.queue_free()
		viewport = null

	func prepare_reference() -> void:
		if viewport != null and is_inside_tree():
			begin_prepare()
			await get_tree().process_frame
			await RenderingServer.frame_post_draw
			finish_prepare()

class RulePicture extends Picture:
	## Presentation-only cross section from the G2 rule illustration:
	## a two-cell earth pillar next to the miner, with intact floor below.
	func configure_rule_sample(theme_uid: String, tick: int) -> Dictionary:
		var required: Array[Dictionary] = [{"asset_uid":"art:deco.dungeon_moss","animation":"default"},{"asset_uid":"art:deco.dungeon_torch","animation":"flicker"}]
		var checked: Dictionary = Style.require_sprites(provider,required)
		if not checked.ok: return checked
		var visual_tiles := PackedByteArray([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
		checked = configure_visual(theme_uid,Vector2i(12,7),visual_tiles,[{"asset_uid":"art:char.portitor","animation":"idle","position":Vector2i(120,124)}],tick,Vector2i(64,44))
		if not checked.ok: return checked
		if viewport != null:
			for child: Node in viewport.get_children():
				if child is ColorRect and child.material is ShaderMaterial:
					child.position.y -= 1
				elif child is Sprite2D and child != viewport.get_child(0):
					child.position.y -= 1
		if viewport != null:
			var adornments = PIXELS.new(320, 180)
			for decoration: Array in [["art:deco.dungeon_moss", "default", Vector2i(136, 91)], ["art:deco.dungeon_torch", "flicker", Vector2i(148, 96)]]:
				if Style.Contract.require_capability(provider,decoration[0],"sprite").ok: SPRITES.blit(adornments, decoration[0], decoration[1], tick, decoration[2])
			_layer(adornments.image())
		expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		size = Vector2(56, 44)
		if texture is AtlasTexture: (texture as AtlasTexture).region = Rect2(106, 84, 56, 44)
		return Style.Contract.result([])

	func set_tick(_tick: int) -> void:
		pass
