<p align="center">
  <img src="docs/images/readme-banner.png" alt="山径线索板 · RaceMemoir — 用照片、奖牌、号码布与红线串联山野记忆" width="100%" />
</p>

<p align="center">
  <a href="https://app.racememoir.com"><img alt="在线体验 RaceMemoir" src="https://img.shields.io/badge/在线体验-RaceMemoir-F38020?logo=cloudflare&logoColor=white" /></a>
  <img alt="React" src="https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" />
  <img alt="Version 0.0.1" src="https://img.shields.io/badge/version-0.0.5-6B7D53" />
  <a href="LICENSE"><img alt="License: AGPL v3" src="https://img.shields.io/badge/License-AGPL_v3-blue" /></a>
</p>

<p align="center">简体中文 · <a href="README.en.md">English</a></p>

山径线索板是一款记录赛事与山野旅程的 Web 数字收藏板。

将真实奖牌装入展示框、照片用大头钉固定、号码布用胶带贴住，把 GPX 轨迹变成路线卡，在无限画布上用红线串联每段记忆。

---

![山径线索板页面截图](docs/images/board.png)

<div align="center">发挥你的创意，请随意摆放！</div>
<div></div>

![贴纸配置页面截图](docs/images/sticker.png)

<div align="center">自由配置物件，不再受限。</div>
<div></div>

![分享页面截图](docs/images/share.png)

## 特色
- 🖼️虚拟展示墙，不受实体世界的限制
- 🎖️多种物件随心摆放，简约整洁还是随意杂乱有你决定
- 😊纯前端实现，轻松部署，数据保留在本地

## 功能

- ✅ 收藏奖牌、照片、号码布、便签、贴纸与路线卡。
- ✅ 上传图片自动制作轮廓贴纸，自由调整白边和大小，保存到收藏库重复使用。
- ✅ 上传照片（支持批量导入）、奖牌与真实号码布，支持奖牌抠图、号码布裁切和透视校正，导入 GPX 展示赛事路线。
- ✅ 无限画布自由排布，支持分组、锁定、对齐分布、吸附辅助线与撤销重做。
- ✅ 支持手机触屏：双指缩放与平移、长按多选，照片和地图可直接用手势调整取景。
- ✅ 自定义相纸、展示框与装饰，用可调弧度的红线串联记忆。
- ✅ 多块奖牌合并为 1×2、1×4 或 2×4 展览框，支持调整顺序与拆分。
- ✅ 收藏库统一管理与复用，本地自动保存。
- ✅ 地图作为纸质物件融入画布，用红圈和图钉标记赛事地点、连接藏品。
- ✅ 导出高清图片与 ZIP 完整备份，支持恢复及旧版 JSON 导入。



## 运行

基础交互使用 [Base UI](https://base-ui.com/)：弹窗、菜单、提示与开关共用键盘操作、焦点管理及浮层定位。

需要 Node.js 22.18+（推荐 Node.js 24）。

```bash
npm install
npm run dev
```

打开 [http://localhost:5173](http://localhost:5173)。

```bash
npm run build      # TypeScript 检查与生产构建
npm run preview    # 预览生产构建
npm test           # 运行测试
```

## 开源许可

本项目原创代码采用 [GNU AGPL v3.0](LICENSE)（`AGPL-3.0-only`）许可。第三方依赖、地图数据及素材遵循各自的许可证。
