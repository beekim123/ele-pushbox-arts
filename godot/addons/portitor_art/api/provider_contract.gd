class_name PortitorArtProviderContract
extends RefCounted
## Query metadata/capability return raw dictionaries; validation returns a result envelope.
const NATIVE_STATES: Array[String] = ["implemented", "reference_only", "missing"]
const KINDS: Array[String] = ["sprite", "material", "theme", "feedback", "ui", "embedded_ui", "reference", "missing"]
const EVIDENCE_CODES: Array[String] = ["S", "M", "T", "F", "U", "E", "R-T", "R-U"]
const EVIDENCE_KINDS: Dictionary = {"S":"sprite", "M":"material", "T":"theme", "F":"feedback",
	"U":"ui", "E":"embedded_ui", "R-T":"reference", "R-U":"reference"}

static func validate(value: Dictionary) -> Dictionary:
	var errors: Array[String] = fields(value, {"native":TYPE_STRING, "implementation_kind":TYPE_STRING,
		"evidence":TYPE_ARRAY, "evidence_stage":TYPE_STRING, "verified":TYPE_BOOL}, {}, "capability")
	if not errors.is_empty():
		return result(errors)
	if value.native not in NATIVE_STATES:
		errors.append("capability.native: unknown status")
	if value.implementation_kind not in KINDS:
		errors.append("capability.implementation_kind: unknown kind")
	if value.evidence_stage not in ["source_inventory", "candidate_verification"]:
		errors.append("capability.evidence_stage: unknown evidence stage")
	if value.evidence_stage == "source_inventory" and value.verified:
		errors.append("source inventory is not verification")
	var seen: Array[String] = []
	for code: Variant in value.evidence:
		if not code is String or code not in EVIDENCE_CODES or code in seen:
			errors.append("capability.evidence: invalid or repeated source category")
		else:
			seen.append(code)
			if EVIDENCE_KINDS[code] != value.implementation_kind:
				errors.append("capability.evidence: source category does not support implementation kind")
	if value.native == "implemented" and (value.implementation_kind in ["reference", "missing"] or seen.is_empty()):
		errors.append("implemented capability requires an implementation and evidence")
	if value.native == "reference_only" and (value.implementation_kind != "reference" or seen.is_empty() or value.verified):
		errors.append("reference media cannot claim a complete native implementation")
	if value.native == "missing" and (value.implementation_kind != "missing" or not seen.is_empty() or value.verified):
		errors.append("missing capability cannot claim implementation evidence")
	return result(errors, value)

static func validate_provider(provider: RefCounted) -> Dictionary:
	var errors: Array[String] = []
	if provider == null:
		errors.append("provider: explicit provider is required")
		return result(errors)
	var signatures: Dictionary = {"metadata":TYPE_DICTIONARY, "capability":TYPE_DICTIONARY, "texture":TYPE_OBJECT}
	for method: String in signatures:
		var found: bool = false
		for info: Dictionary in provider.get_method_list():
			if info.name != method:
				continue
			found = true
			if info.args.size() != 1 or info.args[0].type != TYPE_STRING or info.return.type != signatures[method]:
				errors.append("provider." + method + ": expected one String argument and declared return type")
			elif method == "texture" and info.return.class_name != &"Texture2D":
				errors.append("provider.texture: expected Texture2D return type")
		if not found:
			errors.append("provider: missing method " + method)
	return result(errors, provider)

static func require_capability(provider: RefCounted, uid: String, kind: String = "") -> Dictionary:
	var checked: Dictionary = validate_provider(provider)
	if not checked.ok:
		return checked
	var errors: Array[String] = []
	if not is_art_uid(uid):
		errors.append("required uid must be in the art namespace")
	if not kind.is_empty() and (kind not in KINDS or kind in ["reference", "missing"]):
		errors.append("required kind is not a runnable native capability")
	if not errors.is_empty():
		return result(errors)
	var capability: Dictionary = provider.capability(uid)
	var validated: Dictionary = validate(capability)
	if not validated.ok:
		return validated
	if capability.native != "implemented":
		errors.append(uid + ": required native capability is " + capability.native)
	if not kind.is_empty() and capability.implementation_kind != kind:
		errors.append(uid + ": native implementation kind mismatch")
	var metadata: Dictionary = provider.metadata(uid)
	if not _metadata_is_plain_data(metadata):
		errors.append(uid + ": metadata must contain bounded plain data")
		return result(errors)
	if not metadata.get("uid") is String or metadata.uid != uid:
		errors.append(uid + ": metadata uid must match the requested resource")
		return result(errors)
	if not metadata.get("approved") is bool or not metadata.get("placeholder") is bool:
		errors.append(uid + ": metadata approval and placeholder flags must be bool")
		return result(errors)
	if not metadata.approved or metadata.placeholder:
		errors.append(uid + ": required approved resource metadata is missing")
	if not errors.is_empty():
		return result(errors)
	return result(errors, {"metadata":metadata, "capability":capability})

static func _metadata_is_plain_data(value: Variant, depth: int = 0) -> bool:
	# Metadata remains an open query dictionary; only its data boundary is shared.
	# A depth bound also rejects cycles without traversing or copying them indefinitely.
	if depth > 32:
		return false
	if value == null or value is String or value is int or value is bool:
		return true
	if value is float:
		return is_finite(value)
	if value is Array:
		for item: Variant in value:
			if not _metadata_is_plain_data(item, depth + 1):
				return false
		return true
	if value is Dictionary:
		for key: Variant in value:
			if not (key is String or key is StringName) or not _metadata_is_plain_data(value[key], depth + 1):
				return false
		return true
	return false

static func validate_resource_root(root: String) -> Dictionary:
	var errors: Array[String] = []
	if not root.begins_with("res://") or root == "res://" or root.ends_with("/") or "\\" in root:
		errors.append("resource_root: expected a package directory under res://")
	else:
		for part: String in root.trim_prefix("res://").split("/"):
			if part.is_empty() or part in [".", ".."] or ":" in part:
				errors.append("resource_root: invalid path segment")
	return result(errors, root)

static func fields(value: Dictionary, required: Dictionary, optional: Dictionary, path: String) -> Array[String]:
	var errors: Array[String] = []
	for key: Variant in value:
		# Dictionary dot syntax creates StringName keys; declared field names share that spelling.
		if not (key is String or key is StringName) or (not required.has(key) and not optional.has(key)):
			errors.append(path + ": undeclared field " + str(key))
	for key: String in required:
		if not value.has(key):
			errors.append(path + ": missing " + key)
		elif typeof(value[key]) != required[key]:
			errors.append(path + "." + key + ": invalid type")
	for key: String in optional:
		if value.has(key) and typeof(value[key]) != optional[key]:
			errors.append(path + "." + key + ": invalid type")
	return errors

static func is_art_uid(value: Variant) -> bool:
	if not value is String or not value.begins_with("art:") or value.length() <= 4:
		return false
	for index: int in range(4, value.length()):
		var code: int = value.unicode_at(index)
		if not (code >= 97 and code <= 122) and not (code >= 48 and code <= 57) and code not in [46, 95]:
			return false
	return true

static func result(errors: Array[String], value: Variant = null) -> Dictionary:
	if not errors.is_empty():
		return {"ok":false, "errors":errors, "value":null}
	var output: Variant = value
	if value is Dictionary or value is Array:
		output = value.duplicate(true)
	return {"ok":true, "errors":errors, "value":output}
