/* Public art browsing only. Classification references existing art IDs and
 * display names; it is not a game catalog or a promise of runtime support.
 * Keep it outside art/source and frozen drawing modules. Shared entries are
 * referenced in both modes, never copied or approved by this catalog. */
(function (root) {
  'use strict';
  const MODES = {
    level: {name:'关卡模式', view:'level-art', themes:['dungeon','ruins','cave','forest','sky','cosmos']},
    delivery: {name:'配送模式', view:'delivery-art', themes:['dungeon','diyu','jeju','polar','candy']},
  };
  const WORLD_FIGURES = {
    dungeon:['old_miner','zombie','goblin_smith','skeleton_guard','rat_swarm','goblin_forge'],
    diyu:['ancestor','meng_po','judge','wuchang','yama','wandering_soul','imp','jiangshi'],
    jeju:['haenyeo','tangerine_farmer','lighthouse_keeper','goblin_chief','seagull','dokkaebi'],
    polar:['fisher','reindeer_herder','snowman','narwhal','yeti','penguin'],
    candy:['baker','kid','candy_princess','ice_cream_vendor','ant_army','gingerbread'],
  };
  const WORLD_LABELS = {dungeon:'石牢',ruins:'神庙',cave:'晶窟',forest:'古森',sky:'圣域',
    cosmos:'星站',diyu:'地府',jeju:'济州',polar:'极地',candy:'糖果'};
  const SHARED_CHARACTERS = new Set(['char.portitor','char.portitor_alt','char.miner']);
  const SHARED_SCREENS = new Set(['lobby','lobby_generic','hub_start','controls','settings','settings_help','dialogue']);
  const DELIVERY_SCREENS = new Set(['reels','shop','observe','confirm','hint_animal','settlement','settlement_fail']);
  const LEVEL_UI = new Set(['ui.goal_glow','ui.cause_link','ui.goal_lamp','ui.target','ui.hud_glow',
    'ui.action_icon','ui.keyhint','ui.class_icon','ui.rule_icon','ui.key_cmd']);
  const DELIVERY_MECHANISMS = new Set(['mech.ferry_gate','mech.rune_float','mech.lantern_float','mech.rope_ladder']);
  const DELIVERY_SOUNDS = new Set(['animal_hint','cargo_damage','coin','delivery_arrive','feed_snack',
    'hurt','reel_spin','reel_stop','reroll','shop_buy']);
  const LEVEL_SOUNDS = new Set(['goal_on','level_clear','rule_card','undo']);
  const both = () => ['level','delivery'];
  function themes(a) {
    // Only visual identifiers are inspected. Never infer a map from incidental
    // prose, private room params or a screen's illustrative background.
    if (a.category === 'screen' || a.category === 'ui' || a.category === 'scene') return [];
    const token = a.id.split('.').at(-1);
    return [...new Set(Object.values(MODES).flatMap(m=>m.themes))].filter(world =>
      new RegExp('(^|[._])'+world+'(_|$)').test(a.id) || a.name.includes(WORLD_LABELS[world]) ||
      (WORLD_FIGURES[world] || []).includes(token));
  }
  function related(a) {
    return a.category === 'scene' || /^(char\.hero_|avatar\.hero_|deco\.hero_|deco\.story_)/.test(a.id) ||
      ['deco.paper_house_built','cargo.love_letter'].includes(a.id) ||
      /^ui\.screen\.(story_|crew_|lobby_story)/.test(a.id);
  }
  function modes(a) {
    const id = a.id, cat = a.category;
    if (related(a)) return ['delivery'];
    if (cat === 'theme' || cat === 'fauna' || cat === 'deco') {
      if (a.name.includes('提示动物')) return ['delivery'];
      const worlds = themes(a);
      if (worlds.length) return Object.keys(MODES).filter(m=>worlds.some(w=>MODES[m].themes.includes(w)));
      return both();
    }
    if (['avatar','cargo','monster','scene'].includes(cat)) return ['delivery'];
    if (cat === 'character') return SHARED_CHARACTERS.has(id) ? both() : ['delivery'];
    if (cat === 'item') return ['item.sandbag','item.bomb'].includes(id) ? both() : ['delivery'];
    if (cat === 'object') return id.startsWith('obj.crate_') ? both() : ['delivery'];
    if (cat === 'material') return ['level'];
    if (cat === 'mechanism') return DELIVERY_MECHANISMS.has(id) || /\.(jeju_|candy_)/.test(id) ? ['delivery'] : both();
    if (cat === 'fx') return /\.(monster_poof|jeju_|candy_)/.test(id) ? ['delivery'] : both();
    if (cat === 'screen') {
      const screen = id.slice('ui.screen.'.length);
      if (SHARED_SCREENS.has(screen)) return both();
      return /^(delivery_|run_)/.test(screen) || DELIVERY_SCREENS.has(screen) ? ['delivery'] : ['level'];
    }
    if (cat === 'ui') {
      if (/^ui\.(delivery_|run_|buff_)/.test(id)) return ['delivery'];
      if (LEVEL_UI.has(id) || a.params?.screen?.startsWith('onb_')) return ['level'];
    }
    return both();
  }
  function sections(mode, all) {
    if (!MODES[mode]) return [];
    const list = [{id:'all', name:'全部资源'}];
    for (const world of MODES[mode].themes) {
      const id = 'theme.'+world, a = all.find(a=>a.id===id);
      if (a) list.push({id, name:a.params?.title || a.name.replace(/^主题 · /,'')});
    }
    list.push({id:'characters',name:'角色与生物'}, {id:'items',name:'物品与装饰'},
      {id:'mechanisms',name:'机关与特效'}, {id:'screens',name:'界面与引导'});
    if (mode === 'delivery') list.push({id:'hub',name:'渡口 / 伙计 / 剧情候选'});
    list.push({id:'sounds',name:'音效'});
    return list;
  }
  function assets(mode, section, all, options) {
    if (!MODES[mode]) return [];
    const known = sections(mode, all).some(s=>s.id===section), key = known ? section : 'all';
    // Shared UI may reference another theme (e.g. the lobby or skin selector).
    // Follow the already-public art dependencies instead of dropping them
    // simply because their primary browsing group belongs to the other mode.
    const byId = new Map(all.map(a=>[a.id,a])), included = new Set();
    const queue = all.filter(a=>modes(a).includes(mode)).map(a=>a.id);
    while (queue.length) {
      const id = queue.pop(); if (included.has(id)) continue;
      included.add(id);
      for (const dependency of byId.get(id)?.depends || []) if (byId.has(dependency)) queue.push(dependency);
    }
    return all.filter(a=>included.has(a.id)).filter(a=> {
      if (key === 'all') return true;
      if (key.startsWith('theme.')) {
        const worlds = themes(a);
        return worlds.includes(key.slice(6)) || (!worlds.length && options?.shared !== false);
      }
      if (key === 'characters') return ['character','avatar','monster','fauna'].includes(a.category);
      if (key === 'items') return ['item','cargo','object','deco'].includes(a.category);
      if (key === 'mechanisms') return ['mechanism','material','fx'].includes(a.category);
      if (key === 'screens') return ['screen','ui'].includes(a.category);
      if (key === 'hub') return related(a);
      return false; // sounds are rendered from the separate audio manifest
    });
  }
  function sounds(mode, entries) {
    if (!MODES[mode]) return [];
    return entries.filter(e=>e.kind==='sfx' &&
      (mode === 'level' ? !DELIVERY_SOUNDS.has(e.id) : !LEVEL_SOUNDS.has(e.id)));
  }
  root.PBModeCatalog = {MODES, sections, assets, sounds, modes, themes, related};
})(typeof window !== 'undefined' ? window : globalThis);
