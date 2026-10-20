#!/usr/bin/env node
// Offline deterministic audio pipeline. Only approve records an explicit user's statement.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateSource, renderAudio, sourceHash, rendererFingerprint, audioPresets, renderPresetPreview, joinAudioPreviews } from './lib/audio.mjs';
const { buildContent } = fs.existsSync(new URL('./content.mjs', import.meta.url)) ? await import('./content.mjs') : { buildContent: null };
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const json = v => JSON.stringify(v, null, 1) + '\n';
const canonical = v => Array.isArray(v) ? '[' + v.map(canonical).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}' : JSON.stringify(v);
const same = (a, b) => canonical(a) === canonical(b);
const hashOk = s => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
function fail(uid, field, msg) {
  throw new Error(`${uid || 'audio'} ${field}: ${msg}`);
}
function inside(root, rel) {
  if (typeof rel !== 'string' || rel.includes('\\') || path.isAbsolute(rel) || rel.split('/').some(p => p === '..' || p === '.'))
    fail('audio', 'path', 'invalid relative path ' + rel);
  return path.join(root, rel);
}
function walk(dir) {
  return fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]) : [];
}
function catalog(root) {
  const c = read(path.join(root, 'content/catalog/audio.json'));
  if (c.format !== 'pushbox.catalog/1' || c.kind !== 'audio' || !Array.isArray(c.entries) || !Array.isArray(c.music_sets))
    fail('audio', 'catalog', 'invalid catalog');
  const seen = new Set();
  for (const e of c.entries) {
    if (!['sfx', 'music'].includes(e.kind) || !/^[-a-z0-9_]+$/.test(e.id) || e.uid !== `${e.kind}:${e.id}` || e.source !== `audio/source/${e.kind}/${e.id}.json` || seen.has(e.uid))
      fail(e.uid, 'catalog', 'invalid or duplicate uid/source');
    seen.add(e.uid);
  }
  for (const f of walk(path.join(root, 'audio/source'))) {
    const r = path.relative(root, f).split(path.sep).join('/');
    if (!c.entries.some(e => e.source === r))
      fail('audio', 'source', `not in catalog: ${r}`);
  }
  return c;
}
function recordedDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(date) || !Number.isFinite(Date.parse(date)))
    return false;
  const day = date.slice(0, 10), midnight = Date.parse(`${day}T00:00:00.000Z`);
  return Number.isFinite(midnight) && new Date(midnight).toISOString().slice(0, 10) === day;
}
function approvals(root) {
  const f = path.join(root, 'audio/approvals.json');
  const a = fs.existsSync(f) ? read(f) : { format: 'pushbox.audio-approvals/1', records: [] };
  if (a.format !== 'pushbox.audio-approvals/1' || !Array.isArray(a.records))
    fail('audio', 'approvals', 'invalid table');
  const seen = new Set();
  for (const r of a.records) {
    if (!/^AAP-\d{4,}$/.test(r.id) || seen.has(r.id) || !Array.isArray(r.items) || !Array.isArray(r.selections || []))
      fail('audio', 'approvals.records', 'invalid/duplicate record');
    if (!recordedDate(r.date))
      fail('audio', `approvals.records.${r.id}.date`, 'valid ISO timestamp required');
    for (const key of ['by', 'via', 'note'])
      if (typeof r[key] !== 'string' || !r[key].trim())
        fail('audio', `approvals.records.${r.id}.${key}`, 'explicit user statement and provenance required');
    seen.add(r.id);
  }
  return a;
}
// Prepare every byte before changing any destination. Roll back replacements on IO failure.
function transaction(root, files) {
  const staged = [], committed = [];
  try {
    for (const [rel, data] of files) {
      const dest = inside(root, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const temp = dest + `.tmp-${process.pid}-${staged.length}`;
      fs.writeFileSync(temp, data, { flag: 'wx' });
      staged.push({ dest, temp, old: fs.existsSync(dest) ? fs.readFileSync(dest) : null });
    }
    for (const s of staged) {
      fs.renameSync(s.temp, s.dest);
      committed.push(s);
    }
  }
  catch (e) {
    for (const s of committed.reverse()) {
      if (s.old === null)
        fs.rmSync(s.dest, { force: true });
      else
        fs.writeFileSync(s.dest, s.old);
    }
    throw e;
  }
  finally {
    for (const s of staged)
      fs.rmSync(s.temp, { force: true });
  }
}
function historical(root, item, c) {
  const e = c.entries.find(e => e.uid === item.uid);
  if (!e || !Number.isInteger(item.version) || item.version < 1 || !hashOk(item.hash) || !hashOk(item.wav_sha256))
    fail(item.uid, 'approvals.items', 'invalid identity');
  const history = `audio/history/${e.kind}/${e.id}@v${item.version}.json`, wav = `audio/export/approved/${e.kind}/${e.id}@v${item.version}.wav`;
  if (item.history !== history || item.wav !== wav)
    fail(item.uid, 'approvals.paths', 'noncanonical history/media path');
  if (!fs.existsSync(inside(root, history)) || !fs.existsSync(inside(root, wav)))
    fail(item.uid, 'history', 'missing confirmed source or media');
  const snap = read(inside(root, history)), bytes = fs.readFileSync(inside(root, wav));
  if (snap.format !== 'pushbox.audio-history/1' || snap.uid !== item.uid || snap.version !== item.version || snap.hash !== item.hash || typeof snap.renderer_fingerprint !== 'string' || sourceHash(snap.source, snap.renderer_fingerprint) !== item.hash || snap.source.uid !== item.uid || snap.source.version !== item.version || snap.source.content_hash !== item.hash)
    fail(item.uid, 'history.hash', 'confirmed source snapshot is damaged');
  if (sha(bytes) !== item.wav_sha256)
    fail(item.uid, 'history.wav_sha256', 'confirmed media is damaged');
  if (bytes.length < 44 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE' || bytes.readUInt32LE(24) !== 44100 || bytes.readUInt16LE(22) !== 1 || bytes.readUInt16LE(34) !== 16)
    fail(item.uid, 'history.wav', 'invalid PCM WAV');
  return { ...item, sha256: item.wav_sha256 };
}
function facts(root, c, a) {
  const byUid = new Map(c.entries.map(e => [e.uid, []])), bindings = Object.fromEntries(c.music_sets.map(s => [s.uid, null]));
  for (const rec of a.records) {
    for (const item of rec.items) {
      const valid = historical(root, item, c);
      byUid.get(item.uid).push({ ...valid, approval: rec.id });
    }
    for (const sel of rec.selections || []) {
      const set = c.music_sets.find(s => s.uid === sel.set_uid);
      if (!set || !set.candidates.includes(sel.uid))
        fail(sel.uid, 'selections.set_uid', 'candidate does not belong to ' + sel.set_uid);
      const v = (byUid.get(sel.uid) || []).findLast(x => x.version === sel.version && x.hash === sel.hash);
      if (!v)
        fail(sel.uid, 'selections', 'selection lacks a preceding quality approval');
      bindings[sel.set_uid] = { uid: v.uid, version: v.version, hash: v.hash, wav: v.wav, sha256: v.sha256 };
    }
  }
  return { byUid, bindings };
}
function prior(root) {
  const f = path.join(root, 'audio/export/manifest.json');
  if (!fs.existsSync(f))
    return new Map();
  const m = read(f);
  if (m.format !== 'pushbox.audio-manifest/1' || !Array.isArray(m.entries))
    fail('audio', 'manifest', 'invalid manifest');
  const seen = new Set();
  for (const e of m.entries) {
    if (!e.uid || seen.has(e.uid))
      fail(e.uid, 'manifest.entries', 'duplicate/missing uid');
    seen.add(e.uid);
  }
  return new Map(m.entries.map(e => [e.uid, e]));
}
function dataFor(root, c, entries, bindings) {
  const load = (name) => {
    const p = path.join(root, `content/catalog/${name}.json`);
    return fs.existsSync(p) ? read(p).entries : [];
  };
  const i18n = {};
  for (const loc of ['zh-Hans', 'en']) {
    const p = path.join(root, `content/i18n-audio/${loc}.json`);
    i18n[loc] = fs.existsSync(p) ? read(p) : {};
  }
  return { format: 'pushbox.audio-manifest/1', catalog: c, entries, bindings, slices: load('slices'), worlds: load('worlds'), groups: load('groups'), i18n };
}
function exportFiles(root, c, a, current, validatedFacts = null) {
  const f = validatedFacts || facts(root, c, a);
  const entries = [...c.entries].sort((a, b) => a.uid.localeCompare(b.uid)).map(e => {
    const cur = current.get(e.uid) || null, approved = f.byUid.get(e.uid);
    return { ...e, current: cur, approved, current_is_approved: !!cur && approved.some(x => x.version === cur.version && x.hash === cur.hash && x.sha256 === cur.sha256), availability: approved.length ? 'approved' : cur ? 'review' : 'planned', importable: approved.length > 0 };
  });
  const data = dataFor(root, c, entries, f.bindings);
  return { data, files: [['audio/export/manifest.json', json({ format: data.format, entries, bindings: f.bindings })], ['workbench/data/audio.js', '/* Generated by tools/audio.mjs build. Do not edit. */\nwindow.PB_AUDIO = ' + JSON.stringify(data) + ';\n']] };
}
function checkContent(root) {
  if (fs.existsSync(path.join(root, 'content/catalog/groups.json'))) {
    const res = buildContent(root, { write: false });
    if (res.summary.errors)
      fail('audio', 'content', `${res.summary.errors} content error(s): ` + res.issues.filter(i => i.level === 'error').map(i => i.where + ': ' + i.msg).join('; '));
  }
}
function refreshContent(root) {
  if (fs.existsSync(path.join(root, 'content/catalog/groups.json'))) {
    const res = buildContent(root, { write: true });
    if (res.summary.errors)
      fail('audio', 'content', `${res.summary.errors} content error(s): ` + res.issues.filter(i => i.level === 'error').map(i => i.where + ': ' + i.msg).join('; '));
  }
}
function baselineReader(root, ref) {
  if (!ref)
    return null;
  let commit;
  try {
    commit = execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  }
  catch {
    fail('audio', 'baseline-ref', 'Git reference does not exist or cannot be read: ' + ref);
  }
  return e => {
    let type;
    try {
      type = execFileSync('git', ['ls-tree', commit, '--', e.source], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    }
    catch {
      fail(e.uid, 'baseline-ref', 'cannot read Git tree');
    }
    if (!type)
      return { version: 0, content_hash: null };
    try {
      const b = JSON.parse(execFileSync('git', ['show', `${commit}:${e.source}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
      if (b.uid !== e.uid || !Number.isInteger(b.version) || b.version < 0 || (b.content_hash !== null && !hashOk(b.content_hash)))
        throw new Error('invalid identity');
      return b;
    }
    catch (err) {
      fail(e.uid, 'baseline-ref', 'cannot read baseline source: ' + err.message);
    }
  };
}
export function buildAudio(root = REPO, { kind, baselineRef } = {}) {
  if (fs.existsSync(path.join(root, 'art-pack.lock.json'))) {
    const c = catalog(root), a = approvals(root), manifest = read(path.join(root, 'audio/export/manifest.json'));
    facts(root, c, a);
    const data = dataFor(root, c, manifest.entries, manifest.bindings);
    fs.mkdirSync(path.join(root, 'workbench/data'), { recursive: true });
    fs.writeFileSync(path.join(root, 'workbench/data/audio.js'), '/* Generated by tools/audio.mjs build. Do not edit. */\nwindow.PB_AUDIO = ' + JSON.stringify(data) + ';\n');
    return { bumped: 0, changed: 0, ...summary(data, kind), data };
  }
  root = path.resolve(root);
  if (kind && !['sfx', 'music'].includes(kind))
    fail('audio', 'kind', 'must be sfx|music');
  const c = catalog(root), a = approvals(root), old = prior(root), base = baselineReader(root, baselineRef);
  facts(root, c, a);
  checkContent(root);
  const files = [], current = new Map([...old].map(([uid, e]) => [uid, e.current]));
  let bumped = 0, changed = 0;
  for (const e of c.entries.filter(e => !kind || e.kind === kind).sort((a, b) => a.uid.localeCompare(b.uid))) {
    const p = inside(root, e.source);
    if (!fs.existsSync(p)) {
      current.delete(e.uid);
      continue;
    }
    const s = read(p);
    validateSource(s, e, c.policy);
    const h = sourceHash(s), b = base ? base(e) : s;
    const version = h === b.content_hash ? b.version : b.version + 1;
    if (!Number.isSafeInteger(version) || version < 1)
      fail(e.uid, 'version', 'invalid target version');
    for (const r of a.records)
      for (const i of r.items)
        if (i.uid === e.uid && i.version === version && i.hash !== h)
          fail(e.uid, 'baseline-ref', '发布基线已过期: target version already has a different confirmed hash');
    const out = renderAudio(s, e, c.policy);
    if (version > s.version)
      bumped++;
    if (h !== s.content_hash)
      changed++;
    const updated = { ...s, version, content_hash: h };
    const wav = `audio/export/preview/${e.kind}/${e.id}.wav`;
    files.push([e.source, json(updated)], [wav, out.wav]);
    current.set(e.uid, { version, hash: h, wav, sha256: sha(out.wav), metrics: out.metrics });
  }
  const ex = exportFiles(root, c, a, current);
  files.push(...ex.files);
  if (!fs.existsSync(path.join(root, 'audio/approvals.json')))
    files.push(['audio/approvals.json', json(a)]);
  transaction(root, files);
  refreshContent(root);
  return { bumped, changed, ...summary(ex.data, kind), data: ex.data };
}
function summary(data, kind) {
  const selected = data.entries.filter(e => !kind || e.kind === kind);
  return { sources: selected.filter(e => e.current).length, missing_sfx: data.entries.filter(e => e.kind === 'sfx' && !e.current).length, missing_music: data.entries.filter(e => e.kind === 'music' && !e.current).length, unselected: Object.values(data.bindings).filter(x => !x).length };
}
export function verifyAudio(root = REPO, { kind, requireSources = false } = {}) {
  root = path.resolve(root);
  if (kind && !['sfx', 'music'].includes(kind))
    fail('audio', 'kind', 'must be sfx|music');
  const c = catalog(root), a = approvals(root), old = prior(root), errors = [], missing = [];
  let verified = 0;
  try {
    const current = new Map([...old].map(([uid, e]) => [uid, e.current]));
    const expected = exportFiles(root, c, a, current).data;
    const raw = read(path.join(root, 'audio/export/manifest.json'));
    if (!same(raw.entries, expected.entries) || !same(raw.bindings, expected.bindings))
      fail('audio', 'manifest', 'entries/bindings differ from catalog and approval records');
  }
  catch (e) {
    errors.push(e.message);
  }
  for (const e of c.entries.filter(e => !kind || e.kind === kind)) {
    const p = inside(root, e.source);
    if (!fs.existsSync(p)) {
      missing.push(e.uid);
      if (old.get(e.uid)?.current)
        errors.push(`${e.uid} source: missing source for exported current`);
      continue;
    }
    try {
      const s = read(p);
      validateSource(s, e, c.policy);
      const cur = old.get(e.uid)?.current;
      if (!cur || s.version !== cur.version || s.content_hash !== cur.hash || sourceHash(s) !== cur.hash)
        fail(e.uid, 'source.content_hash', 'source changed since build or current is missing');
      const out = renderAudio(s, e, c.policy);
      if (cur.wav !== `audio/export/preview/${e.kind}/${e.id}.wav`)
        fail(e.uid, 'current.wav', 'noncanonical preview path');
      const wav = fs.readFileSync(inside(root, cur.wav));
      if (sha(wav) !== cur.sha256 || !wav.equals(out.wav))
        fail(e.uid, 'current.wav', 'byte-for-byte rebuild mismatch');
      if (!same(cur.metrics, out.metrics))
        fail(e.uid, 'current.metrics', 'metrics differ from rebuilt WAV');
      verified++;
    }
    catch (err) {
      errors.push(`${e.uid}: ${err.message}`);
    }
  }
  if (requireSources && missing.length)
    errors.push('sources: 未制作 ' + missing.join(', '));
  return { ok: errors.length === 0, errors, missing, verified, records: a.records.length };
}
function identity(v) {
  return { uid: v.uid, version: v.version, hash: v.hash, wav_sha256: v.wav_sha256 || v.sha256 };
}
function checkRequest(req, c) {
  if (!req || req.format !== 'pushbox.audio-approval-request/1' || !Array.isArray(req.items) || !Array.isArray(req.selections || []) || (!req.items.length && !(req.selections || []).length))
    fail('audio', 'request', 'expected items and/or selections');
  const seen = new Set();
  for (const [n, i] of req.items.entries()) {
    if (!c.entries.some(e => e.uid === i.uid) || !Number.isInteger(i.version) || i.version < 1 || !hashOk(i.hash) || !hashOk(i.wav_sha256))
      fail(i.uid, `request.items[${n}]`, 'invalid uid/version/hash/wav_sha256');
    if (seen.has(i.uid))
      fail(i.uid, `request.items[${n}]`, 'duplicate request uid');
    seen.add(i.uid);
  }
  seen.clear();
  for (const [n, s] of (req.selections || []).entries()) {
    const set = c.music_sets.find(x => x.uid === s.set_uid);
    if (!set || !set.candidates.includes(s.uid) || !Number.isInteger(s.version) || s.version < 1 || !hashOk(s.hash))
      fail(s.uid, `request.selections[${n}]`, 'wrong set or invalid identity');
    if (seen.has(s.set_uid))
      fail(s.uid, `request.selections[${n}]`, 'duplicate/conflicting selection');
    seen.add(s.set_uid);
  }
}
export function approveAudio(root = REPO, req, { by, via, note } = {}) {
  if (fs.existsSync(path.join(root, 'art-pack.lock.json'))) fail('audio', 'locked', '声音编辑与确认请在 https://github.com/beekim123/ele-pushbox-arts 做；游戏资源已锁定。');
  root = path.resolve(root);
  note = note || req?.note;
  if (![by, via, note].every(v => typeof v === 'string' && v.trim()))
    fail('audio', 'approve.note/by/via', 'explicit user statement, by and via required');
  const c = catalog(root), a = approvals(root), old = prior(root), f = facts(root, c, a);
  checkRequest(req, c);
  const files = [], items = [], newApproved = new Map();
  for (const i of req.items) {
    const e = c.entries.find(e => e.uid === i.uid), cur = old.get(i.uid)?.current;
    if (!cur || cur.version !== i.version || cur.hash !== i.hash || cur.sha256 !== i.wav_sha256)
      fail(i.uid, 'request.items.current', 'wrong current version/hash/media');
    const s = read(inside(root, e.source));
    validateSource(s, e, c.policy);
    if (s.version !== cur.version || s.content_hash !== cur.hash || sourceHash(s) !== cur.hash)
      fail(i.uid, 'source.content_hash', 'source changed since build');
    const out = renderAudio(s, e, c.policy), wav = fs.readFileSync(inside(root, cur.wav));
    if (cur.wav !== `audio/export/preview/${e.kind}/${e.id}.wav` || sha(wav) !== i.wav_sha256 || !wav.equals(out.wav))
      fail(i.uid, 'current.wav', 'media changed or rebuild failed');
    if (!same(cur.metrics, out.metrics))
      fail(i.uid, 'current.metrics', 'metrics changed or verification failed');
    const previous = f.byUid.get(i.uid).find(v => same(identity(v), i));
    if (previous) {
      newApproved.set(i.uid, previous);
      items.push(previous);
      continue;
    }
    const hp = `audio/history/${e.kind}/${e.id}@v${i.version}.json`, wp = `audio/export/approved/${e.kind}/${e.id}@v${i.version}.wav`;
    const snapshot = { format: 'pushbox.audio-history/1', uid: i.uid, version: i.version, hash: i.hash, renderer_fingerprint: rendererFingerprint(), source: s };
    for (const [p, bytes] of [[hp, Buffer.from(json(snapshot))], [wp, wav]]) {
      if (fs.existsSync(inside(root, p)) && !fs.readFileSync(inside(root, p)).equals(bytes))
        fail(i.uid, 'history', 'cannot overwrite a confirmed version');
      files.push([p, bytes]);
    }
    const it = { ...i, history: hp, wav: wp };
    items.push(it);
    newApproved.set(i.uid, { ...it, sha256: i.wav_sha256 });
  }
  for (const s of req.selections || []) {
    const found = [...(f.byUid.get(s.uid) || []), ...(newApproved.has(s.uid) ? [newApproved.get(s.uid)] : [])].find(v => v.version === s.version && v.hash === s.hash);
    if (!found)
      fail(s.uid, 'selections', 'quality approval required before adoption');
  }
  const already = req.items.every(i => (f.byUid.get(i.uid) || []).some(v => same(identity(v), i))) && (req.selections || []).every(s => {
    const b = f.bindings[s.set_uid];
    return b && b.uid === s.uid && b.version === s.version && b.hash === s.hash;
  });
  if (already)
    return { record: null, already: true };
  const last = Math.max(0, ...a.records.map(r => Number(r.id.slice(4)))), record = { id: 'AAP-' + String(last + 1).padStart(4, '0'), date: new Date().toISOString(), by: by.trim(), via: via.trim(), note: note.trim(), items: items.map(i => ({ uid: i.uid, version: i.version, hash: i.hash, wav_sha256: i.wav_sha256, history: i.history, wav: i.wav })), selections: (req.selections || []).map(s => ({ ...s })) };
  const updated = { ...a, records: [...a.records, record] };
  // All validation and export preparation precedes the single filesystem transaction.
  const nextFacts = { byUid: new Map([...f.byUid].map(([uid, versions]) => [uid, [...versions]])), bindings: { ...f.bindings } };
  for (const i of record.items)
    nextFacts.byUid.get(i.uid).push({ ...i, sha256: i.wav_sha256, approval: record.id });
  for (const s of record.selections) {
    const v = nextFacts.byUid.get(s.uid).findLast(v => v.version === s.version && v.hash === s.hash);
    nextFacts.bindings[s.set_uid] = { uid: v.uid, version: v.version, hash: v.hash, wav: v.wav, sha256: v.sha256 };
  }
  const ex = exportFiles(root, c, updated, new Map([...old].map(([uid, e]) => [uid, e.current])), nextFacts);
  checkContent(root);
  files.push(...ex.files, ['audio/approvals.json', json(updated)]);
  transaction(root, files);
  refreshContent(root);
  return { record: record.id, already: false };
}
export function buildPresetPreviews(out, policy) {
  const rendered = Object.keys(audioPresets()).map(name => ({ name, ...renderPresetPreview(name, policy) }));
  transaction(out, [...rendered.map(r => [r.name + '.wav', r.wav]), ['all.wav', joinAudioPreviews(rendered.map(r => r.wav))]]);
  return rendered;
}
function options(argv) {
  const out = {}, allowed = new Set(['root', 'kind', 'baseline-ref', 'require-sources', 'items', 'from-file', 'by', 'via', 'note', 'out']);
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i].slice(2);
    if (!argv[i].startsWith('--') || !allowed.has(k) || k in out)
      fail('audio', 'arguments', 'unknown/duplicate argument ' + argv[i]);
    if (k === 'require-sources')
      out[k] = true;
    else {
      const v = argv[++i];
      if (!v || v.startsWith('--'))
        fail('audio', 'arguments', 'missing value for --' + k);
      out[k] = v;
    }
  }
  return out;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [cmd, ...rest] = process.argv.slice(2), o = options(rest), root = path.resolve(o.root || REPO);
    if (cmd === 'approve' && fs.existsSync(path.join(root, 'art-pack.lock.json'))) fail('audio', 'locked', '声音确认请在 https://github.com/beekim123/ele-pushbox-arts 做。');
    if (!['build', 'verify', 'approve', 'presets'].includes(cmd))
      fail('audio', 'command', 'usage: node tools/audio.mjs build|verify|approve|presets [--root dir] [--out dir]');
    const valid = cmd === 'build' ? ['root', 'kind', 'baseline-ref'] : cmd === 'verify' ? ['root', 'kind', 'require-sources'] : cmd === 'presets' ? ['root', 'out'] : ['root', 'items', 'from-file', 'by', 'via', 'note'];
    for (const k of Object.keys(o))
      if (!valid.includes(k))
        fail('audio', 'arguments', `--${k} is not valid for ${cmd}`);
    if (cmd === 'presets') {
      if (!o.out) fail('audio', 'arguments', 'presets requires --out dir');
      const policyPath = path.join(root, 'content/catalog/audio.json');
      const policy = read(fs.existsSync(policyPath) ? policyPath : path.join(REPO, 'content/catalog/audio.json')).policy;
      const out = path.resolve(root, o.out), samples = buildPresetPreviews(out, policy);
      for (const s of samples) {
        console.log(`${s.name}: ${s.metrics.verified ? '指标通过' : '未验证（指标冲突）'}; gain ${s.gain_db.toFixed(2)} dB; RMS ${s.metrics.rms_dbfs.toFixed(2)} dBFS; peak ${s.metrics.peak_dbfs.toFixed(2)} dBFS; noise ${(100 * s.metrics.noise_energy_ratio).toFixed(2)}%`);
        for (const issue of s.issues) console.log('  ' + issue);
      }
      console.log(`audio presets: ${samples.length} WAV + all.wav; ${samples.filter(s => !s.metrics.verified).length} 个样本未通过现行指标；仅试听，不进清单或游戏; ${out}`);
    }
    else if (cmd === 'build') {
      const r = buildAudio(root, { kind: o.kind, baselineRef: o['baseline-ref'] });
      for (const e of r.data.entries.filter(e => (!o.kind || e.kind === o.kind) && !e.current))
        console.log(`${e.uid}: 未制作`);
      console.log(`audio build: ${r.bumped} bumped / ${r.changed} changed; ${r.sources} source(s); 未制作 ${r.missing_sfx} 音效 + ${r.missing_music} 音乐候选; ${r.unselected} 曲组未选定`);
    }
    else if (cmd === 'verify') {
      const r = verifyAudio(root, { kind: o.kind, requireSources: o['require-sources'] });
      for (const uid of r.missing)
        console.log(`${uid}: 未制作（无音源指标结果）`);
      for (const e of r.errors)
        console.error(e);
      console.log(`audio verify: ${r.ok ? 'ok' : 'FAILED'}; ${r.verified} 指标通过（不等于用户确认）; ${r.missing.length} 未制作; ${r.records} approval record(s)`);
      if (!r.ok)
        process.exitCode = 1;
    }
    else {
      if (!!o.items === !!o['from-file'])
        fail('audio', 'arguments', 'use exactly one of --items or --from-file');
      let req;
      if (o['from-file'])
        req = read(path.resolve(o['from-file']));
      else {
        const m = prior(root);
        req = { format: 'pushbox.audio-approval-request/1', items: o.items.split(',').map(token => {
            const match = /^((?:sfx|music):[a-z0-9_-]+)@v([1-9]\d*)$/.exec(token);
            if (!match)
              fail('audio', 'items', 'expected uid@vN: ' + token);
            const cur = m.get(match[1])?.current;
            if (!cur || cur.version !== Number(match[2]))
              fail(match[1], 'items.version', 'wrong current version');
            return { uid: match[1], version: cur.version, hash: cur.hash, wav_sha256: cur.sha256 };
          }), selections: [] };
      }
      const r = approveAudio(root, req, { by: o.by, via: o.via, note: o.note });
      console.log(r.already ? 'audio approve: 已记录（未重复追加）' : `audio approve: ${r.record}`);
    }
  }
  catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}
