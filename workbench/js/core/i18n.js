/* UI text: locale tables (content/i18n/*.json), placeholders, script-aware
 * wrapping, ellipsis and overflow reporting. Layout code never concatenates
 * sentences and never assumes a text width; it measures. */
(function (root) {
  "use strict";
  const PB = (root.PB = root.PB || {});
  let tables = {}, locale = "zh-Hans";
  const issues = [];

  // Pseudo-locale for layout stress tests: accented English, about 40 % longer.
  const ACCENT = { a: "à", c: "ç", e: "é", i: "î", n: "ñ", o: "ö", u: "ü", y: "ý", A: "Å", C: "Ç", E: "É", I: "Î", O: "Ö", U: "Ü" };
  function pseudo(s) {
    const body = s.replace(/\{[^}]+\}|./g, (m) => (m.length > 1 ? m : ACCENT[m] || m));
    const pad = Math.max(2, Math.round(s.length * 0.4));
    return "[" + body + " " + "~".repeat(pad) + "]";
  }

  function setTables(t) { tables = t || {}; }
  function setLocale(l) { locale = l; }
  function getLocale() { return locale; }
  function locales() { return Object.keys(tables).concat(["qps"]); }
  function has(key) { return !!(tables["zh-Hans"] && key in tables["zh-Hans"]); }
  function t(key, vars) {
    const base = locale === "qps" ? tables.en : tables[locale];
    let s = base && key in base ? base[key] : tables["zh-Hans"] && key in tables["zh-Hans"] ? tables["zh-Hans"][key] : key;
    if (locale === "qps") s = pseudo(s);
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
    return s;
  }

  // Tokens: one CJK character, a run of non-space non-CJK characters (a word), or spaces.
  const TOKEN = /[　-鿿가-힯＀-￯]|[^\s　-鿿가-힯＀-￯]+|\s+/g;
  const NO_START = "，。：；、！？）」』”…,.:;!?)";
  // `measure` defaults to the 12px UI font; dialogue bubbles pass the 10px one.
  function wrap(str, width, measureFn) {
    const measure = measureFn || PB.text.measure, lines = [];
    let line = "";
    for (const tok of str.match(TOKEN) || []) {
      if (/^\s+$/.test(tok)) { if (line) line += " "; continue; }
      if (!line || measure(line + tok) <= width) { line += tok; continue; }
      if (NO_START.includes(tok[0]) && line.length > 1) {   // keep punctuation off the line start: carry the previous character over
        const last = line.slice(-1); lines.push(line.slice(0, -1)); line = last + tok; continue;
      }
      lines.push(line.replace(/\s+$/, ""));
      line = tok;
      while (measure(line) > width && line.length > 1) {   // a single word wider than the box
        let cut = line.length - 1; while (cut > 1 && measure(line.slice(0, cut)) > width) cut--;
        lines.push(line.slice(0, cut)); line = line.slice(cut);
      }
    }
    if (line) lines.push(line.replace(/\s+$/, ""));
    return lines;
  }
  function ellipsize(str, width) {
    const measure = PB.text.measure;
    if (measure(str) <= width) return { text: str, cut: false };
    let s = str; while (s.length > 0 && measure(s + "…") > width) s = s.slice(0, -1);
    return { text: s.replace(/\s+$/, "") + "…", cut: true };
  }
  function report(kind, key, rect) { if (issues.length < 500) issues.push({ kind, key, rect, locale }); }
  function takeIssues() { return issues.splice(0, issues.length); }

  PB.i18n = { setTables, setLocale, getLocale, locales, t, has, wrap, ellipsize, report, takeIssues, pseudo };
})(typeof window !== "undefined" ? window : globalThis);
