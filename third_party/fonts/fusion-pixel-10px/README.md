# 缝合像素字体 10px（小字）

source = https://www.npmjs.com/package/@fontsource/fusion-pixel-10px-proportional-sc （上游 https://github.com/TakWolf/fusion-pixel-font）
package = @fontsource/fusion-pixel-10px-proportional-sc@5.3.0
font_file = fusion-pixel-10px-proportional-sc.woff2（包内 files/fusion-pixel-10px-proportional-sc-latin-400-normal.woff2，原样复制，含完整简体中文）
font_sha256 = 20f58ce5f54e468bc6aa86944aa2445b1e19264193496e9cd57f913cdb279e72
license = SIL OFL 1.1（OFL.txt）

用途：对话气泡、角色自言自语、提示气泡等**角色说的话**（docs/design/dialogue.md）。菜单、标题、按钮仍用 12px。
导入设置同 12px：10px，最近邻，关闭抗锯齿、hinting、子像素、mipmap、MSDF。工作台字形由 tools/build-font.py 烘焙到 workbench/js/core/font-small.js。
