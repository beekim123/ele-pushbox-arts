// Text tables. content/i18n/<locale>.json are frozen: they feed the content
// hash of the approved screens (AGENTS.md 2a). Newer text lives in its own
// table, content/i18n-<name>/<locale>.json (i18n-delivery: the delivery slice;
// i18n-extra: the developer's text). Every table has every locale, and a key
// lives in exactly one table. Returns the merged tables and each key's file.
import fs from "node:fs";
import path from "node:path";

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const jsonFiles = (dir) => fs.readdirSync(dir).filter((n) => n.endsWith(".json")).sort();

export function textTableDirs(root) {
  const content = path.join(root, "content");
  return fs.readdirSync(content).filter((n) => /^i18n-[a-z0-9_-]+$/.test(n) && fs.statSync(path.join(content, n)).isDirectory()).sort();
}

// Problems in the extra tables (a repeated key, a missing translation, an
// unknown locale) are returned, not thrown, so one bad table never stops the
// art build; tools/content.mjs reports them as errors.
export function loadTextTables(root) {
  const tables = {}, source = {}, problems = [];
  for (const f of jsonFiles(path.join(root, "content/i18n"))) tables[f.slice(0, -5)] = readJson(path.join(root, "content/i18n", f));
  const keys = Object.keys(tables["zh-Hans"] || {}).filter((k) => k !== "_meta");
  for (const [loc, tab] of Object.entries(tables)) for (const k of keys) if (!(k in tab)) throw new Error(`i18n: ${loc} is missing ${k}`);
  for (const k of keys) source[k] = "content/i18n/zh-Hans.json";
  for (const dir of textTableDirs(root)) {
    const extra = {}, where = `content/${dir}`;
    for (const f of jsonFiles(path.join(root, "content", dir))) {
      try { extra[f.slice(0, -5)] = readJson(path.join(root, "content", dir, f)); } catch (e) { problems.push({ where: `${where}/${f}`, msg: "不是有效的 JSON：" + e.message }); }
    }
    if (!extra["zh-Hans"]) { problems.push({ where, msg: "没有 zh-Hans.json" }); continue; }
    for (const loc of Object.keys(extra)) {
      if (!tables[loc]) { problems.push({ where: `${where}/${loc}.json`, msg: "content/i18n 里没有这种语言" }); continue; }
      for (const k of Object.keys(extra[loc])) if (k !== "_meta" && !(k in extra["zh-Hans"])) problems.push({ where: `${where}/${loc}.json`, msg: `${k} 在 zh-Hans.json 里没有` });
    }
    for (const k of Object.keys(extra["zh-Hans"])) {
      if (k === "_meta") continue;
      if (source[k]) { problems.push({ where, msg: `${k} 已经在 ${source[k]} 里（一个键只能在一张表里）` }); continue; }
      for (const loc of Object.keys(tables)) {
        const tab = extra[loc];
        if (tab && k in tab) tables[loc][k] = tab[k];
        else problems.push({ where: `${where}/${loc}.json`, msg: `缺少 ${k} 的翻译` });
      }
      tables["zh-Hans"][k] = extra["zh-Hans"][k];
      source[k] = `${where}/zh-Hans.json`;
    }
  }
  return { tables, source, problems };
}

// Characters each key needs that its font lacks. 12px (PB.FONT) for menus and
// titles, 10px (PB.FONT_SMALL) for everything (bubbles); dialogue lines and
// level hints ("dlg.*", "*.hint.*") are drawn in 10px only. A missing glyph
// would silently draw as "?".
export function missingGlyphs(PB, tables) {
  const out = [];
  for (const [loc, tab] of Object.entries(tables)) for (const [k, v] of Object.entries(tab)) {
    if (k === "_meta" || typeof v !== "string") continue;
    const small = k.startsWith("dlg.") || k.includes(".hint.");
    const lack = new Set();
    for (const ch of v) {
      if (/\s/.test(ch)) continue;
      if (!PB.FONT_SMALL.glyphs[ch] || (!small && !PB.FONT.glyphs[ch])) lack.add(ch);
    }
    if (lack.size) out.push({ locale: loc, key: k, chars: [...lack].join("") });
  }
  return out;
}
