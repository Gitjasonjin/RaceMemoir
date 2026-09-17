# 背景材质

四种背景均使用本地 WebP 图片材质，在「装饰样式 → 整块收藏板 → 收藏板背景」切换。经典 SVG 版本及文件已移除；旧收藏板或备份中的 `cork-svg`、`dark-wood-svg`、`kraft-svg`、`chalkboard-svg` 会分别显示对应的写实材质。选择随收藏板保存，支持撤销和备份恢复，不依赖外部图片服务。

## 软木板图片

- 原始摄影：[Close-up of a Cork Board — Petr Ganaj / Pexels](https://www.pexels.com/photo/close-up-of-a-cork-board-18358663/)。
- 原始素材授权：[Pexels License](https://www.pexels.com/license/)。不是 CC0 素材。
- 处理：使用内置 imagegen 对实拍素材进行 AI 调色、降低对比度并修整平铺接缝，部分颗粒经过重构。随后只做 WebP 格式压缩，质量 92%，保留 1536 × 1024 分辨率。
- 显示：每块贴图占画布 384 × 256 单位，保留 3:2 比例。画布、选项预览、分享预览与 PNG 导出共用 `backgroundStyle`，纹理随画布平移和缩放。
- 色调：在真实软木贴图上叠加约 15–22% 不透明度的暖米白光照层，使整体更浅，保留原始贴图细节。
- 默认背景 ID 仍为 `cork`，既有软木板自动使用新图片。

### 图片处理提示词

Edit the supplied photograph of coarse agglomerated cork board into a production-ready seamless repeating background texture. Keep its actual photographic coarse irregular cork chips, small wood fibers, tiny pores and natural chip distribution. Preserve approximately the same chip scale and density, NOT a fine sand texture, not smooth polygons, not illustrated. Only modify color/contrast and seam continuity: reduce the strong orange saturation by roughly 25-30 percent, soften contrast by roughly 15-20 percent by lifting dark crevices modestly while retaining sharp fiber detail. Aim for subdued warm natural tan, not gray or washed-out cream. Uniform diffuse neutral illumination across the entire image; no gradient, vignette, corner shading, highlights or baked shadows. Precisely seamless tile in BOTH axes: left/right and top/bottom edges continue the same chips and fibers, so repeating the output on a 3x3 grid has no visible lines, edge discontinuities, lighter/darker strips, or obvious repeating dark clusters. Output only ONE flat rectangular texture tile, approximately original 3:2 aspect ratio at high resolution. Edge-to-edge cork, no border, no frame, no writing, no diagram, no 3D rendered board, no pins and no before-after layout.

上述百分比为编辑目标，并非对结果的精确测量；效果通过平铺预览与画布目视检查确认。

## 深色木板、牛皮纸与黑板

这三种素材使用内置 `image_gen` 分别生成，属于 AI 生成的写实材质，并非实拍照片。均保留生成的 1254 × 1254 分辨率，仅转码为 WebP（质量 92），没有通过程序调色、缩放或合成。

| 材质 | 本地资产 | 画布平铺尺寸 | 背景 ID | 完整生成提示词 |
| --- | --- | --- | --- | --- |
| 深色木板 | `public/textures/dark-wood-photo.webp` | 768 × 768 | `dark-wood` | [木板生成记录](wood-texture-prompt.md) |
| 牛皮纸 | `public/textures/kraft-photo.webp` | 576 × 576 | `kraft` | [牛皮纸生成记录](kraft-texture-prompt.md) |
| 黑板 | `public/textures/chalkboard-photo.webp` | 640 × 640 | `chalkboard` | [黑板生成记录](chalkboard-texture-prompt.md) |

木板保留哑光横向木纹与板缝；牛皮纸使用浅暖米棕底色和细短纤维；黑板使用深炭绿涂层、淡粉尘和轻微擦拭痕迹。三种素材合计约 1.13 MiB。保留原有背景 ID，因此已保存的对应主题会直接使用新材质。

已在浏览器检查重复平铺、主题切换、撤销、自动保存与刷新恢复，以及分享预览和实际 PNG 导出。当前检查比例下未发现明显拼接线或亮暗条带；纹理重复仍遵循固定图块平铺方式。

奖牌展示框复用木板图片作为木纹，以 CSS 混色呈现原木与黑色涂装；四边分别裁切为斜角拼接，竖边旋转木纹方向。衬纸复用牛皮纸图片，内背板采用细织纹与内凹阴影，外框采用接触阴影和柔和投影。材质处理不改变框内尺寸与奖牌缩放规则。
