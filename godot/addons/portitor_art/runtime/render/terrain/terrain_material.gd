class_name PortitorArtTerrainMaterial
extends RefCounted
const SHADER: Shader = preload("terrain.gdshader")
const Cells = preload("../../../api/visual_cells.gd")
const CODES: String = ".abcdefghijklmnopqrstuvwxyzABCDEF"

static func create(theme: Dictionary) -> ShaderMaterial:
	var material: ShaderMaterial = ShaderMaterial.new()
	material.shader = SHADER
	var values: PackedInt32Array = PackedInt32Array()
	for group: Array in [["rock", "base.0", "base.1", "seam", "speck", "light", "light2", "dark", "edge", "top", "under"], ["earth", "base.0", "base.1", "clump", "pebble", "pebbleShade", "crust", "crust2", "dark", "frame", "bevel"], ["cracked", "base.0", "base.1", "crack", "crackLight", "light", "dark", "frame", "bevel"], ["sand", "base.0", "base.1", "base.2", "grain", "top"], ["water", "body", "upper", "surface", "glint"]]:
		var params: Dictionary = theme.get(group[0], {})
		for key: String in group.slice(1):
			var code: String = "."
			if key.begins_with("base."):
				var base: Array = params.get("base", [])
				var index: int = key.get_slice(".", 1).to_int()
				if index < base.size():
					code = base[index]
			else:
				code = params.get(key, ".")
			values.append(maxi(0, CODES.find(code)))
	material.set_shader_parameter("colors", values)
	material.set_shader_parameter("rock_pattern", ["brick", "block", "rough", "grass", "marble", "cloud", "panel", "wild"].find(theme.rock.pattern))
	if theme.rock.pattern == "wild":
		var wild: PackedInt32Array = PackedInt32Array()
		for code: String in theme.rock.get("grass", [theme.rock.top, theme.rock.light, theme.rock.dark]) + theme.rock.get("stone", [theme.rock.light, theme.rock.top, theme.rock.light2]) + [theme.rock.get("root", "."), theme.rock.get("soil", ".")]:
			wild.append(maxi(0, CODES.find(code)))
		material.set_shader_parameter("wild_colors", wild)
	material.set_shader_parameter("hazard_trim", theme.rock.get("trim") == "hazard")
	return material

static func bind_visual_cells(material: ShaderMaterial, texture: Texture2D, descriptor: Dictionary) -> Dictionary:
	var checked: Dictionary = Cells.validate(descriptor)
	if not checked.ok:
		return checked
	if material == null or texture == null or texture.get_size() != Vector2(descriptor.size):
		return {"ok":false,"errors":["visual texture size/material mismatch"],"value":null}
	material.set_shader_parameter("visual_cells",texture)
	material.set_shader_parameter("cells_size",descriptor.size)
	material.set_shader_parameter("cells_origin",descriptor.origin)
	var visible: Rect2i = descriptor.visible_rect
	material.set_shader_parameter("cells_visible",Vector4i(visible.position.x,visible.position.y,visible.size.x,visible.size.y))
	material.set_shader_parameter("particle_recipe",checked.value.recipe == "particle")
	return {"ok":true,"errors":[],"value":checked.value}
