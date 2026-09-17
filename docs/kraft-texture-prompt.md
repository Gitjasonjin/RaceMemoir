# 牛皮纸背景纹理

- 生成来源：OpenAI 内置 `image_gen`，AI 生成的写实材质，非实际摄影素材。
- 生成日期：2026-09-17。
- 原始文件：`C:/Users/hj/.codex/generated_images/01a0ad65-7ea7-74a1-b450-7bc877f9dfa5/exec-9af04173-8d6f-48dd-b348-e111e98333e8.png`。
- 项目资产：`public/textures/kraft-photo.webp`。
- 实际分辨率：1254 × 1254 像素（提示词目标 1024 × 1024；保留工具原始输出尺寸）。
- 格式转换：Pillow 仅将 PNG 转码为 WebP，quality=92、method=6；未裁剪、缩放、调色或修改纹理。
- 建议 CSS：`background-repeat: repeat; background-size: 640px 640px;`，即 `tileSize: 640`。
- 图像检查：浅暖米棕色底面，短纤维和细微斑点可见，整体低饱和；无文字、纸边、折痕、折角、透视或投影。生成时要求双轴无缝平铺；最终页面仍应检查实际重复接缝与尺寸。

## 完整生成提示词

```text
Use case: photorealistic-natural
Asset type: Seamlessly repeating website background texture, square 1024 x 1024 pixels.
Primary request: Create a photorealistic close-up material scan of clean natural kraft paper, with a quiet pale warm brown / beige-tan color. This is a single flat texture tile filling the entire frame.
Subject and materials: Authentic short irregular cellulose paper fibers and tiny subtle flecks embedded in the paper. Fibers are genuinely visible at close inspection, fine and delicately varied, never dominating. Very slight natural paper-surface micro-undulation. Fine organic variation, low contrast and low saturation.
Composition/framing: Orthographic straight-on flat material scan, perfectly evenly focused edge to edge. Texture extends beyond all four sides, no sheet boundary. Seamless tileable in both horizontal and vertical axes; opposite edges match in color and texture continuity. Non-directional, even random distribution without a noticeable focal area or repeating motif.
Lighting: Uniform soft diffuse illumination across the whole surface. Flat albedo-like lighting, no gradient, no vignette, no cast shadows or lighting hotspots.
Color palette: Soft light warm kraft brown, neutral beige and muted tan; restrained earthy warmth.
Constraints: Only the paper surface, no objects, no writing, no letters, no watermark, no folds, creases, curled corners, sheet edges, tears, stains, perspective, shadows or coarse ridges. Must look like real paper, not wood grain, wood planks, sandpaper, cork, leather, fabric, cardboard corrugations, or generic computer noise. AI-generated photorealistic texture; do not place any text in the image.
```
