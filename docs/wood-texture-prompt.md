# 深色木板背景生成记录

- 来源：OpenAI 内置 `image_gen` 工具，AI 生成的写实木材纹理，并非真实摄影或图库照片。
- 生成日期：2026-09-17。
- 原始文件：`C:/Users/hj/.codex/generated_images/01a0ad65-376f-77c0-87e5-39070cfeb116/exec-614ace5c-ac64-45f4-a234-9e988e72369b.png`。
- 最终资产：`public/textures/dark-wood-photo.webp`。
- 实际分辨率：1254 × 1254 px；提示中请求约 1024 × 1024，工具返回以上原始尺寸，已保留。
- 转码：Pillow 仅将 PNG 转为 WebP，quality=92、method=6；未裁剪、缩放、调色或合成。
- CSS 建议：`background-repeat: repeat; background-size: 1024px 1024px;`，可按产品预览调节 tileSize。
- 图像检查：横向真实木质纤维、自然板缝、低饱和暖深棕、均匀哑光，无文字、边框和透视。提示要求双轴无缝平铺；最终页面仍应检查实际重复时边缘接续观感。

## 完整生成 Prompt

```text
Use case: photorealistic-natural
Asset type: seamless repeating raster material texture for a website background
Primary request: A single square 1024x1024 photorealistic dark walnut wood board surface texture, tightly framed edge to edge with no surrounding objects.
Style/medium: AI-generated photographic material scan appearance, real wood grain structure rather than abstract procedural noise.
Composition/framing: Orthographic straight-down view of a completely flat surface; horizontal fine wood grain running continuously left to right. A few subtle natural horizontal plank seams, with modest variation in plank widths; no prominent end joints.
Lighting/mood: Perfectly even diffuse neutral lighting across the whole tile; matte finish; no glare, highlights, vignette, shadows, or directional illumination.
Color palette: Low-saturation warm dark brown walnut, rich but restrained, modest tonal variations, enough visible fine grain to recognize real wood.
Materials/textures: Natural fine walnut fibers, delicate pores, understated flowing grain; only very faint occasional knots and no large distinctive knots.
Constraints: Seamlessly tileable in BOTH X and Y directions; the left edge must continue naturally into the right edge, and the top into the bottom. No borders, no frame, no text, no logos, no watermark, no perspective. No strong repeated knot patterns, no glossy varnish, no weathering, no scratches, no nails. Produce only the material texture.
```

