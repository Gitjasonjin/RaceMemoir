# 模块维护指南

源码按业务职责组织，`main.tsx` 只负责挂载应用与加载样式。

| 模块 | 职责与主要入口 |
| --- | --- |
| `src/app` | 页面组装及跨模块操作；`App.tsx` 协调选中、拖拽、编辑和导入，`Topbar.tsx`、`BoardDialog.tsx` 管理顶部栏与弹窗 |
| `src/domain` | 物件、收藏记录、校验、样式目录与示例数据；不依赖 React、DOM 或浏览器存储 |
| `src/board` | 画布几何、框选、连线与照片绳排列；`useBoardHistory.ts` 管理撤销历史，`useCanvasCamera.ts` 管理视口与缩放 |
| `src/items` | 按照片、奖牌、路线、赛事地图、号码布和便签分别维护渲染、取景/抠图辅助与样式；`Artwork.tsx` 只分发物件类型 |
| `src/appearance` | 图钉、胶带、连接绳等装饰控件与渲染 |
| `src/library` | 收藏库列表、筛选、编辑、回收站及记录状态；`RecordPanel.tsx` 组装列表与记录编辑，`MemoryEditor.tsx` 编辑未关联记录的物件 |
| `src/race-map` | 离线赛事地图、地点编辑、地点聚合与收藏跳转；本地底图在 `src/assets/maps`，详见 [赛事地图说明](offline-race-map.md) |
| `src/persistence` | 本地读写、自动保存、备份恢复和导出；`boardStore.ts` 读取布局，`recordStore.ts` 保存文件，`zipArchive.ts` 处理备份，`exportImage.ts` 生成 PNG |
| `src/shared` | 通用小组件、资源 URL hook 与基础样式；仅放入没有业务归属的复用代码 |

## 依赖约定

- 领域数据和纯计算优先放在 `domain`、`board` 或对应物件目录；浏览器副作用留在 hook、组件和 `persistence`。
- 物件子模块不反向依赖 `App`、收藏库面板或 `Artwork` 分发器。跨模块操作通过参数、回调协调，不通过互相导入页面组件实现。
- 收藏记录保存内容，画布物件保存位置、尺寸、取景和外观。同一份记录可以被多个画布物件引用。
- 同时影响收藏库、画布和撤销历史的操作由 `App` 协调，例如彻底删除记录时清理相关历史快照。
- 保留明确的文件导入路径，不用集中转发文件掩盖依赖方向。

## 常见修改入口

- 新增相纸、展示框或背景：先修改 `domain/styleCatalog.ts`，再修改对应物件或装饰模块，参见[样式扩展约定](style-extension.md)。
- 调整照片取景：`items/photo/PhotoCropPreview.tsx`、`photoCrop.ts`；奖牌抠图：`items/medal/useCutout.ts` 与相邻 worker。
- 修改画布缩放或历史策略：`board/useCanvasCamera.ts`、`useBoardHistory.ts`。选中与拖拽的联动仍在 `app/App.tsx`，避免将一套手势状态拆散。
- 修改收藏筛选或回收站：`library/LibraryRecords.tsx`；上传与内容编辑：`library/RecordEditor.tsx`。
- 修改备份或 PNG：`persistence/zipArchive.ts`、`recordArchive.ts`、`exportImage.ts`。PNG 导出保留 SVG 样式、伪元素资源和离屏定位的兼容处理。

- 修改地图地点连线：`board/threadEndpoints.ts` 统一解析地点投影、取景、尺寸与旋转后的端点；画布、预览线、缩略图和导出边界复用同一结果。

## 样式与验证

CSS 跟随功能归属存放，由 `app/styles.css` 显式按顺序加载。调整顺序会影响层叠覆盖；新增规则应放在所属模块，并检查桌面、窄屏和导出效果。

`tests` 继续集中存放纯逻辑与存储测试，直接导入模块文件；Node 的类型剥离运行方式要求测试引用保留 `.ts` 扩展名。改动后运行 `npm test` 和 `npm run build`；组件或手势改动还需检查浏览器中的编辑、撤销与导出流程。

本次目录整理不修改本地存储键、记录 ID 或备份格式。涉及这些字段的后续改动应同时维护旧数据兼容逻辑与备份测试。
