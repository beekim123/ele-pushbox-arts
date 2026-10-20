// All sources in this file are isolated fixtures, never production candidates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { validateSource, renderAudio, sourceHash, rendererFingerprint } from '../tools/lib/audio.mjs';
const rendererCatalog = JSON.parse(fs.readFileSync(new URL('../content/catalog/audio.json', import.meta.url)));
export const rendererPolicy = rendererCatalog.policy;
export const rendererSfxEntry = rendererCatalog.entries.find(e => e.uid === 'sfx:push');
export const rendererMusicEntry = rendererCatalog.entries.find(e => e.uid === 'music:jeju_b');
export function rendererSfxSource() {
  return { format: 'pushbox.audio/1', engine: 'portitor-chip/1', kind: 'sfx', id: 'push', uid: 'sfx:push', name: 'isolated test', seed: 42, sample_rate: 44100, channels: 1, version: 0, content_hash: null, gain_db: 0, duration_ms: 180,
    instruments: [{ id: 'soft', wave: 'sine', gain_db: -20, lowpass_hz: 2000, attack_ms: 8, decay_ms: 0, sustain: 1, release_ms: 25 }],
    events: [{ instrument: 'soft', start_ms: 5, duration_ms: 140, note: 57, gain_db: 0 }] };
}
export function rendererMusicSource() {
  const s = rendererSfxSource();
  delete s.duration_ms;
  delete s.events;
  return { ...s, kind: 'music', id: 'jeju_b', uid: 'music:jeju_b', set: 'jeju', bpm: 108, meter: [4, 4], bars: 32, mode: 'isolated fixture', instruments: [{ ...s.instruments[0], gain_db: -23 }],
    tracks: [{ instrument: 'soft', notes: Array.from({ length: 32 }, (_, i) => ({ beat: i * 4, length: 4, note: 57, gain_db: 0 })) }] };
}
const rendererSha = b => createHash('sha256').update(b).digest('hex');
const rendererCopy = v => structuredClone(v);
test('sfx renderer emits deterministic mono PCM and checks the active segment', () => {
  const source = rendererSfxSource();
  const a = renderAudio(source, rendererSfxEntry, rendererPolicy);
  const b = renderAudio(source, rendererSfxEntry, rendererPolicy);
  assert.equal(rendererSha(a.wav), rendererSha(b.wav));
  assert.equal(a.wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(a.wav.readUInt16LE(20), 1);
  assert.equal(a.wav.readUInt16LE(22), 1);
  assert.equal(a.wav.readUInt32LE(24), 44100);
  assert.equal(a.wav.readUInt16LE(34), 16);
  assert.equal(a.wav.length, 44 + 7938 * 2);
  assert.ok(a.metrics.rms_dbfs >= -26 && a.metrics.rms_dbfs <= -22);
  assert.ok(a.metrics.active_sample_count < a.metrics.sample_count);
  assert.ok(a.metrics.peak_dbfs <= -9);
  assert.equal(a.metrics.verified, true);
  source.instruments[0].gain_db = -15;
  source.duration_ms = 180;
  source.events[0].duration_ms = 40;
  assert.throws(() => renderAudio(source, rendererSfxEntry, rendererPolicy), /sfx:push.*metrics.rms_dbfs/);
});
test('all source and nested fields are strict, finite and report uid with field path', () => {
  const changes = [
    [s => {
        s.external_sample = 'https://invalid/sample';
      }, 'external_sample'],
    [s => {
        s.instruments[0].file = 'sample.wav';
      }, 'instruments\\[0\\].file'],
    [s => {
        s.events[0].velocity = 1;
      }, 'events\\[0\\].velocity'],
    [s => {
        s.events[0].note = 82;
      }, 'events\\[0\\].note'],
    [s => {
        s.events[0].slide_to_note = 20;
      }, 'events\\[0\\].slide_to_note'],
    [s => {
        s.instruments[0].wave = 'square';
      }, 'instruments\\[0\\].wave'],
    [s => {
        s.instruments[0].pulse_width = 0.5;
      }, 'instruments\\[0\\].pulse_width'],
    [s => {
        s.instruments[0].wave = 'pulse';
        s.instruments[0].pulse_width = 0.3;
      }, 'instruments\\[0\\].pulse_width'],
    [s => {
        s.instruments[0].attack_ms = 7;
      }, 'instruments\\[0\\].attack_ms'],
    [s => {
        s.instruments[0].release_ms = 24;
      }, 'instruments\\[0\\].release_ms'],
    [s => {
        s.instruments[0].lowpass_hz = 4001;
      }, 'instruments\\[0\\].lowpass_hz'],
    [s => {
        s.events[0].duration_ms = 170;
      }, 'events\\[0\\].duration_ms'],
    [s => {
        s.gain_db = Infinity;
      }, 'gain_db'],
    [s => {
        s.seed = -1;
      }, 'seed'],
    [s => {
        s.uid = 'sfx:wrong';
      }, 'uid']
  ];
  for (const [change, field] of changes) {
    const s = rendererSfxSource();
    change(s);
    assert.throws(() => validateSource(s, rendererSfxEntry, rendererPolicy), new RegExp(`sfx:push.*${field}`));
  }
});
test('sound hash ignores labels and managed fields but includes synthesis parameters and renderer', () => {
  const s = rendererSfxSource();
  const before = sourceHash(s);
  const labels = { ...s, name: 'renamed', description: 'documentation', version: 7, content_hash: 'f'.repeat(64) };
  assert.equal(sourceHash(labels), before);
  const changed = rendererCopy(s);
  changed.seed++;
  assert.notEqual(sourceHash(changed), before);
  changed.seed--;
  changed.events[0].note++;
  assert.notEqual(sourceHash(changed), before);
  assert.match(rendererFingerprint(), /^[0-9a-f]{64}$/);
});
test('noise is seeded, seed zero maps to one, and excess noise energy fails', () => {
  const s = rendererSfxSource();
  s.instruments.push({ ...s.instruments[0], id: 'dust', wave: 'noise', gain_db: -36 });
  s.events.push({ instrument: 'dust', start_ms: 5, duration_ms: 140, gain_db: 0 });
  s.seed = 0;
  const zero = renderAudio(s, rendererSfxEntry, rendererPolicy);
  s.seed = 1;
  assert.deepEqual(renderAudio(s, rendererSfxEntry, rendererPolicy).wav, zero.wav);
  s.seed = 2;
  assert.notDeepEqual(renderAudio(s, rendererSfxEntry, rendererPolicy).wav, zero.wav);
  assert.ok(zero.metrics.noise_energy_ratio > 0 && zero.metrics.noise_energy_ratio <= 0.08);
  s.events.shift();
  assert.throws(() => renderAudio(s, rendererSfxEntry, rendererPolicy), /sfx:push.*metrics.noise_energy_ratio/);
  s.events[0].note = 57;
  assert.throws(() => validateSource(s, rendererSfxEntry, rendererPolicy), /sfx:push.*events\[0\].note/);
});
test('32-bar periodic music renders repeatably with cross-boundary releases and exact sample count', () => {
  const s = rendererMusicSource();
  const a = renderAudio(s, rendererMusicEntry, rendererPolicy);
  const b = renderAudio(s, rendererMusicEntry, rendererPolicy);
  assert.equal(rendererSha(a.wav), rendererSha(b.wav));
  assert.equal(a.metrics.sample_count, 3136000);
  assert.ok(a.metrics.rms_dbfs >= -28 && a.metrics.rms_dbfs <= -24);
  assert.ok(a.metrics.seam_value_delta <= 0.002);
  assert.ok(a.metrics.seam_slope_delta <= 0.002);
  assert.ok(a.metrics.window_rms_range_db <= 6);
  assert.ok(a.metrics.longest_silence_ms < 1000);
  assert.ok(a.metrics.pitched_voice_max >= 2, 'release tails count as active voices');
  assert.ok(Math.abs(a.wav.readInt16LE(44) / 32768) > 0.001, 'music has no forced file fade-in');
});
test('music schema enforces catalog tempo, 32 bars, beat precision, tracks and simultaneous release voices', () => {
  const changes = [
    [s => {
        s.bars = 16;
      }, 'bars'],
    [s => {
        s.bpm = 109;
      }, 'bpm'],
    [s => {
        s.tracks[0].notes[0].beat = 0.01;
      }, 'tracks\\[0\\].notes\\[0\\].beat'],
    [s => {
        s.tracks[0].notes[0].length = 0;
      }, 'tracks\\[0\\].notes\\[0\\].length'],
    [s => {
        s.tracks[0].notes[0].slide_to_note = 58;
      }, 'tracks\\[0\\].notes\\[0\\].slide_to_note'],
    [s => {
        s.tracks = Array.from({ length: 7 }, () => rendererCopy(s.tracks[0]));
      }, 'tracks'],
    [s => {
        s.tracks[0].notes = Array.from({ length: 5 }, () => ({ beat: 127, length: 2, note: 57, gain_db: 0 }));
      }, 'pitched_voice']
  ];
  for (const [change, field] of changes) {
    const s = rendererMusicSource();
    change(s);
    assert.throws(() => validateSource(s, rendererMusicEntry, rendererPolicy), new RegExp(`music:jeju_b.*${field}`));
  }
});
test('music rejects complete silence gaps, uneven three-second windows and a broken seam', () => {
  const silent = rendererMusicSource();
  silent.tracks[0].notes = silent.tracks[0].notes.slice(0, 1);
  assert.throws(() => renderAudio(silent, rendererMusicEntry, rendererPolicy), /music:jeju_b.*metrics\.(longest_silence_ms|rms_dbfs)/);
  const uneven = rendererMusicSource();
  uneven.instruments[0].gain_db = -21;
  uneven.tracks[0].notes.forEach(n => {
    if (n.beat >= 64)
      n.gain_db = -12;
  });
  assert.throws(() => renderAudio(uneven, rendererMusicEntry, rendererPolicy), /music:jeju_b.*metrics.window_rms_range_db/);
  const seam = rendererMusicSource();
  seam.tracks[0].notes = [{ beat: 0, length: 128, note: 69, gain_db: 0 }];
  assert.throws(() => renderAudio(seam, rendererMusicEntry, rendererPolicy), /music:jeju_b.*metrics.seam_/);
});
test('peak, RMS, DC, and silence failures cannot be hidden by PCM clipping or padding', () => {
  const loud = rendererSfxSource();
  loud.instruments[0].gain_db = -2;
  assert.throws(() => renderAudio(loud, rendererSfxEntry, rendererPolicy), /sfx:push.*metrics\.(peak_dbfs|clipping)/);
  const quiet = rendererSfxSource();
  quiet.gain_db = -30;
  assert.throws(() => renderAudio(quiet, rendererSfxEntry, rendererPolicy), /sfx:push.*metrics.rms_dbfs/);
  const dc = rendererSfxSource();
  dc.instruments[0].wave = 'pulse';
  dc.instruments[0].pulse_width = 0.25;
  dc.events[0].duration_ms = 1;
  dc.instruments[0].release_ms = 25;
  assert.throws(() => renderAudio(dc, rendererSfxEntry, rendererPolicy), /sfx:push.*metrics\./);
  const silent = rendererSfxSource();
  silent.instruments[0].sustain = 0;
  assert.throws(() => renderAudio(silent, rendererSfxEntry, rendererPolicy), /sfx:push.*metrics\./);
});
// CLI / release / approval integration: all data stays in temporary roots.
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const cli = path.join(REPO, 'tools/audio.mjs');
function sandbox(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wb02-cli-'));
  for (const dir of ['content', 'art/source', 'art/concepts', 'art/approvals.json'])
    fs.cpSync(path.join(REPO, dir), path.join(root, dir), { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
function run(root, args, good = true) {
  const p = spawnSync(process.execPath, [cli, ...args, '--root', root], { encoding: 'utf8' });
  if (good)
    assert.equal(p.status, 0, p.stdout + p.stderr);
  else
    assert.notEqual(p.status, 0, p.stdout);
  return p;
}
const read = (r, p) => JSON.parse(fs.readFileSync(path.join(r, p), 'utf8'));
function write(r, p, v) {
  fs.mkdirSync(path.dirname(path.join(r, p)), { recursive: true });
  fs.writeFileSync(path.join(r, p), JSON.stringify(v, null, 1) + '\n');
}
function source(root, kind = 'sfx', id = 'push') {
  const c = read(root, 'content/catalog/audio.json');
  const e = c.entries.find(x => x.kind === kind && x.id === id);
  const s = { format: 'pushbox.audio/1', kind, id, uid: e.uid, name: e.name, seed: 17, engine: 'portitor-chip/1', sample_rate: 44100, channels: 1, version: 0, content_hash: null, gain_db: kind === 'sfx' ? -20 : -23, instruments: [{ id: 'tone', wave: 'sine', gain_db: 0, lowpass_hz: 1200, attack_ms: 8, decay_ms: 0, sustain: 1, release_ms: 25 }] };
  if (kind === 'sfx')
    Object.assign(s, { duration_ms: e.duration_ms, events: [{ instrument: 'tone', start_ms: 0, duration_ms: e.duration_ms - 30, note: 45, gain_db: 0 }] });
  else
    Object.assign(s, { set: e.set, bpm: e.bpm, meter: [4, 4], bars: 32, mode: e.mode, tracks: [{ instrument: 'tone', notes: Array.from({ length: 32 }, (_, i) => ({ beat: i * 4, length: 4, note: 57, gain_db: 0 })) }] });
  write(root, e.source, s);
  return { s, e };
}
function current(root, uid) {
  return read(root, 'audio/export/manifest.json').entries.find(e => e.uid === uid).current;
}
function request(root, items, selections = []) {
  const p = path.join(root, 'request.json');
  write(root, 'request.json', { format: 'pushbox.audio-approval-request/1', items, selections, note: '临时测试用户明确确认质量并采用这些具体版本' });
  return p;
}
function item(root, uid) {
  const c = current(root, uid);
  return { uid, version: c.version, hash: c.hash, wav_sha256: c.sha256 };
}
function approve(root, items, selections = []) {
  return run(root, ['approve', '--from-file', request(root, items, selections), '--by', '测试用户', '--via', 'test']);
}
test('CLI empty build is honest, deterministic and initializes an append-only empty approval table', t => {
  const r = sandbox(t);
  const a = run(r, ['build']);
  const cat = read(r, 'content/catalog/audio.json');
  assert.match(a.stdout, new RegExp(`${cat.entries.filter(e => e.kind === 'sfx').length}.*${cat.entries.filter(e => e.kind === 'music').length}`));
  const before = fs.readFileSync(path.join(r, 'audio/approvals.json'));
  run(r, ['build']);
  assert.deepEqual(fs.readFileSync(path.join(r, 'audio/approvals.json')), before);
  assert.deepEqual(read(r, 'audio/approvals.json').records, []);
  const v = run(r, ['verify']);
  assert.match(v.stdout, /0.*指标|no sources|未制作/);
  run(r, ['verify', '--require-sources'], false);
  assert.equal(read(r, 'audio/export/manifest.json').entries.filter(e => e.current).length, 0);
});
test('CLI rebuild/approval is exact and a stale source cannot be approved', t => {
  const r = sandbox(t);
  const { s, e } = source(r);
  run(r, ['build']);
  const c = current(r, e.uid), wav = fs.readFileSync(path.join(r, c.wav));
  assert.equal(c.version, 1);
  assert.match(run(r, ['build']).stdout, /0 bumped.*0 changed/);
  assert.deepEqual(fs.readFileSync(path.join(r, c.wav)), wav);
  run(r, ['verify']);
  const req = item(r, e.uid);
  approve(r, [req]);
  assert.equal(read(r, 'audio/approvals.json').records.length, 1);
  approve(r, [req]);
  assert.equal(read(r, 'audio/approvals.json').records.length, 1);
  const approved = read(r, 'audio/approvals.json').records[0].items[0];
  assert.ok(fs.existsSync(path.join(r, approved.wav)));
  s.gain_db = -19;
  write(r, e.source, s);
  const p = run(r, ['approve', '--from-file', request(r, [req]), '--by', '测试', '--via', 'test'], false);
  assert.match(p.stderr, /source|源|hash/);
  assert.equal(read(r, 'audio/approvals.json').records.length, 1);
});
test('CLI baseline locks iterations, rejects expired or missing refs and preserves the other kind', t => {
  const r = sandbox(t);
  const { s, e } = source(r);
  execFileSync('git', ['init', '-q'], { cwd: r });
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'add', '.'], { cwd: r });
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'baseline empty audio'], { cwd: r });
  for (const gain of [-20, -19.8, -19.6]) {
    s.gain_db = gain;
    write(r, e.source, s);
    run(r, ['build', '--kind', 'sfx', '--baseline-ref', 'HEAD']);
    assert.equal(current(r, e.uid).version, 1);
  }
  run(r, ['build', '--baseline-ref', 'missing-ref'], false);
  const c = item(r, e.uid);
  approve(r, [c]);
  s.gain_db = -19.5;
  write(r, e.source, s);
  run(r, ['build', '--baseline-ref', 'HEAD'], false);
  assert.equal(read(r, e.source).version, 0);
});
test('CLI validates all approval items before any writes and preserves explicit historical selection', t => {
  const r = sandbox(t);
  source(r);
  const { s, e } = source(r, 'music', 'jeju_b');
  run(r, ['build']);
  const a = item(r, 'sfx:push'), m = item(r, e.uid), sel = { set_uid: 'music:jeju', uid: e.uid, version: m.version, hash: m.hash };
  const bad = { ...m, hash: '0'.repeat(64) };
  run(r, ['approve', '--from-file', request(r, [a, bad]), '--by', '测试', '--via', 'test'], false);
  assert.equal(read(r, 'audio/approvals.json').records.length, 0);
  assert.equal(fs.existsSync(path.join(r, 'audio/history/sfx/push@v1.json')), false);
  approve(r, [m]);
  assert.equal(read(r, 'audio/export/manifest.json').bindings['music:jeju'], null);
  approve(r, [], [sel]);
  const old = read(r, 'audio/export/manifest.json').bindings['music:jeju'];
  const revised = read(r, e.source);
  revised.gain_db = -22.9;
  write(r, e.source, revised);
  run(r, ['build']);
  assert.equal(current(r, e.uid).version, 2);
  assert.deepEqual(read(r, 'audio/export/manifest.json').bindings['music:jeju'], old);
  approve(r, [item(r, 'sfx:push')]);
  assert.deepEqual(read(r, 'audio/export/manifest.json').bindings['music:jeju'], old);
  approve(r, [], [sel]);
  const before = fs.readFileSync(path.join(r, 'audio/approvals.json'));
  run(r, ['approve', '--from-file', request(r, [], [{ ...sel, set_uid: 'music:diyu' }]), '--by', '测试', '--via', 'test'], false);
  assert.deepEqual(fs.readFileSync(path.join(r, 'audio/approvals.json')), before);
  fs.appendFileSync(path.join(r, old.wav), 'corrupt');
  run(r, ['approve', '--from-file', request(r, [], [sel]), '--by', '测试', '--via', 'test'], false);
  assert.deepEqual(fs.readFileSync(path.join(r, 'audio/approvals.json')), before);
});
test('published baselines cap repeated revisions and --kind preserves the other source and export', t => {
  const r = sandbox(t);
  source(r);
  source(r, 'music', 'jeju_b');
  run(r, ['build']);
  execFileSync('git', ['init', '-q'], { cwd: r });
  execFileSync('git', ['add', '.'], { cwd: r });
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'published v1'], { cwd: r });
  const musical = current(r, 'music:jeju_b'), musicSource = fs.readFileSync(path.join(r, 'audio/source/music/jeju_b.json')), musicWav = fs.readFileSync(path.join(r, musical.wav));
  for (const gain of [-19.9, -19.8, -19.7]) {
    const s = read(r, 'audio/source/sfx/push.json');
    s.gain_db = gain;
    write(r, 'audio/source/sfx/push.json', s);
    run(r, ['build', '--kind', 'sfx', '--baseline-ref', 'HEAD']);
    assert.equal(current(r, 'sfx:push').version, 2);
    assert.deepEqual(current(r, 'music:jeju_b'), musical);
    assert.deepEqual(fs.readFileSync(path.join(r, 'audio/source/music/jeju_b.json')), musicSource);
    assert.deepEqual(fs.readFileSync(path.join(r, musical.wav)), musicWav);
  }
  assert.match(run(r, ['build', '--kind', 'sfx', '--baseline-ref', 'HEAD']).stdout, /0 bumped.*0 changed/);
  run(r, ['verify', '--kind', 'sfx']);
});
test('approval rejects duplicate, wrong media/version and conflicting selections without partial writes', t => {
  const r = sandbox(t);
  source(r);
  run(r, ['build']);
  const good = item(r, 'sfx:push');
  const before = fs.readFileSync(path.join(r, 'audio/approvals.json'));
  for (const items of [[good, good], [{ ...good, version: 2 }], [{ ...good, wav_sha256: 'f'.repeat(64) }]]) {
    run(r, ['approve', '--from-file', request(r, items), '--by', '测试', '--via', 'test'], false);
    assert.deepEqual(fs.readFileSync(path.join(r, 'audio/approvals.json')), before);
    assert.equal(fs.existsSync(path.join(r, 'audio/history/sfx/push@v1.json')), false);
  }
  const p = request(r, [good]);
  const req = read(r, 'request.json');
  delete req.note;
  write(r, 'request.json', req);
  run(r, ['approve', '--from-file', p, '--by', '测试', '--via', 'test'], false);
  assert.deepEqual(fs.readFileSync(path.join(r, 'audio/approvals.json')), before);
  fs.appendFileSync(path.join(r, current(r, 'sfx:push').wav), 'corrupted');
  run(r, ['verify'], false);
  run(r, ['approve', '--from-file', request(r, [good]), '--by', '测试', '--via', 'test'], false);
  assert.deepEqual(fs.readFileSync(path.join(r, 'audio/approvals.json')), before);
});
test('changing renderer bytes changes the sound hash while a saved historical fingerprint stays verifiable', async (t) => {
  const r = sandbox(t), f = path.join(r, 'renderer.mjs');
  fs.copyFileSync(path.join(REPO, 'tools/lib/audio.mjs'), f);
  const a = await import(new URL('file://' + f));
  const src = rendererSfxSource(), saved = a.rendererFingerprint(), hash = a.sourceHash(src);
  fs.appendFileSync(f, '\n// isolated renderer revision\n');
  assert.notEqual(a.sourceHash(src), hash);
  assert.equal(a.sourceHash(src, saved), hash);
});
test('verify detects forged derived approval/binding data and approval requires unchanged metrics', t => {
  const r = sandbox(t);
  source(r);
  run(r, ['build']);
  const c = item(r, 'sfx:push'), before = fs.readFileSync(path.join(r, 'audio/approvals.json')), original = read(r, 'audio/export/manifest.json');
  const fake = structuredClone(original);
  fake.bindings['music:dungeon'] = { uid: 'music:dungeon_a', version: 1, hash: 'f'.repeat(64), wav: 'fake.wav', sha256: 'f'.repeat(64) };
  write(r, 'audio/export/manifest.json', fake);
  assert.match(run(r, ['verify'], false).stderr, /manifest/);
  const bad = structuredClone(original);
  bad.entries.find(e => e.uid === 'sfx:push').current.metrics.rms_dbfs = -1;
  write(r, 'audio/export/manifest.json', bad);
  run(r, ['approve', '--from-file', request(r, [c]), '--by', '测试', '--via', 'test'], false);
  assert.deepEqual(fs.readFileSync(path.join(r, 'audio/approvals.json')), before);
  write(r, 'audio/export/manifest.json', original);
  const duplicate = structuredClone(original);
  duplicate.entries.push(duplicate.entries[0]);
  write(r, 'audio/export/manifest.json', duplicate);
  run(r, ['verify'], false);
  write(r, 'audio/export/manifest.json', original);

});
test('one missing music bar fails the full-silence metric even while overall RMS remains valid', () => {
  const s = rendererMusicSource();
  s.tracks[0].notes.splice(16, 1);
  assert.throws(() => renderAudio(s, rendererMusicEntry, rendererPolicy), /music:jeju_b.*metrics.longest_silence_ms/);
});
test('historical approval metadata is mandatory for verify and future builds', t => {
  const r = sandbox(t);
  source(r);
  run(r, ['build']);
  approve(r, [item(r, 'sfx:push')]);
  const original = read(r, 'audio/approvals.json');
  for (const field of ['id', 'date', 'by', 'via', 'note']) {
    const bad = structuredClone(original);
    delete bad.records[0][field];
    write(r, 'audio/approvals.json', bad);
    run(r, ['verify'], false);
    run(r, ['build'], false);
  }
  const bad = structuredClone(original);
  bad.records[0].date = '2026-02-30T00:00:00.000Z';
  write(r, 'audio/approvals.json', bad);
  run(r, ['verify'], false);
});

// WB-04: frozen pre-upgrade PCM, not renderer/source fingerprints. These fixtures
// deliberately isolate waveform bytes; production loudness tests above stay strict.
const waveformPolicy = { ...rendererPolicy, metrics: { ...rendererPolicy.metrics,
  sfx_rms_dbfs: { target: -24, tolerance: 60 }, noise_energy_ratio_max: 1, dc_abs_max: 1 } };
// Frozen voice routine from WB-04's baseline (36e1344), intentionally independent
// of the production renderer. Compare the complete PCM payload, not metadata.
function preWB04Pcm(source) {
  const RATE = 44100, mix = new Float64Array(Math.round(source.duration_ms * RATE / 1000));
  const level = (age, i) => {
    const a = i.attack_ms * RATE / 1000, d = i.decay_ms * RATE / 1000;
    if (age < a) return age / a;
    if (d > 0 && age < a + d) return 1 - (1 - i.sustain) * (age - a) / d;
    return i.sustain;
  };
  for (const [index, e] of source.events.entries()) {
    const i = source.instruments.find(i => i.id === e.instrument);
    const start = Math.round(e.start_ms * RATE / 1000);
    const gate = Math.round((e.start_ms + e.duration_ms) * RATE / 1000) - start;
    const release = i.release_ms * RATE / 1000;
    const alpha = 1 - Math.exp(-2 * Math.PI * i.lowpass_hz / RATE);
    const volume = 10 ** ((i.gain_db + e.gain_db) / 20);
    const noteHz = i.wave === 'noise' ? 0 : 440 * 2 ** ((e.note - 69) / 12);
    const slideHz = e.slide_to_note === undefined ? noteHz : 440 * 2 ** ((e.slide_to_note - 69) / 12);
    let phase = 0, filtered = 0, random = (((source.seed || 1) ^ Math.imul(index, 0x9e3779b9)) >>> 0) || 1;
    for (let age = 0; age < Math.min(gate + Math.ceil(release), mix.length - start); age++) {
      let raw;
      if (i.wave === 'noise') { random ^= random << 13; random ^= random >>> 17; random ^= random << 5; raw = (random >>> 0) / 2147483648 - 1; }
      else if (i.wave === 'sine') raw = Math.sin(2 * Math.PI * phase);
      else if (i.wave === 'triangle') raw = 1 - 4 * Math.abs(phase - 0.5);
      else raw = phase < i.pulse_width ? 1 : -i.pulse_width / (1 - i.pulse_width);
      filtered += alpha * (raw - filtered);
      const env = age < gate ? level(age, i) : level(gate, i) * Math.max(0, 1 - (age - gate) / release);
      mix[start + age] += filtered * env * volume;
      const frequency = noteHz + (slideHz - noteHz) * Math.min(1, age / Math.max(1, gate));
      phase += frequency / RATE; phase -= Math.floor(phase);
    }
  }
  const pcm = Buffer.alloc(mix.length * 2), volume = 10 ** (source.gain_db / 20);
  mix.forEach((value, n) => pcm.writeInt16LE(Math.round(value * volume * 32768), n * 2));
  return pcm;
}
test('WB-04 retains pre-upgrade bytes for sine, triangle, pulse and seeded noise', () => {
  for (const wave of ['sine', 'triangle', 'pulse', 'noise']) {
    const s = rendererSfxSource();
    Object.assign(s.instruments[0], { wave, gain_db: -23 });
    if (wave === 'pulse') s.instruments[0].pulse_width = 0.25;
    if (wave === 'noise') delete s.events[0].note;
    else s.events[0].slide_to_note = 60;
    assert.deepEqual(renderAudio(s, rendererSfxEntry, waveformPolicy).wav.subarray(44), preWB04Pcm(s), wave);
  }
});

test('WB-04 pluck, FM and saw are deterministic and produce different PCM', () => {
  const hashes = [];
  for (const wave of ['pluck', 'fm', 'saw']) {
    const s = rendererSfxSource();
    s.instruments[0].wave = wave;
    const a = renderAudio(s, rendererSfxEntry, waveformPolicy);
    assert.deepEqual(renderAudio(s, rendererSfxEntry, waveformPolicy).wav, a.wav);
    hashes.push(rendererSha(a.wav));
  }
  assert.equal(new Set(hashes).size, 3);
});

test('WB-04 rejects missing presets and invalid synthesis/effect parameters with field paths', () => {
  const changes = [
    [i => { i.preset = 'missing'; }, 'preset'],
    [i => { i.wave = 'pluck'; i.pluck_brightness = 1.01; }, 'pluck_brightness'],
    [i => { i.wave = 'pluck'; i.pluck_decay_ms = 0; }, 'pluck_decay_ms'],
    [i => { i.wave = 'fm'; i.fm_ratio = 0; }, 'fm_ratio'],
    [i => { i.wave = 'fm'; i.fm_depth = 13; }, 'fm_depth'],
    [i => { i.wave = 'fm'; i.fm_decay_ms = -1; }, 'fm_decay_ms'],
    [i => { i.vibrato_hz = 13; }, 'vibrato_hz'],
    [i => { i.vibrato_cents = 101; }, 'vibrato_cents'],
    [i => { i.vibrato_delay_ms = -1; }, 'vibrato_delay_ms'],
    [i => { i.breath = 0.51; }, 'breath'],
    [i => { i.wave = 'saw'; i.breath = 0.1; }, 'breath'],
    [i => { i.echo = { delay_ms: 0, feedback: 0.2, mix: 0.2 }; }, 'echo.delay_ms'],
    [i => { i.echo = { delay_ms: 100, feedback: 1, mix: 0.2 }; }, 'echo.feedback'],
    [i => { i.echo = { delay_ms: 100, feedback: 0.2, mix: NaN }; }, 'echo.mix'],
    [i => { i.echo = { delay_ms: 100, feedback: 0.2, mix: 0.2, file: 'x' }; }, 'echo.file']
  ];
  for (const [change, field] of changes) {
    const s = rendererSfxSource(); change(s.instruments[0]);
    assert.throws(() => validateSource(s, rendererSfxEntry, rendererPolicy),
      e => e.message.includes('sfx:push instruments[0].' + field), field);
  }
  for (const reverb of [{ size: 2, mix: 0.1 }, { size: 0.5, mix: -1 }, { size: 0.5, mix: 0.1, file: 'x' }]) {
    const s = rendererMusicSource(); s.reverb = reverb;
    assert.throws(() => validateSource(s, rendererMusicEntry, rendererPolicy), /music:jeju_b reverb\./);
  }
});

test('WB-04 presets expand with field overrides and affect sound identity', async () => {
  const { audioPresets } = await import('../tools/lib/audio.mjs');
  const presets = audioPresets();
  const required = ['guzheng', 'pipa', 'dizi', 'xiao', 'erhu', 'muyu', 'bangzi', 'bianzhong',
    'gayageum', 'harp', 'marimba', 'waves', 'glockenspiel', 'epiano', 'pad_strings', 'pluck_bass', 'brush', 'soft_kick'];
  for (const name of required) assert.ok(presets[name], name);
  const s = rendererSfxSource();
  const echo = { delay_ms: 115, feedback: 0.18, mix: 0 };
  s.instruments = [{ id: 'soft', preset: 'guzheng', gain_db: -20, lowpass_hz: 1700, release_ms: 25, echo }];
  const explicit = rendererCopy(s);
  explicit.instruments = [{ id: 'soft', ...presets.guzheng, gain_db: -20, lowpass_hz: 1700, release_ms: 25, echo }];
  assert.deepEqual(renderAudio(s, rendererSfxEntry, waveformPolicy).wav,
    renderAudio(explicit, rendererSfxEntry, waveformPolicy).wav);
  s.instruments[0].pluck_brightness = 0.15;
  assert.notEqual(sourceHash(s), sourceHash(explicit));
  assert.notDeepEqual(renderAudio(s, rendererSfxEntry, waveformPolicy).wav,
    renderAudio(explicit, rendererSfxEntry, waveformPolicy).wav);
});

test('WB-04 delayed vibrato leaves the opening unchanged and breath contributes measured noise', () => {
  for (const wave of ['sine', 'triangle', 'pulse', 'pluck', 'fm', 'saw']) {
    const s = rendererSfxSource(); s.instruments[0].wave = wave;
    if (wave === 'pulse') s.instruments[0].pulse_width = 0.5;
    const dry = renderAudio(s, rendererSfxEntry, waveformPolicy).wav;
    Object.assign(s.instruments[0], { vibrato_hz: 5, vibrato_cents: 30, vibrato_delay_ms: 50 });
    const wet = renderAudio(s, rendererSfxEntry, waveformPolicy).wav;
    assert.deepEqual(wet.subarray(44, 44 + 2400 * 2), dry.subarray(44, 44 + 2400 * 2));
    assert.notDeepEqual(wet, dry, wave);
  }
  const s = rendererSfxSource(); s.instruments[0].breath = 0.12;
  const a = renderAudio(s, rendererSfxEntry, waveformPolicy);
  assert.ok(a.metrics.noise_energy_ratio > 0);
  assert.deepEqual(renderAudio(s, rendererSfxEntry, waveformPolicy).wav, a.wav);
  s.seed++;
  assert.notDeepEqual(renderAudio(s, rendererSfxEntry, waveformPolicy).wav, a.wav);
});

test('WB-04 echo and reverb preserve audible previous-cycle tails and PCM seam limits', () => {
  const s = rendererMusicSource();
  s.instruments[0].gain_db = -21;
  s.instruments[0].echo = { delay_ms: 390, feedback: 0.45, mix: 0.15 };
  s.reverb = { size: 0.75, mix: 0.1 };
  const a = renderAudio(s, rendererMusicEntry, rendererPolicy);
  assert.ok(a.metrics.seam_value_delta <= 0.002);
  assert.ok(a.metrics.seam_slope_delta <= 0.002);
  assert.deepEqual(renderAudio(s, rendererMusicEntry, rendererPolicy).wav, a.wav);
  delete s.reverb; delete s.instruments[0].echo;
  assert.notDeepEqual(a.wav, renderAudio(s, rendererMusicEntry, rendererPolicy).wav);
});

test('WB-04 an echo longer than a short loop has an audible tail at the first sample', () => {
  const s = rendererSfxSource();
  Object.assign(s, { id: 'reel_spin', uid: 'sfx:reel_spin', duration_ms: 400, loop: true });
  Object.assign(s.instruments[0], { release_ms: 100, gain_db: -23 });
  Object.assign(s.events[0], { start_ms: 240, duration_ms: 50 });
  const entry = rendererCatalog.entries.find(e => e.uid === 'sfx:reel_spin');
  const dry = renderAudio(s, entry, waveformPolicy);
  assert.equal(dry.wav.readInt16LE(44), 0);
  s.instruments[0].echo = { delay_ms: 650, feedback: 0.7, mix: 0.3 };
  const wet = renderAudio(s, entry, waveformPolicy);
  assert.ok(Math.abs(wet.wav.readInt16LE(44)) > 10, 'previous cycles must reach sample zero');
  assert.ok(wet.metrics.seam_value_delta <= 0.002);
  assert.ok(wet.metrics.seam_slope_delta <= 0.002);
  assert.deepEqual(renderAudio(s, entry, waveformPolicy).wav, wet.wav);
});

test('WB-04 preset CLI creates deterministic short WAVs and concatenates exact half-second gaps', t => {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'wb04-presets-'));
  t.after(() => fs.rmSync(r, { recursive: true, force: true }));
  const first = run(r, ['presets', '--out', 'samples']);
  assert.match(first.stdout, /18/);
  const dir = path.join(r, 'samples'), names = fs.readdirSync(dir).filter(n => n.endsWith('.wav') && n !== 'all.wav');
  assert.equal(names.length, 18);
  const before = new Map(fs.readdirSync(dir).map(n => [n, fs.readFileSync(path.join(dir, n))]));
  run(r, ['presets', '--out', 'samples']);
  for (const [name, wav] of before) {
    assert.deepEqual(fs.readFileSync(path.join(dir, name)), wav);
    if (name !== 'all.wav') assert.ok(wav.readUInt32LE(40) / 88200 <= 5, name);
  }
  const all = before.get('all.wav');
  assert.equal(all.readUInt32LE(40), 18 * (before.get('guzheng.wav').length - 44) + 17 * 44100);
  const offset = 44 + before.get('guzheng.wav').length - 44;
  assert.ok(all.subarray(offset, offset + 44100).every(x => x === 0));
  assert.deepEqual(all.subarray(44, offset), before.get('guzheng.wav').subarray(44));
});
