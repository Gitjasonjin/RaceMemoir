# 奖牌框材质

生成日期：2026-09-24。使用 OpenAI 内置 `image_gen` 生成写实材质，并非实拍照片。两张原图均为 1254 × 1254；仅转换为 WebP（quality=85、method=6），未缩放、调色或裁剪。

| 资产 | 用途 | 大小 |
| --- | --- | --- |
| [frame-oak.webp](../public/textures/frame-oak.webp) | 原木框的横向浅橡木纹 | 244,132 B |
| [frame-linen.webp](../public/textures/frame-linen.webp) | 原木框、黑框共用的织物纹理底图，去色并叠加哑光黑色涂层后呈现 | 419,718 B |

黑框继续使用已有深木纹贴图，叠加炭黑色涂层。框边的高光、内缘暗部与拼接缝由 CSS 绘制，不烘焙到素材中。左右木条将木纹旋转 90°，各边错开取样，避免接缝处木纹连续穿过。

背板使用哑光黑色织物：纹理以 `luminosity` 混合到中性黑色底层，消除原始贴图的绿色，再叠加轻微的黑色明暗渐变（#27272799 → #101010b3）。纹理以 180 px 平铺，保留细微纤维与内缘阴影。混合仅作用于背板背景，不改变奖牌图片的颜色；无需新增贴图文件。

框边为 13 px，内侧卡纸为 7 px，加上两层各 1 px 的边框，内容仍向内缩进 22 px，与 `exhibitCells` 的坐标约定保持一致。单框、多奖牌框和侧栏预览共用渲染；挂钩模式不添加框边和织物。图片放在普通元素的 CSS 背景中，确保高清导出能内嵌文件。

## 浅橡木生成提示

```text
Use case: photorealistic-natural. Asset type: production seamless texture tile for a real solid-oak picture-frame moulding in a web app. Generate one square 1024x1024 seamless albedo/material texture, true overhead macro photography of finely sanded light natural European oak, warm neutral beige and muted honey tan, very fine long flowing narrow wood pores and subtly irregular fibers running strictly HORIZONTALLY left to right. Close-set quarter-sawn wood grain, subtle natural tonal variation, occasional tiny narrow medullary flecks, hand-finished matte wax. This is a single continuous wood surface filling every pixel, NOT a picture of a frame, NOT planks, no joints, no knots, no panels, no objects, no text, no border, no vignette. Even diffuse neutral lighting, no directional highlights, no shadows, no perspective, no gradients from dark to light across the image. Low to moderate contrast, grain clearly visible at small UI scale without looking distressed. No orange varnish, no shiny gold look. Seamless repeat left-right and top-bottom. High-frequency genuine photographic wood fibers, not vector lines or illustration. Intended as the raw unlit color material for 13-pixel wide beveled frame rails; illumination and bevels will be applied in CSS.
```

## 织物生成提示

```text
Use case: photorealistic-natural. Asset type: production seamless woven fabric texture tile for the deep recessed back of a premium medal shadow box in a web app. Generate one square 1024x1024 seamless texture, perfect overhead macro photography of tightly woven dark charcoal-green linen book cloth, nearly black forest green base approximately #24322b. Visible fine interlaced soft matte linen fibers, warp and weft have subtle irregular yarn thickness, tiny fiber fuzz, very small natural knots, close dense weave. Realistic fine fabric, not a large grid, not burlap, not shiny synthetic canvas, no visible diagonal folds, no creases. Even diffuse neutral lighting, flat surface all the way to every edge, no perspective, no objects, no text, no frame, no shadows, no illumination hotspots or vignette. Restrained 10-15% tonal variation around the dark base, enough fine fiber relief to see at close zoom yet calm and dark at thumbnail size. Tile seamlessly on all four sides. Real material photography, not an illustration, no procedural checkerboard appearance.
```
