class_name PortitorArtWorldSnapshot
extends RefCounted
## Integer, resolved visual data. No caller-owned objects are accepted.
const Contract = preload("provider_contract.gd")
const FORMAT: String = "portitor.art.world/1"
const ANCHORS: Array[String] = ["hud.undo", "hud.restart", "hud.hint", "hud.goal", "hud.sandbag", "tutorial.keys", "dialogue.text"]
const ENTITY_FIELDS: Dictionary = {"instance_id":TYPE_STRING, "asset_uid":TYPE_STRING,
	"position":TYPE_VECTOR2I, "animation":TYPE_STRING, "layer":TYPE_INT, "flip_h":TYPE_BOOL}
const ENTITY_OPTIONAL: Dictionary = {"frame":TYPE_INT, "pressed":TYPE_BOOL, "active":TYPE_BOOL,
	"floating":TYPE_BOOL, "tilt":TYPE_INT, "ladder_top":TYPE_BOOL, "visible_rows":TYPE_INT, "animation_tick":TYPE_INT, "order":TYPE_INT, "stage":TYPE_STRING}

static func validate(value: Dictionary) -> Dictionary:
	var errors: Array[String] = Contract.fields(value, {"format":TYPE_STRING, "tick":TYPE_INT,
		"theme_uid":TYPE_STRING, "viewport":TYPE_VECTOR2I, "origin":TYPE_VECTOR2I,
		"visual_seed":TYPE_INT, "entities":TYPE_ARRAY, "effects":TYPE_ARRAY, "anchors":TYPE_DICTIONARY}, {"geometry":TYPE_DICTIONARY, "environment":TYPE_DICTIONARY, "layout_id":TYPE_STRING, "layout_revision":TYPE_INT}, "world")
	if not errors.is_empty():
		return Contract.result(errors)
	if value.format != FORMAT:
		errors.append("world.format: unsupported schema")
	if value.tick < 0:
		errors.append("world.tick: must be nonnegative")
	if not Contract.is_art_uid(value.theme_uid) or not value.theme_uid.begins_with("art:theme."):
		errors.append("world.theme_uid: expected theme art uid")
	if value.viewport.x <= 0 or value.viewport.y <= 0:
		errors.append("world.viewport: dimensions must be positive")
	if value.has("geometry"):
		errors.append_array(_geometry_errors(value.geometry))
	if value.has("environment"):
		errors.append_array(_environment_errors(value.environment))
	if value.get("layout_revision", 0) < 0 or (value.has("layout_id") and value.layout_id.is_empty()):
		errors.append("world.layout: invalid identity/revision")
	var ids: Dictionary = {}
	for index: int in value.entities.size():
		var entity: Variant = value.entities[index]
		if not entity is Dictionary:
			errors.append("world.entities: expected entity dictionary")
			continue
		errors.append_array(_entity_errors(entity, "world.entities[%d]" % index))
		if entity.get("instance_id") is String:
			if ids.has(entity.instance_id):
				errors.append("world.entities: duplicate instance_id")
			ids[entity.instance_id] = true
	for effect: Variant in value.effects:
		if not effect is Dictionary:
			errors.append("world.effects: expected effect dictionary")
		else:
			errors.append_array(_effect_errors(effect))
	for id: Variant in value.anchors:
		if not id is String or id not in ANCHORS or not value.anchors[id] is Rect2:
			errors.append("world.anchors: expected semantic id and Rect2")
		elif not _rect_valid(value.anchors[id]):
			errors.append("world.anchors: expected finite nonnegative rectangle")
	return Contract.result(errors, value)

static func _entity_errors(value: Dictionary, path: String) -> Array[String]:
	var errors: Array[String] = Contract.fields(value, ENTITY_FIELDS, ENTITY_OPTIONAL, path)
	if not errors.is_empty():
		return errors
	if value.instance_id.is_empty() or value.animation.is_empty():
		errors.append(path + ": identity and animation cannot be empty")
	if not Contract.is_art_uid(value.asset_uid):
		errors.append(path + ": expected art asset uid")
	if value.layer < -4096 or value.layer > 4096:
		errors.append(path + ": layer outside CanvasItem range")
	for key: String in ["frame", "visible_rows", "animation_tick", "order"]:
		if value.get(key, 0) < 0:
			errors.append(path + "." + key + ": must be nonnegative")
	if value.get("tilt", 0) not in [-1, 0, 1]:
		errors.append(path + ".tilt: expected -1, 0 or 1")
	if value.get("stage", "entities") not in ["entities", "target", "observe", "overlay"]:
		errors.append(path + ": invalid drawing stage")
	return errors

static func _effect_errors(value: Dictionary) -> Array[String]:
	var errors: Array[String] = []
	var kind: Variant = value.get("kind")
	if not kind is String:
		return ["world.effects.kind: expected visual effect enum"]
	if kind == "sprite":
		var sprite: Dictionary = value.duplicate()
		sprite.erase("kind")
		return _entity_errors(sprite, "world.effects.sprite")
	var required: Dictionary = {"kind":TYPE_STRING, "id":TYPE_STRING}
	var optional: Dictionary = {"order":TYPE_INT, "stage":TYPE_STRING}
	match kind:
		"highlight":
			required.merge({"bounds":TYPE_RECT2I, "progress":TYPE_FLOAT})
			optional.merge({"style":TYPE_STRING, "alpha":TYPE_FLOAT})
		"link", "tutorial_flight":
			required.merge({"from":TYPE_VECTOR2I, "to":TYPE_VECTOR2I, "progress":TYPE_FLOAT})
			if kind=="tutorial_flight":
				# HUD centers can be half pixels; preserve interpolation before the final floor.
				required["from"]=TYPE_VECTOR2I if value.get("from") is Vector2i else TYPE_VECTOR2
				required["to"]=TYPE_VECTOR2I if value.get("to") is Vector2i else TYPE_VECTOR2
			optional.merge({"style":TYPE_STRING, "phase":TYPE_STRING})
		"bridge_load":
			required.merge({"position":TYPE_VECTOR2I, "bars":TYPE_PACKED_BYTE_ARRAY})
		"placeholder":
			required.merge({"position":TYPE_VECTOR2I, "solid":TYPE_BOOL, "size":TYPE_INT})
		"observe_path":
			required.merge({"points":TYPE_ARRAY, "style":TYPE_STRING})
		"observe_link":
			required.merge({"from":TYPE_VECTOR2I, "to":TYPE_VECTOR2I, "style":TYPE_STRING, "rounding":TYPE_STRING})
		"observe_region":
			required.merge({"shape":TYPE_STRING, "style":TYPE_STRING})
			if not value.get("shape") is String: return ["world.effects.shape: expected shape enum"]
			if value.get("shape") == "rect": required["bounds"] = TYPE_RECT2I
			elif value.get("shape") == "circle": required.merge({"center":TYPE_VECTOR2I, "radius":TYPE_INT})
			else: return ["world.effects.shape: unknown shape"]
		"target_blast":
			required.merge({"center":TYPE_VECTOR2I, "radius":TYPE_INT})
		"room_focus":
			required["bounds"] = TYPE_RECT2I
		_:
			return ["world.effects.kind: unknown visual effect"]
	errors.append_array(Contract.fields(value, required, optional, "world.effects"))
	if not errors.is_empty(): return errors
	if value.id.is_empty() or value.get("order", 0) < 0 or value.get("stage", "entities") not in ["entities", "target", "observe", "overlay"]:
		errors.append("world.effects: invalid identity/order/stage")
	for key: String in ["progress", "alpha"]:
		if value.has(key) and (not is_finite(value[key]) or value[key] < 0.0 or value[key] > 1.0): errors.append("world.effects: invalid " + key)
	if value.has("bounds") and (value.bounds.size.x < 0 or value.bounds.size.y < 0): errors.append("world.effects: negative rectangle")
	if value.has("radius") and (value.radius < 1 or value.radius > 640): errors.append("world.effects: invalid radius")
	match kind:
		"highlight":
			if value.get("style", "goal") not in ["goal", "flash"]: errors.append("unknown highlight style")
		"tutorial_flight":
			if not Vector2(value.from).is_finite() or not Vector2(value.to).is_finite(): errors.append("nonfinite flight endpoints")
			if value.get("style", "goal") not in ["goal", "sand"] or value.get("phase", "travel") not in ["travel", "arrival"]: errors.append("unknown flight style/phase")
		"link":
			if value.get("style", "tutorial") != "tutorial" or value.get("phase", "travel") != "travel": errors.append("unknown link style/phase")
		"bridge_load":
			if value.bars.size() > 256: errors.append("too many bridge bars")
			for bar: int in value.bars:
				if bar > 2: errors.append("unknown bridge bar style")
		"placeholder":
			if value.size < 7 or value.size > 16: errors.append("invalid placeholder size")
		"observe_path":
			if value.points.size() > 2048: errors.append("too many observation points")
			for point: Variant in value.points:
				if not point is Vector2i: errors.append("observation points must be Vector2i")
			if value.style not in ["candidate", "actual"]: errors.append("unknown path style")
		"observe_link":
			if value.style not in ["candidate", "actual"] or value.rounding not in ["round", "floor_half"]: errors.append("unknown link style")
		"observe_region":
			if value.style not in ["cyan", "heat", "gust", "release", "load", "blast", "cracked"]: errors.append("unknown region style")
	return errors

static func _geometry_errors(value: Dictionary) -> Array[String]:
	var errors: Array[String] = Contract.fields(value, {"grid_size":TYPE_VECTOR2I, "cell_size":TYPE_INT,
		"room_bounds":TYPE_RECT2I, "ambient_area":TYPE_RECT2I, "floor_slots":TYPE_ARRAY, "ceiling_slots":TYPE_ARRAY,
		"perch_edges":TYPE_ARRAY, "alive_mask":TYPE_PACKED_BYTE_ARRAY, "exclude_room":TYPE_BOOL, "ambient_mode":TYPE_STRING}, {}, "world.geometry")
	if not errors.is_empty(): return errors
	var size: Vector2i = value.grid_size
	if size.x <= 0 or size.y <= 0 or size.x > 1024 or size.y > 1024 or value.cell_size != 16:
		return ["world.geometry: invalid display dimensions"]
	if value.alive_mask.size() != size.x * size.y: errors.append("world.geometry: alive mask size mismatch")
	for bit: int in value.alive_mask:
		if bit > 1: errors.append("world.geometry: alive mask must contain bits")
	for key: String in ["floor_slots", "ceiling_slots", "perch_edges"]:
		for cell: Variant in value[key]:
			if not cell is Vector2i or cell.x < 0 or cell.y < 0 or cell.x >= size.x or cell.y >= size.y: errors.append("world.geometry: invalid slot")
	if value.room_bounds.size != size * 16 or value.ambient_area.size.x < 0 or value.ambient_area.size.y < 0: errors.append("world.geometry: invalid display bounds")
	if value.ambient_mode not in ["one", "sparse", "full"]: errors.append("world.geometry: invalid ambient mode")
	return errors

static func _environment_errors(value: Dictionary) -> Array[String]:
	var errors: Array[String] = Contract.fields(value, {"mode":TYPE_STRING, "weather":TYPE_STRING, "area":TYPE_RECT2I,
		"lights":TYPE_ARRAY, "observe":TYPE_BOOL, "show_grid":TYPE_BOOL, "dim_steps":TYPE_INT}, {}, "world.environment")
	if not errors.is_empty(): return errors
	if value.mode not in ["full", "lights", "off"] or value.weather not in ["none", "meteors", "sandstorm", "fireflies", "rain", "snow", "embers", "drips", "wind"]:
		errors.append("world.environment: unknown display mode/weather")
	if value.dim_steps < 0 or value.dim_steps > 32 or value.area.size.x < 0 or value.area.size.y < 0: errors.append("world.environment: invalid display bounds/dim")
	for light: Variant in value.lights:
		if not light is Dictionary:
			errors.append("world.environment: invalid light")
			continue
		errors.append_array(Contract.fields(light, {"asset_uid":TYPE_STRING, "position":TYPE_VECTOR2I}, {}, "world.environment.light"))
		if light.get("asset_uid") is String and not Contract.is_art_uid(light.asset_uid): errors.append("world.environment: invalid light uid")
	return errors

static func _rect_valid(rect: Rect2) -> bool:
	return rect.position.is_finite() and rect.size.is_finite() and rect.size.x >= 0.0 and rect.size.y >= 0.0
