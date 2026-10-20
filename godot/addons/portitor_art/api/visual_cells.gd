class_name PortitorArtVisualCells
extends RefCounted
## A continuous RGBA8 image: R=visual class, G=visual variant, B=0, A=255.
## G=0..3 selects the base color; G=4..7 adds the approved fire overlay, even at R=0.
## Recipe is purely visual: particle (default) or tile; both images use one texel per pixel.
const Contract = preload("provider_contract.gd")
const FORMAT: String = "visual_cells/1"
enum VisualClass { EMPTY, ROCK, CRACKED_ROCK, SOIL, SAND, WATER, RUBBLE, FUSE, ACID,
	LIMESTONE, LIMESTONE_ALT, HARD_ROCK, SMOKE, MIST, PLUG, DECAYING_PLUG, WOOD, ICE, BRIDGE }

static func validate(value: Dictionary) -> Dictionary:
	var errors: Array[String] = Contract.fields(value, {"format":TYPE_STRING, "size":TYPE_VECTOR2I,
		"origin":TYPE_VECTOR2I, "visible_rect":TYPE_RECT2I}, {"recipe":TYPE_STRING}, "visual_cells")
	if not errors.is_empty():
		return Contract.result(errors)
	if value.format != FORMAT:
		errors.append("visual_cells.format: unsupported schema")
	if value.get("recipe", "particle") not in ["tile", "particle"]:
		errors.append("visual_cells.recipe: expected tile or particle")
	var size: Vector2i = value.size
	var visible: Rect2i = value.visible_rect
	if size.x <= 0 or size.y <= 0:
		errors.append("visual_cells.size: dimensions must be positive")
	# Do not add Vector2i coordinates: its 32-bit end can wrap on hostile descriptors.
	if visible.position.x < 0 or visible.position.y < 0 or visible.size.x <= 0 or visible.size.y <= 0 or visible.position.x > size.x or visible.position.y > size.y or visible.size.x > size.x - visible.position.x or visible.size.y > size.y - visible.position.y:
		errors.append("visual_cells.visible_rect: expected nonempty local bounds within size")
	var normalized: Dictionary = value.duplicate(true)
	if not normalized.has("recipe"):
		normalized.recipe = "particle"
	return Contract.result(errors, normalized)

static func validate_image(image: Image, descriptor: Dictionary) -> Dictionary:
	var checked: Dictionary = validate(descriptor)
	if not checked.ok:
		return checked
	var errors: Array[String] = []
	if image == null or image.is_empty():
		errors.append("visual_cells.image: image is required")
		return Contract.result(errors)
	if image.get_size() != descriptor.size or image.get_format() != Image.FORMAT_RGBA8 or image.has_mipmaps() or image.is_compressed():
		errors.append("visual_cells.image: expected uncompressed, non-mipmapped RGBA8 at descriptor size")
		return Contract.result(errors)
	var bytes: PackedByteArray = image.get_data()
	for offset: int in range(0, bytes.size(), 4):
		if bytes[offset] > VisualClass.BRIDGE or bytes[offset + 1] > 7 or bytes[offset + 2] != 0 or bytes[offset + 3] != 255:
			errors.append("visual_cells.image: unknown class or invalid reserved channels at pixel %d" % (offset / 4))
			break
	return Contract.result(errors, checked.value)
