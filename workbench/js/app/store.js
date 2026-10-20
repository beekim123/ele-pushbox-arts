/* Data access and browser persistence for the workbench.
 * The repository data comes from data/bundle.js (built by tools/art.mjs).
 * Local edits and the review selection live in localStorage only; they reach the
 * repository solely through the export files described in the Export view. */
(function (root) {
  "use strict";
  const PB = root.PB;
  const B = root.PB_BUNDLE || { assets: [], approvals: [], levels: [], history: {}, references: [] };
  const KEYS = { drafts: "pb.wb.drafts.v1", review: "pb.wb.review.v1", prefs: "pb.wb.prefs.v1" };

  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  let storageOk = true;
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); storageOk = true; } catch (e) { storageOk = false; }
  }

  const assets = new Map(B.assets.map((a) => [a.id, a]));
  const original = new Map(B.assets.map((a) => [a.id, JSON.parse(JSON.stringify(a))]));
  let drafts = load(KEYS.drafts, {});
  let review = load(KEYS.review, { selected: {}, feedback: {} });
  const prefs = load(KEYS.prefs, {});
  const listeners = new Set();

  // Apply local drafts on top of repository sprites so every view shows the edit.
  function effective(id) {
    const a = assets.get(id), d = drafts[id];
    if (!a || !d || a.kind !== "sprite") return a;
    return Object.assign({}, a, { frames: d.frames, _draft: true });
  }
  function registerAll() {
    if (PB.i18n && B.i18n) { PB.i18n.setTables(B.i18n); PB.i18n.setLocale(prefs.locale || "zh-Hans"); }
    for (const a of assets.values()) PB.sprites.register(effective(a.id));
  }
  function emit(what) { for (const fn of listeners) fn(what); }

  // Content catalogs and derived statuses (data/content.js, built by tools/content.mjs).
  const C = root.PB_CONTENT || { catalogs: {}, notes: {}, levels: [], mechanisms: [], issues: [], summary: { errors: 0, warnings: 0, report: null } };
  const MECH_STATUS = { proposed: "提议", designed: "已设计", specified: "有规格", verified: "已验证", playable: "可玩" };

  // The monitor preferences and wishes are browser drafts, never approval facts.
  const A = root.PB_AUDIO || { entries: [], bindings: {}, catalog: { entries: [], music_sets: [], routes: {}, policy: {} } };
  const AUDIO_KEY = "pb.wb.audio.v1";
  const rawAudio = load(AUDIO_KEY, {});
  const audioPrefs = rawAudio && typeof rawAudio === "object" ? rawAudio : {};
  if (!audioPrefs.drafts || typeof audioPrefs.drafts !== "object") audioPrefs.drafts = {};
  if (!audioPrefs.requested || typeof audioPrefs.requested !== "object") audioPrefs.requested = {};
  const saveAudio = () => save(AUDIO_KEY, audioPrefs);

  const store = {
    bundle: B,
    audio: () => A,
    audioPrefs: () => audioPrefs,
    setAudioPref(key, value) { audioPrefs[key] = value; saveAudio(); },
    audioDrafts: () => audioPrefs.drafts,
    setAudioDraft(setUid, candidate) { audioPrefs.drafts[setUid] = candidate; saveAudio(); },
    audioRequested: () => audioPrefs.requested,
    setAudioRequested(uid, value) { if (value) audioPrefs.requested[uid] = value; else delete audioPrefs.requested[uid]; saveAudio(); },
    content: () => C,
    hasContent: () => !!root.PB_CONTENT,
    catalog: (kind) => (C.catalogs || {})[kind] || [],
    // Global resource ids (docs/design/ids.md).
    ids: () => C.ids || { domains: {}, entries: [] },
    uid: (domain, id) => { const e = (C.ids || { entries: [] }).entries.find((x) => x.domain === domain && x.id === id); return e ? e.uid : domain + ":" + id; },
    idEntry: (uid) => (C.ids || { entries: [] }).entries.find((x) => x.uid === uid),
    catalogNote: (kind) => (C.notes || {})[kind] || "",
    mode: (id) => ((C.catalogs || {}).modes || []).find((m) => m.id === id),
    group: (id) => ((C.catalogs || {}).groups || []).find((g) => g.id === id),
    mechanism: (id) => (C.mechanisms || []).find((m) => m.id === id),
    planned: (id) => (C.levels || []).find((l) => l.id === id),
    mechStatusLabel: (s) => MECH_STATUS[s] || s,
    storageOk: () => storageOk,
    assets: () => [...assets.values()],
    asset: (id) => assets.get(id),
    effective,
    original: (id) => original.get(id),
    history: (key) => B.history[key],
    levels: () => B.levels,
    level: (id) => B.levels.find((l) => l.id === id),
    approvals: () => B.approvals,
    modelCheck: (id) => (B.modelCheck ? B.modelCheck.levels.find((l) => l.id === id) : null),
    status(id) { return drafts[id] ? "local" : assets.get(id).status; },
    statusLabel(s) { return { approved: "已确认", review: "待确认", draft: "草稿", local: "本地修改" }[s] || s; },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    drafts: () => drafts,
    draftCount: () => Object.keys(drafts).length,
    setDraft(id, frames) {
      const a = assets.get(id);
      drafts[id] = { base_version: a.version, base_hash: a.content_hash, frames, saved_at: new Date().toISOString() };
      save(KEYS.drafts, drafts); PB.sprites.register(effective(id)); emit("drafts");
    },
    discardDraft(id) { delete drafts[id]; save(KEYS.drafts, drafts); PB.sprites.register(effective(id)); emit("drafts"); },
    discardAll() { drafts = {}; save(KEYS.drafts, drafts); registerAll(); emit("drafts"); },

    review: () => review,
    toggleSelected(id, on) {
      const a = assets.get(id);
      if (on) review.selected[id] = { version: a.version, hash: a.content_hash }; else delete review.selected[id];
      save(KEYS.review, review); emit("review");
    },
    setFeedback(id, text) {
      if (text) review.feedback[id] = { version: assets.get(id).version, text }; else delete review.feedback[id];
      save(KEYS.review, review); emit("review");
    },
    clearReview() { review = { selected: {}, feedback: {} }; save(KEYS.review, review); emit("review"); },
    // Selections made against an older version are dropped, never silently carried over.
    pruneReview() {
      let changed = false;
      for (const [id, s] of Object.entries(review.selected)) {
        const a = assets.get(id);
        if (!a || a.version !== s.version || a.content_hash !== s.hash || a.status === "approved" || drafts[id]) { delete review.selected[id]; changed = true; }
      }
      if (changed) save(KEYS.review, review);
    },

    pref(key, fallback) { return key in prefs ? prefs[key] : fallback; },
    setPref(key, value) { prefs[key] = value; save(KEYS.prefs, prefs); },
    registerAll,
  };
  root.PBStore = store;
})(window);
