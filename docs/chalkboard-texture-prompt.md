# 黑板背景材质

- 来源：OpenAI 内置 `image_gen` 工具生成，2026-09-17。AI 生成的写实材质，不是实拍照片，无外部摄影来源。
- 项目资产：`public/textures/chalkboard-photo.webp`。
- 分辨率：1254 × 1254 px（工具实际输出；提示词目标为约 1024 × 1024 px）。
- 转码：Pillow，仅将 PNG 转为 WebP，quality=92、method=6；没有裁切、缩放、颜色调整或纹理编辑。
- 建议 CSS：`background-repeat: repeat; background-size: 640px 640px;`，对应 tileSize 为 640；可在页面实际观感中微调。
- 检查：已目视检查生成图，呈现细哑光炭绿涂层、细微粉尘与低对比不规则擦拭残留，无字迹、物件、边框或明显白色擦痕。提示词要求双轴无缝平铺；最终页面仍应检查重复边界观感。

## 完整生成提示词

```text
Use case: photorealistic-natural
Asset type: seamless repeating website background texture, a square 1024x1024 raster material.
Primary request: Generate an AI-created photorealistic close-up of an empty school chalkboard surface. The material must read as an actual finely matte painted chalkboard, with restrained extremely faint irregular traces of erased chalk and fine chalk dust embedded in the surface. It should remain quiet behind a collection of photographs and keepsakes.
Composition/framing: perfectly flat straight-on orthographic material scan, the surface fills every pixel, no perspective. Seamlessly tileable in BOTH horizontal and vertical directions; all opposite edges must match naturally, with no border or tile seam.
Lighting/mood: perfectly even diffuse lighting across the entire tile, no directional illumination, no shadows, no vignette, no center-to-edge gradient.
Color palette: low-saturation deep charcoal green, very dark muted school-board green. Subtle low-contrast surface detail, not black, not bright green.
Materials/textures: authentic very fine matte painted grain and tiny scattered chalk particles, with barely visible diffuse irregular eraser residue. Natural material detail at multiple tiny scales rather than uniform digital noise. No broad bright white wiped areas, no dominant wipe stroke.
Constraints: one square texture only. No text, letters, numbers, symbols, lines, drawings, doodles, scratches resembling writing, logos, watermark, objects, chalk sticks, hands, frame, board edges, floor, wall, horizon, perspective, gradients, or vignette. Not a scene, not a mockup. Do not add prominent patches or a focal point. This is AI-generated photorealistic texture, not a sourced real photograph.
```
