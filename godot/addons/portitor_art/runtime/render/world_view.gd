class_name PortitorArtWorldView
extends Node2D
## Provider-owned world paint. The caller supplies every visual tick and resolved snapshot.
const Contract = preload("../../api/provider_contract.gd")
const Schema = preload("../../api/world_snapshot.gd")
const Raster = preload("palette_raster.gd")
const Background = preload("themes/background.gd")
const AmbientType = preload("ambient/ambient.gd")
const EnvironmentType = preload("env/environment.gd")
const SpriteType = preload("sprites/sprite_assets.gd")
const Terrain = preload("terrain/terrain_material.gd")
const Matter = preload("matter.gd")
const PALETTE_SHADER: Shader = preload("sprites/palette.gdshader")
const VIEW_SIZE: Vector2i = Vector2i(320,180)
const LIGHTING_CACHE_LIMIT: int = 16
const LAYER_CACHE_LIMIT: int = 8
class PortitorArtOverlayCanvas extends Node2D:
	var view: Node2D
	func _draw() -> void:
		view.draw_overlay(self)
var overlay: Node2D
var provider: RefCounted
var Sprites: RefCounted
var Ambient: RefCounted = AmbientType.new()
var EnvEffects: RefCounted = EnvironmentType.new()
var _snapshot: Dictionary = {}
var _theme: Dictionary = {}
var _origin: Vector2i
var _terrain_material: ShaderMaterial
var _back: Sprite2D
var _terrain: ColorRect
var _plants_front: Sprite2D
var _front: Sprite2D
var _base_raster: RefCounted
var _static_background: RefCounted
var _base_key: String = ""
var _last_frame_key: String = ""
var _lighting_cache: Dictionary = {}
var _plants_cache: Dictionary = {}
var _entities_cache: Dictionary = {}
var _back_upload_key: String = ""
var _plants_upload_key: String = ""
var _front_upload_key: String = ""
var _layout_key: String = ""
var _checked_assets: Dictionary = {}
var _sprite_layouts: Dictionary = {}
var _visual_texture: Texture2D
var _visual_descriptor: Dictionary = {}
var last_validation_us: int = 0
var last_render_us: int = 0
var last_refresh_stages: Dictionary = {}

func prepare_assets(requirements: Array[Dictionary]) -> Dictionary:
	# Explicit resource preparation owns no clock or rules and never changes the bound view.
	var started: int=Time.get_ticks_usec()
	var prepared: Array[String]=[]
	var bytes: int=0
	if provider==null: return Contract.result(["resource preparation requires a provider"])
	for requirement: Dictionary in requirements:
		var errors: Array[String]=Contract.fields(requirement,{"asset_uid":TYPE_STRING,"animation":TYPE_STRING},{},"resource preparation")
		if not errors.is_empty(): return Contract.result(errors)
		var supported: Dictionary=Contract.require_capability(provider,requirement.asset_uid,"sprite")
		if not supported.ok: return supported
		errors=_sprite_binding_errors(requirement)
		if not errors.is_empty(): return Contract.result(errors)
	for requirement: Dictionary in requirements:
		var uid: String=requirement.asset_uid
		var metadata: Dictionary=Sprites.metadata(uid)
		var image: Image=Sprites._image(uid)
		Sprites._sparse_frame(uid,Vector2i(int(metadata.size[0]),int(metadata.size[1])),0)
		bytes+=image.get_data().size()
		prepared.append(uid)
		_checked_assets[uid]=true
	return Contract.result([],{"uids":prepared,"elapsed_us":Time.get_ticks_usec()-started,"retained_rgba_image_bytes":bytes})

func configure(value: RefCounted) -> Dictionary:
	var checked: Dictionary = Contract.validate_provider(value)
	if not checked.ok: return checked
	provider = value
	Sprites = SpriteType.new(value)
	clear_caches()
	_snapshot = {}; _theme = {}; _terrain_material = null
	return Contract.result([],true)

func set_snapshot(value: Dictionary) -> Dictionary:
	var started: int = Time.get_ticks_usec()
	var checked: Dictionary = Schema.validate(value)
	if not checked.ok: return checked
	if provider == null: return Contract.result(["WorldView requires a configured provider"])
	if not value.has("geometry") or not value.has("environment") or value.viewport != VIEW_SIZE:
		return Contract.result(["WorldView requires explicit geometry/environment and a 320x180 viewport"])
	var required: Array[String] = [value.theme_uid]
	for entity: Dictionary in value.entities:
		if not entity.asset_uid in required: required.append(entity.asset_uid)
	for effect: Dictionary in value.effects:
		if effect.kind=="sprite" and not effect.asset_uid in required: required.append(effect.asset_uid)
		if effect.kind=="tutorial_flight" and effect.get("style","goal")=="goal" and effect.get("phase","travel")=="travel" and not "art:ui.goal_lamp" in required:
			required.append("art:ui.goal_lamp")
	for uid: String in required:
		if _checked_assets.has(uid): continue
		var supported: Dictionary = Contract.require_capability(provider,uid,"theme" if uid==value.theme_uid else "sprite")
		if not supported.ok: return supported
	for entity: Dictionary in value.entities:
		var errors: Array[String] = _sprite_binding_errors(entity)
		if not errors.is_empty(): return Contract.result(errors)
	for effect: Dictionary in value.effects:
		if effect.kind=="sprite":
			var errors: Array[String] = _sprite_binding_errors(effect)
			if not errors.is_empty(): return Contract.result(errors)
		elif effect.kind=="tutorial_flight" and effect.get("style","goal")=="goal" and effect.get("phase","travel")=="travel":
			var errors: Array[String] = _sprite_binding_errors({"asset_uid":"art:ui.goal_lamp","animation":"off"})
			if not errors.is_empty(): return Contract.result(errors)
	var theme: Dictionary = provider.metadata(value.theme_uid).get("params",{})
	for key: String in ["rock","earth","cracked","sand","water","background"]:
		if not theme.get(key) is Dictionary: return Contract.result(["incomplete theme display parameters: "+key])
	if not theme.rock.get("pattern") is String or not theme.background.get("style") is String:
		return Contract.result(["missing theme style enums"])
	var geometry: Dictionary = value.geometry
	var next_layout: String = str([value.theme_uid,value.get("layout_id",""),value.get("layout_revision",0),value.origin,
		geometry.grid_size,geometry.cell_size,geometry.room_bounds,geometry.ambient_area,
		geometry.floor_slots,geometry.ceiling_slots,geometry.perch_edges])
	if next_layout != _layout_key:
		clear_caches()
		_layout_key = next_layout
	if _snapshot.get("theme_uid") != value.theme_uid or _terrain_material==null:
		_terrain_material = Terrain.create(theme)
		if _visual_texture != null: Terrain.bind_visual_cells(_terrain_material,_visual_texture,_visual_descriptor)
	for uid: String in required: _checked_assets[uid] = true
	_snapshot = checked.value
	_theme = theme
	_origin = value.origin
	last_validation_us = Time.get_ticks_usec()-started
	_ensure_layers()
	_terrain.material = _terrain_material
	_terrain_material.set_shader_parameter("matter_approved",Sprites.has("art:material.chapter2_5"))
	var fire: Dictionary = Sprites.metadata("art:fx.fire")
	_terrain_material.set_shader_parameter("fire_approved",not fire.is_empty())
	if not fire.is_empty():
		_terrain_material.set_shader_parameter("fire_sheet",Sprites.texture("art:fx.fire"))
		_terrain_material.set_shader_parameter("fire_frame",Sprites.frame_at(fire,"burn",value.tick))
	var paint_started: int = Time.get_ticks_usec()
	_render()
	overlay.queue_redraw()
	last_render_us = Time.get_ticks_usec()-paint_started
	return Contract.result([],true)

func _sprite_binding_errors(entity: Dictionary) -> Array[String]:
	var uid: String=entity.asset_uid
	var asset: Dictionary=Sprites.metadata(uid)
	if not _sprite_layouts.has(uid):
		if not asset.get("animations") is Dictionary or not asset.get("size") is Array or asset.size.size()!=2:
			return [uid+": missing sprite display metadata"]
		if not asset.get("anchor") is Array or asset.anchor.size()!=2:
			return [uid+": missing sprite anchor"]
		for pixel: Variant in asset.size+asset.anchor:
			if not _pixel_integer(pixel): return [uid+": noninteger sprite size/anchor"]
		if asset.size[0]<=0 or asset.size[1]<=0 or not _pixel_integer(asset.get("frame_count")) or asset.frame_count<1:
			return [uid+": invalid sprite dimensions/frame count"]
		var texture: Texture2D=Sprites.texture(uid)
		if texture==null: return [uid+": missing required sprite texture"]
		if int(asset.size[0])*int(asset.frame_count)!=texture.get_width() or int(asset.size[1])!=texture.get_height():
			return [uid+": sprite dimensions/frame count do not match its texture"]
		_sprite_layouts[uid]={"frame_count":int(asset.frame_count),"animations":{}}
	var layout: Dictionary=_sprite_layouts[uid]
	if entity.has("frame"):
		if entity.frame<0 or entity.frame>=layout.frame_count: return [uid+": frame outside sheet"]
	elif not layout.animations.has(entity.animation):
		var animation: Variant=asset.animations.get(entity.animation)
		if not animation is Dictionary or not animation.get("frames") is Array or animation.frames.is_empty():
			return [uid+": missing animation frames "+entity.animation]
		for frame: Variant in animation.frames:
			if not _pixel_integer(frame) or frame<0 or frame>=layout.frame_count: return [uid+": animation frame outside sheet"]
		var fps: Variant=animation.get("fps",0)
		if not (fps is int or fps is float) or not is_finite(float(fps)) or fps<0 or not animation.get("loop",false) is bool:
			return [uid+": invalid animation timing"]
		layout.animations[entity.animation]=true
	return []

static func _pixel_integer(value: Variant) -> bool:
	if not (value is int or value is float): return false
	return is_finite(float(value)) and value==floor(float(value)) and value>=-2147483648 and value<=2147483647

func set_visual_cells(texture: Texture2D, descriptor: Dictionary) -> Dictionary:
	var bound: Dictionary = Terrain.bind_visual_cells(_terrain_material,texture,descriptor)
	if bound.ok:
		_visual_texture = texture
		_visual_descriptor = bound.value
	return bound

func clear_visual_cells() -> void:
	_visual_texture = null
	_visual_descriptor = {}
	if _terrain_material != null:
		_terrain_material.set_shader_parameter("visual_cells",null)
		_terrain_material.set_shader_parameter("cells_visible",Vector4i.ZERO)

func get_anchor(id: String) -> Rect2:
	return _snapshot.get("anchors",{}).get(id,Rect2())

func clear_caches() -> void:
	_lighting_cache.clear(); _plants_cache.clear(); _entities_cache.clear()
	_back_upload_key=""; _plants_upload_key=""; _front_upload_key=""; _last_frame_key=""
	_base_key=""; _static_background=null; _checked_assets.clear(); _sprite_layouts.clear()
	Ambient.clear_caches()
	EnvEffects._pool_geometry.clear()
	if Sprites != null: Sprites.clear_caches()

func _render() -> void:
	var measured_us: int = Time.get_ticks_usec()
	var tick: int = _snapshot.tick
	var geometry: Dictionary = _snapshot.geometry
	var environment: Dictionary = _snapshot.environment
	var theme_uid: String = _snapshot.theme_uid
	var w: int = geometry.grid_size.x
	var h: int = geometry.grid_size.y
	var environment_mode: String = environment.mode
	var background_dim_steps: int = environment.dim_steps
	var observe: bool = environment.observe
	var show_grid: bool = environment.show_grid
	var frame_key: String = str([tick,_snapshot.origin,_snapshot.visual_seed,_snapshot.entities,_snapshot.effects,geometry,environment])
	if frame_key == _last_frame_key:
		last_refresh_stages = {"cached":Time.get_ticks_usec()-measured_us}
		return
	_last_frame_key = frame_key
	var lights: Array = []
	for light: Dictionary in environment.lights: lights.append({"id":light.asset_uid.trim_prefix("art:"),"x":light.position.x,"y":light.position.y})
	var back_commands: Array[Dictionary] = Ambient.plan(_theme,geometry,_origin,tick,"back",Sprites,_snapshot.visual_seed,lights)
	var front_commands: Array[Dictionary] = Ambient.plan(_theme,geometry,_origin,tick,"front",Sprites,_snapshot.visual_seed,lights)
	last_refresh_stages = {"ambient_plan":Time.get_ticks_usec()-measured_us}
	measured_us = Time.get_ticks_usec()
	var ctx: Dictionary = {"tick":tick,"area":environment.area,"lights":lights,"weather":environment.weather,"level":"lite" if environment_mode=="lights" else environment_mode}
	var background_tick: int = tick >> 4 if _theme.background.style in ["sky", "cosmos"] else 0
	var base_key: String = "%s:%d" % [theme_uid, background_tick]
	if _static_background == null:
		_static_background = Raster.new(320, 180)
		Background.draw_static(_static_background, _theme, Rect2i(Vector2i.ZERO, VIEW_SIZE))
	if base_key != _base_key:
		_base_raster = _static_background.copy()
		Background.draw_dynamic(_base_raster, _theme, Rect2i(Vector2i.ZERO, VIEW_SIZE), tick)
		_base_key = base_key
	var lighting_key: String = str([base_key, environment_mode, EnvEffects.lighting_phase(_theme, ctx)])
	var quiet: bool = EnvEffects.quiet_weather(_theme, ctx)
	var world_area: Rect2i = Rect2i(_origin, Vector2i(w * 16, h * 16))
	var observing: bool = observe
	var back_key: String = str([lighting_key, Sprites.command_phase(back_commands), observing, world_area])
	var back_raster: RefCounted = null
	if not quiet or back_key != _back_upload_key:
		if not _lighting_cache.has(lighting_key):
			var lit: RefCounted = _base_raster.copy()
			EnvEffects.draw_background_light(lit, _theme, ctx)
			_cache_layer(_lighting_cache, lighting_key, lit, LIGHTING_CACHE_LIMIT)
		back_raster = _lighting_cache[lighting_key].copy()
		if not quiet:
			EnvEffects.draw_weather_back(back_raster, _theme, ctx)
		_blit_commands(back_raster, back_commands)
	last_refresh_stages.background_environment = Time.get_ticks_usec() - measured_us
	measured_us = Time.get_ticks_usec()
	var plants_key: String = str(Sprites.command_phase(front_commands))
	var plants_final_key: String = str([plants_key, observing, world_area])
	var plants_raster: RefCounted = null
	if not quiet or plants_final_key != _plants_upload_key:
		if not _plants_cache.has(plants_key):
			var plants: RefCounted = Raster.new(320, 180)
			_blit_commands(plants, front_commands)
			_cache_layer(_plants_cache, plants_key, plants, LAYER_CACHE_LIMIT)
		plants_raster = _plants_cache[plants_key].copy()
	var entities_key: String = _entity_phase(tick)
	var front_final_key: String = str([entities_key,_snapshot.effects,observing,show_grid,world_area])
	var front_raster: RefCounted = null
	if not quiet or front_final_key != _front_upload_key:
		if not _entities_cache.has(entities_key):
			var entities: RefCounted = Raster.new(320, 180)
			_paint_stage(entities,"entities")
			_cache_layer(_entities_cache, entities_key, entities, LAYER_CACHE_LIMIT)
		front_raster = _entities_cache[entities_key].copy()
		if not quiet:
			EnvEffects.draw(front_raster, _theme, "front", ctx)
		_paint_stage(front_raster,"target")
	if observing:
		if back_raster != null:
			back_raster.remap(world_area, Raster.DIM_MAP)
		if plants_raster != null:
			plants_raster.remap(world_area, Raster.DIM_MAP)
		if front_raster != null:
			front_raster.remap(world_area, Raster.DIM_MAP)
			_paint_stage(front_raster,"observe")
	if front_raster != null and (show_grid or observe):
		_draw_grid(front_raster, w, h)
	last_refresh_stages.foreground_entities = Time.get_ticks_usec() - measured_us
	measured_us = Time.get_ticks_usec()
	if back_raster != null:
		_update_texture(_back, back_raster.image())
	if plants_raster != null:
		_update_texture(_plants_front, plants_raster.image())
	if front_raster != null:
		_update_texture(_front, front_raster.image())
	_back_upload_key = back_key if quiet else ""
	_plants_upload_key = plants_final_key if quiet else ""
	_front_upload_key = front_final_key if quiet else ""
	var vignette: int = int(_theme.get("env", {}).get("vignette", 0)) if environment_mode != "off" else 0
	(_back.material as ShaderMaterial).set_shader_parameter("vignette_width", vignette)
	(_plants_front.material as ShaderMaterial).set_shader_parameter("vignette_width", vignette)
	for sprite: Sprite2D in [_back, _plants_front, _front]:
		(sprite.material as ShaderMaterial).set_shader_parameter("background_dim_steps", maxi(0, background_dim_steps))
	last_refresh_stages.texture_upload = Time.get_ticks_usec() - measured_us
	measured_us = Time.get_ticks_usec()
	_terrain.position = _origin
	_terrain.size = Vector2(w * 16, h * 16)
	_terrain_material.set_shader_parameter("grid_size", Vector2i(w, h))
	_terrain_material.set_shader_parameter("visual_tick", tick >> 3)
	_terrain_material.set_shader_parameter("screen_origin", _origin)
	_terrain_material.set_shader_parameter("vignette_width", vignette)
	_terrain_material.set_shader_parameter("observe", observe)
	_terrain_material.set_shader_parameter("background_dim_steps", maxi(0, background_dim_steps))
static func _cache_layer(cache: Dictionary, key: String, raster: RefCounted, limit: int) -> void:
	if cache.size() >= limit:
		cache.erase(cache.keys()[0])
	cache[key] = raster

func _ensure_layers() -> void:
	if _back != null:
		return
	_back = Sprite2D.new()
	_back.centered = false
	_back.material = _palette_material()
	add_child(_back)
	_terrain = ColorRect.new()
	_terrain.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_terrain)
	_plants_front = Sprite2D.new()
	_plants_front.centered = false
	_plants_front.material = _palette_material()
	add_child(_plants_front)
	_front = Sprite2D.new()
	_front.centered = false
	_front.material = _palette_material()
	add_child(_front)
	overlay = PortitorArtOverlayCanvas.new()
	overlay.view = self
	overlay.z_index = 5
	add_child(overlay)
	if _terrain_material != null:
		_terrain.material = _terrain_material

static func _update_texture(sprite: Sprite2D, image: Image) -> void:
	if sprite.texture == null:
		sprite.texture = ImageTexture.create_from_image(image)
	else:
		(sprite.texture as ImageTexture).update(image)

func _palette_material() -> ShaderMaterial:
	var material: ShaderMaterial = ShaderMaterial.new()
	material.shader = PALETTE_SHADER
	return material


func _blit_commands(raster: RefCounted, commands: Array[Dictionary]) -> void:
	for command: Dictionary in commands: Sprites.blit(raster,command.uid,command.anim,command.tick,Vector2i(command.x,command.y),command.flip)

func _entity_phase(tick: int) -> String:
	var frames: Array = []
	for entity: Dictionary in _snapshot.entities:
		frames.append([entity.asset_uid,entity.get("frame",Sprites.frame_at(Sprites.metadata(entity.asset_uid),entity.animation,entity.get("animation_tick",tick))),entity.position,entity.flip_h,entity.get("visible_rows",-1),entity.layer,entity.get("order",0)])
	var effects: Array = []
	for effect: Dictionary in _snapshot.effects:
		if effect.get("stage","entities")=="entities": effects.append(effect)
	return str([frames,effects])

func _paint_stage(raster: RefCounted, stage: String, resolved: Dictionary = {}) -> void:
	# Internal pure paint helper; compatibility callers validate the same display schema.
	var model: Dictionary = _snapshot if resolved.is_empty() else resolved
	var records: Array = []
	if stage=="entities": records.append_array(model.entities)
	for effect: Dictionary in model.effects:
		if effect.get("stage","entities")==stage: records.append(effect)
	var ordered: Array = []
	for index: int in records.size(): ordered.append({"data":records[index],"index":index})
	ordered.sort_custom(func(a: Dictionary,b: Dictionary) -> bool:
		var aa: Array = [a.data.get("layer",2),a.data.get("order",0),a.index]
		var bb: Array = [b.data.get("layer",2),b.data.get("order",0),b.index]
		for i: int in 3:
			if aa[i]!=bb[i]: return aa[i]<bb[i]
		return false)
	for record: Dictionary in ordered:
		var item: Dictionary = record.data
		if item.has("asset_uid"):
			Sprites.blit(raster,item.asset_uid,item.get("frame",item.animation),item.get("animation_tick",model.tick),item.position,item.flip_h,item.get("visible_rows",-1))
		else: Matter.draw(raster,item)

func draw_overlay(canvas: Node2D) -> void:
	if _snapshot.is_empty(): return
	for effect: Dictionary in _snapshot.effects:
		if effect.get("stage","")!="overlay": continue
		match effect.kind:
			"room_focus":
				var room: Rect2 = Rect2(effect.bounds)
				canvas.draw_rect(Rect2(0,20,320,maxf(0,room.position.y-20)),Color(0,0,0,0.5))
				canvas.draw_rect(Rect2(0,room.end.y,320,maxf(0,180-room.end.y)),Color(0,0,0,0.5))
				canvas.draw_rect(Rect2(0,room.position.y,room.position.x,room.size.y),Color(0,0,0,0.5))
				canvas.draw_rect(Rect2(room.end.x,room.position.y,maxf(0,320-room.end.x),room.size.y),Color(0,0,0,0.5))
				for edge: int in range(1,17): canvas.draw_rect(room.grow(edge),Color(0.094,0.078,0.145,0.5*(1-float(edge)/17)),false,1)
			"highlight":
				var color: Color = Color.WHITE if effect.get("style","goal")=="flash" else Color(0.388,0.78,0.302,effect.get("alpha",1.0))
				canvas.draw_rect(Rect2(effect.bounds),color,false,1)
			"tutorial_flight":
				if effect.get("phase","travel")=="arrival":
					canvas.draw_rect(Rect2(Vector2(effect.to)-Vector2(4,4),Vector2(8,8)),Color.WHITE)
				else:
					var point: Vector2 = Vector2(effect.from).lerp(Vector2(effect.to),1-pow(1-effect.progress,3)).floor()
					canvas.draw_rect(Rect2(point-Vector2.ONE,Vector2(2,2)),Color.WHITE)
					canvas.draw_rect(Rect2(point-Vector2(2,0),Vector2.ONE),Color("63c74d"))
					if effect.get("style","goal")=="goal":
						var lamp: Dictionary = Sprites.metadata("art:ui.goal_lamp")
						var dimensions: Array = lamp.get("size",[9,9])
						var pivot: Array = lamp.get("anchor",[0,0])
						var at: Vector2 = Vector2(effect.to)-Vector2(dimensions[0],dimensions[1])/2+Vector2(pivot[0],pivot[1])
						Sprites.draw_asset(canvas,"art:ui.goal_lamp","off",0,at)
			"link":
				var start: Vector2 = effect.from
				var end: Vector2 = effect.to
				var distance: float = start.distance_to(end)
				for offset: int in range(0,ceili(distance),8): canvas.draw_line(start.move_toward(end,offset).floor(),start.move_toward(end,minf(distance,offset+4)).floor(),Color(0.388,0.78,0.302,1-effect.progress),1)
func _draw_grid(raster: RefCounted, width: int, height: int) -> void:
	for y: int in range(height + 1):
		for x: int in range(0, width * 16, 2):
			raster.set_code(_origin.x + x, _origin.y + y * 16 - (1 if y == height else 0), "v")
	for x: int in range(width + 1):
		for y: int in range(0, height * 16, 2):
			raster.set_code(_origin.x + x * 16 - (1 if x == width else 0), _origin.y + y, "v")


func render_texture(uid: String, tick: int = 0) -> Texture2D:
	if DisplayServer.get_name()=="headless": return null
	var viewport: SubViewport = SubViewport.new()
	viewport.size = VIEW_SIZE
	viewport.transparent_bg = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	viewport.canvas_item_default_texture_filter = Viewport.DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_NEAREST
	get_tree().root.add_child(viewport)
	var view: Node2D = get_script().new()
	view.configure(provider)
	viewport.add_child(view)
	var geometry: Dictionary = _sample_geometry(Vector2i(21,11),Vector2i(0,12),9,false,false,Rect2i(0,0,320,150))
	var bound: Dictionary = view.set_snapshot({"format":"portitor.art.world/1","tick":tick,"theme_uid":uid,
		"viewport":VIEW_SIZE,"origin":Vector2i(0,12),"visual_seed":Ambient.seed_of(uid.trim_prefix("art:")),
		"entities":[],"effects":[],"anchors":{},"geometry":geometry,
		"environment":{"mode":"full","weather":provider.metadata(uid).get("params",{}).get("env",{}).get("weather","none"),
		"area":Rect2i(0,20,320,136),"lights":[],"observe":false,"show_grid":false,"dim_steps":0}})
	if not bound.ok:
		viewport.queue_free()
		return null
	view.set_visual_cells(_sample_tiles(Vector2i(21,11),9),{"format":"visual_cells/1","size":Vector2i(336,176),"origin":Vector2i.ZERO,"visible_rect":Rect2i(0,0,336,176),"recipe":"tile"})
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var result: ImageTexture = ImageTexture.create_from_image(viewport.get_texture().get_image())
	viewport.queue_free()
	return result

func render_thumbnail(uid: String, size: Vector2i, tick: int = 0, with_hero: bool = true) -> Texture2D:
	if DisplayServer.get_name()=="headless" or size.x<=0 or size.y<=12: return null
	var supported: Dictionary = Contract.require_capability(provider,uid,"theme")
	if not supported.ok: return null
	if with_hero:
		for requirement: Dictionary in [{"asset_uid":"art:char.portitor","animation":"idle"},{"asset_uid":"art:obj.crate_wood","animation":"default"}]:
			if not Contract.require_capability(provider,requirement.asset_uid,"sprite").ok or not _sprite_binding_errors(requirement).is_empty(): return null
	var theme: Dictionary = supported.value.metadata.params
	var cols: int = ceili(float(size.x)/16)+1
	var floor_row: int = floori(float(size.y-12)/16)
	var origin: Vector2i = Vector2i(0,size.y-12-floor_row*16)
	var geometry: Dictionary = _sample_geometry(Vector2i(cols,floor_row+2),origin,floor_row,false,with_hero,Rect2i(0,0,size.x,size.y-14))
	var lights: Array = []
	var planner: RefCounted = AmbientType.new()
	var sprites: RefCounted = SpriteType.new(provider)
	var back: RefCounted = Raster.new(size.x,size.y)
	Background.draw(back,theme,Rect2i(Vector2i.ZERO,size),tick)
	var back_commands: Array[Dictionary] = planner.plan(theme,geometry,origin,tick,"back",sprites,planner.seed_of(uid.trim_prefix("art:")),lights)
	for command: Dictionary in back_commands: sprites.blit(back,command.uid,command.anim,command.tick,Vector2i(command.x,command.y),command.flip)
	var front: RefCounted = Raster.new(size.x,size.y)
	for command: Dictionary in planner.plan(theme,geometry,origin,tick,"front",sprites,planner.seed_of(uid.trim_prefix("art:")),lights): sprites.blit(front,command.uid,command.anim,command.tick,Vector2i(command.x,command.y),command.flip)
	if with_hero:
		sprites.blit(front,"art:char.portitor","idle",tick,Vector2i(24,origin.y+floor_row*16))
		sprites.blit(front,"art:obj.crate_wood","default",0,Vector2i(40,origin.y+floor_row*16))
	var viewport: SubViewport = SubViewport.new()
	viewport.size = size
	viewport.transparent_bg = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	viewport.canvas_item_default_texture_filter = Viewport.DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_NEAREST
	get_tree().root.add_child(viewport)
	var back_sprite: Sprite2D = Sprite2D.new()
	back_sprite.centered = false
	back_sprite.material = _palette_material()
	back_sprite.texture = ImageTexture.create_from_image(back.image())
	viewport.add_child(back_sprite)
	var terrain: ColorRect = ColorRect.new()
	terrain.position = Vector2(origin)
	terrain.size = Vector2(cols*16,(floor_row+2)*16)
	var material: ShaderMaterial = Terrain.create(theme)
	material.set_shader_parameter("grid_size",geometry.grid_size)
	material.set_shader_parameter("visual_tick",tick>>3)
	var dimensions: Vector2i = geometry.grid_size*16
	Terrain.bind_visual_cells(material,_sample_tiles(geometry.grid_size,floor_row),{"format":"visual_cells/1","size":dimensions,"origin":Vector2i.ZERO,"visible_rect":Rect2i(Vector2i.ZERO,dimensions),"recipe":"tile"})
	terrain.material = material
	viewport.add_child(terrain)
	var front_sprite: Sprite2D = Sprite2D.new()
	front_sprite.centered = false
	front_sprite.material = _palette_material()
	front_sprite.texture = ImageTexture.create_from_image(front.image())
	viewport.add_child(front_sprite)
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var result: ImageTexture = ImageTexture.create_from_image(viewport.get_texture().get_image())
	viewport.queue_free()
	return result

func _sample_geometry(size: Vector2i, origin: Vector2i, floor_row: int, lobby: bool, with_hero: bool, area: Rect2i) -> Dictionary:
	var floor_slots: Array = []
	for x: int in size.x:
		if with_hero and x in [1,2]: continue
		floor_slots.append(Vector2i(x,floor_row-1))
	var mask: PackedByteArray = PackedByteArray()
	mask.resize(size.x*size.y)
	mask.fill(1)
	return {"grid_size":size,"cell_size":16,"room_bounds":Rect2i(origin,size*16),"ambient_area":area,
		"floor_slots":floor_slots,"ceiling_slots":[],"perch_edges":[Vector2i(size.x-1,floor_row-1)],
		"alive_mask":mask,"exclude_room":false,"ambient_mode":"one"}

func _sample_tiles(size: Vector2i, floor_row: int) -> Texture2D:
	var bytes: PackedByteArray = PackedByteArray()
	bytes.resize(size.x*size.y*4)
	for y: int in size.y:
		for x: int in size.x:
			bytes[(y*size.x+x)*4] = 1 if y>=floor_row else 0
			bytes[(y*size.x+x)*4+3] = 255
	var image: Image = Image.create_from_data(size.x,size.y,false,Image.FORMAT_RGBA8,bytes)
	image.resize(size.x*16,size.y*16,Image.INTERPOLATE_NEAREST)
	return ImageTexture.create_from_image(image)
