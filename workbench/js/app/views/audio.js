/* WB-02 audio monitor. PB_AUDIO is generated; browser wishes never mutate it.
 * HTML media loads local WAVs directly, so this view also works on file://. */
(function (root) {
  "use strict";
  const store = root.PBStore, data = store.audio(), catalog = data.catalog || {};
  const entries = data.entries || [], sets = catalog.music_sets || [], routes = catalog.routes || {};
  const byUid = new Map(entries.map(e => [e.uid, e]));
  const h = root.PBStage.el, prefs = store.audioPrefs();
  const text = (key, args) => {
    const locale = store.pref("locale", "zh-Hans");
    const tables = data.i18n || {}, table = (tables[locale] || tables["zh-Hans"] || {})["audio.dom"] || {};
    return String(table[key] || key).replace(/\{(\w+)\}/g, (_, k) => args && args[k] != null ? args[k] : "");
  };
  const clamp = v => Number.isFinite(Number(v)) ? Math.max(0, Math.min(1, Number(v))) : 0.8;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const identity = r => r ? [r.uid, r.version, r.hash].join("/") : "";
  const resource = e => e && e.current ? Object.assign({ uid: e.uid }, e.current) : null;
  const seconds = current => Number((current && current.metrics || {}).duration_ms || 0) / 1000;
  const mediaURL = wav => new URL("../" + wav, location.href.split("#")[0]).href;
  let active = false, mode = "sfx", tick = null, message = "";
  function status(value) { message = value; const el = document.getElementById("audio-status"); if (el) el.textContent = value; }

  // The engine exposes its monitor state for deterministic browser verification.
  // No game state or import path is changed by this monitor.
  const player = (() => {
    let generation = 0, audition = 0, serial = Promise.resolve(), gainTimer = null, duckFade = null;
    let music = [], sfx = [], transition = null, transitionGeneration = -1, desired = null, selected = null, stopping = null;
    const last = new Map(), cancelledUids = new Map(), overlays = new Set();
    let ducked = false;
    const volume = { master: clamp(prefs.master ?? .8), music: clamp(prefs.music ?? .8), sfx: clamp(prefs.sfx ?? .8), muted: prefs.muted === true };
    function duckGain() {
      if (!duckFade) return ducked ? Math.pow(10, -9 / 20) : 1;
      const amount = Math.min(1, (performance.now() - duckFade.start) / 200);
      const value = duckFade.from + (duckFade.to - duckFade.from) * amount;
      if (amount === 1) duckFade = null;
      return value;
    }
    const gain = kind => volume.muted ? 0 : volume.master * volume[kind] * (kind === "sfx" ? Math.pow(10, -6 / 20) : duckGain());
    // Native HTMLAudioElement volume is essential on file://: connecting local
    // media to MediaElementAudioSource can return CORS-silenced PCM. Linear
    // monitor fades use one timer for all media, without local fetch or a server.
    function weight(v) {
      if (!v.fade) return v.weight;
      const amount = Math.min(1, (performance.now() - v.fade.start) / v.fade.ms);
      const value = v.fade.from + (v.fade.to - v.fade.from) * amount;
      if (amount === 1) { v.weight = v.fade.to; v.fade = null; }
      return value;
    }
    function applyGain(v) { if (!v.released) v.media.volume = Math.max(0, Math.min(1, gain(v.kind) * weight(v))); }
    function mix(v, target, ms) {
      if (v.released) return;
      const from = weight(v);
      v.fade = ms ? { from, to: target, start: performance.now(), ms } : null;
      if (!ms) v.weight = target;
      applyGain(v);
    }
    function cleanup(v) {
      if (v.released) return;
      v.released = true;
      clearTimeout(v.timer);
      v.media.pause(); v.media.removeAttribute("src"); v.media.load();
      music = music.filter(x => x !== v); sfx = sfx.filter(x => x !== v);
      if (!music.length && !sfx.length) { clearInterval(gainTimer); gainTimer = null; }
    }
    async function release(v, ms) {
      if (v.released) return;
      if (v.releasePromise) return v.releasePromise;
      v.releasing = true; mix(v, 0, ms);
      v.releasePromise = (async () => { if (ms) await wait(ms); cleanup(v); })();
      return v.releasePromise;
    }
    async function create(r, kind, opts) {
      opts = opts || {};
      const media = new root.Audio(mediaURL(r.wav));
      media.preload = "metadata"; media.loop = !!opts.loop;
      const v = { uid: r.uid, version: r.version, hash: r.hash, media, kind, priority: opts.priority || 0, born: performance.now(), weight: opts.weight ?? 1, releasing: false, released: false, duration: opts.duration || 0 };
      (kind === "music" ? music : sfx).push(v); mix(v, v.weight, 0);
      if (!gainTimer) gainTimer = setInterval(() => { for (const voice of music.concat(sfx)) applyGain(voice); }, 16);
      media.addEventListener("ended", () => {
        if (v.seam && v.seam.part === "tail" && !v.released) {
          v.media.currentTime = 0; v.seam.part = "head";
          v.media.play().catch(() => cleanup(v));
        } else if (!media.loop && !v.seam) cleanup(v);
      });
      media.addEventListener("error", () => { cleanup(v); status(text("error", { error: r.uid })); });
      try { await media.play(); } catch (err) { cleanup(v); throw err; }
      return v;
    }
    async function stopMusic(ms) { desired = null; selected = null; await Promise.all(music.slice().map(v => release(v, ms || 0))); }
    function stopAll() {
      if (stopping) return stopping;
      generation++; audition++; desired = null; selected = null;
      stopping = Promise.all(music.concat(sfx).map(v => release(v, v.uid === "sfx:reel_spin" ? 80 : 0)))
        .then(() => { status(text("stopped")); }).finally(() => { stopping = null; });
      return stopping;
    }
    async function close() { await stopAll(); }
    function setVolumes(next) {
      for (const key of ["master", "music", "sfx"]) if (key in next) { volume[key] = clamp(next[key]); store.setAudioPref(key, volume[key]); }
      if ("muted" in next) { volume.muted = !!next.muted; store.setAudioPref("muted", volume.muted); }
      for (const v of music.concat(sfx)) applyGain(v);
    }
    function setDucked(on) { const from = duckGain(); ducked = !!on; duckFade = { from, to: ducked ? Math.pow(10, -9 / 20) : 1, start: performance.now() }; }
    function setOverlay(key, on) { if (on) overlays.add(key); else overlays.delete(key); setDucked(overlays.size > 0); }
    async function playPreview(uid, options) {
      const e = byUid.get(uid), r = resource(e); if (!r || gain("music") === 0 || stopping) return false;
      options = options || {};
      const request = ++audition, epoch = generation;
      // Changing audition kind also cancels sfx still awaiting a free slot/fade.
      for (const entry of entries) if (entry.kind === "sfx") cancelledUids.set(entry.uid, (cancelledUids.get(entry.uid) || 0) + 1);
      await stopMusic(100);
      // A more recent click takes precedence, even while the old stream releases.
      if (request !== audition || epoch !== generation || gain("music") === 0) return false;
      await Promise.all(sfx.slice().map(v => release(v, v.uid === "sfx:reel_spin" ? 80 : 0)));
      if (request !== audition || epoch !== generation || gain("music") === 0) return false;
      const v = await create(r, "music", { loop: options.loop !== false, duration: seconds(e.current) });
      if (request !== audition || epoch !== generation) { cleanup(v); return false; }
      if (options.seam) {
        v.seam = { cycle: 0, part: "tail" }; v.media.loop = false;
        const position = Math.max(0, v.duration - 2);
        v.media.currentTime = position;
        v.media.addEventListener("loadedmetadata", () => { if (!v.released) v.media.currentTime = position; });
      }
      status(text("playing", { uid })); return true;
    }
    async function playSfx(uid) {
      const epoch = generation, uidGeneration = cancelledUids.get(uid) || 0, e = byUid.get(uid), r = resource(e);
      const currentRequest = () => epoch === generation && uidGeneration === (cancelledUids.get(uid) || 0);
      if (!r || gain("sfx") === 0 || stopping) return false;
      // Admission uses event time, before waiting for any fade. Fast repeats
      // are ignored here rather than queued until their interval elapses.
      const now = performance.now();
      if (now - (last.get(uid) ?? -Infinity) < (e.min_interval_ms || 0)) return false;
      if (["sfx:animal_hint", "sfx:feed_snack"].includes(uid)) {
        const other = uid === "sfx:animal_hint" ? "sfx:feed_snack" : "sfx:animal_hint";
        if (now - (last.get(other) ?? -Infinity) < 500) return false;
      }
      last.set(uid, now); audition++;
      const operation = async () => {
        if (gain("sfx") === 0 || !currentRequest()) return false;
        await stopMusic(100);
        if (!currentRequest() || gain("sfx") === 0) return false;
        if (uid === "sfx:reel_spin") {
          await Promise.all(sfx.filter(v => v.uid === uid).map(v => release(v, 80)));
          if (!currentRequest() || gain("sfx") === 0) return false;
        } else if (sfx.filter(v => v.uid === uid).length >= (e.max_instances || 1)) return false;
        if (sfx.length >= 3) {
          const victim = sfx.slice().sort((a, b) => a.priority - b.priority || a.born - b.born)[0];
          if ((e.priority || 0) < victim.priority) return false;
          await release(victim, 25); // The releasing voice still occupies its slot.
        }
        if (!currentRequest() || gain("sfx") === 0) return false;
        const v = await create(r, "sfx", { priority: e.priority, loop: e.loop, duration: seconds(e.current) });
        if (!currentRequest()) { cleanup(v); return false; }
        const lifetime = e.loop ? Math.min(e.max_play_ms || 2000, 2000) : Math.max(e.duration_ms || 0, v.duration * 1000);
        v.timer = setTimeout(() => release(v, e.loop ? 80 : 0), Math.max(0, lifetime - (e.loop ? 80 : 0)));
        status(text("playing", { uid })); return true;
      };
      const next = serial.then(operation, operation); serial = next.catch(() => false); return next;
    }
    function pause(uid) { const v = music.find(v => v.uid === uid); if (v) { v.media.pause(); status(text("paused", { uid })); } }
    async function resume(uid, options) {
      const v = music.find(v => v.uid === uid);
      if (v) { if (!gain("music")) return false; if (options && "loop" in options) v.media.loop = options.loop; await v.media.play(); status(text("playing", { uid })); return true; }
      return playPreview(uid, options);
    }
    async function restart(uid, options) {
      const v = music.find(v => v.uid === uid);
      if (v) { v.seam = null; v.media.currentTime = 0; return resume(uid, options); }
      return playPreview(uid, options);
    }
    function loop(uid, on) { const v = music.find(v => v.uid === uid); if (v) { v.media.loop = on; v.seam = null; } }
    async function stopUid(uid) {
      audition++;
      cancelledUids.set(uid, (cancelledUids.get(uid) || 0) + 1);
      await Promise.all(music.concat(sfx).filter(v => v.uid === uid).map(v => release(v, uid === "sfx:reel_spin" ? 80 : 25)));
      status(text("stopped"));
    }
    // Route-model monitor: same locked result continues; active fades coalesce to
    // the most recent target. A transition can own at most old + new streams.
    function requestMusic(r) {
      if (stopping) return Promise.resolve(false);
      desired = r;
      if (transition && transitionGeneration === generation) return transition;
      if (identity(selected) === identity(r)) return Promise.resolve();
      const epoch = generation;
      transitionGeneration = epoch;
      transition = (async () => {
        do {
          const target = desired;
          if (identity(selected) === identity(target)) break;
          const old = music.slice();
          let next = null;
          if (target && gain("music") > 0) next = await create(target, "music", { loop: true, weight: 0 });
          if (epoch !== generation) { if (next) cleanup(next); break; }
          for (const v of old) mix(v, 0, 1000);
          if (next) mix(next, 1, 1000);
          await wait(1000);
          for (const v of old) cleanup(v);
          if (epoch !== generation) { if (next) cleanup(next); break; }
          selected = target;
        } while (epoch === generation && identity(desired) !== identity(selected));
      })().finally(() => { if (transitionGeneration === epoch) transition = null; });
      return transition;
    }
    function step() {
      for (const v of music.slice()) {
        if (!v.seam || (v.media.paused && !v.media.ended)) continue;
        const duration = Number.isFinite(v.media.duration) ? v.media.duration : v.duration;
        if (v.seam.part === "tail" && (v.media.currentTime >= duration - .035 || v.media.ended)) { v.media.currentTime = 0; v.seam.part = "head"; v.media.play().catch(() => cleanup(v)); }
        else if (v.seam.part === "head" && v.media.currentTime >= 2) {
          v.seam.cycle++;
          if (v.seam.cycle >= 3) cleanup(v);
          else { v.media.currentTime = Math.max(0, duration - 2); v.seam.part = "tail"; }
        }
      }
    }
    return { playPreview, playSfx, pause, resume, restart, loop, stopUid, stopAll, close, setVolumes, setDucked, setOverlay, requestMusic, step,
      snapshot: () => ({ music: music.slice(), sfx: sfx.slice(), volumes: Object.assign({}, volume), ducked }) };
  })();

  function resolve(ctx) {
    ctx = ctx || {};
    const fallback = catalog.policy && catalog.policy.default_music_uid || "music:dungeon";
    let requested = fallback;
    if (ctx.slice) {
      const slice = (data.slices || store.catalog("slices")).find(e => e.id === ctx.slice);
      requested = (routes.delivery || {}).slice_to_music?.[ctx.slice] || (routes.world_to_music || {})[slice && slice.world] || fallback;
    } else if (ctx.chapter) requested = (routes.chapter_to_music || {})[ctx.chapter] || fallback;
    else if (ctx.group) {
      const group = (data.groups || store.catalog("groups")).find(e => e.id === ctx.group);
      const chapter = group && group.theme ? group.theme.replace(/^theme\./, "") : (routes.group_to_chapter || {})[ctx.group];
      requested = (routes.chapter_to_music || {})[chapter] || fallback;
    } else if (ctx.world) requested = (routes.world_to_music || {})[ctx.world] || fallback;
    const bindings = data.bindings || {};
    const result = bindings[requested] || bindings[fallback] || null;
    return { requested, resource: result, fallback: !!result && !bindings[requested], reason: !result ? text("silent_reason") : bindings[requested] ? text("direct") : text("fallback") };
  }
  function currentApproved(e) {
    return !!e.current && (e.approved || []).some(a => a.version === e.current.version && a.hash === e.current.hash && (a.sha256 || a.wav_sha256) === e.current.sha256);
  }
  const currentItem = e => ({ uid: e.uid, version: e.current.version, hash: e.current.hash, wav_sha256: e.current.sha256 });
  function approvalRequest() {
    const items = new Map(), selections = [];
    for (const item of Object.values(store.audioRequested())) {
      const e = byUid.get(item.uid);
      if (e && e.current && e.current.version === item.version && e.current.hash === item.hash && e.current.sha256 === item.wav_sha256) items.set(item.uid, item);
    }
    for (const set of sets) {
      const draft = store.audioDrafts()[set.uid];
      if (!draft) continue;
      const e = byUid.get(draft.uid);
      if (!e || !e.current || e.current.version !== draft.version || e.current.hash !== draft.hash) continue;
      items.set(e.uid, currentItem(e));
      selections.push({ set_uid: set.uid, uid: draft.uid, version: draft.version, hash: draft.hash });
    }
    const request = { format: "pushbox.audio-approval-request/1", items: [...items.values()], selections };
    const lines = [text("request_note")];
    for (const item of request.items) lines.push(text("quality_line", Object.assign({ sha: item.wav_sha256 }, item)));
    for (const item of selections) lines.push(text("selection_line", Object.assign({ set: item.set_uid }, item)));
    request.note = lines.join("\n"); return request;
  }
  async function action(fn) { try { await fn(); } catch (err) { status(text("error", { error: err.message })); } }
  function button(key, fn, attrs) { return h("button", Object.assign({ type: "button", class: "btn small", text: text(key), "data-action": key, onclick: () => action(fn) }, attrs)); }
  function requestArea() {
    const copy = async () => {
      const request = approvalRequest(); if (!request.items.length && !request.selections.length) { status(text("request_empty")); return; }
      const value = request.note + "\n\n" + JSON.stringify(request, null, 2);
      const field = document.getElementById("audio-request-text"); field.value = value; field.hidden = false;
      try { await navigator.clipboard.writeText(value); status(text("copied")); } catch (_) { field.focus(); field.select(); status(text("copy_manual")); }
    };
    return h("section", { class: "audio-request" }, [h("h3", { text: text("request_heading") }), h("p", { text: text("request_help") }),
      h("div", { class: "audio-actions" }, [button("copy", copy, { "data-action": "request-copy" }), button("download", () => {
        const request = approvalRequest(); if (!request.items.length && !request.selections.length) { status(text("request_empty")); return; }
        root.PBMain.download("audio-approval-request.json", JSON.stringify(request, null, 2) + "\n");
      }, { "data-action": "request-download" })]), h("textarea", { id: "audio-request-text", hidden: true, readonly: true, "aria-label": text("request_heading") })]);
  }
  function volumeControls() {
    const values = player.snapshot().volumes;
    const box = h("div", { class: "audio-monitor" });
    for (const key of ["master", "music", "sfx"]) {
      const value = h("output", { text: Math.round(values[key] * 100) + "%", for: "audio-volume-" + key });
      const input = h("input", { type: "range", min: 0, max: 100, step: 1, value: Math.round(values[key] * 100), id: "audio-volume-" + key, "aria-label": text(key),
        oninput: ev => { const next = Number(ev.target.value) / 100; player.setVolumes({ [key]: next }); value.textContent = Math.round(next * 100) + "%"; if (!player.snapshot().music.length && key === "music") status(text("idle")); },
        onchange: () => {
          if (key === "music") return;
          const v = player.snapshot().volumes;
          if (v.muted || !v.master || !v.sfx) return;
          if (!byUid.get("sfx:volume_preview")?.current) { status(text("preview_missing")); return; }
          action(() => player.playSfx("sfx:volume_preview"));
        } });
      box.append(h("label", { class: "audio-slider" }, [h("span", { text: text(key) }), input, value]));
    }
    box.append(h("label", { class: "audio-toggle" }, [h("input", { type: "checkbox", checked: values.muted, id: "audio-mute", onchange: ev => player.setVolumes({ muted: ev.target.checked }) }), text("mute")]), button("stop", () => player.stopAll(), { "data-action": "stop-all" }));
    return box;
  }
  function meta(e) {
    const c = e.current, m = c && c.metrics || {}, dur = seconds(c) || (e.duration_ms ? e.duration_ms / 1000 : 0);
    const dl = h("dl", { class: "audio-meta" });
    for (const [key, value] of [[text("duration"), dur ? dur.toFixed(2) + " s" : text("none")], ["RMS", Number.isFinite(m.rms_dbfs) ? m.rms_dbfs.toFixed(2) + " dBFS" : text("none")], ["Peak", Number.isFinite(m.peak_dbfs) ? m.peak_dbfs.toFixed(2) + " dBFS" : text("none")], [text("version"), c ? "v" + c.version + " · " + c.hash : text("none")]]) dl.append(h("dt", { text: key }), h("dd", { text: value }));
    return dl;
  }
  function wish(set, e) {
    store.setAudioDraft(set.uid, { uid: e.uid, version: e.current.version, hash: e.current.hash, wav_sha256: e.current.sha256 });
    for (const label of document.querySelectorAll('[data-wish="' + set.uid + '"]')) label.textContent = text("wish_label", { uid: e.uid, version: e.current.version });
    for (const select of document.querySelectorAll('[data-set-wish="' + set.uid + '"]')) select.value = e.uid;
  }
  function wishLabel(set) {
    const draft = store.audioDrafts()[set.uid], e = draft && byUid.get(draft.uid);
    const valid = e && e.current && e.current.version === draft.version && e.current.hash === draft.hash;
    return h("p", { class: "audio-wish", "data-wish": set.uid, text: draft ? valid ? text("wish_label", draft) : text("stale") : text("no_wish") });
  }
  function card(e, set) {
    const c = e.current, available = !!c;
    const box = h("article", { class: "audio-card" + (!available ? " is-missing" : ""), "data-uid": e.uid, "data-kind": e.kind });
    box.append(h("h3", { text: e.name }), h("code", { text: e.uid }), h("p", { class: "audio-state", text: !available ? text("missing") : currentApproved(e) ? text("approved") : text("review") }));
    if (e.kind === "music") box.append(h("p", { text: e.bpm + " BPM · " + e.mode }), h("p", { class: "small muted", text: e.theme || "" }));
    box.append(meta(e));
    const actions = h("div", { class: "audio-actions" });
    actions.append(button("play", () => e.kind === "music" ? player.resume(e.uid, { loop: box.querySelector('[data-action="loop"]').checked }) : player.playSfx(e.uid), { disabled: !available }));
    if (e.kind === "music") {
      actions.append(button("pause", () => player.pause(e.uid), { disabled: !available }), button("restart", () => player.restart(e.uid, { loop: box.querySelector('[data-action="loop"]').checked }), { disabled: !available }));
      const loop = h("input", { type: "checkbox", checked: true, "data-action": "loop", disabled: !available, onchange: ev => player.loop(e.uid, ev.target.checked) });
      actions.append(h("label", { class: "audio-toggle" }, [loop, text("loop")]), button("seam", () => player.playPreview(e.uid, { seam: true }), { disabled: !available }));
      box.append(h("div", { class: "audio-timeline" }, [h("progress", { max: 1, value: 0, "data-position": e.uid, "aria-label": text("position") }), h("span", { class: "audio-seam", text: text("seam_marker") }), h("output", { "data-time": e.uid, text: "0:00" })]));
    }
    actions.append(button("stop", () => player.stopUid(e.uid), { disabled: !available })); box.append(actions);
    if (set) box.append(button("wish", () => wish(set, e), { disabled: !available, "data-action": "wish" }));
    if (available) box.append(h("label", { class: "audio-request-item" }, [h("input", { type: "checkbox", checked: store.audioRequested()[e.uid]?.hash === c.hash, "data-action": "quality", onchange: ev => store.setAudioRequested(e.uid, ev.target.checked ? currentItem(e) : null) }), text("request_item")]));
    return box;
  }
  function sfxPage(work) {
    const delivery = new Set(["cargo_damage", "reel_spin", "reel_stop", "reroll", "shop_buy", "feed_snack", "animal_hint", "delivery_arrive"]);
    const ui = new Set(["undo", "restart", "hint_show", "rule_card", "ui_move", "ui_confirm", "ui_back", "menu_open", "menu_close", "blocked", "volume_preview"]);
    for (const key of ["level", "delivery", "interface"]) {
      const group = entries.filter(e => e.kind === "sfx" && (key === "delivery" ? delivery.has(e.id) : key === "interface" ? ui.has(e.id) : !delivery.has(e.id) && !ui.has(e.id)));
      work.append(h("h2", { text: text(key) }), h("div", { class: "audio-sfx-grid" }, group.map(e => card(e))));
    }
  }
  function musicPage(work) {
    for (const set of sets) {
      const group = (set.candidates || []).map(uid => byUid.get(uid)).filter(Boolean);
      work.append(h("section", { class: "audio-set", "data-set": set.uid }, [h("h2", { text: set.name + " · " + group.filter(e => e.current).length + "/" + group.length }), wishLabel(set), h("div", { class: "audio-candidates" }, group.map(e => card(e, set)))]));
    }
  }
  function mapsPage(work) {
    const slices = (data.slices || store.catalog("slices")).slice();
    if (!slices.some(e => e.id === "jeju_1")) slices.push({ id: "jeju_1", name: text("pending_jeju"), _pending: true });
    slices.push({ id: "__unknown__", name: text("unknown") });
    const table = h("table", { class: "audio-maps grid" });
    table.append(h("thead", {}, [h("tr", {}, ["map", "requested", "actual", "candidates", "no_wish", "reason"].map(key => h("th", { text: text(key) })))]));
    const body = h("tbody");
    for (const slice of slices) {
      const result = resolve({ slice: slice.id }), set = sets.find(e => e.uid === result.requested);
      const binding = (data.bindings || {})[result.requested];
      const list = set ? set.candidates.map(uid => byUid.get(uid)).filter(Boolean) : [];
      const select = h("select", { "data-set-wish": set && set.uid, "aria-label": slice.id + " " + text("wish"), onchange: ev => { const e = byUid.get(ev.target.value); if (e) wish(set, e); } }, [h("option", { value: "", text: text("no_wish") })].concat(list.map(e => h("option", { value: e.uid, disabled: !e.current, text: e.uid + (e.current ? "@v" + e.current.version : " · " + text("missing")) }))));
      const draft = set && store.audioDrafts()[set.uid]; if (draft) select.value = draft.uid;
      const wanted = set ? h("div", {}, [select, wishLabel(set)]) : h("span", { text: text("no_wish") });
      const current = binding && byUid.get(binding.uid)?.current;
      let actual = binding ? binding.uid + "@v" + binding.version : text("unselected");
      if (binding && current && (binding.version !== current.version || binding.hash !== current.hash)) actual += " · " + text("game_version", { game: binding.version, current: current.version });
      body.append(h("tr", { "data-map": slice.id }, [h("td", { text: slice.name + " · " + slice.id }), h("td", { class: "mono", text: result.requested }), h("td", { text: actual }), h("td", { text: list.filter(e => e.current).length + "/" + list.length }), h("td", {}, [wanted]), h("td", { text: result.reason + (result.resource ? " · " + result.resource.uid + "@v" + result.resource.version : "") })]));
    }
    table.append(body);work.append(h("div", { class: "audio-table-scroll" }, [table]));
  }
  function updatePositions() {
    player.step();
    for (const p of document.querySelectorAll(".audio-timeline progress")) p.value = 0;
    for (const v of player.snapshot().music) {
      const progress = document.querySelector('[data-position="' + v.uid + '"]'), output = document.querySelector('[data-time="' + v.uid + '"]');
      const duration = Number.isFinite(v.media.duration) ? v.media.duration : v.duration;
      if (progress) { progress.max = duration || 1; progress.value = v.media.currentTime || 0; }
      if (output) { const sec = Math.floor(v.media.currentTime || 0); output.textContent = Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0") + (v.seam ? " · " + (v.seam.cycle + 1) + "/3" : ""); }
    }
  }
  function show(id) {
    const next = (id || "sfx").split("/")[0];
    if (active && next !== mode) player.stopAll();
    active = true; mode = ["sfx", "music", "maps"].includes(next) ? next : "sfx";
    const work = document.getElementById("audio-root");work.textContent = "";
    work.append(h("h1", { text: text("title") + " · " + text(mode) }), volumeControls(), h("p", { class: "small muted", text: text("monitor_help") }), h("p", { id: "audio-status", role: "status", text: message || text("idle") }));
    if (!(data.bindings || {})[catalog.policy?.default_music_uid || "music:dungeon"]) work.append(h("p", { class: "audio-warning", text: text("missing_default") + " · " + text("silent_reason") }));
    if (!entries.some(e => e.current)) work.append(h("p", { class: "audio-empty", text: text("no_sources") }));
    if (mode === "sfx") sfxPage(work); else if (mode === "music") musicPage(work); else mapsPage(work);
    work.append(requestArea(), h("p", { class: "small muted", text: text("quality_warning") }));
    clearInterval(tick); tick = setInterval(updatePositions, 50);
    const uid = (id || "").split("/").slice(1).join("/");
    if (uid) document.querySelector('.audio-card[data-uid="' + CSS.escape(uid) + '"]')?.scrollIntoView({ block: "nearest" });
  }
  function hide() { active = false;clearInterval(tick);tick = null;player.close().catch(() => {}); }
  document.addEventListener("visibilitychange", () => { if (document.hidden) player.close().catch(() => {}); });
  root.addEventListener("pagehide", hide);
  root.PBWBAudio = { show, hide, player, resolve, approvalRequest, text };
})(window);
