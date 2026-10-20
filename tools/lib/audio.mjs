// Deterministic, dependency-free synthesis for the PORTITOR audio source format.
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

const RATE = 44100;
const COMMON = ['format', 'kind', 'id', 'uid', 'name', 'description', 'seed', 'engine', 'sample_rate', 'channels', 'version', 'content_hash', 'gain_db', 'instruments'];
const INSTRUMENT = ['id', 'preset', 'wave', 'pulse_width', 'gain_db', 'lowpass_hz', 'attack_ms', 'decay_ms', 'sustain', 'release_ms',
  'pluck_brightness', 'pluck_decay_ms', 'fm_ratio', 'fm_depth', 'fm_decay_ms', 'vibrato_hz', 'vibrato_cents', 'vibrato_delay_ms', 'breath', 'echo'];
const PRESETS = new URL('../../audio/presets.json', import.meta.url);
const EVENT = ['instrument', 'start_ms', 'duration_ms', 'note', 'slide_to_note', 'gain_db'];
const NOTE = ['beat', 'length', 'note', 'gain_db'];
const sha = value => createHash('sha256').update(value).digest('hex');
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const hz = note => 440 * 2 ** ((note - 69) / 12);
const gain = db => 10 ** (db / 20);
const db = amplitude => amplitude > 0 ? 20 * Math.log10(amplitude) : -Infinity;
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;

export function rendererFingerprint() {
  const bytes = readFileSync(new URL(import.meta.url));
  return sha(existsSync(PRESETS) ? Buffer.concat([bytes, Buffer.from('\n'), Buffer.from(JSON.stringify(canonical(audioPresets())))]) : bytes);
}
export function audioPresets() {
  if (!existsSync(PRESETS)) failure('audio', 'presets', 'preset library is missing');
  const library = JSON.parse(readFileSync(PRESETS, 'utf8'));
  record(library, ['format', 'presets'], 'audio', 'presets');
  equal(library.format, 'pushbox.audio-presets/1', 'audio', 'presets.format');
  if (!library.presets || typeof library.presets !== 'object' || Array.isArray(library.presets)) failure('audio', 'presets', 'must contain a presets object');
  for (const [name, value] of Object.entries(library.presets)) {
    if (!/^[a-z][a-z0-9_]*$/.test(name)) failure('audio', `presets.${name}`, 'invalid preset name');
    record(value, INSTRUMENT.filter(k => !['id', 'preset'].includes(k)), 'audio', `presets.${name}`);
  }
  return library.presets;
}
function resolveInstruments(source) {
  let presets;
  return { ...source, instruments: source.instruments.map((i, index) => {
    if (!i || !own(i, 'preset')) return i;
    presets ||= audioPresets();
    if (typeof i.preset !== 'string' || !own(presets, i.preset)) failure(source.uid, `instruments[${index}].preset`, 'unknown preset ' + String(i.preset));
    return { ...presets[i.preset], ...i };
  }) };
}
export function sourceHash(source, fingerprint = rendererFingerprint()) {
  const sound = Object.fromEntries(Object.entries(source).filter(([key]) => !['name', 'description', 'version', 'content_hash'].includes(key)));
  return sha(JSON.stringify(canonical({ source: sound, renderer_fingerprint: fingerprint, encoding: 'pcm_s16le', sample_rate: RATE, channels: 1 })));
}

function failure(uid, field, message) { throw new Error(`${uid} ${field}: ${message}`); }
function record(value, fields, uid, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) failure(uid, path, 'must be an object');
  for (const key of Object.keys(value)) if (!fields.includes(key)) failure(uid, path ? `${path}.${key}` : key, 'unknown field');
}
function numeric(value, min, max, uid, path, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) failure(uid, path, `must be ${integer ? 'an integer' : 'finite'} in [${min}, ${max}]`);
}
function text(value, uid, path) { if (typeof value !== 'string' || !value.trim()) failure(uid, path, 'must be a nonempty string'); }
function equal(value, expected, uid, path) { if (JSON.stringify(value) !== JSON.stringify(expected)) failure(uid, path, `must equal ${JSON.stringify(expected)}`); }
function list(value, uid, path, min = 1) { if (!Array.isArray(value) || value.length < min) failure(uid, path, `must be an array with at least ${min} item(s)`); }
function pitch(value, instrument, uid, path, policy) {
  if (instrument.wave === 'noise') { if (value !== undefined) failure(uid, path, 'noise must omit pitched notes'); return; }
  numeric(value, ...policy.note_midi_range, uid, path, true);
  numeric(hz(value), ...policy.metrics.fundamental_hz, uid, `${path}.fundamental_hz`);
  if (instrument.vibrato_hz && instrument.vibrato_cents) {
    const spread = 2 ** (instrument.vibrato_cents / 1200);
    numeric(hz(value) / spread, ...policy.metrics.fundamental_hz, uid, `${path}.vibrato_min_hz`);
    numeric(hz(value) * spread, ...policy.metrics.fundamental_hz, uid, `${path}.vibrato_max_hz`);
  }
}
function sourceEvents(source) {
  const instruments = new Map(source.instruments.map(i => [i.id, i]));
  if (source.kind === 'sfx') return source.events.map((e, index) => {
    const start = Math.round(e.start_ms * RATE / 1000);
    const gateEnd = Math.round((e.start_ms + e.duration_ms) * RATE / 1000);
    return { ...e, index, instrument: instruments.get(e.instrument), start, gate: gateEnd - start };
  });
  const beatSamples = RATE * 60 / source.bpm;
  return source.tracks.flatMap((track, ti) => track.notes.map((n, ni) => {
    const start = Math.round(n.beat * beatSamples);
    return { ...n, index: `${ti}:${ni}`, instrument: instruments.get(track.instrument), start, gate: Math.round((n.beat + n.length) * beatSamples) - start };
  }));
}
function sampleCount(source) { return source.kind === 'music' ? Math.round(RATE * source.bars * source.meter[0] * 60 / source.bpm) : Math.round(RATE * source.duration_ms / 1000); }
function voiceCounts(events, period, circular) {
  const points = []; let active = 0, pitched = 0;
  const add = (start, end, isPitched) => { points.push([start, 1, isPitched ? 1 : 0], [end, -1, isPitched ? -1 : 0]); };
  for (const e of events) {
    let duration = e.gate + Math.ceil(e.instrument.release_ms * RATE / 1000);
    const isPitched = e.instrument.wave !== 'noise';
    if (!circular) { add(e.start, e.start + duration, isPitched); continue; }
    const full = Math.floor(duration / period);
    active += full; if (isPitched) pitched += full;
    duration -= full * period;
    if (duration === 0) continue;
    const start = e.start % period, end = start + duration;
    if (end <= period) add(start, end, isPitched);
    else { add(start, period, isPitched); add(0, end - period, isPitched); }
  }
  let totalMax = active, pitchedMax = pitched;
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const [, delta, pitchDelta] of points) { active += delta; pitched += pitchDelta; totalMax = Math.max(totalMax, active); pitchedMax = Math.max(pitchedMax, pitched); }
  return { voice_max: totalMax, pitched_voice_max: pitchedMax };
}

export function validateSource(source, entry, policy) {
  const uid = entry?.uid || source?.uid || '(unknown audio uid)';
  const kind = entry?.kind || source?.kind;
  record(source, [...COMMON, ...(kind === 'music' ? ['set', 'bpm', 'meter', 'bars', 'mode', 'tracks', 'reverb'] : ['duration_ms', 'events', 'loop'])], uid, '');
  equal(source.format, 'pushbox.audio/1', uid, 'format');
  equal(source.engine, 'portitor-chip/1', uid, 'engine');
  if (!['sfx', 'music'].includes(kind)) failure(uid, 'kind', 'must be sfx or music');
  equal(source.kind, kind, uid, 'kind');
  equal(source.uid, entry.uid, uid, 'uid'); equal(source.id, entry.id, uid, 'id');
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(source.id)) failure(uid, 'id', 'invalid local identifier');
  text(source.name, uid, 'name');
  if (own(source, 'description') && typeof source.description !== 'string') failure(uid, 'description', 'must be a string');
  equal(source.sample_rate, RATE, uid, 'sample_rate'); equal(source.channels, 1, uid, 'channels');
  numeric(source.seed, 0, 0xffffffff, uid, 'seed', true);
  numeric(source.version, 0, Number.MAX_SAFE_INTEGER, uid, 'version', true);
  if (source.content_hash !== null && !/^[a-f0-9]{64}$/.test(source.content_hash || '')) failure(uid, 'content_hash', 'must be null or a SHA-256 digest');
  numeric(source.gain_db, -60, 0, uid, 'gain_db');
  list(source.instruments, uid, 'instruments');
  // Check authored fields before preset expansion, so overrides cannot hide typos.
  source.instruments.forEach((i, n) => record(i, INSTRUMENT, uid, `instruments[${n}]`));
  source = resolveInstruments(source);
  const instruments = new Map();
  source.instruments.forEach((i, index) => {
    const path = `instruments[${index}]`;
    record(i, INSTRUMENT, uid, path); text(i.id, uid, `${path}.id`);
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(i.id) || instruments.has(i.id)) failure(uid, `${path}.id`, 'invalid or duplicate instrument id');
    if (!['sine', 'triangle', 'pulse', 'noise', 'pluck', 'fm', 'saw'].includes(i.wave)) failure(uid, `${path}.wave`, 'unsupported waveform');
    if (i.wave === 'pulse') { if (![0.25, 0.5].includes(i.pulse_width)) failure(uid, `${path}.pulse_width`, 'must be 0.25 or 0.5'); }
    else if (own(i, 'pulse_width')) failure(uid, `${path}.pulse_width`, 'only allowed for pulse');
    numeric(i.gain_db, -60, 0, uid, `${path}.gain_db`);
    numeric(i.lowpass_hz, 200, Math.min(4000, policy.metrics.lowpass_hz_max), uid, `${path}.lowpass_hz`);
    numeric(i.attack_ms, 8, 200, uid, `${path}.attack_ms`);
    numeric(i.decay_ms, 0, 500, uid, `${path}.decay_ms`);
    numeric(i.sustain, 0, 1, uid, `${path}.sustain`);
    numeric(i.release_ms, 25, 1500, uid, `${path}.release_ms`);
    validateTone(i, uid, path);
    instruments.set(i.id, i);
  });
  if (own(source, 'reverb')) {
    record(source.reverb, ['size', 'mix'], uid, 'reverb');
    numeric(source.reverb.size, 0, 1, uid, 'reverb.size');
    numeric(source.reverb.mix, 0, 0.5, uid, 'reverb.mix');
  }
  const instrumentAt = (id, path) => { if (!instruments.has(id)) failure(uid, path, 'unknown instrument'); return instruments.get(id); };
  if (kind === 'sfx') {
    numeric(source.duration_ms, 0.01, Math.min(policy.sfx_duration_max_ms, entry.duration_ms), uid, 'duration_ms');
    if (own(source, 'loop')) { if (source.loop !== true || source.id !== 'reel_spin') failure(uid, 'loop', 'only reel_spin supports loop:true'); }
    if (source.id === 'reel_spin') equal(source.loop, true, uid, 'loop');
    list(source.events, uid, 'events');
    source.events.forEach((e, index) => {
      const path = `events[${index}]`;
      record(e, EVENT, uid, path);
      const i = instrumentAt(e.instrument, `${path}.instrument`);
      numeric(e.start_ms, 0, source.duration_ms, uid, `${path}.start_ms`);
      numeric(e.duration_ms, 0.001, source.duration_ms, uid, `${path}.duration_ms`);
      if (e.start_ms + e.duration_ms + i.release_ms > source.duration_ms + 1e-9) failure(uid, `${path}.duration_ms`, 'gate plus release exceeds file duration');
      pitch(e.note, i, uid, `${path}.note`, policy);
      if (own(e, 'slide_to_note')) { if (i.wave === 'noise') failure(uid, `${path}.slide_to_note`, 'noise cannot slide'); pitch(e.slide_to_note, i, uid, `${path}.slide_to_note`, policy); }
      numeric(e.gain_db, -60, 0, uid, `${path}.gain_db`);
    });
  } else {
    equal(source.set, entry.set, uid, 'set'); text(source.mode, uid, 'mode');
    numeric(source.bpm, ...policy.music_bpm_range, uid, 'bpm'); equal(source.bpm, entry.bpm, uid, 'bpm');
    equal(source.meter, policy.music_meter, uid, 'meter'); equal(source.meter, entry.meter, uid, 'meter');
    equal(source.bars, policy.music_bars, uid, 'bars'); equal(source.bars, entry.bars, uid, 'bars');
    list(source.tracks, uid, 'tracks');
    if (source.tracks.length > policy.music_track_limit) failure(uid, 'tracks', `exceeds ${policy.music_track_limit} tracks`);
    source.tracks.forEach((track, ti) => {
      const path = `tracks[${ti}]`; record(track, ['instrument', 'notes'], uid, path);
      const i = instrumentAt(track.instrument, `${path}.instrument`);
      list(track.notes, uid, `${path}.notes`, 0);
      track.notes.forEach((n, ni) => {
        const np = `${path}.notes[${ni}]`; record(n, NOTE, uid, np);
        numeric(n.beat, 0, 128 - 1 / 16, uid, `${np}.beat`);
        numeric(n.length, 1 / 16, Number.MAX_SAFE_INTEGER, uid, `${np}.length`);
        for (const field of ['beat', 'length']) if (!Number.isSafeInteger(n[field] * 16)) failure(uid, `${np}.${field}`, 'must use 1/16 beat precision');
        pitch(n.note, i, uid, `${np}.note`, policy); numeric(n.gain_db, -60, 0, uid, `${np}.gain_db`);
      });
    });
    const voices = voiceCounts(sourceEvents(source), sampleCount(source), true);
    if (voices.pitched_voice_max > policy.music_pitched_voice_limit) failure(uid, 'tracks.pitched_voice_max', `exceeds ${policy.music_pitched_voice_limit} simultaneous pitched voices including releases`);
    if (voices.voice_max > policy.music_track_limit) failure(uid, 'tracks.voice_max', `exceeds ${policy.music_track_limit} simultaneous voices including releases`);
  }
}

function validateTone(i, uid, path) {
  const optional = (key, min, max, waves) => {
    if (!own(i, key)) return;
    if (waves && !waves.includes(i.wave)) failure(uid, `${path}.${key}`, `only allowed for ${waves.join('/')}`);
    numeric(i[key], min, max, uid, `${path}.${key}`);
  };
  optional('pluck_brightness', 0, 1, ['pluck']); optional('pluck_decay_ms', 50, 8000, ['pluck']);
  optional('fm_ratio', 0.25, 16, ['fm']); optional('fm_depth', 0, 12, ['fm']); optional('fm_decay_ms', 1, 5000, ['fm']);
  for (const [key, max] of [['vibrato_hz', 12], ['vibrato_cents', 100], ['vibrato_delay_ms', 5000]]) {
    optional(key, 0, max, ['sine', 'triangle', 'pulse', 'pluck', 'fm', 'saw']);
  }
  optional('breath', 0, 0.5, ['sine', 'triangle']);
  if (own(i, 'echo')) {
    record(i.echo, ['delay_ms', 'feedback', 'mix'], uid, `${path}.echo`);
    numeric(i.echo.delay_ms, 1, 1500, uid, `${path}.echo.delay_ms`);
    numeric(i.echo.feedback, 0, 0.85, uid, `${path}.echo.feedback`);
    numeric(i.echo.mix, 0, 0.5, uid, `${path}.echo.mix`);
  }
}

function envelopeBeforeGate(age, instrument) {
  const a = instrument.attack_ms * RATE / 1000, d = instrument.decay_ms * RATE / 1000;
  if (age < a) return age / a;
  if (d > 0 && age < a + d) return 1 - (1 - instrument.sustain) * (age - a) / d;
  return instrument.sustain;
}
function renderVoice(mix, event, start, seed, energy, noiseMix = null) {
  const instrument = event.instrument, count = mix.length;
  const release = instrument.release_ms * RATE / 1000;
  const duration = event.gate + Math.ceil(release);
  const stop = Math.min(duration, count - start);
  const alpha = 1 - Math.exp(-2 * Math.PI * instrument.lowpass_hz / RATE);
  const volume = gain(instrument.gain_db + event.gain_db);
  const noteHz = instrument.wave === 'noise' ? 0 : hz(event.note);
  const slideHz = event.slide_to_note === undefined ? noteHz : hz(event.slide_to_note);
  const releaseLevel = envelopeBeforeGate(event.gate, instrument);
  let phase = 0, filtered = 0, random = seed || 1;
  const nextNoise = () => { random ^= random << 13; random ^= random >>> 17; random ^= random << 5; return (random >>> 0) / 2147483648 - 1; };
  const breath = instrument.breath || 0;
  const breathAlpha = 1 - Math.exp(-2 * Math.PI * Math.min(1200, instrument.lowpass_hz) / RATE);
  const vibrato = instrument.vibrato_hz && instrument.vibrato_cents;
  const vibratoStart = (instrument.vibrato_delay_ms || 0) * RATE / 1000;
  let modPhase = 0, air = 0, filteredAir = 0, string, write = 0, stringLow = 0, stringPrevious = 0, stringDc = 0;
  const brightness = 0.15 + 0.8 * (instrument.pluck_brightness ?? 0.6);
  if (instrument.wave === 'pluck') {
    const lowest = Math.min(noteHz, slideHz) / 2 ** (100 / 1200);
    string = new Float64Array(Math.ceil(RATE / lowest) + 8);
    let excitation = 0, sum = 0;
    for (let n = 0; n < string.length; n++) { excitation += brightness * (nextNoise() - excitation); string[n] = excitation; sum += excitation; }
    const mean = sum / string.length;
    for (let n = 0; n < string.length; n++) string[n] -= mean;
  }
  for (let age = 0; age < stop; age++) {
    let frequency = noteHz + (slideHz - noteHz) * Math.min(1, age / Math.max(1, event.gate));
    if (vibrato && age > vibratoStart) {
      const elapsed = age - vibratoStart, fade = Math.min(1, elapsed / (RATE * 0.1));
      frequency *= 2 ** (instrument.vibrato_cents * fade * Math.sin(2 * Math.PI * instrument.vibrato_hz * elapsed / RATE) / 1200);
    }
    let raw;
    if (instrument.wave === 'noise') { random ^= random << 13; random ^= random >>> 17; random ^= random << 5; raw = (random >>> 0) / 2147483648 - 1; }
    else if (instrument.wave === 'sine') raw = Math.sin(2 * Math.PI * phase);
    else if (instrument.wave === 'triangle') raw = 1 - 4 * Math.abs(phase - 0.5);
    else if (instrument.wave === 'saw') {
      // Polynomial BLEP smooths the discontinuity before the existing low-pass.
      const dt = frequency / RATE;
      let correction = 0;
      if (phase < dt) { const t = phase / dt; correction = t + t - t * t - 1; }
      else if (phase > 1 - dt) { const t = (phase - 1) / dt; correction = t * t + t + t + 1; }
      raw = 2 * phase - 1 - correction;
    }
    else if (instrument.wave === 'fm') {
      const depth = (instrument.fm_depth ?? 2) * Math.exp(-age / (RATE * (instrument.fm_decay_ms ?? 300) / 1000));
      raw = Math.sin(2 * Math.PI * phase + depth * Math.sin(2 * Math.PI * modPhase));
      modPhase += frequency * (instrument.fm_ratio ?? 2) / RATE; modPhase -= Math.floor(modPhase);
    }
    else if (instrument.wave === 'pluck') {
      // Fractional delay and filter phase compensation keep slides/vibrato tuned.
      const delay = RATE / frequency - (1 - brightness) / brightness;
      let read = (write - delay + string.length) % string.length;
      const left = Math.floor(read), fraction = read - left;
      raw = string[left] * (1 - fraction) + string[(left + 1) % string.length] * fraction;
      stringLow += brightness * (raw - stringLow);
      string[write] = stringLow * Math.exp(-Math.log(1000) * 1000 / (frequency * (instrument.pluck_decay_ms ?? 1800)));
      write = (write + 1) % string.length;
      const centered = raw - stringPrevious + 0.997 * stringDc;
      stringPrevious = raw; stringDc = centered; raw = centered;
    }
    else raw = phase < instrument.pulse_width ? 1 : -instrument.pulse_width / (1 - instrument.pulse_width);
    if (breath) {
      air += breathAlpha * (nextNoise() - air);
      const component = air * breath;
      raw = raw * (1 - breath) + component;
      filteredAir += alpha * (component - filteredAir);
    }
    filtered += alpha * (raw - filtered);
    const env = age < event.gate ? envelopeBeforeGate(age, instrument) : releaseLevel * Math.max(0, 1 - (age - event.gate) / release);
    const value = filtered * env * volume, position = start + age;
    if (position >= 0) {
      const noiseValue = instrument.wave === 'noise' ? value : filteredAir * env * volume;
      mix[position] += value; energy.total += value * value;
      if (instrument.wave === 'noise' || breath) energy.noise += noiseValue * noiseValue;
      if (noiseMix) noiseMix[position] += noiseValue;
    }
    phase += frequency / RATE; phase -= Math.floor(phase);
  }
}

function feedbackDelay(input, delay, feedback, circular) {
  const count = input.length, output = new Float64Array(count), line = new Float64Array(delay);
  // Always pre-render a complete loop. Long/high-feedback tails receive enough
  // additional cycles to put the remaining state error below 1e-10, far below PCM.
  const settling = feedback ? delay * Math.ceil(Math.log(1e-10) / Math.log(feedback)) : delay;
  const pre = circular ? Math.max(1, Math.ceil(settling / count)) * count : 0;
  let cursor = 0, sourceIndex = 0;
  for (let n = -pre; n < count; n++) {
    const delayed = line[cursor];
    line[cursor] = input[sourceIndex] + feedback * delayed;
    if (n >= 0) output[n] = delayed;
    cursor = (cursor + 1) % delay;
    sourceIndex++; if (sourceIndex === count) sourceIndex = 0;
  }
  return output;
}
function echoAudio(input, echo, circular) {
  if (!echo?.mix) return input;
  const wet = feedbackDelay(input, Math.max(1, Math.round(echo.delay_ms * RATE / 1000)), echo.feedback, circular);
  for (let n = 0; n < input.length; n++) wet[n] = input[n] * (1 - echo.mix) + wet[n] * echo.mix;
  return wet;
}
function reverbAudio(input, reverb, circular) {
  if (!reverb?.mix) return input;
  const output = new Float64Array(input.length), feedback = 0.35 + 0.4 * reverb.size;
  for (const time of [29.7, 37.1, 41.1, 43.7]) {
    const wet = feedbackDelay(input, Math.round(time * (0.5 + 1.5 * reverb.size) * RATE / 1000), feedback, circular);
    for (let n = 0; n < input.length; n++) output[n] += wet[n] * 0.25;
  }
  for (let n = 0; n < input.length; n++) output[n] = input[n] * (1 - reverb.mix) + output[n] * reverb.mix;
  return output;
}
function wavBuffer(pcm) {
  const wav = Buffer.alloc(44 + pcm.length * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(RATE, 24); wav.writeUInt32LE(RATE * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(pcm.length * 2, 40);
  for (let n = 0; n < pcm.length; n++) wav.writeInt16LE(pcm[n], 44 + n * 2);
  return wav;
}
function measure(pcm, source, voices, energy, policy) {
  const count = pcm.length, threshold = 0.001;
  let peak = 0, sum = 0, square = 0, first = -1, last = -1, run = 0, longest = 0, leading = 0, stillLeading = true;
  for (let n = 0; n < count; n++) {
    const x = pcm[n] / 32768, abs = Math.abs(x);
    peak = Math.max(peak, abs); sum += x; square += x * x;
    if (abs >= threshold) { if (first < 0) first = n; last = n; }
    if (pcm[n] === 0) { run++; longest = Math.max(longest, run); if (stillLeading) leading++; }
    else { run = 0; stillLeading = false; }
  }
  const circular = source.kind === 'music' || source.loop === true;
  if (circular) longest = Math.min(count, Math.max(longest, leading + run));
  let activeSquare = 0;
  if (first >= 0) for (let n = first; n <= last; n++) activeSquare += (pcm[n] / 32768) ** 2;
  const activeCount = first >= 0 ? last - first + 1 : 0;
  const m = { verified: true, sample_rate: RATE, channels: 1, bit_depth: 16, sample_count: count, duration_ms: count * 1000 / RATE,
    active_sample_count: activeCount, rms_dbfs: db(Math.sqrt(source.kind === 'sfx' ? activeSquare / Math.max(1, activeCount) : square / count)),
    full_rms_dbfs: db(Math.sqrt(square / count)), peak_dbfs: db(peak), dc_abs: Math.abs(sum / count), noise_energy_ratio: energy.total > 0 ? energy.noise / energy.total : 0,
    endpoint_start_abs: Math.abs(pcm[0] / 32768), endpoint_end_abs: Math.abs(pcm[count - 1] / 32768), longest_silence_ms: longest * 1000 / RATE,
    track_count: source.kind === 'music' ? source.tracks.length : source.events.length, ...voices };
  if (circular) {
    m.seam_value_delta = Math.abs((pcm[0] - pcm[count - 1]) / 32768);
    m.seam_slope_delta = Math.abs(((pcm[1] - pcm[0]) - (pcm[count - 1] - pcm[count - 2])) / 32768);
  }
  if (source.kind === 'music') {
    const window = Math.round(policy.metrics.music_window_seconds * RATE), step = Math.round(policy.metrics.music_window_step_seconds * RATE);
    const windows = [];
    let windowSquare = 0;
    for (let n = 0; n < Math.min(window, count); n++) windowSquare += (pcm[n] / 32768) ** 2;
    const lastStart = count - window;
    for (let start = 0; start <= lastStart; start += step) {
      if (start > 0) {
        for (let n = start - step; n < start; n++) windowSquare -= (pcm[n] / 32768) ** 2;
        for (let n = start + window - step; n < start + window; n++) windowSquare += (pcm[n] / 32768) ** 2;
      }
      const rms = db(Math.sqrt(Math.max(0, windowSquare) / window));
      if (rms >= policy.metrics.music_window_ignore_below_dbfs) windows.push(rms);
    }
    m.window_count = Math.floor(lastStart / step) + 1; m.window_non_silent_count = windows.length;
    m.window_rms_min_dbfs = windows.length ? Math.min(...windows) : null;
    m.window_rms_max_dbfs = windows.length ? Math.max(...windows) : null;
    m.window_rms_range_db = windows.length ? Math.max(...windows) - Math.min(...windows) : 0;
  }
  return m;
}
function assertMetrics(metrics, source, policy, issues = null) {
  const uid = source.uid, p = policy.metrics;
  const reject = (field, message) => { if (issues) issues.push(`${uid} ${field}: ${message}`); else failure(uid, field, message); };
  const max = (field, limit) => { if (!Number.isFinite(metrics[field]) || metrics[field] > limit + 1e-12) reject(`metrics.${field}`, `${metrics[field]} exceeds ${limit}`); };
  max('peak_dbfs', p.sample_peak_max_dbfs); max('noise_energy_ratio', p.noise_energy_ratio_max);
  const rms = source.kind === 'music' ? p.music_rms_dbfs : p.sfx_rms_dbfs;
  if (!Number.isFinite(metrics.rms_dbfs) || Math.abs(metrics.rms_dbfs - rms.target) > rms.tolerance + 1e-12) reject('metrics.rms_dbfs', `${metrics.rms_dbfs} outside ${rms.target} ± ${rms.tolerance}`);
  max('dc_abs', p.dc_abs_max);
  if (source.kind === 'music' || source.loop) { max('seam_value_delta', p.music_seam_value_delta_max); max('seam_slope_delta', p.music_seam_slope_delta_max); }
  else { max('endpoint_start_abs', p.sfx_endpoint_abs_max); max('endpoint_end_abs', p.sfx_endpoint_abs_max); }
  if (source.kind === 'music') {
    max('window_rms_range_db', p.music_window_rms_range_max_db);
    if (metrics.longest_silence_ms >= p.music_full_silence_max_ms) reject('metrics.longest_silence_ms', `must be less than ${p.music_full_silence_max_ms} ms`);
  }
}

function mixAudio(source) {
  const count = sampleCount(source), mix = new Float64Array(count), energy = { total: 0, noise: 0 };
  const events = sourceEvents(source), circular = source.kind === 'music' || source.loop === true;
  const voices = voiceCounts(events, count, circular);
  const effects = !!source.reverb?.mix || source.instruments.some(i => i.echo?.mix);
  const renderEvent = (event, ei, bus, busEnergy, noiseBus) => {
    const duration = event.gate + Math.ceil(event.instrument.release_ms * RATE / 1000);
    const seed = ((source.seed || 1) ^ Math.imul(ei, 0x9e3779b9)) >>> 0;
    if (!circular) renderVoice(bus, event, event.start, seed, busEnergy, noiseBus);
    else {
      // One complete pre-roll, plus every older note that still sustains into it.
      // Each absolute beat endpoint is rounded independently before scheduling.
      const firstCycle = Math.floor((-count - event.start - duration) / count) + 1;
      const lastCycle = Math.floor((count - 1 - event.start) / count);
      for (let cycle = firstCycle; cycle <= lastCycle; cycle++) renderVoice(bus, event, event.start + cycle * count, seed, busEnergy, noiseBus);
    }
  };
  if (!effects) events.forEach((event, ei) => renderEvent(event, ei, mix, energy));
  else for (const instrument of source.instruments) {
    const bus = new Float64Array(count), noiseBus = instrument.wave === 'noise' || instrument.breath ? new Float64Array(count) : null;
    const unusedEnergy = { total: 0, noise: 0 };
    events.forEach((event, ei) => { if (event.instrument.id === instrument.id) renderEvent(event, ei, bus, unusedEnergy, noiseBus); });
    const processed = reverbAudio(echoAudio(bus, instrument.echo, circular), source.reverb, circular);
    const processedNoise = noiseBus && reverbAudio(echoAudio(noiseBus, instrument.echo, circular), source.reverb, circular);
    for (let n = 0; n < count; n++) {
      mix[n] += processed[n]; energy.total += processed[n] * processed[n];
      if (processedNoise) energy.noise += processedNoise[n] * processedNoise[n];
    }
  }
  return { mix, energy, voices };
}
function quantize(mix, source) {
  const count = mix.length;
  const pcm = new Int16Array(count), volume = gain(source.gain_db);
  for (let n = 0; n < count; n++) {
    const x = mix[n] * volume;
    if (!Number.isFinite(x)) failure(source.uid, `metrics.samples[${n}]`, 'non-finite sample');
    if (x > 32767 / 32768 || x < -1) failure(source.uid, 'metrics.clipping', `sample ${n} exceeds PCM range`);
    pcm[n] = Math.round(x * 32768);
  }
  return pcm;
}
export function renderAudio(source, entry, policy) {
  validateSource(source, entry, policy);
  source = resolveInstruments(source);
  const { mix, energy, voices } = mixAudio(source), pcm = quantize(mix, source);
  const metrics = measure(pcm, source, voices, energy, policy);
  assertMetrics(metrics, source, policy);
  return { wav: wavBuffer(pcm), metrics };
}

// Auditions are neither catalog SFX nor 32-bar music. They share the exact voice,
// effect and PCM code, validate instruments, and report the unchanged safety rules.
export function renderPresetPreview(name, policy) {
  const presets = audioPresets();
  if (!own(presets, name)) failure('audio', 'preset', 'unknown preset ' + name);
  const instrument = { ...presets[name], id: 'demo' };
  const source = { format: 'pushbox.audio/1', engine: 'portitor-chip/1', kind: 'sfx', id: `preset_${name}`, uid: `preview:${name}`,
    name, seed: 170004, sample_rate: RATE, channels: 1, version: 0, content_hash: null, gain_db: 0,
    instruments: [instrument], duration_ms: 1600, events: [{ instrument: 'demo', start_ms: 0, duration_ms: 1,
      ...(instrument.wave === 'noise' ? {} : { note: 57 }), gain_db: 0 }] };
  validateSource(source, { id: source.id, uid: source.uid, kind: 'sfx', duration_ms: 1600 }, policy);
  source.duration_ms = 4800;
  const percussion = ['muyu', 'bangzi', 'marimba', 'brush', 'soft_kick'].includes(name);
  if (percussion) source.events = [0, 450, 900, 1350, 1800, 2475, 2700, 3150].map((start_ms, n) => ({
    instrument: 'demo', start_ms, duration_ms: name === 'marimba' ? 200 : 100, gain_db: n % 2 ? -3 : 0,
    ...(instrument.wave === 'noise' ? {} : { note: name === 'soft_kick' ? 48 : name === 'marimba' ? [57, 60, 64, 60][n % 4] : 64 }),
    ...(name === 'soft_kick' ? { slide_to_note: 36 } : {}) }));
  else if (name === 'waves') source.events = [0, 1400, 2800].map(start_ms => ({ instrument: 'demo', start_ms, duration_ms: 800, gain_db: 0 }));
  else source.events = [57, 60, 64, 69, 64].map((note, n) => ({ instrument: 'demo', start_ms: n * 600,
    duration_ms: n === 4 ? 750 : 500, note: note - (name === 'pluck_bass' ? 12 : 0), gain_db: 0 }));
  const { mix, energy, voices } = mixAudio(source);
  // A visible, offline demonstration gain, never a player-side normalization.
  // Start from unity instrument gain so quiet presets can be compared fairly.
  let square = 0, peak = 0;
  for (const x of mix) { square += x * x; peak = Math.max(peak, Math.abs(x)); }
  const target = policy.metrics.sfx_rms_dbfs.target;
  source.gain_db = Math.min(0, target - db(Math.sqrt(square / mix.length)), policy.metrics.sample_peak_max_dbfs - 0.1 - db(peak));
  const pcm = quantize(mix, source), metrics = measure(pcm, source, voices, energy, policy), issues = [];
  assertMetrics(metrics, source, policy, issues);
  metrics.verified = issues.length === 0;
  return { wav: wavBuffer(pcm), metrics, issues, gain_db: source.gain_db };
}

export function joinAudioPreviews(wavs) {
  const gap = new Int16Array(RATE / 2), count = wavs.reduce((n, w) => n + (w.length - 44) / 2, 0) + gap.length * Math.max(0, wavs.length - 1);
  const pcm = new Int16Array(count); let offset = 0;
  wavs.forEach((wav, index) => {
    for (let n = 44; n < wav.length; n += 2) pcm[offset++] = wav.readInt16LE(n);
    if (index < wavs.length - 1) offset += gap.length;
  });
  return wavBuffer(pcm);
}
