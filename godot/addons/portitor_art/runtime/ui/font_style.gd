class_name PortitorArtFontStyle
extends RefCounted
## Font construction algorithms: MIT candidate. Font binaries/derived glyphs retain OFL.
## Original spacing/size parameters: ui_factory.gd:7-32 and g2.gd:18-28; UI style provenance.
const Contract = preload("../../api/provider_contract.gd")
const FILES: Array[String] = ["fusion-pixel-12px/fusion-pixel-12px-proportional-zh_hans.otf.woff2", "fusion-pixel-10px/fusion-pixel-10px-proportional-sc.woff2"]
const HASHES: Array[String] = ["0ebd99e6f1e9b650a793a3f759c1c3dfa99f0c5b6502e78569b48ddb43767e40", "20f58ce5f54e468bc6aa86944aa2445b1e19264193496e9cd57f913cdb279e72"]
var resource_root: String = ""
var _faces: Array[FontVariation] = []
var _g2_faces: Array[FontVariation] = []

func configure(provider: RefCounted) -> Dictionary:
	var checked: Dictionary = Contract.validate_provider(provider)
	if not checked.ok:
		return checked
	var root: Variant = provider.get("resource_root")
	if not root is String:
		return Contract.result(["font provider requires an explicit resource_root"])
	checked = Contract.validate_resource_root(root)
	if not checked.ok:
		return checked
	var faces: Array[FontVariation] = []
	var g2_faces: Array[FontVariation] = []
	for index: int in FILES.size():
		var path: String = root.path_join("resources/fonts").path_join(FILES[index])
		if not FileAccess.file_exists(path) or FileAccess.get_sha256(path) != HASHES[index]:
			return Contract.result(["missing or changed frozen font: " + path])
		var file := FontFile.new()
		file.data = FileAccess.get_file_as_bytes(path)
		file.antialiasing = TextServer.FONT_ANTIALIASING_NONE
		file.hinting = TextServer.HINTING_NONE
		file.subpixel_positioning = TextServer.SUBPIXEL_POSITIONING_DISABLED
		file.multichannel_signed_distance_field = false
		file.msdf_pixel_range = 8
		file.msdf_size = 48
		file.disable_embedded_bitmaps = true
		file.generate_mipmaps = false
		file.allow_system_fallback = true
		file.force_autohinter = false
		file.keep_rounding_remainders = true
		file.oversampling = 0.0
		var face := FontVariation.new()
		face.base_font = file
		face.spacing_top = -2
		if index == 1:
			face.spacing_bottom = -2
		faces.append(face)
		var g2 := FontVariation.new()
		g2.base_font = file
		g2.spacing_top = face.spacing_top
		g2.spacing_bottom = face.spacing_bottom
		g2.opentype_features = {"kern":0}
		g2_faces.append(g2)
	resource_root = root
	_faces = faces
	_g2_faces = g2_faces
	return Contract.result([], {"resource_root":root})

func font(small: bool = false) -> FontVariation:
	return _faces[int(small)] if _faces.size() == 2 else null

func g2_font(small: bool = false) -> FontVariation:
	return _g2_faces[int(small)] if _g2_faces.size() == 2 else null
