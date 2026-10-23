window.PB_SCREENS = {
  "format": "pushbox.screens/1",
  "screens": [
    {
      "id": "lobby",
      "art": "ui.screen.lobby",
      "variants": [
        "ui.screen.hub_start",
        "ui.screen.lobby_generic",
        "ui.screen.lobby_story"
      ],
      "name": "大厅",
      "flow": "开始",
      "transitions": [
        {
          "key": "Enter",
          "label": "继续",
          "to": "play",
          "when": "有上次关卡",
          "hotspot": [
            16,
            87,
            126,
            15
          ],
          "focus": 0
        },
        {
          "key": "Enter",
          "label": "继续",
          "to": "chapters",
          "when": "没有上次关卡",
          "hotspot": [
            16,
            87,
            126,
            15
          ],
          "focus": 0
        },
        {
          "key": "Enter",
          "label": "选择章节",
          "to": "chapters",
          "hotspot": [
            16,
            108,
            105,
            15
          ],
          "focus": 1
        },
        {
          "key": "Enter",
          "label": "设置",
          "to": "settings",
          "hotspot": [
            16,
            128,
            105,
            15
          ],
          "focus": 2
        },
        {
          "key": "Enter",
          "label": "退出",
          "to": "@quit",
          "hotspot": [
            16,
            148,
            105,
            14
          ],
          "focus": 3
        }
      ],
      "game": "in_use",
      "notes": "公开画面使用示例数据；跳转按 WB-11 的关卡模式主图行为。新玩家、通用大厅和剧情大厅仅作外观变体；其菜单文字、位置或项数不同，不复用主图菜单绑定。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "implemented",
        "game": true
      },
      "coverage": {
        "uid": "art:ui.screen.lobby",
        "version": 5,
        "native": "implemented",
        "implementation_kind": "ui",
        "evidence": [
          "U"
        ]
      },
      "variantsProgress": [
        {
          "art": "ui.screen.hub_start",
          "steps": {
            "html": true,
            "approved": true,
            "godot": "implemented"
          },
          "coverage": {
            "uid": "art:ui.screen.hub_start",
            "version": 1,
            "native": "implemented",
            "implementation_kind": "embedded_ui",
            "evidence": [
              "E"
            ]
          }
        },
        {
          "art": "ui.screen.lobby_generic",
          "steps": {
            "html": true,
            "approved": true,
            "godot": "implemented"
          },
          "coverage": {
            "uid": "art:ui.screen.lobby_generic",
            "version": 1,
            "native": "implemented",
            "implementation_kind": "embedded_ui",
            "evidence": [
              "E"
            ]
          }
        },
        {
          "art": "ui.screen.lobby_story",
          "steps": {
            "html": true,
            "approved": true,
            "godot": "missing"
          },
          "coverage": null
        }
      ]
    },
    {
      "id": "chapters",
      "art": "ui.screen.chapters",
      "variants": [],
      "name": "章节选择",
      "flow": "开始",
      "transitions": [
        {
          "key": "ArrowLeft",
          "label": "换章",
          "to": "@stay",
          "hotspot": [
            19,
            37,
            70,
            64
          ]
        },
        {
          "key": "ArrowRight",
          "label": "换章",
          "to": "@stay",
          "hotspot": [
            231,
            37,
            70,
            64
          ]
        },
        {
          "key": "Enter",
          "label": "进入",
          "to": "levels",
          "when": "章节已开放",
          "hotspot": [
            100,
            25,
            121,
            87
          ]
        },
        {
          "key": "Esc",
          "label": "返回",
          "to": "lobby"
        }
      ],
      "game": "in_use",
      "notes": "公开画面使用示例数据；跳转按 WB-11 的关卡模式主图行为。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "implemented",
        "game": true
      },
      "coverage": {
        "uid": "art:ui.screen.chapters",
        "version": 6,
        "native": "implemented",
        "implementation_kind": "ui",
        "evidence": [
          "U"
        ]
      },
      "variantsProgress": []
    },
    {
      "id": "levels",
      "art": "ui.screen.levels",
      "variants": [],
      "name": "关卡选择",
      "flow": "开始",
      "transitions": [
        {
          "key": "ArrowUp",
          "label": "选择",
          "to": "@stay"
        },
        {
          "key": "ArrowDown",
          "label": "选择",
          "to": "@stay"
        },
        {
          "key": "Enter",
          "label": "进入",
          "to": "rulecard",
          "when": "有没看过的规则",
          "hotspot": [
            17,
            96,
            141,
            16
          ]
        },
        {
          "key": "Enter",
          "label": "进入",
          "to": "play",
          "when": "没有没看过的规则",
          "hotspot": [
            17,
            96,
            141,
            16
          ]
        },
        {
          "key": "Esc",
          "label": "返回",
          "to": "chapters"
        }
      ],
      "game": "in_use",
      "notes": "公开画面使用示例数据；跳转按 WB-11 的关卡模式主图行为。画面选中的是示例行；进入操作不绑定某个固定关卡。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "implemented",
        "game": true
      },
      "coverage": {
        "uid": "art:ui.screen.levels",
        "version": 6,
        "native": "implemented",
        "implementation_kind": "ui",
        "evidence": [
          "U"
        ]
      },
      "variantsProgress": []
    },
    {
      "id": "play",
      "art": "ui.screen.hud_keys",
      "variants": [],
      "name": "局内",
      "flow": "关卡内",
      "transitions": [
        {
          "key": "Esc",
          "label": "暂停",
          "to": "pause",
          "hotspot": [
            300,
            3,
            16,
            14
          ]
        },
        {
          "key": "H",
          "label": "提示",
          "to": "hint",
          "when": "第 1 级",
          "hotspot": [
            273,
            3,
            24,
            14
          ]
        },
        {
          "key": "Z",
          "label": "撤销",
          "to": "@stay",
          "hotspot": [
            213,
            3,
            25,
            14
          ]
        },
        {
          "key": "R",
          "label": "重来",
          "to": "@stay",
          "hotspot": [
            243,
            3,
            25,
            14
          ]
        },
        {
          "label": "过关",
          "to": "complete",
          "when": "关卡完成"
        }
      ],
      "game": "in_use",
      "notes": "公开画面使用示例数据；跳转按 WB-11 的关卡模式主图行为。场景与顶栏组合展示，HTML 不能游玩；过关是自动事件，没有按键或点击区。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "reference_only",
        "game": true
      },
      "coverage": {
        "uid": "art:ui.screen.hud_keys",
        "version": 1,
        "native": "reference_only",
        "implementation_kind": "reference",
        "evidence": [
          "R-U"
        ]
      },
      "variantsProgress": []
    },
    {
      "id": "pause",
      "art": "ui.screen.pause",
      "variants": [
        "ui.screen.pause_help"
      ],
      "name": "暂停",
      "flow": "关卡内",
      "transitions": [
        {
          "key": "Enter",
          "label": "继续",
          "to": "play",
          "hotspot": [
            103,
            48,
            115,
            15
          ],
          "focus": 0
        },
        {
          "key": "Enter",
          "label": "提示",
          "to": "hint",
          "hotspot": [
            103,
            63,
            115,
            15
          ],
          "focus": 1
        },
        {
          "key": "Enter",
          "label": "重开",
          "to": "play",
          "hotspot": [
            103,
            78,
            115,
            15
          ],
          "focus": 2
        },
        {
          "key": "Enter",
          "label": "跳过此关",
          "to": "levels",
          "hotspot": [
            103,
            93,
            115,
            15
          ],
          "focus": 3
        },
        {
          "key": "Enter",
          "label": "选关",
          "to": "levels",
          "hotspot": [
            103,
            108,
            115,
            15
          ],
          "focus": 4
        },
        {
          "key": "Enter",
          "label": "设置",
          "to": "settings",
          "hotspot": [
            103,
            123,
            115,
            15
          ],
          "focus": 5
        },
        {
          "key": "Enter",
          "label": "返回大厅",
          "to": "lobby",
          "hotspot": [
            103,
            138,
            115,
            15
          ],
          "focus": 6
        },
        {
          "key": "Esc",
          "label": "继续",
          "to": "play"
        }
      ],
      "game": "in_use",
      "notes": "公开画面使用示例数据；跳转按 WB-11 的关卡模式主图行为。设置页 Esc 返回暂停；重开和跳过此关对应主图菜单文字。操作说明变体多一项，不能沿用主图 focus。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "implemented",
        "game": true
      },
      "coverage": {
        "uid": "art:ui.screen.pause",
        "version": 6,
        "native": "implemented",
        "implementation_kind": "ui",
        "evidence": [
          "U"
        ]
      },
      "variantsProgress": [
        {
          "art": "ui.screen.pause_help",
          "steps": {
            "html": true,
            "approved": true,
            "godot": "implemented"
          },
          "coverage": {
            "uid": "art:ui.screen.pause_help",
            "version": 1,
            "native": "implemented",
            "implementation_kind": "embedded_ui",
            "evidence": [
              "E"
            ]
          }
        }
      ]
    },
    {
      "id": "hint",
      "art": "ui.screen.hint",
      "variants": [],
      "name": "提示",
      "flow": "关卡内",
      "transitions": [
        {
          "key": "H",
          "label": "下一级提示",
          "to": "@stay",
          "when": "第 1–2 级"
        },
        {
          "key": "Enter",
          "label": "下一级提示",
          "to": "@stay",
          "when": "第 1–2 级"
        },
        {
          "key": "H",
          "label": "演示",
          "to": "play",
          "when": "第 3 级",
          "hotspot": [
            117,
            162,
            39,
            14
          ],
          "focus": 0
        },
        {
          "key": "H",
          "label": "回到正确位置",
          "to": "play",
          "when": "第 3 级",
          "hotspot": [
            160,
            162,
            86,
            14
          ],
          "focus": 1
        },
        {
          "key": "Enter",
          "label": "演示",
          "to": "play",
          "when": "第 3 级",
          "hotspot": [
            117,
            162,
            39,
            14
          ],
          "focus": 0
        },
        {
          "key": "Enter",
          "label": "回到正确位置",
          "to": "play",
          "when": "第 3 级",
          "hotspot": [
            160,
            162,
            86,
            14
          ],
          "focus": 1
        },
        {
          "key": "Esc",
          "label": "返回",
          "to": "play"
        }
      ],
      "game": "in_use",
      "notes": "公开画面使用示例数据；跳转按 WB-11 的关卡模式主图行为。画法 state.focus 0–2 表示提示第 1–3 级；清单 focus 0/1 仅是第 3 级动作菜单。前两级只记录键盘推进，不虚构按钮。动作文字按实际画面为「演示」「回到正确位置」。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "implemented",
        "game": true
      },
      "coverage": {
        "uid": "art:ui.screen.hint",
        "version": 6,
        "native": "implemented",
        "implementation_kind": "ui",
        "evidence": [
          "U"
        ]
      },
      "variantsProgress": []
    },
    {
      "id": "rulecard",
      "art": "ui.screen.rulecard",
      "variants": [
        "ui.screen.rulecard_how"
      ],
      "name": "规则卡",
      "flow": "关卡内",
      "transitions": [
        {
          "key": "Enter",
          "label": "知道了",
          "to": "rulecard",
          "when": "还有规则卡",
          "hotspot": [
            119,
            126,
            81,
            15
          ]
        },
        {
          "key": "Enter",
          "label": "知道了",
          "to": "play",
          "when": "没有更多规则卡",
          "hotspot": [
            119,
            126,
            81,
            15
          ]
        },
        {
          "key": "Esc",
          "label": "知道了",
          "to": "rulecard",
          "when": "还有规则卡",
          "hotspot": [
            119,
            126,
            81,
            15
          ]
        },
        {
          "key": "Esc",
          "label": "知道了",
          "to": "play",
          "when": "没有更多规则卡",
          "hotspot": [
            119,
            126,
            81,
            15
          ]
        }
      ],
      "game": "in_use",
      "notes": "公开画面使用示例数据；跳转按 WB-11 的关卡模式主图行为。带按法变体的按钮位置不同，下方跳转只对应主图。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "implemented",
        "game": true
      },
      "coverage": {
        "uid": "art:ui.screen.rulecard",
        "version": 6,
        "native": "implemented",
        "implementation_kind": "ui",
        "evidence": [
          "U"
        ]
      },
      "variantsProgress": [
        {
          "art": "ui.screen.rulecard_how",
          "steps": {
            "html": true,
            "approved": true,
            "godot": "implemented"
          },
          "coverage": {
            "uid": "art:ui.screen.rulecard_how",
            "version": 1,
            "native": "implemented",
            "implementation_kind": "embedded_ui",
            "evidence": [
              "E"
            ]
          }
        }
      ]
    },
    {
      "id": "complete",
      "art": "ui.screen.complete",
      "variants": [
        "ui.screen.clear_found"
      ],
      "name": "过关",
      "flow": "关卡内",
      "transitions": [
        {
          "key": "Enter",
          "label": "下一关",
          "to": "play",
          "when": "有下一关",
          "hotspot": [
            93,
            79,
            62,
            17
          ],
          "focus": 0
        },
        {
          "key": "Enter",
          "label": "下一关",
          "to": "levels",
          "when": "没有下一关",
          "hotspot": [
            93,
            79,
            62,
            17
          ],
          "focus": 0
        },
        {
          "key": "Enter",
          "label": "选关",
          "to": "levels",
          "hotspot": [
            165,
            79,
            63,
            17
          ],
          "focus": 1
        },
        {
          "key": "Esc",
          "label": "选关",
          "to": "levels"
        }
      ],
      "game": "in_use",
      "notes": "公开画面使用示例数据；跳转按 WB-11 的关卡模式主图行为。「你发现了」变体按钮位置不同，下方跳转只对应主图。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "implemented",
        "game": true
      },
      "coverage": {
        "uid": "art:ui.screen.complete",
        "version": 6,
        "native": "implemented",
        "implementation_kind": "ui",
        "evidence": [
          "U"
        ]
      },
      "variantsProgress": [
        {
          "art": "ui.screen.clear_found",
          "steps": {
            "html": true,
            "approved": true,
            "godot": "implemented"
          },
          "coverage": {
            "uid": "art:ui.screen.clear_found",
            "version": 1,
            "native": "implemented",
            "implementation_kind": "embedded_ui",
            "evidence": [
              "E"
            ]
          }
        }
      ]
    },
    {
      "id": "settings",
      "art": "ui.screen.settings",
      "variants": [
        "ui.screen.settings_help"
      ],
      "name": "设置",
      "flow": "设置与帮助",
      "transitions": [
        {
          "key": "ArrowUp",
          "label": "选择",
          "to": "@stay"
        },
        {
          "key": "ArrowDown",
          "label": "选择",
          "to": "@stay"
        },
        {
          "key": "ArrowLeft",
          "label": "调整",
          "to": "@stay"
        },
        {
          "key": "ArrowRight",
          "label": "调整",
          "to": "@stay"
        },
        {
          "key": "Esc",
          "label": "返回",
          "to": "@return"
        }
      ],
      "game": "in_use",
      "notes": "公开画面使用示例数据；跳转按 WB-11 的关卡模式主图行为。从大厅或暂停进入，Esc 回到来源页；操作说明变体是滚动列表，不推断其绝对菜单索引。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "implemented",
        "game": true
      },
      "coverage": {
        "uid": "art:ui.screen.settings",
        "version": 7,
        "native": "implemented",
        "implementation_kind": "ui",
        "evidence": [
          "U"
        ]
      },
      "variantsProgress": [
        {
          "art": "ui.screen.settings_help",
          "steps": {
            "html": true,
            "approved": true,
            "godot": "implemented"
          },
          "coverage": {
            "uid": "art:ui.screen.settings_help",
            "version": 1,
            "native": "implemented",
            "implementation_kind": "embedded_ui",
            "evidence": [
              "E"
            ]
          }
        }
      ]
    },
    {
      "id": "controls",
      "art": "ui.screen.controls",
      "variants": [],
      "name": "操作说明",
      "flow": "设置与帮助",
      "transitions": [
        {
          "key": "Esc",
          "label": "返回",
          "to": "lobby"
        }
      ],
      "game": "in_use",
      "notes": "公开画面使用示例数据；跳转按 WB-11 的关卡模式主图行为。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "implemented",
        "game": true
      },
      "coverage": {
        "uid": "art:ui.screen.controls",
        "version": 1,
        "native": "implemented",
        "implementation_kind": "ui",
        "evidence": [
          "U"
        ]
      },
      "variantsProgress": []
    },
    {
      "id": "dialogue",
      "art": "ui.screen.dialogue",
      "variants": [],
      "name": "对话",
      "flow": "剧情",
      "transitions": [
        {
          "key": "Esc",
          "label": "返回",
          "to": "lobby"
        }
      ],
      "game": "in_use",
      "notes": "公开画面使用示例数据；跳转按 WB-11 的关卡模式主图行为。只登记页面去向，不记录对白正文。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "implemented",
        "game": true
      },
      "coverage": {
        "uid": "art:ui.screen.dialogue",
        "version": 3,
        "native": "implemented",
        "implementation_kind": "ui",
        "evidence": [
          "U"
        ]
      },
      "variantsProgress": []
    },
    {
      "id": "confirm",
      "art": "ui.screen.confirm",
      "variants": [],
      "name": "放弃这一单确认框",
      "flow": "配送一局",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "reference_only",
        "game": false
      },
      "coverage": {
        "uid": "art:ui.screen.confirm",
        "version": 3,
        "native": "reference_only",
        "implementation_kind": "reference",
        "evidence": [
          "R-U"
        ]
      },
      "variantsProgress": []
    },
    {
      "id": "crew_joined",
      "art": "ui.screen.crew_joined",
      "variants": [],
      "name": "伙计加入提示",
      "flow": "伙计",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "crew_pick",
      "art": "ui.screen.crew_pick",
      "variants": [],
      "name": "派伙计界面",
      "flow": "伙计",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "crew_room",
      "art": "ui.screen.crew_room",
      "variants": [],
      "name": "伙计房界面",
      "flow": "伙计",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "delivery_assist",
      "art": "ui.screen.delivery_assist",
      "variants": [],
      "name": "配送辅助设置独立面板",
      "flow": "设置与帮助",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "delivery_help",
      "art": "ui.screen.delivery_help",
      "variants": [],
      "name": "按地图教学回顾",
      "flow": "配送一局",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "delivery_hud",
      "art": "ui.screen.delivery_hud",
      "variants": [],
      "name": "局内 HUD（配送）",
      "flow": "配送一局",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "reference_only",
        "game": false
      },
      "coverage": {
        "uid": "art:ui.screen.delivery_hud",
        "version": 4,
        "native": "reference_only",
        "implementation_kind": "reference",
        "evidence": [
          "R-U"
        ]
      },
      "variantsProgress": []
    },
    {
      "id": "delivery_pause",
      "art": "ui.screen.delivery_pause",
      "variants": [],
      "name": "暂停菜单（配送）",
      "flow": "配送一局",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "reference_only",
        "game": false
      },
      "coverage": {
        "uid": "art:ui.screen.delivery_pause",
        "version": 4,
        "native": "reference_only",
        "implementation_kind": "reference",
        "evidence": [
          "R-U"
        ]
      },
      "variantsProgress": []
    },
    {
      "id": "delivery_practice",
      "art": "ui.screen.delivery_practice",
      "variants": [],
      "name": "独立教学练习",
      "flow": "配送一局",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "hint_animal",
      "art": "ui.screen.hint_animal",
      "variants": [],
      "name": "提示动物气泡（配送）",
      "flow": "配送一局",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "reference_only",
        "game": false
      },
      "coverage": {
        "uid": "art:ui.screen.hint_animal",
        "version": 2,
        "native": "reference_only",
        "implementation_kind": "reference",
        "evidence": [
          "R-U"
        ]
      },
      "variantsProgress": []
    },
    {
      "id": "observe",
      "art": "ui.screen.observe",
      "variants": [],
      "name": "看全图（配送）",
      "flow": "配送一局",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "reference_only",
        "game": false
      },
      "coverage": {
        "uid": "art:ui.screen.observe",
        "version": 2,
        "native": "reference_only",
        "implementation_kind": "reference",
        "evidence": [
          "R-U"
        ]
      },
      "variantsProgress": []
    },
    {
      "id": "reels",
      "art": "ui.screen.reels",
      "variants": [],
      "name": "滚轮台（配送开局）",
      "flow": "配送一局",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "reference_only",
        "game": false
      },
      "coverage": {
        "uid": "art:ui.screen.reels",
        "version": 4,
        "native": "reference_only",
        "implementation_kind": "reference",
        "evidence": [
          "R-U"
        ]
      },
      "variantsProgress": []
    },
    {
      "id": "run_door",
      "art": "ui.screen.run_door",
      "variants": [],
      "name": "门牌选择（岔路①）",
      "flow": "配送一局",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "run_door_skull",
      "art": "ui.screen.run_door_skull",
      "variants": [],
      "name": "骷髅门牌与改签提示（岔路③）",
      "flow": "配送一局",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "run_event",
      "art": "ui.screen.run_event",
      "variants": [],
      "name": "奇遇事件",
      "flow": "配送一局",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "run_lucky",
      "art": "ui.screen.run_lucky",
      "variants": [],
      "name": "上上签",
      "flow": "配送一局",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "run_map",
      "art": "ui.screen.run_map",
      "variants": [],
      "name": "十二格链式小地图",
      "flow": "配送一局",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "run_quit",
      "art": "ui.screen.run_quit",
      "variants": [],
      "name": "收工确认",
      "flow": "配送一局",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "run_rest",
      "art": "ui.screen.run_rest",
      "variants": [],
      "name": "歇脚三选一",
      "flow": "配送一局",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "run_result",
      "art": "ui.screen.run_result",
      "variants": [],
      "name": "一局结算",
      "flow": "配送一局",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "run_shelf",
      "art": "ui.screen.run_shelf",
      "variants": [],
      "name": "驿站货架",
      "flow": "配送一局",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "run_wish_card",
      "art": "ui.screen.run_wish_card",
      "variants": [],
      "name": "心愿签",
      "flow": "配送一局",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "run_wish_give",
      "art": "ui.screen.run_wish_give",
      "variants": [],
      "name": "交付心愿",
      "flow": "配送一局",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "settlement",
      "art": "ui.screen.settlement",
      "variants": [],
      "name": "送达结算",
      "flow": "配送一局",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "reference_only",
        "game": false
      },
      "coverage": {
        "uid": "art:ui.screen.settlement",
        "version": 4,
        "native": "reference_only",
        "implementation_kind": "reference",
        "evidence": [
          "R-U"
        ]
      },
      "variantsProgress": []
    },
    {
      "id": "settlement_fail",
      "art": "ui.screen.settlement_fail",
      "variants": [],
      "name": "失败结算",
      "flow": "配送一局",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "reference_only",
        "game": false
      },
      "coverage": {
        "uid": "art:ui.screen.settlement_fail",
        "version": 4,
        "native": "reference_only",
        "implementation_kind": "reference",
        "evidence": [
          "R-U"
        ]
      },
      "variantsProgress": []
    },
    {
      "id": "shop",
      "art": "ui.screen.shop",
      "variants": [],
      "name": "驿站货架",
      "flow": "配送一局",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "reference_only",
        "game": false
      },
      "coverage": {
        "uid": "art:ui.screen.shop",
        "version": 4,
        "native": "reference_only",
        "implementation_kind": "reference",
        "evidence": [
          "R-U"
        ]
      },
      "variantsProgress": []
    },
    {
      "id": "story_board",
      "art": "ui.screen.story_board",
      "variants": [],
      "name": "故事单总览",
      "flow": "剧情",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "story_chapter",
      "art": "ui.screen.story_chapter",
      "variants": [],
      "name": "章节页",
      "flow": "剧情",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "story_complete",
      "art": "ui.screen.story_complete",
      "variants": [],
      "name": "读完一章",
      "flow": "剧情",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "story_letter",
      "art": "ui.screen.story_letter",
      "variants": [],
      "name": "感谢信",
      "flow": "剧情",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "story_order",
      "art": "ui.screen.story_order",
      "variants": [],
      "name": "单子出发页",
      "flow": "剧情",
      "transitions": [],
      "game": "not_yet",
      "notes": "公开画面使用示例数据；跳转留待 WB-13。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    }
  ],
  "unlisted": [],
  "totals": {
    "pages": 42,
    "design": 42,
    "html": 42,
    "approved": 42,
    "implemented": 10,
    "reference_only": 10,
    "missing": 22,
    "in_use": 11,
    "not_yet": 31
  }
};
