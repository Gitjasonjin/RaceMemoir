# 内置纪念地图

`china-provinces.simplified.json` 是 GeoJSON FeatureCollection，以 `.json` 扩展名参与 Vite 构建。包含 34 个区域，文件约 152 KB；运行时不访问地图服务器。

## 来源与许可

底图来自 **Natural Earth 1:50m** 数据，属于 Public Domain，可随应用本地分发。地图与导出图片保留 `Natural Earth` 来源标注。

- [许可说明](https://www.naturalearthdata.com/about/terms-of-use/)
- [Admin 1 – States, provinces](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-1-states-provinces/)
- [Admin 1 原始 GeoJSON](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_1_states_provinces.geojson)
- [Admin 0 原始 GeoJSON](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson)

获取日期：2026-09-15。Natural Earth 的边界为其数据集采用的表达，本应用将其用于区域级纪念示意，不额外重绘边界。

## 本地处理

1. 从 Admin 1 中提取 `adm0_a3 = CHN` 的 31 个省级区域。
2. 从 Admin 0 中提取 `ADM0_A3 = TWN / HKG / MAC` 的台湾、香港、澳门几何区域。
3. 保留原始 Polygon / MultiPolygon 拓扑与环方向，坐标保留四位小数。原始 1:50m 数据已经概化，不再逐点抽样。
4. 属性仅保留稳定的本地 `id` 与中文 `name`，移除其他属性。

下载源文件的 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| Admin 1 | `69a0e06e640b2d505858ae1cb63034e4677f3000b35a98e16312932b98c426b9` |
| Admin 0 | `3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb` |

更新底图时检查投影测试、地点定位、屏幕与 PNG 显示。应用自带底图不重复放进每个用户备份。


## 地形阴影

`china-terrain.webp` 来自 [Natural Earth 1:50m Shaded Relief](https://www.naturalearthdata.com/downloads/50m-raster-data/50m-shaded-relief/)，SR_50M v3.2.0，公共领域。源文件：https://naciscdn.org/naturalearth/50m/raster/SR_50M.zip 。

使用 `scripts/build-map-terrain.py` 将全球等距经纬度栅格按应用 Mercator 投影重采样为 2000 × 1400 WebP，并调整为低饱和灰绿色。需要 Python、Pillow、NumPy 及项目 Node 依赖；传入解压的 SR_50M.tif 路径即可重建。投影来自 `mapGeometry`，如投影变化需重新生成。

地形只用于视觉参考，不表示精确高程。SVG 按现有省域裁切并叠加边界、标签和地点；资源内嵌供离线显示及 PNG 导出，不请求在线地图。
