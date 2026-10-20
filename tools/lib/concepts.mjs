import fs from "node:fs";
import path from "node:path";
export function loadConcepts(root, add = () => {}, worlds = null) {
  const rel = p => path.join(root, p);
  const readJson = p => JSON.parse(fs.readFileSync(p, "utf8"));
  let concepts = null;
  const CONCEPTS = "content/concepts/maps.json";
  if (fs.existsSync(rel(CONCEPTS))) {
    try { concepts = readJson(rel(CONCEPTS)); } catch (e) { add("error", CONCEPTS, "不是合法 JSON：" + e.message); }
    if (concepts && !Array.isArray(concepts.maps)) { add("error", CONCEPTS, "缺少 maps 数组"); concepts = null; }
    const worldIds = worlds ? new Set(worlds.map((w) => w.id)) : null;
    const STAGES = ["概念", "设计", "美术", "房间", "完成", "暂停"], VERDICTS = ["待看", "满意", "不满意"];
    for (const [i, c] of (concepts ? concepts.maps : []).entries()) {
      const where = `${CONCEPTS}/${c && c.id ? c.id : "maps[" + i + "]"}`;
      if (!c || (worldIds && !worldIds.has(c.id))) { add("error", where, `地图 ${JSON.stringify(c && c.id)} 不在 content/catalog/worlds.json 里`); if (!c) continue; }
      if (!STAGES.includes(c.stage)) add("error", where, `stage ${JSON.stringify(c.stage)} 不是 ${STAGES.join(" / ")} 之一`);
      if (!VERDICTS.includes(c.verdict)) add("error", where, `verdict ${JSON.stringify(c.verdict)} 不是 ${VERDICTS.join(" / ")} 之一`);
      for (const [k, img] of (Array.isArray(c.images) ? c.images : []).entries()) {
        const f = img && img.file;
        if (typeof f !== "string" || !f || !fs.existsSync(rel(f)) || !fs.statSync(rel(f)).isFile()) add("error", where, `images[${k}].file 指向的文件不存在：${JSON.stringify(f)}`);
      }
    }
  }

  return concepts;
}
