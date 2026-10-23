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
      "variantTransitions": {
        "ui.screen.hub_start": [
          {
            "key": "Enter",
            "focus": 0,
            "label": "开始游戏",
            "hotspot": [
              20,
              86,
              120,
              13
            ],
            "to": "@stay",
            "sources": [
              {
                "file": "workbench/js/core/ui-onboarding.js",
                "section": "ui.screen.hub_start 主样张"
              },
              {
                "file": "docs/design/mode-delivery.md",
                "section": "2 一局的流程"
              },
              {
                "file": "docs/design/mode-story.md",
                "section": "1 一句话和定位"
              }
            ],
            "notes": "待定 P01：大厅模式入口的目标页与大厅变体选择未明确。"
          },
          {
            "key": "Enter",
            "focus": 1,
            "label": "选择章节",
            "hotspot": [
              12,
              107,
              110,
              13
            ],
            "to": "chapters",
            "sources": [
              {
                "file": "workbench/js/core/ui-onboarding.js",
                "section": "ui.screen.hub_start 主样张"
              },
              {
                "file": "docs/packages/WB-11.md",
                "section": "4 首批关卡模式页面跳转表"
              }
            ]
          },
          {
            "key": "Enter",
            "focus": 2,
            "label": "设置",
            "hotspot": [
              12,
              126,
              110,
              13
            ],
            "to": "settings",
            "sources": [
              {
                "file": "workbench/js/core/ui-onboarding.js",
                "section": "ui.screen.hub_start 主样张"
              },
              {
                "file": "docs/packages/WB-11.md",
                "section": "4 首批关卡模式页面跳转表"
              }
            ]
          },
          {
            "key": "Enter",
            "focus": 3,
            "label": "退出",
            "hotspot": [
              12,
              145,
              110,
              13
            ],
            "to": "@quit",
            "sources": [
              {
                "file": "workbench/js/core/ui-onboarding.js",
                "section": "ui.screen.hub_start 主样张"
              },
              {
                "file": "docs/packages/WB-11.md",
                "section": "4 首批关卡模式页面跳转表"
              }
            ]
          }
        ],
        "ui.screen.lobby_generic": [
          {
            "key": "Enter",
            "focus": 0,
            "label": "关卡模式",
            "hotspot": [
              22,
              72,
              104,
              18
            ],
            "to": "@stay",
            "sources": [
              {
                "file": "workbench/js/core/ui-screens-result.js",
                "section": "ui.screen.lobby_generic 主样张"
              },
              {
                "file": "docs/design/mode-delivery.md",
                "section": "2 一局的流程"
              },
              {
                "file": "docs/design/mode-story.md",
                "section": "1 一句话和定位"
              }
            ],
            "notes": "待定 P01：大厅模式入口的目标页与大厅变体选择未明确。"
          },
          {
            "key": "Enter",
            "focus": 1,
            "label": "配送",
            "hotspot": [
              22,
              94,
              104,
              18
            ],
            "to": "@stay",
            "sources": [
              {
                "file": "workbench/js/core/ui-screens-result.js",
                "section": "ui.screen.lobby_generic 主样张"
              },
              {
                "file": "docs/design/mode-delivery.md",
                "section": "2 一局的流程"
              },
              {
                "file": "docs/design/mode-story.md",
                "section": "1 一句话和定位"
              }
            ],
            "notes": "待定 P01：大厅模式入口的目标页与大厅变体选择未明确。"
          },
          {
            "key": "Enter",
            "focus": 2,
            "label": "设置",
            "hotspot": [
              22,
              116,
              104,
              18
            ],
            "to": "settings",
            "sources": [
              {
                "file": "workbench/js/core/ui-screens-result.js",
                "section": "ui.screen.lobby_generic 主样张"
              },
              {
                "file": "docs/packages/WB-11.md",
                "section": "4 首批关卡模式页面跳转表"
              }
            ]
          },
          {
            "key": "Enter",
            "focus": 3,
            "label": "退出",
            "hotspot": [
              22,
              138,
              104,
              18
            ],
            "to": "@quit",
            "sources": [
              {
                "file": "workbench/js/core/ui-screens-result.js",
                "section": "ui.screen.lobby_generic 主样张"
              },
              {
                "file": "docs/packages/WB-11.md",
                "section": "4 首批关卡模式页面跳转表"
              }
            ]
          }
        ],
        "ui.screen.lobby_story": [
          {
            "key": "Enter",
            "focus": 0,
            "label": "关卡模式",
            "hotspot": [
              22,
              65,
              104,
              18
            ],
            "to": "@stay",
            "sources": [
              {
                "file": "workbench/js/core/ui-screens-story.js",
                "section": "ui.screen.lobby_story 主样张"
              },
              {
                "file": "docs/design/mode-delivery.md",
                "section": "2 一局的流程"
              },
              {
                "file": "docs/design/mode-story.md",
                "section": "1 一句话和定位"
              }
            ],
            "notes": "待定 P01：大厅模式入口的目标页与大厅变体选择未明确。"
          },
          {
            "key": "Enter",
            "focus": 1,
            "label": "配送",
            "hotspot": [
              22,
              84,
              104,
              18
            ],
            "to": "@stay",
            "sources": [
              {
                "file": "workbench/js/core/ui-screens-story.js",
                "section": "ui.screen.lobby_story 主样张"
              },
              {
                "file": "docs/design/mode-delivery.md",
                "section": "2 一局的流程"
              },
              {
                "file": "docs/design/mode-story.md",
                "section": "1 一句话和定位"
              }
            ],
            "notes": "待定 P01：大厅模式入口的目标页与大厅变体选择未明确。"
          },
          {
            "key": "Enter",
            "focus": 2,
            "label": "剧情",
            "hotspot": [
              22,
              103,
              104,
              18
            ],
            "to": "@stay",
            "sources": [
              {
                "file": "workbench/js/core/ui-screens-story.js",
                "section": "ui.screen.lobby_story 主样张"
              },
              {
                "file": "docs/design/mode-delivery.md",
                "section": "2 一局的流程"
              },
              {
                "file": "docs/design/mode-story.md",
                "section": "1 一句话和定位"
              }
            ],
            "notes": "待定 P01：大厅模式入口的目标页与大厅变体选择未明确。"
          },
          {
            "key": "Enter",
            "focus": 3,
            "label": "设置",
            "hotspot": [
              22,
              122,
              104,
              18
            ],
            "to": "settings",
            "sources": [
              {
                "file": "workbench/js/core/ui-screens-story.js",
                "section": "ui.screen.lobby_story 主样张"
              },
              {
                "file": "docs/packages/WB-11.md",
                "section": "4 首批关卡模式页面跳转表"
              }
            ]
          },
          {
            "key": "Enter",
            "focus": 4,
            "label": "退出",
            "hotspot": [
              22,
              141,
              104,
              18
            ],
            "to": "@quit",
            "sources": [
              {
                "file": "workbench/js/core/ui-screens-story.js",
                "section": "ui.screen.lobby_story 主样张"
              },
              {
                "file": "docs/packages/WB-11.md",
                "section": "4 首批关卡模式页面跳转表"
              }
            ]
          }
        ]
      },
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
      "game": "frozen_v1",
      "notes": "公开画面使用示例数据；跳转按 WB-11 的关卡模式主图行为。 WB-16：关卡 v1 已冻结，重做时清理；公开示例只保留旧版画面与跳转。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "implemented",
        "game": false
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
      "game": "frozen_v1",
      "notes": "公开画面使用示例数据；跳转按 WB-11 的关卡模式主图行为。画面选中的是示例行；进入操作不绑定某个固定关卡。 WB-16：关卡 v1 已冻结，重做时清理；公开示例只保留旧版画面与跳转。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "implemented",
        "game": false
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
      "game": "frozen_v1",
      "notes": "公开画面使用示例数据；跳转按 WB-11 的关卡模式主图行为。场景与顶栏组合展示，HTML 不能游玩；过关是自动事件，没有按键或点击区。 WB-16：关卡 v1 已冻结，重做时清理；公开示例只保留旧版画面与跳转。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "reference_only",
        "game": false
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
      "game": "frozen_v1",
      "notes": "公开画面使用示例数据；跳转按 WB-11 的关卡模式主图行为。设置页 Esc 返回暂停；重开和跳过此关对应主图菜单文字。操作说明变体多一项，不能沿用主图 focus。 WB-16：关卡 v1 已冻结，重做时清理；公开示例只保留旧版画面与跳转。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "implemented",
        "game": false
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
      "game": "frozen_v1",
      "notes": "公开画面使用示例数据；跳转按 WB-11 的关卡模式主图行为。画法 state.focus 0–2 表示提示第 1–3 级；清单 focus 0/1 仅是第 3 级动作菜单。前两级只记录键盘推进，不虚构按钮。动作文字按实际画面为「演示」「回到正确位置」。 WB-16：关卡 v1 已冻结，重做时清理；公开示例只保留旧版画面与跳转。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "implemented",
        "game": false
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
      "game": "frozen_v1",
      "notes": "公开画面使用示例数据；跳转按 WB-11 的关卡模式主图行为。带按法变体的按钮位置不同，下方跳转只对应主图。 WB-16：关卡 v1 已冻结，重做时清理；公开示例只保留旧版画面与跳转。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "implemented",
        "game": false
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
      "game": "frozen_v1",
      "notes": "公开画面使用示例数据；跳转按 WB-11 的关卡模式主图行为。「你发现了」变体按钮位置不同，下方跳转只对应主图。 WB-16：关卡 v1 已冻结，重做时清理；公开示例只保留旧版画面与跳转。",
      "steps": {
        "design": true,
        "html": true,
        "approved": true,
        "godot": "implemented",
        "game": false
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
      "transitions": [
        {
          "key": "Enter",
          "focus": 0,
          "label": "放弃",
          "hotspot": [
            48,
            109,
            106,
            20
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-delivery.js",
              "section": "ui.screen.confirm 主样张"
            },
            {
              "file": "docs/design/mode-delivery.md",
              "section": "4 时间与操作"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P03：确认放弃后的结算画面未绑定。"
        },
        {
          "key": "Enter",
          "focus": 1,
          "label": "再想想",
          "hotspot": [
            166,
            109,
            106,
            20
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-delivery.js",
              "section": "ui.screen.confirm 主样张"
            },
            {
              "file": "docs/design/mode-delivery.md",
              "section": "4 时间与操作"
            }
          ],
          "notes": "待定 P02：确认框取消或返回后的目标页未明确。"
        },
        {
          "key": "Esc",
          "label": "返回",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-delivery.js",
              "section": "ui.screen.confirm 主样张"
            },
            {
              "file": "docs/design/mode-delivery.md",
              "section": "4 时间与操作"
            }
          ],
          "notes": "待定 P02：确认框取消或返回后的目标页未明确。"
        }
      ],
      "game": "frozen_v1",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：重做版的游戏接入仍未登记。 待定 P02：确认框取消或返回后的目标页未明确。（docs/design/mode-delivery.md §4 时间与操作） 待定 P03：确认放弃后的结算画面未绑定。（docs/design/mode-delivery.md §4 时间与操作） WB-16 冻结 v1 来源：游戏仓库 live_service_ui.gd（confirm_abandon 标题）；这只证明旧版页面在用，不代表重做版已接入。",
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
      "transitions": [
        {
          "key": "Enter",
          "label": "确认",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-crew.js",
              "section": "ui.screen.crew_joined 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "5 和其他模式的关系"
            },
            {
              "file": "docs/design/characters.md",
              "section": "3 渡口居民"
            }
          ],
          "notes": "待定 P23：伙计页面各派出、返回、确认操作的目标页未明确。"
        }
      ],
      "game": "not_yet",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：游戏 main 的页面消费证据不足，保持 not_yet。 待定 P23：伙计页面各派出、返回、确认操作的目标页未明确。（docs/design/mode-story.md §2.3 一单里的规矩） WB-16：限定只读的 live 文件注释和标题尚不能唯一绑定本页，保持未接入；剧情/伙计也不推断已使用。",
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
      "transitions": [
        {
          "key": "Enter",
          "label": "派出",
          "focus": 0,
          "hotspot": [
            19,
            55,
            86,
            66
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-crew.js",
              "section": "ui.screen.crew_pick 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "5 和其他模式的关系"
            },
            {
              "file": "docs/design/characters.md",
              "section": "3 渡口居民"
            }
          ],
          "notes": "待定 P23：伙计页面各派出、返回、确认操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "label": "派出",
          "focus": 1,
          "hotspot": [
            117,
            55,
            86,
            66
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-crew.js",
              "section": "ui.screen.crew_pick 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "5 和其他模式的关系"
            },
            {
              "file": "docs/design/characters.md",
              "section": "3 渡口居民"
            }
          ],
          "notes": "待定 P23：伙计页面各派出、返回、确认操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "label": "派出",
          "focus": 2,
          "hotspot": [
            215,
            55,
            86,
            66
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-crew.js",
              "section": "ui.screen.crew_pick 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "5 和其他模式的关系"
            },
            {
              "file": "docs/design/characters.md",
              "section": "3 渡口居民"
            }
          ],
          "notes": "待定 P23：伙计页面各派出、返回、确认操作的目标页未明确。"
        },
        {
          "key": "Esc",
          "label": "返回",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-crew.js",
              "section": "ui.screen.crew_pick 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "5 和其他模式的关系"
            },
            {
              "file": "docs/design/characters.md",
              "section": "3 渡口居民"
            }
          ],
          "notes": "待定 P23：伙计页面各派出、返回、确认操作的目标页未明确。"
        }
      ],
      "game": "not_yet",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：游戏 main 的页面消费证据不足，保持 not_yet。 待定 P23：伙计页面各派出、返回、确认操作的目标页未明确。（docs/design/mode-story.md §2.3 一单里的规矩） 热点仅对应公开主样张可见卡片。 WB-16：限定只读的 live 文件注释和标题尚不能唯一绑定本页，保持未接入；剧情/伙计也不推断已使用。",
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
      "transitions": [
        {
          "key": "ArrowLeft",
          "label": "选择",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-crew.js",
              "section": "ui.screen.crew_room 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "5 和其他模式的关系"
            },
            {
              "file": "docs/design/characters.md",
              "section": "3 渡口居民"
            }
          ],
          "notes": "待定 P23：伙计页面各派出、返回、确认操作的目标页未明确。"
        },
        {
          "key": "ArrowRight",
          "label": "选择",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-crew.js",
              "section": "ui.screen.crew_room 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "5 和其他模式的关系"
            },
            {
              "file": "docs/design/characters.md",
              "section": "3 渡口居民"
            }
          ],
          "notes": "待定 P23：伙计页面各派出、返回、确认操作的目标页未明确。"
        },
        {
          "key": "Esc",
          "label": "返回",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-crew.js",
              "section": "ui.screen.crew_room 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "5 和其他模式的关系"
            },
            {
              "file": "docs/design/characters.md",
              "section": "3 渡口居民"
            }
          ],
          "notes": "待定 P23：伙计页面各派出、返回、确认操作的目标页未明确。"
        }
      ],
      "game": "not_yet",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：游戏 main 的页面消费证据不足，保持 not_yet。 待定 P23：伙计页面各派出、返回、确认操作的目标页未明确。（docs/design/mode-story.md §2.3 一单里的规矩） WB-16：限定只读的 live 文件注释和标题尚不能唯一绑定本页，保持未接入；剧情/伙计也不推断已使用。",
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
      "transitions": [
        {
          "key": "ArrowUp",
          "label": "选择",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-dhelp.js",
              "section": "ui.screen.delivery_assist 主样张"
            },
            {
              "file": "docs/design/mode-delivery.md",
              "section": "4 时间与操作"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "7.3 玩家想慢慢想的时候"
            }
          ],
          "notes": "待定 P20：配送辅助独立面板的入口与返回页未明确。"
        },
        {
          "key": "ArrowDown",
          "label": "选择",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-dhelp.js",
              "section": "ui.screen.delivery_assist 主样张"
            },
            {
              "file": "docs/design/mode-delivery.md",
              "section": "4 时间与操作"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "7.3 玩家想慢慢想的时候"
            }
          ],
          "notes": "待定 P20：配送辅助独立面板的入口与返回页未明确。"
        },
        {
          "key": "ArrowLeft",
          "label": "调整",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-dhelp.js",
              "section": "ui.screen.delivery_assist 主样张"
            },
            {
              "file": "docs/design/mode-delivery.md",
              "section": "4 时间与操作"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "7.3 玩家想慢慢想的时候"
            }
          ],
          "notes": "待定 P20：配送辅助独立面板的入口与返回页未明确。"
        },
        {
          "key": "ArrowRight",
          "label": "调整",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-dhelp.js",
              "section": "ui.screen.delivery_assist 主样张"
            },
            {
              "file": "docs/design/mode-delivery.md",
              "section": "4 时间与操作"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "7.3 玩家想慢慢想的时候"
            }
          ],
          "notes": "待定 P20：配送辅助独立面板的入口与返回页未明确。"
        },
        {
          "key": "Esc",
          "label": "返回",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-dhelp.js",
              "section": "ui.screen.delivery_assist 主样张"
            },
            {
              "file": "docs/design/mode-delivery.md",
              "section": "4 时间与操作"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "7.3 玩家想慢慢想的时候"
            }
          ],
          "notes": "待定 P20：配送辅助独立面板的入口与返回页未明确。"
        }
      ],
      "game": "not_yet",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：游戏 main 的页面消费证据不足，保持 not_yet。 待定 P20：配送辅助独立面板的入口与返回页未明确。（docs/design/mode-delivery.md §4 时间与操作） WB-16：限定只读的 live 文件注释和标题尚不能唯一绑定本页，保持未接入；剧情/伙计也不推断已使用。",
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
      "transitions": [
        {
          "key": "Enter",
          "label": "练习一下",
          "hotspot": [
            125,
            132,
            99,
            17
          ],
          "to": "delivery_practice",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-dhelp.js",
              "section": "ui.screen.delivery_help 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "3.7 首次教学与教学回顾"
            }
          ],
          "when": "所选教学已开放"
        },
        {
          "key": "Esc",
          "label": "返回",
          "hotspot": [
            230,
            132,
            65,
            17
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-dhelp.js",
              "section": "ui.screen.delivery_help 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "3.7 首次教学与教学回顾"
            }
          ],
          "notes": "待定 P21：教学列表关闭后的目标页未明确。"
        }
      ],
      "game": "not_yet",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：游戏 main 的页面消费证据不足，保持 not_yet。 待定 P21：教学列表关闭后的目标页未明确。（docs/design/delivery-run.md §3.7 首次教学与教学回顾） 教学条目为选择区域；练习与返回按钮不占教学焦点索引。 WB-16：限定只读的 live 文件注释和标题尚不能唯一绑定本页，保持未接入；剧情/伙计也不推断已使用。",
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
      "transitions": [
        {
          "key": "Esc",
          "label": "暂停",
          "to": "delivery_pause",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-delivery.js",
              "section": "ui.screen.delivery_hud 主样张"
            },
            {
              "file": "docs/design/delivery-slice.md",
              "section": "2 一局的流程"
            },
            {
              "file": "docs/design/delivery-slice.md",
              "section": "11 HUD 与操作"
            }
          ]
        }
      ],
      "game": "frozen_v1",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：重做版的游戏接入仍未登记。 待定 P04：配送 HUD 送达后的结算画面及页面顺序未绑定。（docs/design/mode-delivery.md §2 一局的流程） 待定 P05：配送 HUD 失败后的结算画面未绑定。（docs/design/delivery-slice.md §2 一局的流程） 待定 P06：打开货架时选用的货架画面未绑定。（docs/design/delivery-slice.md §8 驿站） WB-16 冻结 v1 来源：游戏仓库 live_hud.gd（delivery_hud@v4 开头注释）；这只证明旧版页面在用，不代表重做版已接入。",
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
      "transitions": [
        {
          "key": "Enter",
          "focus": 0,
          "label": "继续",
          "hotspot": [
            81,
            58,
            158,
            17
          ],
          "to": "delivery_hud",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-delivery.js",
              "section": "ui.screen.delivery_pause 主样张"
            },
            {
              "file": "docs/design/delivery-slice.md",
              "section": "2 一局的流程"
            }
          ]
        },
        {
          "key": "Enter",
          "focus": 1,
          "label": "重来这个房间",
          "hotspot": [
            81,
            75,
            158,
            17
          ],
          "to": "delivery_hud",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-delivery.js",
              "section": "ui.screen.delivery_pause 主样张"
            },
            {
              "file": "docs/design/delivery-slice.md",
              "section": "2 一局的流程"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "7.2 全实时的规则"
            }
          ]
        },
        {
          "key": "Enter",
          "focus": 2,
          "label": "放弃这一单",
          "hotspot": [
            81,
            92,
            158,
            17
          ],
          "to": "confirm",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-delivery.js",
              "section": "ui.screen.delivery_pause 主样张"
            },
            {
              "file": "docs/design/mode-delivery.md",
              "section": "4 时间与操作"
            }
          ]
        },
        {
          "key": "Enter",
          "focus": 3,
          "label": "设置",
          "hotspot": [
            81,
            109,
            158,
            17
          ],
          "to": "settings",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-delivery.js",
              "section": "ui.screen.delivery_pause 主样张"
            },
            {
              "file": "docs/design/delivery-slice.md",
              "section": "2 一局的流程"
            }
          ]
        },
        {
          "key": "Enter",
          "focus": 4,
          "label": "返回大厅",
          "hotspot": [
            81,
            126,
            158,
            17
          ],
          "to": "lobby",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-delivery.js",
              "section": "ui.screen.delivery_pause 主样张"
            },
            {
              "file": "docs/design/delivery-slice.md",
              "section": "2 一局的流程"
            }
          ]
        },
        {
          "key": "Esc",
          "label": "返回",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-delivery.js",
              "section": "ui.screen.delivery_pause 主样张"
            },
            {
              "file": "docs/design/delivery-slice.md",
              "section": "2 一局的流程"
            }
          ],
          "notes": "待定 P26：配送暂停页 Esc 返回操作的目标页未明确。"
        }
      ],
      "game": "frozen_v1",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：重做版的游戏接入仍未登记。 待定 P26：配送暂停页 Esc 返回操作的目标页未明确。（docs/design/delivery-slice.md §2 一局的流程） WB-16 冻结 v1 来源：游戏仓库 live_overlays.gd（pause 标题）；这只证明旧版页面在用，不代表重做版已接入。",
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
      "transitions": [
        {
          "key": "R",
          "label": "重置",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-dhelp.js",
              "section": "ui.screen.delivery_practice 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "3.7 首次教学与教学回顾"
            }
          ]
        },
        {
          "key": "Tab",
          "label": "教学列表",
          "to": "delivery_help",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-dhelp.js",
              "section": "ui.screen.delivery_practice 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "3.7 首次教学与教学回顾"
            }
          ]
        },
        {
          "key": "Esc",
          "label": "返回准备",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-dhelp.js",
              "section": "ui.screen.delivery_practice 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "3.7 首次教学与教学回顾"
            },
            {
              "file": "docs/design/delivery-slice.md",
              "section": "2 一局的流程"
            }
          ],
          "notes": "待定 P25：教学入口与返回准备操作尚未绑定到滚轮台。"
        }
      ],
      "game": "not_yet",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：游戏 main 的页面消费证据不足，保持 not_yet。 待定 P25：教学入口与返回准备操作尚未绑定到滚轮台。（docs/design/delivery-run.md §3.7 首次教学与教学回顾） WB-16：限定只读的 live 文件注释和标题尚不能唯一绑定本页，保持未接入；剧情/伙计也不推断已使用。",
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
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：游戏 main 的页面消费证据不足，保持 not_yet。 待定 P15：提示气泡的入口、关闭操作及返回页未明确。（docs/design/delivery-run.md §7.2 全实时的规则） 实际主样张未画出可绑定的按键或按钮，不补造动作。 WB-16：限定只读的 live 文件注释和标题尚不能唯一绑定本页，保持未接入；剧情/伙计也不推断已使用。",
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
      "transitions": [
        {
          "key": "Tab",
          "label": "返回",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-delivery.js",
              "section": "ui.screen.observe 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "7.3 玩家想慢慢想的时候"
            }
          ],
          "notes": "待定 P14：看全图页面的返回目标页未明确。"
        }
      ],
      "game": "not_yet",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：游戏 main 的页面消费证据不足，保持 not_yet。 待定 P14：看全图页面的返回目标页未明确。（docs/design/delivery-run.md §7.3 玩家想慢慢想的时候） WB-16：限定只读的 live 文件注释和标题尚不能唯一绑定本页，保持未接入；剧情/伙计也不推断已使用。",
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
      "transitions": [
        {
          "key": "ArrowLeft",
          "label": "选择",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-delivery.js",
              "section": "ui.screen.reels 主样张"
            }
          ]
        },
        {
          "key": "ArrowRight",
          "label": "选择",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-delivery.js",
              "section": "ui.screen.reels 主样张"
            }
          ]
        },
        {
          "key": "R",
          "label": "重转",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-delivery.js",
              "section": "ui.screen.reels 主样张"
            },
            {
              "file": "docs/design/mode-delivery.md",
              "section": "3.2 玩家能做什么"
            }
          ]
        },
        {
          "key": "Enter",
          "label": "出发",
          "to": "delivery_hud",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-delivery.js",
              "section": "ui.screen.reels 主样张"
            },
            {
              "file": "docs/design/delivery-slice.md",
              "section": "2 一局的流程"
            },
            {
              "file": "docs/design/mode-delivery.md",
              "section": "2 一局的流程"
            }
          ]
        }
      ],
      "game": "not_yet",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：游戏 main 的页面消费证据不足，保持 not_yet。 待定 P25：教学入口与返回准备操作尚未绑定到滚轮台。（docs/design/delivery-run.md §3.7 首次教学与教学回顾） 教学回顾入口未画出，不补造按键。 WB-16：限定只读的 live 文件注释和标题尚不能唯一绑定本页，保持未接入；剧情/伙计也不推断已使用。",
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
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：游戏 main 的页面消费证据不足，保持 not_yet。 待定 P16：门牌画面与配送 HUD 之间的页面绑定未明确。（docs/design/delivery-run.md §3.4 路线） 实际主样张未画出可绑定的按键或按钮，不补造动作。 WB-16：限定只读的 live 文件注释和标题尚不能唯一绑定本页，保持未接入；剧情/伙计也不推断已使用。",
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
      "transitions": [
        {
          "key": "2",
          "label": "重抽",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-door.js",
              "section": "ui.screen.run_door_skull 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "3.4 路线"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "3.5 门牌"
            }
          ],
          "notes": "待定 P16：门牌画面与配送 HUD 之间的页面绑定未明确。"
        }
      ],
      "game": "not_yet",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：游戏 main 的页面消费证据不足，保持 not_yet。 待定 P16：门牌画面与配送 HUD 之间的页面绑定未明确。（docs/design/delivery-run.md §3.4 路线） WB-16：限定只读的 live 文件注释和标题尚不能唯一绑定本页，保持未接入；剧情/伙计也不推断已使用。",
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
      "transitions": [
        {
          "key": "Enter",
          "focus": 0,
          "label": "喝",
          "hotspot": [
            134,
            82,
            82,
            18
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_event 主样张"
            },
            {
              "file": "docs/design/mode-delivery.md",
              "section": "9 随机事件与顺路单"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "10 和现有设计的关系"
            }
          ],
          "notes": "待定 P17：奇遇选项完成后的目标页未明确。"
        },
        {
          "key": "Enter",
          "focus": 1,
          "label": "不喝",
          "hotspot": [
            220,
            82,
            82,
            18
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_event 主样张"
            },
            {
              "file": "docs/design/mode-delivery.md",
              "section": "9 随机事件与顺路单"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "10 和现有设计的关系"
            }
          ],
          "notes": "待定 P17：奇遇选项完成后的目标页未明确。"
        }
      ],
      "game": "frozen_v1",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：重做版的游戏接入仍未登记。 待定 P17：奇遇选项完成后的目标页未明确。（docs/design/mode-delivery.md §9 随机事件与顺路单） WB-16 冻结 v1 来源：游戏仓库 live_details.gd / live_panels.gd（event 标题）；这只证明旧版页面在用，不代表重做版已接入。",
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
      "transitions": [
        {
          "key": "Enter",
          "label": "出发",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-wish.js",
              "section": "ui.screen.run_lucky 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "6.1 已定做法"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "6.5 上上签"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "11 用户的选择"
            }
          ],
          "notes": "待定 P18：心愿卡与上上签页面的打开、出发及关闭路由未明确。"
        }
      ],
      "game": "frozen_v1",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：重做版的游戏接入仍未登记。 待定 P18：心愿卡与上上签页面的打开、出发及关闭路由未明确。（docs/design/delivery-run.md §6.1 已定做法） WB-16 冻结 v1 来源：游戏仓库 live_details.gd / live_order_ui.gd（lucky 标题）；这只证明旧版页面在用，不代表重做版已接入。",
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
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：游戏 main 的页面消费证据不足，保持 not_yet。 待定 P13：小地图入口、关闭操作及返回页未明确。（docs/design/mode-delivery.md §4 时间与操作） 实际主样张未画出可绑定的按键或按钮，不补造动作。 WB-16：限定注释/标题只见通用 map，与其他已登记画面不能唯一绑定，保持未接入；不据此否认冻结 v1 存在相应页面。",
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
      "transitions": [
        {
          "key": "Enter",
          "focus": 0,
          "label": "收工",
          "hotspot": [
            48,
            128,
            106,
            20
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_quit 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P09：收工确认、取消与返回的目标页未明确。"
        },
        {
          "key": "Enter",
          "focus": 1,
          "label": "再想想",
          "hotspot": [
            166,
            128,
            106,
            20
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_quit 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P09：收工确认、取消与返回的目标页未明确。"
        },
        {
          "key": "Esc",
          "label": "返回",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_quit 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P09：收工确认、取消与返回的目标页未明确。"
        }
      ],
      "game": "frozen_v1",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：重做版的游戏接入仍未登记。 待定 P09：收工确认、取消与返回的目标页未明确。（docs/design/delivery-run.md §4.6 一局怎么结束） WB-16 冻结 v1 来源：游戏仓库 live_service_ui.gd（confirm_retire 标题）；这只证明旧版页面在用，不代表重做版已接入。",
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
      "transitions": [
        {
          "key": "Enter",
          "focus": 0,
          "label": "恢复生命",
          "hotspot": [
            120,
            43,
            186,
            28
          ],
          "when": "样张中不可用",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_rest 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.2 花在哪"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P08：歇脚页按钮与离开操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "focus": 1,
          "label": "修复货物",
          "hotspot": [
            120,
            73,
            186,
            28
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_rest 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.2 花在哪"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P08：歇脚页按钮与离开操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "focus": 2,
          "label": "领取补给",
          "hotspot": [
            120,
            103,
            186,
            28
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_rest 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.2 花在哪"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P08：歇脚页按钮与离开操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "focus": 3,
          "label": "收工",
          "hotspot": [
            220,
            140,
            94,
            18
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_rest 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.2 花在哪"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P08：歇脚页按钮与离开操作的目标页未明确。"
        },
        {
          "key": "Q",
          "focus": 3,
          "label": "收工",
          "hotspot": [
            220,
            140,
            94,
            18
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_rest 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.2 花在哪"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P08：歇脚页按钮与离开操作的目标页未明确。"
        },
        {
          "key": "Esc",
          "label": "离开",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_rest 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.2 花在哪"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P08：歇脚页按钮与离开操作的目标页未明确。"
        }
      ],
      "game": "frozen_v1",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：重做版的游戏接入仍未登记。 待定 P08：歇脚页按钮与离开操作的目标页未明确。（docs/design/delivery-run.md §4.2 花在哪） WB-16 冻结 v1 来源：游戏仓库 live_service_ui.gd（rest 标题，UI-12b 注释）；这只证明旧版页面在用，不代表重做版已接入。",
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
      "transitions": [
        {
          "key": "Enter",
          "focus": 0,
          "label": "再送一单",
          "hotspot": [
            68,
            158,
            88,
            18
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_result 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "10 和现有设计的关系"
            }
          ],
          "notes": "待定 P10：一局结算页各按钮的目标页未明确。"
        },
        {
          "key": "Enter",
          "focus": 1,
          "label": "回大厅",
          "hotspot": [
            164,
            158,
            88,
            18
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_result 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "10 和现有设计的关系"
            }
          ],
          "notes": "待定 P10：一局结算页各按钮的目标页未明确。"
        }
      ],
      "game": "frozen_v1",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：重做版的游戏接入仍未登记。 待定 P10：一局结算页各按钮的目标页未明确。（docs/design/delivery-run.md §4.6 一局怎么结束） WB-16 冻结 v1 来源：游戏仓库 live_service_ui.gd（result 标题，UI-12b 注释）；这只证明旧版页面在用，不代表重做版已接入。",
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
      "transitions": [
        {
          "key": "Enter",
          "focus": 0,
          "label": "购买",
          "hotspot": [
            14,
            41,
            42,
            46
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_shelf 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.2 花在哪"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P07：货架按钮与离开操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "focus": 1,
          "label": "购买",
          "hotspot": [
            60,
            41,
            42,
            46
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_shelf 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.2 花在哪"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P07：货架按钮与离开操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "focus": 2,
          "label": "购买",
          "hotspot": [
            116,
            41,
            42,
            46
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_shelf 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.2 花在哪"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P07：货架按钮与离开操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "focus": 3,
          "label": "购买",
          "hotspot": [
            162,
            41,
            42,
            46
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_shelf 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.2 花在哪"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P07：货架按钮与离开操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "focus": 4,
          "label": "购买",
          "hotspot": [
            208,
            41,
            42,
            46
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_shelf 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.2 花在哪"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P07：货架按钮与离开操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "focus": 5,
          "label": "购买",
          "hotspot": [
            264,
            41,
            42,
            46
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_shelf 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.2 花在哪"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P07：货架按钮与离开操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "focus": 6,
          "label": "换一批",
          "hotspot": [
            179,
            98,
            66,
            27
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_shelf 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.2 花在哪"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P07：货架按钮与离开操作的目标页未明确。"
        },
        {
          "key": "R",
          "focus": 6,
          "label": "换一批",
          "hotspot": [
            179,
            98,
            66,
            27
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_shelf 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.2 花在哪"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P07：货架按钮与离开操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "focus": 7,
          "label": "恢复生命",
          "hotspot": [
            248,
            98,
            66,
            27
          ],
          "when": "样张中不可用",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_shelf 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.2 花在哪"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P07：货架按钮与离开操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "focus": 8,
          "label": "修复货物",
          "hotspot": [
            179,
            129,
            66,
            27
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_shelf 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.2 花在哪"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P07：货架按钮与离开操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "focus": 9,
          "label": "收工",
          "hotspot": [
            248,
            129,
            66,
            27
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_shelf 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.2 花在哪"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P07：货架按钮与离开操作的目标页未明确。"
        },
        {
          "key": "Q",
          "focus": 9,
          "label": "收工",
          "hotspot": [
            248,
            129,
            66,
            27
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_shelf 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.2 花在哪"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P07：货架按钮与离开操作的目标页未明确。"
        },
        {
          "key": "Esc",
          "label": "离开",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-shelf.js",
              "section": "ui.screen.run_shelf 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.2 花在哪"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P07：货架按钮与离开操作的目标页未明确。"
        }
      ],
      "game": "frozen_v1",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：重做版的游戏接入仍未登记。 待定 P06：打开货架时选用的货架画面未绑定。（docs/design/delivery-slice.md §8 驿站） 待定 P07：货架按钮与离开操作的目标页未明确。（docs/design/delivery-run.md §4.2 花在哪） WB-16 冻结 v1 来源：游戏仓库 live_service_ui.gd（shelf 界面标识，UI-12b 注释）；这只证明旧版页面在用，不代表重做版已接入。",
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
      "transitions": [
        {
          "key": "ArrowLeft",
          "label": "选择",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-wish.js",
              "section": "ui.screen.run_wish_card 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "6.1 已定做法"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "6.5 上上签"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "11 用户的选择"
            }
          ],
          "notes": "待定 P18：心愿卡与上上签页面的打开、出发及关闭路由未明确。"
        },
        {
          "key": "ArrowRight",
          "label": "选择",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-wish.js",
              "section": "ui.screen.run_wish_card 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "6.1 已定做法"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "6.5 上上签"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "11 用户的选择"
            }
          ],
          "notes": "待定 P18：心愿卡与上上签页面的打开、出发及关闭路由未明确。"
        },
        {
          "key": "R",
          "label": "重转",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-wish.js",
              "section": "ui.screen.run_wish_card 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "6.1 已定做法"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "6.5 上上签"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "11 用户的选择"
            }
          ],
          "notes": "待定 P18：心愿卡与上上签页面的打开、出发及关闭路由未明确。"
        },
        {
          "key": "Enter",
          "label": "出发",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-wish.js",
              "section": "ui.screen.run_wish_card 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "6.1 已定做法"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "6.5 上上签"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "11 用户的选择"
            }
          ],
          "notes": "待定 P18：心愿卡与上上签页面的打开、出发及关闭路由未明确。"
        }
      ],
      "game": "frozen_v1",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：重做版的游戏接入仍未登记。 待定 P18：心愿卡与上上签页面的打开、出发及关闭路由未明确。（docs/design/delivery-run.md §6.1 已定做法） WB-16 冻结 v1 来源：游戏仓库 live_order_ui.gd（UI-12c 准备页开头注释与 wish 标识，对应包中同组发愿卡）；这只证明旧版页面在用，不代表重做版已接入。",
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
      "transitions": [
        {
          "key": "Enter",
          "label": "下一页",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-wish.js",
              "section": "ui.screen.run_wish_give 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "6.1 已定做法"
            }
          ],
          "notes": "待定 P19：心愿交付页下一页操作的目标页未明确。"
        }
      ],
      "game": "not_yet",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：游戏 main 的页面消费证据不足，保持 not_yet。 待定 P19：心愿交付页下一页操作的目标页未明确。（docs/design/delivery-run.md §6.1 已定做法） WB-16：限定只读的 live 文件注释和标题尚不能唯一绑定本页，保持未接入；剧情/伙计也不推断已使用。",
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
      "transitions": [
        {
          "key": "Enter",
          "focus": 0,
          "label": "再送一单",
          "hotspot": [
            68,
            158,
            88,
            18
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-result.js",
              "section": "ui.screen.settlement 主样张"
            },
            {
              "file": "docs/design/delivery-slice.md",
              "section": "2 一局的流程"
            },
            {
              "file": "docs/design/mode-delivery.md",
              "section": "10 连送"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "10 和现有设计的关系"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "11 用户的选择"
            }
          ],
          "notes": "待定 P12：再送一单按钮的目标页存在来源差异。"
        },
        {
          "key": "Enter",
          "focus": 1,
          "label": "回大厅",
          "hotspot": [
            164,
            158,
            88,
            18
          ],
          "to": "lobby",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-result.js",
              "section": "ui.screen.settlement 主样张"
            },
            {
              "file": "docs/design/delivery-slice.md",
              "section": "2 一局的流程"
            }
          ]
        }
      ],
      "game": "not_yet",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：游戏 main 的页面消费证据不足，保持 not_yet。 待定 P12：再送一单按钮的目标页存在来源差异。（docs/design/delivery-slice.md §2 一局的流程） WB-16：限定注释/标题只见通用 result / ResultTitle，与其他已登记画面不能唯一绑定，保持未接入；不据此否认冻结 v1 存在相应页面。",
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
      "transitions": [
        {
          "key": "Enter",
          "focus": 0,
          "label": "再送一单",
          "hotspot": [
            68,
            151,
            88,
            18
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-result.js",
              "section": "ui.screen.settlement_fail 主样张"
            },
            {
              "file": "docs/design/delivery-slice.md",
              "section": "2 一局的流程"
            }
          ],
          "notes": "待定 P11：失败结算页各按钮的目标页未明确。"
        },
        {
          "key": "Enter",
          "focus": 1,
          "label": "回大厅",
          "hotspot": [
            164,
            151,
            88,
            18
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-result.js",
              "section": "ui.screen.settlement_fail 主样张"
            },
            {
              "file": "docs/design/delivery-slice.md",
              "section": "2 一局的流程"
            }
          ],
          "notes": "待定 P11：失败结算页各按钮的目标页未明确。"
        }
      ],
      "game": "not_yet",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：游戏 main 的页面消费证据不足，保持 not_yet。 待定 P11：失败结算页各按钮的目标页未明确。（docs/design/delivery-slice.md §2 一局的流程） WB-16：限定只读的 live 文件注释和标题尚不能唯一绑定本页，保持未接入；剧情/伙计也不推断已使用。",
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
      "transitions": [
        {
          "key": "Enter",
          "label": "购买",
          "focus": 0,
          "hotspot": [
            97,
            32,
            212,
            20
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-delivery.js",
              "section": "ui.screen.shop 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.2 花在哪"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P07：货架按钮与离开操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "label": "购买",
          "focus": 1,
          "hotspot": [
            97,
            53,
            212,
            20
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-delivery.js",
              "section": "ui.screen.shop 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.2 花在哪"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P07：货架按钮与离开操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "label": "购买",
          "focus": 2,
          "hotspot": [
            97,
            74,
            212,
            20
          ],
          "when": "样张中不可用",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-delivery.js",
              "section": "ui.screen.shop 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.2 花在哪"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P07：货架按钮与离开操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "label": "购买",
          "focus": 3,
          "hotspot": [
            97,
            95,
            212,
            20
          ],
          "when": "样张中不可用",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-delivery.js",
              "section": "ui.screen.shop 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.2 花在哪"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P07：货架按钮与离开操作的目标页未明确。"
        },
        {
          "key": "Esc",
          "label": "离开",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-delivery.js",
              "section": "ui.screen.shop 主样张"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.2 花在哪"
            },
            {
              "file": "docs/design/delivery-run.md",
              "section": "4.6 一局怎么结束"
            }
          ],
          "notes": "待定 P07：货架按钮与离开操作的目标页未明确。"
        }
      ],
      "game": "not_yet",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：游戏 main 的页面消费证据不足，保持 not_yet。 待定 P06：打开货架时选用的货架画面未绑定。（docs/design/delivery-slice.md §8 驿站） 待定 P07：货架按钮与离开操作的目标页未明确。（docs/design/delivery-run.md §4.2 花在哪） WB-16：限定只读的 live 文件注释和标题尚不能唯一绑定本页，保持未接入；剧情/伙计也不推断已使用。",
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
      "transitions": [
        {
          "key": "ArrowLeft",
          "label": "选择",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-story.js",
              "section": "ui.screen.story_board 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.2 开放顺序"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "4 故事从哪里讲出来"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "11 备选和待定"
            }
          ],
          "notes": "待定 P22：剧情页面各打开、返回、确认操作的目标页未明确。"
        },
        {
          "key": "ArrowRight",
          "label": "选择",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-story.js",
              "section": "ui.screen.story_board 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.2 开放顺序"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "4 故事从哪里讲出来"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "11 备选和待定"
            }
          ],
          "notes": "待定 P22：剧情页面各打开、返回、确认操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "label": "打开",
          "focus": 0,
          "hotspot": [
            11,
            28,
            70,
            124
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-story.js",
              "section": "ui.screen.story_board 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.2 开放顺序"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "4 故事从哪里讲出来"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "11 备选和待定"
            }
          ],
          "notes": "待定 P22：剧情页面各打开、返回、确认操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "label": "打开",
          "focus": 1,
          "hotspot": [
            87,
            28,
            70,
            124
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-story.js",
              "section": "ui.screen.story_board 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.2 开放顺序"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "4 故事从哪里讲出来"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "11 备选和待定"
            }
          ],
          "notes": "待定 P22：剧情页面各打开、返回、确认操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "label": "打开",
          "focus": 2,
          "hotspot": [
            163,
            28,
            70,
            124
          ],
          "when": "样张中未开放",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-story.js",
              "section": "ui.screen.story_board 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.2 开放顺序"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "4 故事从哪里讲出来"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "11 备选和待定"
            }
          ],
          "notes": "待定 P22：剧情页面各打开、返回、确认操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "label": "打开",
          "focus": 3,
          "hotspot": [
            239,
            28,
            70,
            124
          ],
          "when": "样张中未开放",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-story.js",
              "section": "ui.screen.story_board 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.2 开放顺序"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "4 故事从哪里讲出来"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "11 备选和待定"
            }
          ],
          "notes": "待定 P22：剧情页面各打开、返回、确认操作的目标页未明确。"
        },
        {
          "key": "Esc",
          "label": "返回",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-story.js",
              "section": "ui.screen.story_board 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.2 开放顺序"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "4 故事从哪里讲出来"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "11 备选和待定"
            }
          ],
          "notes": "待定 P22：剧情页面各打开、返回、确认操作的目标页未明确。"
        }
      ],
      "game": "not_yet",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：游戏 main 的页面消费证据不足，保持 not_yet。 待定 P22：剧情页面各打开、返回、确认操作的目标页未明确。（docs/design/mode-story.md §2.3 一单里的规矩） WB-16：限定只读的 live 文件注释和标题尚不能唯一绑定本页，保持未接入；剧情/伙计也不推断已使用。",
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
      "transitions": [
        {
          "key": "ArrowUp",
          "label": "选择",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-story.js",
              "section": "ui.screen.story_chapter 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.2 开放顺序"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "4 故事从哪里讲出来"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "11 备选和待定"
            }
          ],
          "notes": "待定 P22：剧情页面各打开、返回、确认操作的目标页未明确。"
        },
        {
          "key": "ArrowDown",
          "label": "选择",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-story.js",
              "section": "ui.screen.story_chapter 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.2 开放顺序"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "4 故事从哪里讲出来"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "11 备选和待定"
            }
          ],
          "notes": "待定 P22：剧情页面各打开、返回、确认操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "label": "打开",
          "focus": 0,
          "hotspot": [
            18,
            77,
            284,
            18
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-story.js",
              "section": "ui.screen.story_chapter 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.2 开放顺序"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "4 故事从哪里讲出来"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "11 备选和待定"
            }
          ],
          "notes": "待定 P22：剧情页面各打开、返回、确认操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "label": "打开",
          "focus": 1,
          "hotspot": [
            18,
            97,
            284,
            18
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-story.js",
              "section": "ui.screen.story_chapter 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.2 开放顺序"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "4 故事从哪里讲出来"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "11 备选和待定"
            }
          ],
          "notes": "待定 P22：剧情页面各打开、返回、确认操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "label": "打开",
          "focus": 2,
          "hotspot": [
            18,
            117,
            284,
            18
          ],
          "when": "样张中未开放",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-story.js",
              "section": "ui.screen.story_chapter 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.2 开放顺序"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "4 故事从哪里讲出来"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "11 备选和待定"
            }
          ],
          "notes": "待定 P22：剧情页面各打开、返回、确认操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "label": "打开",
          "focus": 3,
          "hotspot": [
            18,
            137,
            284,
            18
          ],
          "when": "样张中未开放",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-story.js",
              "section": "ui.screen.story_chapter 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.2 开放顺序"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "4 故事从哪里讲出来"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "11 备选和待定"
            }
          ],
          "notes": "待定 P22：剧情页面各打开、返回、确认操作的目标页未明确。"
        },
        {
          "key": "Esc",
          "label": "返回",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-story.js",
              "section": "ui.screen.story_chapter 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.2 开放顺序"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "4 故事从哪里讲出来"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "11 备选和待定"
            }
          ],
          "notes": "待定 P22：剧情页面各打开、返回、确认操作的目标页未明确。"
        }
      ],
      "game": "not_yet",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：游戏 main 的页面消费证据不足，保持 not_yet。 待定 P22：剧情页面各打开、返回、确认操作的目标页未明确。（docs/design/mode-story.md §2.3 一单里的规矩） WB-16：限定只读的 live 文件注释和标题尚不能唯一绑定本页，保持未接入；剧情/伙计也不推断已使用。",
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
      "transitions": [
        {
          "key": "Enter",
          "label": "确认",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-story.js",
              "section": "ui.screen.story_complete 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.2 开放顺序"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "4 故事从哪里讲出来"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "11 备选和待定"
            }
          ],
          "notes": "待定 P22：剧情页面各打开、返回、确认操作的目标页未明确。"
        }
      ],
      "game": "not_yet",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：游戏 main 的页面消费证据不足，保持 not_yet。 待定 P22：剧情页面各打开、返回、确认操作的目标页未明确。（docs/design/mode-story.md §2.3 一单里的规矩） WB-16：限定只读的 live 文件注释和标题尚不能唯一绑定本页，保持未接入；剧情/伙计也不推断已使用。",
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
      "transitions": [
        {
          "key": "Enter",
          "label": "收进邮局",
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-story.js",
              "section": "ui.screen.story_letter 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.2 开放顺序"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "4 故事从哪里讲出来"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "11 备选和待定"
            }
          ],
          "notes": "待定 P22：剧情页面各打开、返回、确认操作的目标页未明确。"
        }
      ],
      "game": "not_yet",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：游戏 main 的页面消费证据不足，保持 not_yet。 待定 P22：剧情页面各打开、返回、确认操作的目标页未明确。（docs/design/mode-story.md §2.3 一单里的规矩） WB-16：限定只读的 live 文件注释和标题尚不能唯一绑定本页，保持未接入；剧情/伙计也不推断已使用。",
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
      "transitions": [
        {
          "key": "Enter",
          "focus": 0,
          "label": "出发",
          "hotspot": [
            80,
            135,
            76,
            18
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-story.js",
              "section": "ui.screen.story_order 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.2 开放顺序"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "4 故事从哪里讲出来"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "11 备选和待定"
            }
          ],
          "notes": "待定 P22：剧情页面各打开、返回、确认操作的目标页未明确。"
        },
        {
          "key": "Enter",
          "focus": 1,
          "label": "返回",
          "hotspot": [
            164,
            135,
            76,
            18
          ],
          "to": "@stay",
          "sources": [
            {
              "file": "workbench/js/core/ui-screens-story.js",
              "section": "ui.screen.story_order 主样张"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "2.3 一单里的规矩"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.1 一章的形状"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "3.2 开放顺序"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "4 故事从哪里讲出来"
            },
            {
              "file": "docs/design/mode-story.md",
              "section": "11 备选和待定"
            }
          ],
          "notes": "待定 P22：剧情页面各打开、返回、确认操作的目标页未明确。"
        }
      ],
      "game": "not_yet",
      "notes": "公开示例，仅登记按键、按钮与页面。待定 P24：游戏 main 的页面消费证据不足，保持 not_yet。 待定 P22：剧情页面各打开、返回、确认操作的目标页未明确。（docs/design/mode-story.md §2.3 一单里的规矩） WB-16：限定只读的 live 文件注释和标题尚不能唯一绑定本页，保持未接入；剧情/伙计也不推断已使用。",
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
      "id": "lobby_modes",
      "art": null,
      "variants": [],
      "name": "多模式大厅",
      "flow": "开始",
      "game": "not_yet",
      "notes": "来源：游戏仓库 CORE-01 交付要求；现在游戏在旧大厅上用代码加入口。用途：统一展示可进入的模式，先补 HTML 设计。",
      "transitions": [],
      "steps": {
        "design": false,
        "html": false,
        "approved": false,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "delivery_growth",
      "art": null,
      "variants": [],
      "name": "配送成长与下一单选项面板",
      "flow": "配送一局",
      "game": "frozen_v1",
      "notes": "来源：游戏仓库 live_growth_ui.gd 开头 growth / next-order 注释及 growth 标题。用途：展示成长与下一单选项；v1 直接在游戏代码里做的，重做时先补设计。",
      "transitions": [],
      "steps": {
        "design": false,
        "html": false,
        "approved": false,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "delivery_kitchen",
      "art": null,
      "variants": [],
      "name": "配送补给厨房面板",
      "flow": "配送一局",
      "game": "frozen_v1",
      "notes": "来源：游戏仓库 live_panels.gd 的 kitchen / KitchenTitle 标题。用途：展示补给厨房；v1 直接在游戏代码里做的，重做时先补设计。",
      "transitions": [],
      "steps": {
        "design": false,
        "html": false,
        "approved": false,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "new_play_keys",
      "art": null,
      "variants": [],
      "name": "新操作的按键提示",
      "flow": "新关卡线（设计中）",
      "game": "not_yet",
      "notes": "来源：docs/design/gameplay/README.md。用途：新操作的按键提示；暂定，等操作方案确认后再画。",
      "transitions": [],
      "steps": {
        "design": false,
        "html": false,
        "approved": false,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "new_controls",
      "art": null,
      "variants": [],
      "name": "新操作的操作说明页",
      "flow": "新关卡线（设计中）",
      "game": "not_yet",
      "notes": "来源：docs/design/gameplay/README.md。用途：新操作的操作说明页；暂定，等操作方案确认后再画。",
      "transitions": [],
      "steps": {
        "design": false,
        "html": false,
        "approved": false,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    },
    {
      "id": "hud_tools",
      "art": null,
      "variants": [],
      "name": "本关工具图标",
      "flow": "新关卡线（设计中）",
      "game": "not_yet",
      "notes": "来源：docs/design/gameplay/README.md。用途：本关工具图标；暂定，等操作方案确认后再画。",
      "transitions": [],
      "steps": {
        "design": false,
        "html": false,
        "approved": false,
        "godot": "missing",
        "game": false
      },
      "coverage": null,
      "variantsProgress": []
    }
  ],
  "unlisted": [],
  "totals": {
    "pages": 48,
    "painted": 42,
    "missing_design": 6,
    "design": 42,
    "html": 42,
    "approved": 42,
    "implemented": 10,
    "reference_only": 10,
    "missing": 28,
    "in_use": 4,
    "frozen_v1": 19,
    "not_yet": 25
  }
};
